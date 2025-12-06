from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class WorkspaceBase(BaseModel):
    """Base workspace schema."""
    workspace_id: str
    user_name: Optional[str] = None
    directory_id: Optional[str] = None
    bundle_id: Optional[str] = None
    state: Optional[str] = None
    computer_name: Optional[str] = None
    ip_address: Optional[str] = None
    running_mode: Optional[str] = None
    compute_type_name: Optional[str] = None


class WorkspaceDetail(WorkspaceBase):
    """Detailed workspace schema."""
    id: int
    subnet_id: Optional[str] = None
    root_volume_encryption: Optional[bool] = None
    user_volume_encryption: Optional[bool] = None
    volume_encryption_key: Optional[str] = None
    root_volume_size_gib: Optional[int] = None
    user_volume_size_gib: Optional[int] = None
    created_time: Optional[datetime] = None
    terminated_time: Optional[datetime] = None
    created_by: Optional[str] = None
    terminated_by: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    last_synced: Optional[datetime] = None
    user_email: Optional[str] = None
    user_given_name: Optional[str] = None
    user_surname: Optional[str] = None
    
    class Config:
        from_attributes = True


class WorkspaceUsageBase(BaseModel):
    """Base workspace usage schema."""
    workspace_id: str
    month: str
    total_hours: float = 0.0
    billable_hours: float = 0.0


class WorkspaceUsage(WorkspaceUsageBase):
    """Workspace usage schema."""
    id: int
    last_updated: datetime
    
    class Config:
        from_attributes = True


class BillingDataBase(BaseModel):
    """Base billing data schema."""
    workspace_id: Optional[str] = None
    service: Optional[str] = None
    month: str
    cost: float = 0.0
    usage_quantity: float = 0.0
    usage_unit: Optional[str] = None
    currency: str = "USD"


class BillingData(BillingDataBase):
    """Billing data schema."""
    id: int
    last_updated: datetime
    
    class Config:
        from_attributes = True


class CloudTrailEventBase(BaseModel):
    """Base CloudTrail event schema."""
    event_id: str
    event_time: Optional[datetime] = None
    event_name: Optional[str] = None
    event_source: Optional[str] = None
    username: Optional[str] = None
    workspace_id: Optional[str] = None


class CloudTrailEvent(CloudTrailEventBase):
    """CloudTrail event schema."""
    id: int
    resources: Optional[Dict[str, Any]] = None
    cloud_trail_event: Optional[Dict[str, Any]] = None
    request_parameters: Optional[Dict[str, Any]] = None
    response_elements: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AIQueryRequest(BaseModel):
    """AI query request schema."""
    query: str
    context: Optional[Dict[str, Any]] = None


class AIQueryResponse(BaseModel):
    """AI query response schema."""
    response: str
    processing_time: float
