from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from app.db.session import get_db
from app.models.models import Report, User
from app.api.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()


class ReportRequest(BaseModel):
    """Report generation request."""
    report_type: str  # workspaces, usage, billing, cloudtrail
    format: str = "csv"  # csv, excel
    filters: Optional[Dict[str, Any]] = None


class ReportResponse(BaseModel):
    """Report response."""
    id: int
    status: str
    report_type: str
    format: str
    
    class Config:
        from_attributes = True


def generate_report_task(report_id: int, db: Session):
    """
    Background task to generate report.
    
    TODO: In production, this should be moved to a proper Celery task
    for better async handling and monitoring. This is a simplified
    implementation for demonstration purposes.
    
    Production implementation would use:
    - Celery @task decorator
    - Proper error handling and retry logic
    - Progress tracking
    - Result storage in S3 or similar
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if report:
        report.status = "processing"
        db.commit()
        
        # Placeholder for actual report generation
        # In production, this would:
        # 1. Query database for relevant data
        # 2. Generate CSV/Excel file
        # 3. Store in reports directory or S3
        # 4. Update report status and file_path
        import time
        time.sleep(2)  # Simulates report generation time
        
        report.status = "completed"
        report.file_path = f"/reports/{report_id}.{report.format}"
        db.commit()


@router.post("/generate", response_model=ReportResponse, status_code=202)
def create_report(
    report_request: ReportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a new report asynchronously.
    
    Report types:
    - workspaces: Full workspace inventory
    - usage: Usage data
    - billing: Billing/cost data
    - cloudtrail: Audit log events
    """
    # Create report record
    report = Report(
        report_type=report_request.report_type,
        format=report_request.format,
        filters=report_request.filters,
        created_by=current_user.id,
        status="pending"
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # Queue background task
    background_tasks.add_task(generate_report_task, report.id, db)
    
    return report


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get report status and details."""
    report = db.query(Report).filter(Report.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Users can only view their own reports unless they're admin
    if report.created_by != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return report
