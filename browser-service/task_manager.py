"""
Task Manager for FahOS Browser Service.
Controls concurrency (1 task at a time), cancellation tokens, and task tracking.
"""
import asyncio
import uuid
import time
from typing import Dict, Optional, Any
from schemas import TaskStatusResponse
from agent import execute_browser_task

class TaskManager:
    def __init__(self):
        self.active_task_id: Optional[str] = None
        self.active_async_task: Optional[asyncio.Task] = None
        self.task_store: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def submit_task(self, task_text: str, max_steps: int = 25, mode: str = "interactive") -> TaskStatusResponse:
        async with self._lock:
            if self.active_task_id is not None:
                # Check if previous task is actually still running
                if self.active_async_task and not self.active_async_task.done():
                    return TaskStatusResponse(
                        task_id=self.active_task_id,
                        status="busy",
                        summary="Another browser task is currently in progress. Please wait or stop it first.",
                        error="Browser is busy"
                    )

            task_id = str(uuid.uuid4())[:8]
            self.active_task_id = task_id
            self.task_store[task_id] = {
                "task_id": task_id,
                "status": "starting",
                "task": task_text,
                "start_time": time.time(),
                "summary": "Starting visible browser session...",
                "url": None,
                "error": None
            }

            # Spawn async execution
            headless = (mode == "headless")
            self.active_async_task = asyncio.create_task(self._run_wrapper(task_id, task_text, max_steps, headless))
            
            return TaskStatusResponse(
                task_id=task_id,
                status="starting",
                summary="Browser session initiated."
            )

    async def _run_wrapper(self, task_id: str, task_text: str, max_steps: int, headless: bool):
        try:
            self.task_store[task_id]["status"] = "running"
            res = await execute_browser_task(task_text, max_steps=max_steps, headless=headless)
            self.task_store[task_id].update({
                "status": res.get("status", "completed"),
                "summary": res.get("summary", ""),
                "url": res.get("url", ""),
                "error": res.get("error", None),
                "steps_completed": res.get("steps", 0)
            })
        except asyncio.CancelledError:
            self.task_store[task_id].update({
                "status": "cancelled",
                "summary": "Browser task was stopped by user.",
                "error": "Cancelled"
            })
        except Exception as e:
            self.task_store[task_id].update({
                "status": "failed",
                "summary": f"Failed: {str(e)}",
                "error": str(e)
            })
        finally:
            if self.active_task_id == task_id:
                self.active_task_id = None
                self.active_async_task = None

    def get_task_status(self, task_id: str) -> Optional[TaskStatusResponse]:
        data = self.task_store.get(task_id)
        if not data:
            return None
        return TaskStatusResponse(**data)

    async def cancel_task(self, task_id: str) -> bool:
        async with self._lock:
            if self.active_task_id == task_id and self.active_async_task:
                self.active_async_task.cancel()
                self.active_task_id = None
                self.active_async_task = None
                if task_id in self.task_store:
                    self.task_store[task_id]["status"] = "cancelled"
                    self.task_store[task_id]["summary"] = "Task cancelled by user."
                return True
            return False

task_manager = TaskManager()
