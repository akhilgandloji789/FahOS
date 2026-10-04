"""
Pydantic schemas for FahOS Browser Control Microservice.
Strict validation for incoming tasks and structured state responses.
"""
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field

class BrowserTaskRequest(BaseModel):
    task: str = Field(..., description="Natural language instructions for the browser agent")
    max_steps: Optional[int] = Field(25, description="Maximum agent execution steps")
    mode: Optional[str] = Field("interactive", description="Execution mode: interactive or headless")
    requires_confirmation: Optional[bool] = Field(False, description="Whether to block on sensitive gates")

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str = Field(..., description="queued | starting | running | completed | failed | cancelled | busy")
    summary: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    url: Optional[str] = None
    screenshot: Optional[str] = None
    error: Optional[str] = None
    steps_completed: Optional[int] = 0

class HealthResponse(BaseModel):
    status: str
    browser_service: bool
    browser: bool
    active_task: Optional[str] = None
