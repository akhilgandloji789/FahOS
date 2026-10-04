'use strict';
// FahOS Browser Control Service Client (Electron Main Process)
// Connects to local Python Browser Service (http://127.0.0.1:8484)
// Manages process lifecycle, health checks, task submission, and cancellation.

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const SERVICE_HOST = '127.0.0.1';
const SERVICE_PORT = 8484;
let serviceProcess = null;
let isSpawning = false;

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://${SERVICE_HOST}:${SERVICE_PORT}/health`, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: res.statusCode === 200, data: json });
        } catch (_) {
          resolve({ ok: false });
        }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

async function ensureServiceRunning() {
  const health = await checkHealth();
  if (health.ok) return true;

  if (isSpawning) {
    await new Promise(r => setTimeout(r, 2000));
    return (await checkHealth()).ok;
  }

  isSpawning = true;
  console.log('[FahOS Browser Client] Spawning Python Browser Service daemon...');

  const serviceDir = path.join(__dirname, '..', '..', 'browser-service');
  const pythonPath = path.join(serviceDir, 'venv', 'Scripts', 'python.exe');

  try {
    serviceProcess = spawn(pythonPath, ['main.py'], {
      cwd: serviceDir,
      stdio: 'ignore',
      detached: true,
      windowsHide: false
    });
    serviceProcess.unref();

    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 600));
      const h = await checkHealth();
      if (h.ok) {
        console.log('[FahOS Browser Client] Python Browser Service started and healthy.');
        isSpawning = false;
        return true;
      }
    }
  } catch (err) {
    console.warn('[FahOS Browser Client] Could not spawn Python service:', err.message);
  }

  isSpawning = false;
  return false;
}

function submitBrowserTask(taskText, mode = 'interactive') {
  return new Promise(async (resolve) => {
    const ready = await ensureServiceRunning();
    if (!ready) {
      return resolve({
        ok: false,
        error: 'Python Browser Service is not reachable on localhost:8484. Please run start.bat inside browser-service folder.'
      });
    }

    const payload = JSON.stringify({ task: taskText, mode: mode, max_steps: 20 });
    const options = {
      hostname: SERVICE_HOST,
      port: SERVICE_PORT,
      path: '/tasks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: res.statusCode === 200, task_id: json.task_id, status: json.status, summary: json.summary });
        } catch (e) {
          resolve({ ok: false, error: 'Malformed response from Browser Service' });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(payload);
    req.end();
  });
}

function pollTaskResult(taskId, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - t0 > timeoutMs) {
        clearInterval(interval);
        return resolve({ ok: false, status: 'timeout', summary: 'Browser task exceeded maximum execution time (180s).' });
      }

      const req = http.get(`http://${SERVICE_HOST}:${SERVICE_PORT}/tasks/${taskId}`, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const task = JSON.parse(data);
            if (task.status === 'completed') {
              clearInterval(interval);
              resolve({ ok: true, status: 'completed', summary: task.summary, url: task.url, steps: task.steps_completed });
            } else if (task.status === 'failed' || task.status === 'cancelled') {
              clearInterval(interval);
              resolve({ ok: false, status: task.status, summary: task.summary, error: task.error });
            }
          } catch (_) {}
        });
      });
      req.on('error', () => {});
    }, 1200);
  });
}

async function runBrowserTask(taskText, mode = 'interactive') {
  console.log(`[FahOS Browser Client] Initiating Browser Task: "${taskText}"`);
  const initial = await submitBrowserTask(taskText, mode);
  if (!initial.ok) {
    console.warn('[FahOS Browser Client] Python Playwright service unavailable. Launching native FahOS Browser fallback...');
    try {
      const agentBrowserWindow = require('./agentBrowserWindow');
      agentBrowserWindow.createAgentBrowserWindow();
      return {
        ok: true,
        fallback: true,
        summary: `Launched native FahOS browser for task: "${taskText}"`
      };
    } catch (e) {
      return initial;
    }
  }

  if (initial.status === 'busy') {
    return {
      ok: false,
      status: 'busy',
      summary: '⚠️ Another browser task is currently running. Please wait or say "Stop" before starting a new task.'
    };
  }

  const result = await pollTaskResult(initial.task_id);
  return result;
}

function cancelActiveBrowserTask() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: SERVICE_HOST,
      port: SERVICE_PORT,
      path: '/tasks/cancel-active',
      method: 'POST'
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: true }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
}

module.exports = {
  checkHealth,
  ensureServiceRunning,
  submitBrowserTask,
  runBrowserTask,
  cancelActiveBrowserTask
};
