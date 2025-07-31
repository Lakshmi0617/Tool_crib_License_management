from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from db import get_db
from models import NewToolRequest, ToolsList
from schemas import NewToolRequestCreate, NewToolRequestResponse, NewToolRequestApproval
from typing import List
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/new-tool-requests", response_model=NewToolRequestResponse)
def create_new_tool_request(request: NewToolRequestCreate, db: Session = Depends(get_db)):
    try:
        # Create new tool request with only the fields from the request
        db_request = NewToolRequest(
            Item_Description=request.Item_Description,
            Range_in_mm=request.Range_in_mm,
            Identification_Code=request.Identification_Code,
            Make=request.Make,
            Quantity=request.Quantity,
            Location=request.Location,
            Gauge=request.Gauge,
            Remarks=request.Remarks,
            supervisor_id=request.supervisor_id,
            supervisor_name=request.supervisor_name,
            project_details=request.project_details,
            project_number=request.project_number,
            status="pending"
        )
        db.add(db_request)
        db.commit()
        db.refresh(db_request)
        return db_request
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating new tool request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/new-tool-requests/pending", response_model=List[NewToolRequestResponse])
def get_pending_tool_requests(db: Session = Depends(get_db)):
    try:
        return db.query(NewToolRequest).filter(
            NewToolRequest.status.in_(["pending", "rejected"])
        ).order_by(NewToolRequest.request_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching pending tool requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/new-tool-requests/supervisor/{supervisor_id}", response_model=List[NewToolRequestResponse])
def get_supervisor_tool_requests(supervisor_id: str, db: Session = Depends(get_db)):
    try:
        requests = db.query(NewToolRequest).filter(
            NewToolRequest.supervisor_id == supervisor_id
        ).order_by(NewToolRequest.request_date.desc()).all()
        
        if not requests:
            return []  # Return empty list instead of None
            
        return requests
    except SQLAlchemyError as e:
        logger.error(f"Error fetching supervisor tool requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/new-tool-requests/{request_id}/approve", response_model=NewToolRequestResponse)
def approve_new_tool_request(request_id: int, approval: NewToolRequestApproval, db: Session = Depends(get_db)):
    try:
        tool_request = db.query(NewToolRequest).filter(NewToolRequest.id == request_id).first()
        if not tool_request:
            raise HTTPException(status_code=404, detail="Tool request not found")

        # Update the tool request with officer's decision
        tool_request.status = approval.status
        tool_request.officer_id = approval.officer_id
        tool_request.officer_name = approval.officer_name
        tool_request.response_date = datetime.now()

        # If approved, create or update tool in the tools list
        if approval.status == "approved":
            # Check if tool with same Item_Description and Range_in_mm exists
            existing_tool = db.query(ToolsList).filter(
                ToolsList.Item_Description == tool_request.Item_Description,
                ToolsList.Range_in_mm == tool_request.Range_in_mm
            ).first()

            if existing_tool:
                # Update existing tool
                existing_tool.Quantity += tool_request.Quantity
                # Update other fields if provided
                if tool_request.Make:
                    existing_tool.Make = tool_request.Make
                if tool_request.Location:
                    existing_tool.Location = tool_request.Location
                if tool_request.Identification_Code:
                    existing_tool.Identification_Code = tool_request.Identification_Code
                if tool_request.Gauge:
                    existing_tool.Gauge = tool_request.Gauge
                if tool_request.Remarks:
                    existing_tool.Remarks = tool_request.Remarks
                
                # Update status based on quantity
                if existing_tool.Quantity > 0:
                    existing_tool.status = "available"
                else:
                    existing_tool.status = "not_available"
            else:
                # Create new tool
                new_tool = ToolsList(
                    Item_Description=tool_request.Item_Description,
                    Range_in_mm=tool_request.Range_in_mm,
                    Identification_Code=tool_request.Identification_Code,
                    Make=tool_request.Make,
                    Quantity=tool_request.Quantity,
                    Location=tool_request.Location,
                    Gauge=tool_request.Gauge,
                    Remarks=tool_request.Remarks,
                    status="available"
                )
                db.add(new_tool)

        db.commit()
        db.refresh(tool_request)
        return tool_request
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error approving tool request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/new-tool-requests/{request_id}/reject", response_model=NewToolRequestResponse)
def reject_new_tool_request(request_id: int, approval: NewToolRequestApproval, db: Session = Depends(get_db)):
    try:
        tool_request = db.query(NewToolRequest).filter(NewToolRequest.id == request_id).first()
        if not tool_request:
            raise HTTPException(status_code=404, detail="Tool request not found")

        # Update the tool request with officer's decision
        tool_request.status = "rejected"
        tool_request.officer_id = approval.officer_id
        tool_request.officer_name = approval.officer_name
        tool_request.response_date = datetime.now()

        db.commit()
        db.refresh(tool_request)
        return tool_request
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error rejecting tool request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/new-tool-requests/all-requests", response_model=List[NewToolRequestResponse])
def get_all_tool_requests_with_status(db: Session = Depends(get_db)):
    try:
        return db.query(NewToolRequest).filter(
            NewToolRequest.status.in_(["pending", "approved", "rejected"])
        ).order_by(NewToolRequest.request_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching all tool requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))