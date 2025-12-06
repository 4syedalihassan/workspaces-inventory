from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
import time
from app.core.config import settings
from app.db.session import get_db
from app.models.models import User
from app.schemas.workspace import AIQueryRequest, AIQueryResponse
from app.api.auth import get_current_user

router = APIRouter()


@router.post("/query", response_model=AIQueryResponse)
async def ai_query(
    query_request: AIQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process natural language query using Phi-3 AI model.
    
    This endpoint forwards queries to the AI tier for processing
    and returns intelligent responses based on workspace data.
    """
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.AI_SERVICE_URL}/completion",
                json={
                    "prompt": query_request.query,
                    "context": query_request.context or {}
                }
            )
            response.raise_for_status()
            
            ai_response = response.json()
            processing_time = time.time() - start_time
            
            return AIQueryResponse(
                response=ai_response.get("response", ""),
                processing_time=processing_time
            )
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail=f"AI service unavailable: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing AI query: {str(e)}"
        )


@router.get("/health")
async def ai_health_check():
    """Check AI service health."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.AI_SERVICE_URL}/health")
            response.raise_for_status()
            return {"status": "ok", "ai_service": response.json()}
    except Exception as e:
        return {"status": "error", "message": str(e)}
