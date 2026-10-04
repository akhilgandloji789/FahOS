"""
FastAPI Server for FahOS Browser Control Microservice.
Exposes REST endpoints on localhost:8484 strictly for local Electron consumption.
"""
import sys
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import BrowserTaskRequest, TaskStatusResponse, HealthResponse
from task_manager import task_manager
import config

# Set utf-8 encoding on standard streams to avoid Windows CP1252 print errors
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

app = FastAPI(title="FahOS Browser Control Service", version="1.0.0")

# Security: Localhost CORS only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "http://127.0.0.1:*", "https://localhost:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        browser_service=True,
        browser=True,
        active_task=task_manager.active_task_id
    )

@app.post("/tasks", response_model=TaskStatusResponse)
async def create_task(req: BrowserTaskRequest):
    if not req.task.strip():
        raise HTTPException(status_code=400, detail="Task instruction cannot be empty.")
    return await task_manager.submit_task(
        task_text=req.task,
        max_steps=req.max_steps or 20,
        mode=req.mode or "interactive"
    )

@app.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task(task_id: str):
    status = task_manager.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")
    return status

@app.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    cancelled = await task_manager.cancel_task(task_id)
    return {"task_id": task_id, "cancelled": cancelled}

@app.post("/tasks/cancel-active")
async def cancel_active():
    active_id = task_manager.active_task_id
    if active_id:
        cancelled = await task_manager.cancel_task(active_id)
        return {"cancelled": cancelled, "task_id": active_id}
    return {"cancelled": False, "task_id": None}

if __name__ == "__main__":
    print(f"\n=======================================================")
    print(f"[FahOS] Browser Control Service starting on http://{config.HOST}:{config.PORT}")
    print(f"=======================================================\n")
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, log_level="info")
