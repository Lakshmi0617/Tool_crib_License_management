from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from db import SessionLocal
from models import ToolsList
from schemas import ToolsListCreate, ToolsList as ToolsListSchema, ToolsListUpdate
from sqlalchemy.exc import SQLAlchemyError
from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def update_status_based_on_quantity(tool_obj):
    """Helper function to update status based on quantity"""
    if tool_obj.Quantity > 0:
        tool_obj.status = "available"
    else:
        tool_obj.status = "not_available"
    return tool_obj


@router.post("/tools", response_model=ToolsListSchema, tags=["Tools"])
def create_tool(tool: ToolsListCreate, db: Session = Depends(get_db)):
    """Create a new tool entry or update existing one"""
    try:
        tool_data = tool.dict(exclude_unset=True)

        # First check if exact tool exists (same Item_Description and Range_in_mm)
        existing_tool = db.query(ToolsList).filter(
            ToolsList.Item_Description == tool_data["Item_Description"],
            ToolsList.Range_in_mm == tool_data["Range_in_mm"]
        ).first()

        if existing_tool:
            # Update existing tool's quantity
            existing_tool.Quantity += tool_data.get("Quantity", 0)
            # Update other fields if provided
            if tool_data.get("Make"):
                existing_tool.Make = tool_data["Make"]
            if tool_data.get("Location"):
                existing_tool.Location = tool_data["Location"]
            if tool_data.get("Identification_Code"):
                existing_tool.Identification_Code = tool_data["Identification_Code"]
            if tool_data.get("Gauge"):
                existing_tool.Gauge = tool_data["Gauge"]
            if tool_data.get("Remarks"):
                existing_tool.Remarks = tool_data["Remarks"]
            
            # Update status based on quantity
            existing_tool = update_status_based_on_quantity(existing_tool)
            db.commit()
            db.refresh(existing_tool)
            return existing_tool
        else:
            # Find similar tools with same Item_Description
            similar_tools = db.query(ToolsList).filter(
                ToolsList.Item_Description == tool_data["Item_Description"]
            ).order_by(ToolsList.Range_in_mm.asc(), ToolsList.Sl_no.asc()).all()

            # If similar tools exist, insert new tool in the correct position
            if similar_tools:
                # Find the position where this tool should be inserted based on Range_in_mm
                insert_position = None
                for i, similar_tool in enumerate(similar_tools):
                    if tool_data["Range_in_mm"] < similar_tool.Range_in_mm:
                        insert_position = similar_tool.Sl_no
                        break
                
                if insert_position is None:
                    # If no smaller Range_in_mm found, insert after the last similar tool
                    insert_position = similar_tools[-1].Sl_no + 1

                # Get all tools from insert position onwards
                later_tools = db.query(ToolsList).filter(
                    ToolsList.Sl_no >= insert_position
                ).order_by(ToolsList.Sl_no.asc()).all()

                # Shift Sl_no of later tools
                for later_tool in later_tools:
                    later_tool.Sl_no += 1

                # Create new tool with the calculated Sl_no
                db_tool = ToolsList(**tool_data, Sl_no=insert_position)
            else:
                # Find the first tool that comes alphabetically after this Item_Description
                next_tool = db.query(ToolsList).filter(
                    ToolsList.Item_Description > tool_data["Item_Description"]
                ).order_by(ToolsList.Item_Description.asc()).first()

                if next_tool:
                    # Get all tools from this point
                    later_tools = db.query(ToolsList).filter(
                        ToolsList.Sl_no >= next_tool.Sl_no
                    ).order_by(ToolsList.Sl_no.asc()).all()

                    # Insert before the next tool
                    new_sl_no = next_tool.Sl_no

                    # Shift all later tools
                    for later_tool in later_tools:
                        later_tool.Sl_no += 1

                    # Create new tool with the calculated Sl_no
                    db_tool = ToolsList(**tool_data, Sl_no=new_sl_no)
                else:
                    # If no tool comes after alphabetically, add at the end
                    db_tool = ToolsList(**tool_data)

            # Update status based on quantity
            db_tool = update_status_based_on_quantity(db_tool)

            db.add(db_tool)
            db.commit()
            db.refresh(db_tool)
            return db_tool
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools", response_model=List[ToolsListSchema], tags=["Tools"])
def get_all_tools(db: Session = Depends(get_db)):
    """Get all tools with updated status based on current quantity"""
    try:
        tools = db.query(ToolsList).order_by(ToolsList.Sl_no.asc()).all()
        if not tools:
            return []

        # Update status for all tools based on current quantity
        for tool in tools:
            old_status = tool.status
            tool = update_status_based_on_quantity(tool)
            # Only commit if status changed
            if old_status != tool.status:
                db.commit()

        return tools
    except SQLAlchemyError as e:
        return JSONResponse(
            status_code=500,
            content={"message": "Database error", "detail": str(e)}
        )


@router.get("/tools/{sl_no}", response_model=ToolsListSchema, tags=["Tools"])
def get_tool(sl_no: int, db: Session = Depends(get_db)):
    """Get a specific tool by sl_no with updated status"""
    try:
        tool = db.query(ToolsList).filter(ToolsList.Sl_no == sl_no).first()
        if tool is None:
            raise HTTPException(status_code=404, detail="Tool not found")

        # Update status based on current quantity
        old_status = tool.status
        tool = update_status_based_on_quantity(tool)
        if old_status != tool.status:
            db.commit()
            db.refresh(tool)

        return tool
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tools/{sl_no}", response_model=ToolsListSchema, tags=["Tools"])
def update_tool(sl_no: int, tool_update: ToolsListUpdate, db: Session = Depends(get_db)):
    """Update a tool's details"""
    try:
        db_tool = db.query(ToolsList).filter(ToolsList.Sl_no == sl_no).first()
        if db_tool is None:
            raise HTTPException(status_code=404, detail="Tool not found")

        update_data = tool_update.dict(exclude_unset=True)

        # First update all fields
        for key, value in update_data.items():
            setattr(db_tool, key, value)

        # Then explicitly update status based on quantity
        if db_tool.Quantity > 0:
            db_tool.status = "available"
        else:
            db_tool.status = "not_available"

        db.commit()
        db.refresh(db_tool)
        return db_tool
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tools/{sl_no}", tags=["Tools"])
def delete_tool(sl_no: int, db: Session = Depends(get_db)):
    """Delete a tool"""
    try:
        db_tool = db.query(ToolsList).filter(ToolsList.Sl_no == sl_no).first()
        if db_tool is None:
            raise HTTPException(status_code=404, detail="Tool not found")

        db.delete(db_tool)
        db.commit()
        return {"message": "Tool deleted successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tools/{sl_no}/status", response_model=ToolsListSchema, tags=["Tools"])
def update_tool_status(sl_no: int, status: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """
    Update the status of a tool - but status will be determined by quantity
    """
    try:
        db_tool = db.query(ToolsList).filter(ToolsList.Sl_no == sl_no).first()
        if db_tool is None:
            raise HTTPException(status_code=404, detail="Tool not found")

        # Status should always be based on quantity, ignore the input status
        db_tool = update_status_based_on_quantity(db_tool)

        db.commit()
        db.refresh(db_tool)
        return db_tool
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Add a new endpoint to sync all tools' status
@router.post("/tools/sync-status", tags=["Tools"])
def sync_all_tools_status(db: Session = Depends(get_db)):
    """
    Sync status for all tools based on their current quantity
    """
    try:
        tools = db.query(ToolsList).all()
        updated_count = 0

        for tool in tools:
            old_status = tool.status
            tool = update_status_based_on_quantity(tool)
            if old_status != tool.status:
                updated_count += 1

        db.commit()
        return {"message": f"Successfully synced status for {updated_count} tools"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))