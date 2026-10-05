from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from db import get_db
from models import ToolsReturned, ToolsList, ToolRequest
from schemas import ToolsReturnedCreate, ToolsReturnedResponse
from typing import List
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/tool-returns", response_model=ToolsReturnedResponse)
def create_tool_return(return_data: ToolsReturnedCreate, db: Session = Depends(get_db)):
    try:
        # Get the original tool request using both tool_sl_no and unique_request_id
        tool_request = db.query(ToolRequest).filter(
            and_(
                ToolRequest.tool_sl_no == return_data.tool_sl_no,
                ToolRequest.operator_id == return_data.operator_id,
                ToolRequest.unique_request_id == return_data.unique_request_id,  # Add this line
                ToolRequest.collected == "yes",
                ToolRequest.returned == "no"
            )
        ).first()

        if not tool_request:
            raise HTTPException(
                status_code=400,
                detail="No active tool request found for this specific tool request."
            )

        # Create the return record with the same unique_request_id
        db_return = ToolsReturned(**return_data.dict())
        db_return.unique_request_id = tool_request.unique_request_id
        db_return.request_id = tool_request.id
        db.add(db_return)

        # Update the tool request status
        tool_request.returned = "yes"

        db.commit()
        db.refresh(db_return)
        return db_return
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# GET Endpoints

@router.get("/tool-returns/all", response_model=List[ToolsReturnedResponse])
def get_all_returns(
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get all returns with optional status filter"""
    try:
        query = db.query(ToolsReturned)
        
        if status:
            query = query.filter(ToolsReturned.status == status)
            
        return query.order_by(ToolsReturned.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-returns/operator/{operator_id}", response_model=List[ToolsReturnedResponse])
def get_operator_returns(
    operator_id: str,
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get all returns for a specific operator"""
    try:
        query = db.query(ToolsReturned).filter(ToolsReturned.operator_id == operator_id)
        
        if status:
            query = query.filter(ToolsReturned.status == status)
        else:
            # By default, only show collected returns
            query = query.filter(ToolsReturned.status == "collected")
            
        return query.order_by(ToolsReturned.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-returns/supervisor/{supervisor_id}", response_model=List[ToolsReturnedResponse])
def get_supervisor_returns(
    supervisor_id: str,
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get returns handled by a specific supervisor"""
    try:
        query = db.query(ToolsReturned).filter(ToolsReturned.supervisor_id == supervisor_id)
        
        if status:
            query = query.filter(ToolsReturned.status == status)
            
        return query.order_by(ToolsReturned.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-returns/tool/{tool_sl_no}", response_model=List[ToolsReturnedResponse])
def get_tool_returns(
    tool_sl_no: int,
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get returns for a specific tool"""
    try:
        query = db.query(ToolsReturned).filter(ToolsReturned.tool_sl_no == tool_sl_no)
        
        if status:
            query = query.filter(ToolsReturned.status == status)
            
        return query.order_by(ToolsReturned.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-returns/pending", response_model=List[ToolsReturnedResponse])
def get_pending_returns(db: Session = Depends(get_db)):
    """Get all pending returns"""
    try:
        return db.query(ToolsReturned).filter(
            ToolsReturned.status == "pending"
        ).order_by(ToolsReturned.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-returns/collected", response_model=List[ToolsReturnedResponse])
def get_collected_returns(db: Session = Depends(get_db)):
    """Get all collected returns"""
    try:
        return db.query(ToolsReturned).filter(
            ToolsReturned.status == "collected"
        ).order_by(ToolsReturned.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/tool-returns/{return_id}/collect", response_model=ToolsReturnedResponse)
def collect_tool(
    return_id: int,
    supervisor_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Mark a tool return as collected by supervisor"""
    try:
        db_return = db.query(ToolsReturned).filter(ToolsReturned.id == return_id).first()
        if not db_return:
            raise HTTPException(status_code=404, detail="Tool return not found")

        # Update tool return record
        db_return.supervisor_id = supervisor_data.get("supervisor_id")
        db_return.supervisor_name = supervisor_data.get("supervisor_name")
        db_return.status = "collected"
        db_return.collected_date = datetime.now()

        # Find the original tool request
        tool_request = db.query(ToolRequest).filter(
            ToolRequest.id == db_return.request_id
        ).first()

        if tool_request:
            tool_request.returned = "yes"
            db.flush()

        # Update tool quantity and status
        tool = db.query(ToolsList).filter(ToolsList.Sl_no == db_return.tool_sl_no).first()
        if tool:
            tool.Quantity += 1  # Increment quantity when tool is returned
            tool.status = "available"  # Tool will be available since quantity is increased
            db.flush()

        db.commit()
        db.refresh(db_return)
        return db_return
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

