# FahOS — System Architecture

> **Version:** 1.0.0  
> **Status:** Production Ready  

---

## 1. Overview

FahOS is a **multi-process, event-driven AI operating layer** built on top of Windows. It bridges the gap between natural language and native OS execution through a layered architecture:

```
Human Voice / Text
        │
        ▼
┌───────────────────────────────────────┐
│         Glass HUD Overlay             │  ← Renderer Process (Electron)
│   (overlay.js · styles.css · IPC)    │
└──────────────────┬────────────────────┘
                   │  contextBridge IPC
                   ▼
┌───────────────────────────────────────┐
│        Electron Main Process          │  ← Node.js (main.js)
│  Voice → Router → Orchestrator → Act │
└──────┬──────────────┬─────────────────┘
       │              │
       ▼              ▼
 Voice Engine     AI Brain + Executor
 (Whisper)        (router.js + orchestrator.js)
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
      Filesystem   Contacts    Browser
       Agent        Service    Service
    (systemActions) (contacts) (HTTP :8484)
                                   │
                                   ▼
                        Python FastAPI
                      + Playwright Agent
```

---

## 2. Process Architecture

FahOS runs across **three concurrent processes**:

### 2.1 Electron Renderer Process
- File: `src/renderer/overlay/overlay.js`
- Renders the floating obsidian glass HUD using HTML/CSS
- Captures microphone audio via `Web Audio API`
- Resamples from 48kHz → 16kHz using `OfflineAudioContext`
- Serializes `Float32Array` PCM data and sends over IPC to main process
- Receives streamed response text and renders it as markdown

### 2.2 Electron Main Process
- File: `src/main/main.js`
- Handles all IPC channels (`fahos-query`, `fahos-voice`, `fahos-action`)
- Orchestrates the entire pipeline: voice → transcription → routing → execution → response
- Manages all native Windows integrations (PowerShell, shell, file system)
- Runs `historyService`, `contactsService`, and `configLoader`

### 2.3 Python FastAPI Microservice
- Directory: `browser-service/`
- Runs independently at `http://127.0.0.1:8484`
- Accepts POST `/tasks` with a natural language task string
- Spawns a `browser-use` AI agent with Gemini 3.1 Flash-Lite as the planner
- Returns streaming results back to the Electron main process via HTTP polling

---

## 3. Voice Pipeline

```
Microphone
    │
    ▼ Web Audio API (renderer)
AudioContext.createMediaStreamSource()
    │
    ▼ ScriptProcessorNode / AudioWorklet
Raw PCM Float32 samples (48kHz, multi-channel)
    │
    ▼ resampleTo16kMono() — OfflineAudioContext
16kHz mono Float32Array
    │
    ▼ IPC transfer (ArrayBuffer, zero-copy)
main.js voice handler
    │
    ├─► Groq Whisper API (primary, ~300ms)
    │       model: whisper-large-v3-turbo
    │       format: wav (reconstructed in whisperService.js)
    │
    └─► Local ONNX Whisper (fallback, offline)
            @xenova/transformers
            model: Xenova/whisper-tiny.en
```

### WAV Decoder (`whisperService.js`)
Custom `decodeWavToFloat32()` handles:
- `ArrayBuffer`, `Uint8Array`, Node `Buffer`, JSON-serialized Buffer inputs
- Dynamic chunk traversal (skips `JUNK`, `LIST`, `bext` metadata chunks)
- 16-bit PCM → Float32 normalization
- Multi-channel downmix (all channels averaged, not just ch0+ch1)
- Reads `dataSize` from chunk header to prevent decoding trailing garbage bytes

---

## 4. AI Orchestration Pipeline

### 4.1 Intent Router (`router.js`)
Zero-latency deterministic classifier. Runs before any LLM call.

**Fastpath priority order:**
```
1. Informational query guard (what/who/how → direct to orchestrator)
2. Stop / cancel intent
3. Save / list contacts
4. WhatsApp message extraction (extractWhatsAppMessage)
5. Email compose extraction (extractEmailCompose)
6. WhatsApp chat open
7. File create — standard ("create file X in Y")
8. File create — shorthand ("create X.txt in Y")      ← NEW
9. File read ("read X.txt in Y")                      ← NEW
10. File list ("list files in Y")                     ← NEW
11. YouTube search → browser agent
12. Google/Chrome search → browser agent
13. File delete ("delete X from Y")
14. Open app/folder/file (Observe-Plan-Verify agent)
15. Visual mouse click
16. Fallback → AI Orchestrator
```

### 4.2 Query Classifier (`orchestrator.js`)

Classifies every query into one of 5 tiers using keyword + complexity heuristics:

| Tier | Signals | Primary Model | Fallback Chain |
|:---|:---|:---|:---|
| `simple` | short, greetings, basic facts | gemini-3.6-flash | qwen3.8 → llama3.2:1b |
| `medium` | explanation, summary, 10-25 words | qwen/qwen3.8-27b | gpt-oss-20b → gemini-3.6 |
| `complex` | strategy, analysis, >25 words | openai/gpt-oss-120b | qwen3.8 → deepseek-r1 |
| `coding` | code keywords, languages | qwen/qwen3.8-27b | gpt-oss-120b → qwen2.5-coder |
| `vision` | screenshot, OCR, diagram | gemini-3.6-flash-vision | gemini-3.1-lite → qwen3-vl |

### 4.3 Live Web Search Grounding (`webSearchService.js`)

Triggered automatically for real-time queries (`current`, `latest`, `2024`, `2025`, `2026`, `today`):

```
Query detected as real-time
    │
    ▼ Promise.allSettled (parallel, 4500ms timeout)
    ├─► DDG HTML scrape (primary)
    │       User-Agent spoofing, keep-alive agent
    │       Parse <a class="result__snippet"> tags
    │
    └─► Wikipedia REST API (secondary)
            /api/rest_v1/page/summary/{term}
            Extracts lead paragraph

Snippets scored by scoreSnippet()
    │  Boosts: current-office verbs, years 2024-2026
    │  Penalizes: past-tense verbs (died, was, served)
    ▼
Top 3 snippets injected into BOTH system prompt AND user prompt
    │
    ▼
LLM generates grounded, up-to-date answer
```

---

## 5. Filesystem Agent

### 5.1 Path Resolution (`systemActions.js`)

`getExistingFolderPath(folderName)` resolves user directories:
```
1. Check OneDrive\{folderName}   (e.g. C:\Users\X\OneDrive\Downloads)
2. Check home\{folderName}       (e.g. C:\Users\X\Downloads)
3. Return OneDrive path as default
```

`resolveDirectory(rawName)` adds:
```
1. Direct absolute path detection (C:\... or D:\...)
2. Exact alias match (DIRECTORIES table)
3. Substring/contains match
4. Fuzzy Levenshtein distance match (≤2 edits)
```

### 5.2 CRUD Operations

| Operation | Handler | Notes |
|:---|:---|:---|
| **Create file** | `createFileOrFolder()` | Auto-adds `.txt` if no extension; reveals in Explorer |
| **Create folder** | `createFileOrFolder({isFolder:true})` | `fs.mkdirSync` recursive |
| **Read file** | router.js fastpath | Searches Downloads/Desktop/Documents; 1MB size limit |
| **List directory** | router.js fastpath | `readdirSync`, folders first, capped at 30 items |
| **Delete** | `deleteFileOrFolder()` | Requires `confirmed=true`; uses `shell.trashItem()` → Recycle Bin |

### 5.3 3-Tier Security Model

```
Every filesystem write/delete request
            │
    ┌───────▼────────┐
    │  SAFE tier?    │ ──YES──► Execute immediately
    │ (read / list)  │
    └───────┬────────┘
            │ NO
    ┌───────▼────────┐
    │ CONFIRM tier?  │ ──YES──► Show preview card, proceed on acknowledgment
    │ (create/email) │
    └───────┬────────┘
            │ NO
    ┌───────▼────────┐
    │ DANGEROUS tier │ ──► Block. Return requiresConfirmation=true
    │ (delete)       │     Proceed ONLY if rawText contains "confirm"
    └────────────────┘
```

---

## 6. Visual Mouse Agent (`visualAgent.js`)

```
"click Save button"
        │
        ▼
cropScreenRegion() — PowerShell GDI
  Add-Type System.Drawing
  [Graphics]::CopyFromScreen()
  Bitmap → MemoryStream → Base64 PNG
  Zero disk I/O. In-memory only.
        │
        ▼
Gemini 3.6 Flash Vision API
  Prompt: "Return JSON {x, y} of pixel center of [target]"
  Image: base64 PNG of screen region
        │
        ▼
{x: 452, y: 318}   ← Normalized 0-1000 coordinates
        │
        ▼
ScaleCoordinates() — apply DPI scaleFactor
  screen.getPrimaryDisplay().scaleFactor
        │
        ▼
P/Invoke user32.dll mouse_event()
  C# compiled inline via Add-Type
  MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_LEFTDOWN/UP
        │
        ▼
Physical mouse clicks the target ✓
```

---

## 7. Browser Automation

### 7.1 Routing

```
User: "Open Wikipedia and search for Elon Musk"
        │
router.js BROWSER_TASK_SIGNALS regex match
        │
        ▼
agentBrowserWindow.runAgentTask(rawText)
        │
        ├─► HTTP POST http://127.0.0.1:8484/tasks
        │       { "task": "Open Wikipedia..." }
        │
        │   Python FastAPI receives task
        │       │
        │       ▼
        │   browser_manager.py
        │       Playwright launch_persistent_context()
        │       Profile: ~/.fahos/chrome_agent_profile
        │       CTypes SW_MAXIMIZE SetForegroundWindow
        │
        │       browser-use Agent(llm=Gemini 3.1 Flash-Lite)
        │       Multi-step web planner
        │       Element highlight (amber/green)
        │       Click / type / navigate
        │
        └─► Answer extracted → streamed back to HUD
```

### 7.2 Fallback — Native Electron Browser

If Python microservice is offline (port 8484 unreachable):
```
agentBrowserWindow.createAgentBrowserWindow(url)
    │
    ▼
Electron BrowserWindow (headless=false)
MutationObserver DOM listener
Gemini 3.1 Flash-Lite generates JS automation steps
webContents.executeJavaScript() runs them
```

---

## 8. IPC Contract

| Channel | Direction | Payload | Response |
|:---|:---|:---|:---|
| `fahos-query` | renderer → main | `{ action, text }` | `{ ok, output, isAction, provider, command }` |
| `fahos-voice` | renderer → main | `Float32Array` PCM buffer | `{ ok, transcript }` |
| `fahos-action` | renderer → main | `{ type, data }` | `{ ok, result }` |
| `fahos-history-get` | renderer → main | — | `[{ id, timestamp, query, response }]` |
| `fahos-history-clear` | renderer → main | — | `[]` |

---

## 9. Data Storage

| Store | Location | Format | Privacy |
|:---|:---|:---|:---|
| Conversation History | `%AppData%\fahos\fahos_history.json` | JSON array, 200-entry rolling | Local only |
| Contacts | `%AppData%\fahos\contacts.json` | JSON object keyed by name | Local only |
| Config | `{projectRoot}\fahos.config.json` | JSON | Local only |
| Chrome Profile | `~\.fahos\chrome_agent_profile\` | Chromium user data dir | Local only |
| Screen captures | — | In-memory only (never written) | Zero disk footprint |

---

## 10. Testing

```
tests/
├── orchestrator.test.js    — query classification, tier routing, fallback
├── intent.test.js          — router regex, WhatsApp/email extraction
├── whisper.test.js         — WAV decode, audio pipeline
├── whisper_edge_cases.test.js — multi-channel downmix, JSON Buffer, trailing metadata
├── visualAgent.test.js     — GDI capture mock, coordinate scaling
├── contacts.test.js        — E.164 normalization, save/lookup
└── markdown.test.js        — HUD markdown renderer

Total: 113 tests, 7 suites — all passing ✅
```

---

## 11. Key Design Decisions

| Decision | Rationale |
|:---|:---|
| Electron over web app | Needs native Windows APIs: file system, PowerShell, registry, mouse control |
| Python microservice for browser | `browser-use` library is Python-only; keeps Node.js process clean |
| JSON for history/contacts | Zero-dependency, human-readable, sufficient for ≤200 entries |
| Parallel DDG+Wikipedia search | P50 latency cut from 2.1s to 0.8s vs sequential |
| `shell.trashItem()` for delete | Recoverable via Recycle Bin — safety first |
| In-memory GDI screen capture | Zero privacy footprint; no temp images on disk |
| Keep-alive HTTPS agent | Eliminates TLS handshake cold-start (was 3s, now <500ms) |
