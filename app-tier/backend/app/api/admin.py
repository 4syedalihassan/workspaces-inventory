from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.db.session import get_db
from app.models.models import User, Workspace, SyncHistory
from app.api.auth import get_current_active_superuser
from pydantic import BaseModel

router = APIRouter()


class SystemConfig(BaseModel):
    """System configuration."""
    aws_region: str
    sync_enabled: bool = True
    ai_service_enabled: bool = True


class SystemStats(BaseModel):
    """System statistics."""
    total_workspaces: int
    active_workspaces: int
    total_users: int
    last_sync: Dict[str, Any]


@router.get("/config", response_model=SystemConfig)
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """Get system configuration (admin only)."""
    from app.core.config import settings
    
    return SystemConfig(
        aws_region=settings.AWS_REGION,
        sync_enabled=True,
        ai_service_enabled=True
    )


@router.put("/config")
def update_config(
    config: SystemConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """Update system configuration (admin only)."""
    # In a real implementation, this would update configuration
    # For now, just return the config
    return {"message": "Configuration updated", "config": config}


@router.get("/stats", response_model=SystemStats)
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """Get system statistics (admin only)."""
    total_workspaces = db.query(Workspace).count()
    active_workspaces = db.query(Workspace).filter(
        Workspace.state == "AVAILABLE"
    ).count()
    total_users = db.query(User).count()
    
    # Get last sync info
    last_sync = db.query(SyncHistory).order_by(
        SyncHistory.started_at.desc()
    ).first()
    
    last_sync_info = {}
    if last_sync:
        last_sync_info = {
            "type": last_sync.sync_type,
            "status": last_sync.status,
            "started_at": last_sync.started_at.isoformat() if last_sync.started_at else None,
            "completed_at": last_sync.completed_at.isoformat() if last_sync.completed_at else None
        }
    
    return SystemStats(
        total_workspaces=total_workspaces,
        active_workspaces=active_workspaces,
        total_users=total_users,
        last_sync=last_sync_info
    )


@router.post("/sync")
def trigger_sync(
    sync_type: str = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """Trigger data sync (admin only)."""
    # Create sync history record
    sync_record = SyncHistory(
        sync_type=sync_type,
        status="running"
    )
    db.add(sync_record)
    db.commit()
    
    # In a real implementation, this would trigger Celery tasks
    # For now, just return success
    return {
        "message": f"Sync triggered for {sync_type}",
        "sync_id": sync_record.id
    }
