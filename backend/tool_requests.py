from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, case
from db import get_db
from models import ToolRequest, ToolsList, ToolIssue
from schemas import (
    ToolRequestCreate, ToolRequestResponse,
    ToolRequestApprove
)
from typing import List, Optional
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import uuid

from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/tool-requests", response_model=ToolRequestResponse)
def create_tool_request(request: ToolRequestCreate, db: Session = Depends(get_db)):
    try:
        # Generate unique request ID
        unique_request_id = str(uuid.uuid4())

        # Create tool request record
        request_dict = request.dict()
        request_dict["unique_request_id"] = unique_request_id
        db_request = ToolRequest(**request_dict)
        db.add(db_request)

        db.commit()
        db.refresh(db_request)
        return db_request
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-requests/all", response_model=List[ToolRequestResponse])
def get_all_requests(
    status: str = None,
    collected: str = None,
    returned: str = None,
    db: Session = Depends(get_db)
):
    """Get all requests with optional filters"""
    try:
        query = db.query(ToolRequest)

        if status:
            query = query.filter(ToolRequest.status == status)
        if collected:
            query = query.filter(ToolRequest.collected == collected)
        if returned:
            query = query.filter(ToolRequest.returned == returned)

        return query.order_by(ToolRequest.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-requests/operator/{operator_id}", response_model=List[ToolRequestResponse])
def get_operator_requests(
    operator_id: str,
    status: str = None,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """Get requests for a specific operator"""
    try:
        query = db.query(ToolRequest).filter(ToolRequest.operator_id == operator_id)
        
        if status:
            query = query.filter(ToolRequest.status == status)
        
        if active_only:
            # For in-use tools: approved, collected but not returned
            query = query.filter(
                and_(
                    ToolRequest.status == "approved",
                    ToolRequest.collected == "yes",
                    ToolRequest.returned == "no"
                )
            )
            
        return query.order_by(ToolRequest.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add new endpoint for getting all requests with filters
@router.get("/tool-requests", response_model=List[ToolRequestResponse])
def get_requests(
    operator_id: str = None,
    status: str = None,
    collected: str = None,
    returned: str = None,
    db: Session = Depends(get_db)
):
    """Get all requests with optional filters"""
    try:
        # Start with base query
        query = db.query(ToolRequest)
        
        # Add filters
        if operator_id:
            query = query.filter(ToolRequest.operator_id == operator_id)
        if status:
            query = query.filter(ToolRequest.status == status)
        if collected:
            query = query.filter(ToolRequest.collected == collected)
        if returned:
            query = query.filter(ToolRequest.returned == returned)
            
        # Get all requests
        requests = query.order_by(ToolRequest.request_date.desc()).all()
        
        # For each request, check if there's an active issue
        for request in requests:
            # Check for active issues using unique_request_id
            active_issue = db.query(ToolIssue).filter(
                and_(
                    ToolIssue.unique_request_id == request.unique_request_id,
                    or_(
                        ToolIssue.officer_status == "approved",
                        and_(
                            ToolIssue.officer_status == "pending",
                            ToolIssue.supervisor_status.in_(["pending", "approved"])
                        )
                    )
                )
            ).first()
            
            # If there's an active issue, update the returned status
            if active_issue:
                # Update the request in the database
                request.returned = "issue"
                db.add(request)
                db.commit()
        
        # Refresh the query to get updated data
        requests = query.order_by(ToolRequest.request_date.desc()).all()
        return requests
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tool-requests/{request_id}/approve", response_model=ToolRequestResponse)
def approve_request(request_id: int, approve_data: ToolRequestApprove, db: Session = Depends(get_db)):
    try:
        db_request = db.query(ToolRequest).filter(ToolRequest.id == request_id).first()
        if not db_request:
            raise HTTPException(status_code=404, detail="Request not found")

        db_request.status = approve_data.status
        db_request.supervisor_id = approve_data.supervisor_id
        db_request.supervisor_name = approve_data.supervisor_name
        db_request.response_date = datetime.now()

        db.commit()
        return db_request
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tool-requests/{request_id}/collect", response_model=ToolRequestResponse)
def collect_tool(request_id: int, db: Session = Depends(get_db)):
    try:
        db_request = db.query(ToolRequest).filter(ToolRequest.id == request_id).first()
        if not db_request:
            raise HTTPException(status_code=404, detail="Request not found")

        if db_request.status != "approved":
            raise HTTPException(status_code=400, detail="Request must be approved before collecting")

        if db_request.collected == "yes":
            raise HTTPException(status_code=400, detail="Tool has already been collected")

        db_request.collected = "yes"
        db_request.collection_date = datetime.now()
        
        # Update tool quantity and status
        tool = db.query(ToolsList).filter(ToolsList.Sl_no == db_request.tool_sl_no).first()
        if tool:
            if tool.Quantity > 0:
                tool.Quantity -= 1
                # Update status based on new quantity
                tool.status = "available" if tool.Quantity > 0 else "Not Available"
            else:
                raise HTTPException(status_code=400, detail="Tool is not available")

        db.commit()
        db.refresh(db_request)
        return db_request
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-requests/pending", response_model=List[ToolRequestResponse])
def get_pending_requests(db: Session = Depends(get_db)):
    """Get all pending requests"""
    try:
        return db.query(ToolRequest).filter(
            ToolRequest.status == "pending"
        ).order_by(ToolRequest.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-requests/active", response_model=List[ToolRequestResponse])
def get_active_requests(db: Session = Depends(get_db)):
    """Get all active requests (collected but not returned)"""
    try:
        return db.query(ToolRequest).filter(
            and_(
                ToolRequest.collected == "yes",
                ToolRequest.returned == "no"
            )
        ).order_by(ToolRequest.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-requests/supervisor/{supervisor_id}", response_model=List[ToolRequestResponse])
def get_supervisor_requests(
    supervisor_id: str,
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get requests handled by a specific supervisor"""
    try:
        query = db.query(ToolRequest).filter(ToolRequest.supervisor_id == supervisor_id)
        
        if status:
            query = query.filter(ToolRequest.status == status)
            
        return query.order_by(ToolRequest.request_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

