'use strict';
// FahOS — Windows 11 Modern WinRT Speech Recognition Manager (Diagnostics Enabled)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const logPath = path.join(__dirname, '..', '..', '..', 'stt.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (_) {}
  console.log(msg);
}

let exeProcess = null;
let isWorkerReady = false;
let isListening = false;
let pendingStart = false;
let onTextCallback = null;
let onErrorCallback = null;

function ensureWorker() {
  if (exeProcess && !exeProcess.killed) return;

  const exePath = path.join(__dirname, 'FahOSSpeech.exe');
  log(`[Native STT] Spawning WinRT Speech Engine: ${exePath}`);

  exeProcess = spawn(exePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  isWorkerReady = false;

  exeProcess.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      log(`[STT stdout] ${line}`);
      if (line.includes('READY')) {
        log('[Native STT] WinRT Speech Engine is READY.');
        isWorkerReady = true;
        if (pendingStart) {
          pendingStart = false;
          sendStart();
        }
      } else if (line.startsWith('FINAL:')) {
        const text = line.substring(6).trim();
        log(`[Native STT FINAL]: "${text}"`);
        if (text && onTextCallback) onTextCallback({ text, isFinal: true });
      } else if (line.startsWith('INTERIM:')) {
        const text = line.substring(8).trim();
        log(`[Native STT INTERIM]: "${text}"`);
        if (text && onTextCallback) onTextCallback({ text, isFinal: false });
      } else if (line.startsWith('ERROR:')) {
        const err = line.substring(6).trim();
        log(`[Native STT Error]: ${err}`);
        if (onErrorCallback) onErrorCallback(err);
      }
    }
  });

  exeProcess.stderr.on('data', (d) => {
    log(`[Native STT stderr]: ${d.toString().trim()}`);
  });

  exeProcess.on('exit', (code) => {
    log(`[Native STT] Process exited with code ${code}`);
    exeProcess = null;
    isWorkerReady = false;
    isListening = false;
  });
}

function sendStart() {
  if (exeProcess && exeProcess.stdin.writable) {
    exeProcess.stdin.write('START\n');
    isListening = true;
    log('[Native STT] Sent START to speech engine.');
  }
}

function startListening(callbacks = {}) {
  if (callbacks.onText) onTextCallback = callbacks.onText;
  if (callbacks.onError) onErrorCallback = callbacks.onError;

  ensureWorker();

  if (isWorkerReady) {
    sendStart();
  } else {
    log('[Native STT] Worker not ready yet. Queuing START...');
    pendingStart = true;
  }
}

function stopListening() {
  pendingStart = false;
  if (exeProcess && exeProcess.stdin.writable && isListening) {
    try {
      exeProcess.stdin.write('STOP\n');
      log('[Native STT] Sent STOP to speech engine.');
    } catch (_) {}
  }
  isListening = false;
}

function killWorker() {
  pendingStart = false;
  isListening = false;
  if (exeProcess) {
    try {
      exeProcess.stdin.write('QUIT\n');
      exeProcess.kill();
    } catch (_) {}
    exeProcess = null;
  }
}

module.exports = {
  ensureWorker,
  startListening,
  stopListening,
  killWorker
};
