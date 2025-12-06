from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models.models import Workspace, WorkspaceUsage, BillingData, CloudTrailEvent, User
from app.schemas.workspace import (
    WorkspaceDetail,
    WorkspaceUsage as WorkspaceUsageSchema,
    BillingData as BillingDataSchema,
    CloudTrailEvent as CloudTrailEventSchema
)
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[WorkspaceDetail])
def list_workspaces(
    skip: int = 0,
    limit: int = 100,
    state: Optional[str] = None,
    user_name: Optional[str] = None,
    directory_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List workspaces with optional filters."""
    query = db.query(Workspace)
    
    if state:
        query = query.filter(Workspace.state == state)
    if user_name:
        query = query.filter(Workspace.user_name.ilike(f"%{user_name}%"))
    if directory_id:
        query = query.filter(Workspace.directory_id == directory_id)
    
    workspaces = query.offset(skip).limit(limit).all()
    return workspaces


@router.get("/{workspace_id}", response_model=WorkspaceDetail)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get workspace details by ID."""
    workspace = db.query(Workspace).filter(Workspace.workspace_id == workspace_id).first()
    if not workspace:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return workspace


@router.get("/{workspace_id}/usage", response_model=List[WorkspaceUsageSchema])
def get_workspace_usage(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get usage data for a specific workspace."""
    usage = db.query(WorkspaceUsage).filter(
        WorkspaceUsage.workspace_id == workspace_id
    ).order_by(WorkspaceUsage.month.desc()).all()
    
    return usage


@router.get("/{workspace_id}/billing", response_model=List[BillingDataSchema])
def get_workspace_billing(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get billing data for a specific workspace."""
    billing = db.query(BillingData).filter(
        BillingData.workspace_id == workspace_id
    ).order_by(BillingData.month.desc()).all()
    
    return billing


@router.get("/{workspace_id}/events", response_model=List[CloudTrailEventSchema])
def get_workspace_events(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get CloudTrail events for a specific workspace."""
    events = db.query(CloudTrailEvent).filter(
        CloudTrailEvent.workspace_id == workspace_id
    ).order_by(CloudTrailEvent.event_time.desc()).all()
    
    return events
