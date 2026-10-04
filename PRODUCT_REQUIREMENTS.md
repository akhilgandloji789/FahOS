# FahOS — Product Requirements Document

> **Version:** 1.0.0  
> **Status:** Production Ready  

---

## 1. Executive Summary

### Problem Statement

Windows users interact with their computers the same way they did 30 years ago — through menus, file explorers, keyboard shortcuts, and mouse clicks. Even with modern AI tools like ChatGPT, the gap between *asking* a question and *acting* on the answer still requires manual effort.

**The problem is not intelligence. The problem is the last mile — from AI output to desktop action.**

### Solution

FahOS is a **voice-first AI operating layer** that collapses the gap between thought and action on Windows. Users speak or type in natural language. FahOS understands intent, selects the right AI model, and executes real desktop actions — creating files, opening apps, navigating websites, sending messages — all without touching the keyboard or mouse.

### Core Value Proposition

> *"Your entire Windows desktop — controlled by your voice."*

---

## 2. Goals & Non-Goals

### Goals ✅
- Enable hands-free control of Windows through natural voice and text commands
- Execute real OS-level actions (file CRUD, app launch, web navigation, mouse clicks)
- Provide grounded, up-to-date answers using live web search
- Maintain 99.9% uptime via multi-model AI fallback chains
- Never cause accidental data loss through a safety guard system
- Work fully offline for core features (local Whisper, local file ops)

### Non-Goals ❌
- Cross-platform support (macOS, Linux) — Windows only in v1
- Cloud sync of user data — all storage is local-first
- Billing or subscription management — uses free API tiers
- Multi-user accounts — single-user desktop application

---

## 3. User Personas

### Persona 1: Power User — "Akhil"
- Developer / student who types fast but wants zero context-switch overhead
- Wants to open apps, search the web, and manage files without leaving their flow
- Values speed and reliability above all else
- Pain point: alt-tabbing between browser, IDE, and file explorer constantly

### Persona 2: Accessibility User — "Priya"
- Has repetitive strain injury or motor difficulties
- Needs to control the computer without heavy keyboard/mouse use
- Values voice accuracy and confirmation before destructive actions
- Pain point: existing voice assistants (Cortana, Alexa) cannot do real desktop tasks

### Persona 3: Presenter / Hackathon Demo-er
- Needs to demonstrate complex AI capabilities live in front of judges
- Cannot afford any failure, lag, or ambiguous output
- Values visual feedback (Chrome highlights, HUD cards, security guard prompts)
- Pain point: demos break when internet is slow or AI APIs time out

---

## 4. User Stories

### 4.1 Voice & Input
| ID | As a user, I want to... | Acceptance Criteria |
|:---|:---|:---|
| U1 | Speak a command and have it transcribed accurately | Transcription via Groq Whisper in <500ms; local ONNX fallback if offline |
| U2 | Type commands when I prefer not to speak | Text input field always available in HUD |
| U3 | Summon/dismiss FahOS with a keyboard shortcut | `Ctrl+Space` toggles overlay from any window |

### 4.2 AI Responses
| ID | As a user, I want to... | Acceptance Criteria |
|:---|:---|:---|
| U4 | Get answers grounded in today's facts | Live DDG+Wikipedia snippets injected for temporal queries |
| U5 | Get fast responses for simple questions | Simple queries answered in <1s via Gemini 3.6 Flash |
| U6 | Get deep, accurate answers for complex questions | Complex queries routed to GPT-OSS 120B or Qwen 3.8 |
| U7 | Never see a failure due to one AI provider being down | 3-provider cascading fallback per tier |

### 4.3 Filesystem
| ID | As a user, I want to... | Acceptance Criteria |
|:---|:---|:---|
| U8 | Create files by voice without navigating folders | `"create hi.txt in downloads"` creates the file in <500ms |
| U9 | Read file contents without opening an app | `"read notes.txt"` shows contents in HUD |
| U10 | List what's in a folder | `"list files in downloads"` shows real folder contents |
| U11 | Delete files safely | Delete prompts for confirmation; executes only on `"confirm delete..."` |

### 4.4 App Control
| ID | As a user, I want to... | Acceptance Criteria |
|:---|:---|:---|
| U12 | Open any app by name (with typo tolerance) | Fuzzy Levenshtein matching; `"open caluculator"` works |
| U13 | Open specific folders in File Explorer | `"open downloads"` opens the real folder via shell.openPath |
| U14 | Control media playback | Volume up/down, mute, play/pause, next/prev track |
| U15 | Lock the workstation by voice | `"lock screen"` calls rundll32 LockWorkStation |

### 4.5 Web & Browser
| ID | As a user, I want to... | Acceptance Criteria |
|:---|:---|:---|
| U16 | Search the web and get answers extracted for me | Browser agent navigates, highlights, and returns factual answer |
| U17 | Watch the AI browse in real time | Chrome maximizes, element highlights visible, action narrated in HUD |
| U18 | Retain cookies/logins between sessions | Persistent Chrome profile at `~/.fahos/chrome_agent_profile` |

### 4.6 Communications
| ID | As a user, I want to... | Acceptance Criteria |
|:---|:---|:---|
| U19 | Send WhatsApp messages by contact name | Deep-link via `whatsapp://send?phone=...` after directory lookup |
| U20 | Compose emails by contact name | Gmail web compose URL opened with pre-filled recipient |
| U21 | Save and manage contacts | `"save contact X as XXXXXXXXXX"` persists to local JSON |

### 4.7 Visual & Mouse
| ID | As a user, I want to... | Acceptance Criteria |
|:---|:---|:---|
| U22 | Click any UI element by describing it | `"click Save"` locates element via Gemini Vision and clicks it |
| U23 | No screenshots saved to disk | All screen captures are in-memory GDI, zero disk writes |

---

## 5. Feature Specifications

### 5.1 Voice Pipeline

**Priority:** P0 — Critical  
**Status:** ✅ Shipped

- Captures audio via `Web Audio API` at native sample rate (48kHz)
- Resamples to 16kHz mono using `OfflineAudioContext` with linear interpolation
- Transfers `Float32Array` over IPC as `ArrayBuffer` (zero-copy, no JSON serialization)
- Primary: Groq Whisper API (`whisper-large-v3-turbo`) — ~300ms
- Fallback: `@xenova/transformers` ONNX local model — works offline
- Custom WAV decoder handles multi-channel downmix, dynamic chunk traversal, type-safe buffer parsing

### 5.2 AI Orchestrator

**Priority:** P0 — Critical  
**Status:** ✅ Shipped

- Classifies queries into 5 tiers: simple, medium, complex, coding, vision
- Each tier has 3 providers in priority order with automatic failover
- Supports: Gemini (Google AI Studio), Groq (OpenAI-compatible), Ollama (local)
- Real-time grounding: DDG HTML + Wikipedia REST API, parallel execution, scored snippet injection

### 5.3 Filesystem CRUD Agent

**Priority:** P0 — Critical  
**Status:** ✅ Shipped

- Create: regex fastpath handles both `"create file X in Y"` and `"create X.txt in Y"`
- Read: searches Downloads, Desktop, Documents; 1MB display limit
- List: `readdirSync`, shows folders first, capped at 30 preview items
- Delete: 3-tier safety guard — requires explicit `"confirm"` word in follow-up

### 5.4 Autonomous Browser Agent

**Priority:** P1 — High  
**Status:** ✅ Shipped

- Python FastAPI at port 8484 accepts natural language tasks
- `browser-use` library with Gemini 3.1 Flash-Lite as multi-step planner
- Persistent Chrome profile retains cookies/sessions across FahOS restarts
- Windows User32 hooks auto-maximize Chrome window for visibility
- Native Electron browser fallback if Python service offline

### 5.5 Visual Mouse Agent

**Priority:** P1 — High  
**Status:** ✅ Shipped

- PowerShell GDI in-memory screen capture (System.Drawing)
- Gemini Vision API identifies UI element coordinates
- High-DPI scaleFactor applied before mouse movement
- C# P/Invoke `mouse_event()` for physical cursor control

### 5.6 Security Guard

**Priority:** P0 — Critical  
**Status:** ✅ Shipped

- Three tiers: SAFE (instant), CONFIRM (preview), DANGEROUS (blocked)
- Delete operations return `requiresConfirmation: true` until user says `"confirm"`
- `shell.trashItem()` sends deleted files to Recycle Bin (recoverable)

### 5.7 Local History

**Priority:** P2 — Medium  
**Status:** ✅ Shipped

- JSON flat file at `%AppData%/{AppName}/fahos_history.json`
- Rolling 200-entry window (oldest dropped automatically)
- Entries: `{ id, timestamp, query, response }`
- Zero cloud sync — 100% private

---

## 6. Non-Functional Requirements

| Requirement | Target | Status |
|:---|:---|:---|
| Voice transcription latency | < 500ms (Groq) | ✅ Met |
| Simple query response time | < 1 second | ✅ Met |
| Web search grounding latency | < 4.5 seconds | ✅ Met |
| File operation latency | < 200ms | ✅ Met |
| AI provider uptime | 99.9% (3-provider fallback) | ✅ Met |
| Test coverage | 113 tests, all passing | ✅ Met |
| Screen capture disk writes | Zero | ✅ Met |
| History data locality | Local only, never cloud | ✅ Met |

---

## 7. Tech Stack Summary

| Layer | Technology | Version |
|:---|:---|:---|
| Desktop Shell | Electron | 31.0.0 |
| Runtime | Node.js | v25.2.1 |
| UI | HTML5 / CSS3 / Vanilla JS | — |
| Voice (Cloud) | Groq Whisper API | whisper-large-v3-turbo |
| Voice (Local) | @xenova/transformers | ^2.17.2 |
| AI — Fast | Google Gemini 3.6 Flash | gemini-3.6-flash |
| AI — General | Groq Qwen 3.8 | qwen/qwen3.8-27b |
| AI — Heavy | OpenAI-compatible GPT-OSS | gpt-oss-120b |
| Web Search | DuckDuckGo HTML + Wikipedia REST | — |
| Browser Automation | Python FastAPI + Playwright | browser-use v0.13.8 |
| Screen Vision | PowerShell GDI + Gemini Vision | — |
| Mouse Control | C# P/Invoke user32.dll | — |
| Testing | Jest | ^29.7.0 |
| OS | Windows 10 / 11 x64 | — |

---

## 8. Success Metrics

| Metric | Result |
|:---|:---|
| Target Platform | **Windows 10 / 11** |
| Test Suite | **113 / 113 passing** |
| Features Shipped | **8 major subsystems** |
| Lines of Code | ~4,500 (JS) + ~600 (Python) |
| Build Time | Single hackathon session |

---

## 9. Known Limitations (v1.0)

| Limitation | Impact | Future Fix |
|:---|:---|:---|
| Windows-only | Cannot run on macOS/Linux | Cross-platform Electron build |
| Browser agent requires Python | Extra setup step | Bundle Python via PyInstaller |
| WhatsApp deep-link only | Cannot read incoming messages | WhatsApp Web automation |
| History not searchable | Manual scroll through 200 entries | Add full-text search index |
| Single-user | No multi-profile support | User profile system |

---

## 10. Roadmap (Post-Hackathon)

| Phase | Features |
|:---|:---|
| v1.1 | Packaged `.exe` installer, auto-start on Windows boot |
| v1.2 | WhatsApp Web message reading, incoming notification triage |
| v1.3 | Study Mode — document Q&A with RAG on local PDF/DOCX files |
| v2.0 | Cross-window context awareness, multi-monitor support |
| v2.1 | Plugin system for third-party integrations |
