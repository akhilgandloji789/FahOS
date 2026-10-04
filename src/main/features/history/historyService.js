'use strict';
// FahOS — Local-First Persistent History Service (100% Private, Zero Cloud)
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getHistoryFilePath() {
  try {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return path.join(userData, 'fahos_history.json');
  } catch (_) {
    return path.join(process.cwd(), 'fahos_history.json');
  }
}

function loadHistory() {
  const filePath = getHistoryFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[FahOS History] Read error:', err.message);
  }
  return [];
}

function saveHistory(history) {
  const filePath = getHistoryFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[FahOS History] Write error:', err.message);
    return false;
  }
}

function addEntry({ query, response }) {
  if (!query && !response) return loadHistory();
  const history = loadHistory();
  const newEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    query: String(query || '').trim(),
    response: String(response || '').trim()
  };
  history.unshift(newEntry); // Newest first
  if (history.length > 200) history.length = 200;
  saveHistory(history);
  return history;
}

function clearHistory() {
  saveHistory([]);
  return [];
}

module.exports = { loadHistory, addEntry, clearHistory };
