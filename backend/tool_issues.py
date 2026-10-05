from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, and_, or_
from db import get_db
from models import ToolIssue, ToolsList, User, ToolRequest
from schemas import ToolIssueCreate, ToolIssueResponse, ToolIssueApprove
from typing import List
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


@router.post("/tool-issues", response_model=ToolIssueResponse)
def create_tool_issue(issue: ToolIssueCreate, db: Session = Depends(get_db)):
    try:
        # Log incoming request data
        logger.info(f"Received issue report request: {issue.dict()}")

        # Get the specific tool request using unique_request_id
        tool_request = db.query(ToolRequest).filter(
            and_(
                ToolRequest.unique_request_id == issue.unique_request_id,
                ToolRequest.tool_sl_no == issue.tool_sl_no,
                ToolRequest.operator_id == issue.operator_id,
                ToolRequest.collected == "yes",
                ToolRequest.returned == "no"
            )
        ).first()

        if not tool_request:
            logger.error(f"No matching tool request found for unique_request_id: {issue.unique_request_id}")
            raise HTTPException(
                status_code=400,
                detail=f"No active tool request found for unique_request_id: {issue.unique_request_id}"
            )

        # Verify this is the correct tool request
        logger.info(f"Found matching tool request: {tool_request.id} for tool {tool_request.tool_sl_no}")

        # Check if there's already a pending or approved issue for this request
        existing_issue = db.query(ToolIssue).filter(
            ToolIssue.unique_request_id == issue.unique_request_id,
            ToolIssue.officer_status.in_(["pending", "approved"])
        ).first()

        if existing_issue:
            logger.error(f"Existing issue found for request {issue.unique_request_id}: {existing_issue.id}")
            raise HTTPException(
                status_code=400,
                detail="An issue has already been reported for this tool request."
            )

        # Get operator details from User table
        operator = db.query(User).filter(User.employee_id == issue.operator_id).first()
        if operator:
            issue_data = issue.dict()
            issue_data["department"] = operator.department
            issue_data["contact"] = operator.contact
        else:
            issue_data = issue.dict()

        # Verify the unique_request_id matches
        if issue_data["unique_request_id"] != tool_request.unique_request_id:
            logger.error(f"Request ID mismatch: {issue_data['unique_request_id']} != {tool_request.unique_request_id}")
            raise HTTPException(
                status_code=400,
                detail="Request ID mismatch"
            )

        # Add usage details if available
        if not issue_data.get("purpose"):
            issue_data["purpose"] = tool_request.purpose
        if not issue_data.get("project_details"):
            issue_data["project_details"] = tool_request.project_details

        # Ensure we have the required fields
        if not issue_data.get("purpose") or not issue_data.get("project_details"):
            raise HTTPException(
                status_code=400,
                detail="Purpose and project details are required."
            )

        # Set default status values
        issue_data["officer_status"] = "pending"
        issue_data["supervisor_status"] = "pending"

        # Log the issue data before creating
        logger.info(f"Creating new tool issue with data: {issue_data}")

        db_issue = ToolIssue(**issue_data)
        db.add(db_issue)

        db.commit()
        db.refresh(db_issue)

        # Log the created issue
        logger.info(f"Successfully created new tool issue with ID: {db_issue.id}")

        return db_issue
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating tool issue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error creating tool issue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# GET Endpoints

@router.get("/tool-issues/all", response_model=List[ToolIssueResponse])
def get_all_issues(db: Session = Depends(get_db)):
    """Get all issues with optional filtering"""
    try:
        return db.query(ToolIssue).order_by(ToolIssue.report_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching all issues: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tool-issues/{operator_id}", response_model=List[ToolIssueResponse])
def get_operator_issues(
        operator_id: str,
        officer_status: str = None,
        supervisor_status: str = None,
        db: Session = Depends(get_db)
):
    """Get issues for a specific operator with optional status filters"""
    try:
        query = db.query(ToolIssue).filter(ToolIssue.operator_id == operator_id)

        if officer_status:
            query = query.filter(ToolIssue.officer_status == officer_status)
        else:
            # By default, only show approved issues
            query = query.filter(ToolIssue.officer_status == "approved")

        if supervisor_status:
            query = query.filter(ToolIssue.supervisor_status == supervisor_status)

        return query.order_by(ToolIssue.report_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching operator issues: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tool-issues/tool/{tool_sl_no}", response_model=List[ToolIssueResponse])
def get_tool_issues(
        tool_sl_no: int,
        active_only: bool = False,
        db: Session = Depends(get_db)
):
    """Get issues for a specific tool with option to get only active issues"""
    try:
        query = db.query(ToolIssue).filter(ToolIssue.tool_sl_no == tool_sl_no)

        if active_only:
            query = query.filter(
                ToolIssue.officer_status.in_(["pending", "approved"]),
                ToolIssue.supervisor_status.in_(["pending", "approved"])
            )

        return query.order_by(ToolIssue.report_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching tool issues: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tool-issues/pending", response_model=List[ToolIssueResponse])
def get_pending_issues(role: str = None, db: Session = Depends(get_db)):
    """Get pending issues based on role (officer or supervisor)"""
    try:
        if role == "officer":
            return db.query(ToolIssue).filter(
                ToolIssue.officer_status == "pending"
            ).order_by(ToolIssue.report_date.desc()).all()
        elif role == "supervisor":
            return db.query(ToolIssue).filter(
                ToolIssue.officer_status == "approved",
                ToolIssue.supervisor_status == "pending"
            ).order_by(ToolIssue.report_date.desc()).all()
        else:
            return db.query(ToolIssue).filter(
                ToolIssue.officer_status.in_(["pending", "approved"]),
                ToolIssue.supervisor_status == "pending"
            ).order_by(ToolIssue.report_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching pending issues: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tool-issues/approved", response_model=List[ToolIssueResponse])
def get_approved_issues(role: str = None, db: Session = Depends(get_db)):
    """Get approved issues based on role (officer or supervisor)"""
    try:
        if role == "officer":
            return db.query(ToolIssue).filter(
                ToolIssue.officer_status == "approved"
            ).order_by(ToolIssue.report_date.desc()).all()
        elif role == "supervisor":
            return db.query(ToolIssue).filter(
                ToolIssue.supervisor_status == "approved"
            ).order_by(ToolIssue.report_date.desc()).all()
        else:
            return db.query(ToolIssue).filter(
                and_(
                    ToolIssue.officer_status == "approved",
                    ToolIssue.supervisor_status == "approved"
                )
            ).order_by(ToolIssue.report_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching approved issues: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tool-issues/rejected", response_model=List[ToolIssueResponse])
def get_rejected_issues(role: str = None, db: Session = Depends(get_db)):
    """Get rejected issues based on role (officer or supervisor)"""
    try:
        if role == "officer":
            return db.query(ToolIssue).filter(
                ToolIssue.officer_status == "rejected"
            ).order_by(ToolIssue.report_date.desc()).all()
        elif role == "supervisor":
            return db.query(ToolIssue).filter(
                ToolIssue.supervisor_status == "rejected"
            ).order_by(ToolIssue.report_date.desc()).all()
        else:
            return db.query(ToolIssue).filter(
                or_(
                    ToolIssue.officer_status == "rejected",
                    ToolIssue.supervisor_status == "rejected"
                )
            ).order_by(ToolIssue.report_date.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching rejected issues: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tool-issues/{issue_id}/officer-action", response_model=ToolIssueResponse)
def officer_action_issue(issue_id: int, approval: ToolIssueApprove, db: Session = Depends(get_db)):
    """Officer approve or reject an issue"""
    try:
        issue = db.query(ToolIssue).filter(ToolIssue.id == issue_id).first()
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")

        if issue.officer_status != "pending":
            raise HTTPException(status_code=400, detail="Issue has already been processed by officer")

        # Update officer status based on action
        if approval.action == "approve":
            issue.officer_status = "approved"
        else:  # reject
            issue.officer_status = "rejected"
            issue.supervisor_status = "rejected"  # Auto-reject supervisor if officer rejects

        issue.officer_id = approval.officer_id
        issue.officer_name = approval.officer_name
        issue.officer_approval_date = datetime.now()

        db.commit()
        db.refresh(issue)
        return issue
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error in officer_action_issue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tool-issues/{issue_id}/supervisor-action", response_model=ToolIssueResponse)
def supervisor_action_issue(issue_id: int, approval: ToolIssueApprove, db: Session = Depends(get_db)):
    """Supervisor approve or reject an issue"""
    try:
        issue = db.query(ToolIssue).filter(ToolIssue.id == issue_id).first()
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")

        if issue.officer_status != "approved":
            raise HTTPException(status_code=400, detail="Issue must be approved by officer first")

        if issue.supervisor_status != "pending":
            raise HTTPException(status_code=400, detail="Issue has already been processed by supervisor")

        # Update supervisor status based on action
        if approval.action == "approve":
            issue.supervisor_status = "approved"
        else:  # reject
            issue.supervisor_status = "rejected"

        issue.supervisor_id = approval.supervisor_id
        issue.supervisor_name = approval.supervisor_name
        issue.supervisor_approval_date = datetime.now()

        # Note: We no longer update the tool status here since we only use available/Not Available based on quantity

        db.commit()
        db.refresh(issue)
        return issue
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error in supervisor_action_issue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tool-issues/issue/{issue_id}", response_model=ToolIssueResponse)
def get_issue_by_issue_id(issue_id: int, db: Session = Depends(get_db)):
    """Get a specific issue by issue_id (primary key)"""
    try:
        issue = db.query(ToolIssue).filter(ToolIssue.id == issue_id).first()
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        return issue
    except Exception as e:
        logger.error(f"Error in get_issue_by_issue_id: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tool-issues/supervisor/{supervisor_id}", response_model=List[ToolIssueResponse])
def get_supervisor_issues(
    supervisor_id: str,
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get issues handled by a specific supervisor"""
    try:
        query = db.query(ToolIssue).filter(ToolIssue.supervisor_id == supervisor_id)
        
        if status:
            query = query.filter(ToolIssue.supervisor_status == status)
            
        return query.order_by(ToolIssue.report_date.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))