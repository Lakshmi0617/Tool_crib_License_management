from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from db import get_db
from typing import List
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from sqlalchemy import and_, not_, exists

router = APIRouter()

@router.post("/tool-usage", response_model=ToolUsageHistoryResponse)
def create_tool_usage(usage: ToolUsageHistoryCreate, db: Session = Depends(get_db)):
    try:
        db_usage = ToolUsageHistory(**usage.dict())
        db.add(db_usage)
        # Update tool status to in_use
        tool = db.query(ToolsList).filter(ToolsList.Sl_no == usage.tool_sl_no).first()
        if tool:
            tool.status = "in_use"
        db.commit()
        db.refresh(db_usage)
        return db_usage
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tool-usage/{operator_id}", response_model=List[ToolUsageHistoryResponse])
def get_operator_tool_usage(operator_id: str, db: Session = Depends(get_db)):
    """Get tool usage for an operator, excluding tools with pending or approved issues"""
    try:
        # Get all tool usage records for the operator, using distinct to avoid duplicates
        usage = db.query(ToolUsageHistory).distinct(
            ToolUsageHistory.tool_sl_no,
            ToolUsageHistory.status
        ).filter(
            ToolUsageHistory.operator_id == operator_id
        ).order_by(
            ToolUsageHistory.tool_sl_no,
            ToolUsageHistory.status,
            ToolUsageHistory.start_date.desc()
        ).all()

        if not usage:
            return []

        # Filter out tools that have pending or approved issues
        tools_with_issues = db.query(ToolIssue.tool_sl_no).filter(
            and_(
                ToolIssue.operator_id == operator_id,
                ToolIssue.status.in_(['pending', 'supervisor_approved', 'officer_approved'])
            )
        ).all()
        
        issue_tool_ids = [tool[0] for tool in tools_with_issues]
        
        # Filter out tools with issues and keep only in_use or recently returned tools
        # Also ensure we only get the latest status for each tool
        seen_tools = set()
        filtered_usage = []
        
        for u in usage:
            # Only include each tool once based on its latest status
            if u.tool_sl_no not in seen_tools and u.tool_sl_no not in issue_tool_ids:
                if u.status in ['in_use', 'returned']:
                    filtered_usage.append(u)
                    seen_tools.add(u.tool_sl_no)

        return filtered_usage
    except SQLAlchemyError as e:
        print(f"Error in get_operator_tool_usage: {str(e)}")  # Add logging
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/tool-usage/{usage_id}/return", response_model=ToolUsageHistoryResponse)
def return_tool(
    usage_id: int,
    condition: str,
    remarks: str,
    db: Session = Depends(get_db)
):
    try:
        usage = db.query(ToolUsageHistory).filter(ToolUsageHistory.id == usage_id).first()
        if not usage:
            raise HTTPException(status_code=404, detail="Usage record not found")
        
        usage.status = "returned"
        usage.end_date = datetime.now()
        usage.condition_on_return = condition
        usage.remarks = remarks
        
        # Update tool status to available
        tool = db.query(ToolsList).filter(ToolsList.Sl_no == usage.tool_sl_no).first()
        if tool:
            tool.status = "available"
        
        db.commit()
        db.refresh(usage)
        return usage
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/tool-usage/{tool_sl_no}", response_model=ToolUsageHistoryResponse)
def update_tool_usage(
    tool_sl_no: int,
    update_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Update a tool usage record"""
    try:
        # Get the most recent usage record for this tool
        usage = db.query(ToolUsageHistory)\
            .filter(ToolUsageHistory.tool_sl_no == tool_sl_no)\
            .order_by(ToolUsageHistory.start_date.desc())\
            .first()
            
        if not usage:
            raise HTTPException(status_code=404, detail="Tool usage record not found")

        # Update usage record with condition and remarks
        usage.condition_on_return = update_data.get("condition_on_return")
        usage.remarks = update_data.get("remarks")
        usage.status = "returned"
        usage.end_date = datetime.now()

        # Update tool status to available
        tool = db.query(ToolsList).filter(ToolsList.Sl_no == tool_sl_no).first()
        if tool:
            tool.status = "available"

        db.commit()
        db.refresh(usage)
        return usage
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 