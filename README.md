<div align="center">

<img src="src/renderer/shared/assets/logo.png" alt="FahOS Logo" width="150"/>

# FahOS

### The Voice-First AI Operating Layer for Windows

*Your PC. Your Voice. Your AI.*

<br/>

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-31.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Playwright](https://img.shields.io/badge/Playwright-1.44.0-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![Tests](https://img.shields.io/badge/Tests-113%20Passing-brightgreen?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io)
[![Gemini](https://img.shields.io/badge/Gemini-3.6%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Groq](https://img.shields.io/badge/Groq-Qwen%203.8-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

> **FahOS** transforms your Windows PC into a conversational AI operating environment.
> Speak naturally or type commands — FahOS hears, perceives, reasons, and executes actions directly on your desktop.

<br/>

[![▶ Watch Demo on YouTube](https://img.shields.io/badge/▶%20Watch%20Demo-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/SUAycS4jKGM?si=TwUl7Ac4AHYsrzm7)
&nbsp;&nbsp;
[![📊 View Presentation](https://img.shields.io/badge/📊%20View%20Presentation-Google%20Drive-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/1tONjoiOU7snfEYmmgrPsiL8wShR7DVR6/view?usp=sharing)

</div>

---

## 📖 Table of Contents

| # | Section |
|---|---------|
| 1 | [What is FahOS?](#-what-is-fahos) |
| 2 | [Tech Stack](#-tech-stack) |
| 3 | [System Architecture](#-system-architecture) |
| 4 | [The Floating Glass HUD](#-the-floating-glass-hud) |
| 5 | [Intent Router](#-intent-router) |
| 6 | [AI Orchestration Layer](#-ai-orchestration-layer--5-tier-model-matrix) |
| 7 | [Voice Pipeline](#-dual-engine-voice-pipeline) |
| 8 | [Open Apps](#-open-any-app-with-voice) |
| 9 | [WhatsApp Messaging](#-quick-whatsapp-messaging) |
| 10 | [Gmail Compose](#-quick-gmail-compose) |
| 11 | [Filesystem CRUD Agent](#-filesystem-crud-agent) |
| 12 | [Contacts Directory](#-contacts-directory) |
| 13 | [Conversation History](#-private-conversation-history) |
| 14 | [Screen Snipper & Gemini Vision](#-screen-snipper--gemini-vision) |
| 15 | [Autonomous Browser Agent](#-autonomous-browser-agent) |
| 16 | [3-Tier Security Guard](#-3-tier-security-guard) |
| 17 | [Live Web Grounding](#-live-web-grounding) |
| 18 | [Media & System Controls](#-media--system-controls) |
| 19 | [Automated Test Suites](#-automated-test-suites) |
| 20 | [Quick Start](#-quick-start) |
| 21 | [Example Commands](#-example-voice-commands) |
| 22 | [Project Structure](#-project-structure) |

---

## 🚀 What is FahOS?

Modern desktop operating systems still rely on manual paradigms that are decades old — nested menus, dragging windows, repetitive mouse clicks. Meanwhile, Large Language Models have become incredibly capable, yet remain **trapped inside web browser chat boxes** with no access to your actual computer.

**FahOS bridges this last mile.** It connects natural human language to native OS execution by giving AI:

- 🎙️ **Ears** — Sub-300ms real-time voice transcription
- 👁️ **Eyes** — 100% ephemeral in-memory screen perception
- 🤖 **A Brain** — A 5-tier AI orchestrator selecting the optimal model per task
- ✋ **Hands** — Native Windows automation, visual mouse agency, and autonomous browser navigation

Instead of copying AI text from a browser and manually doing things yourself, **FahOS understands what you want and does it for you.**

---

## 🧰 Tech Stack

<div align="center">

| Layer | Technology |
|:------|:-----------|
| **Desktop Framework** | Electron 31 (Node.js, Chromium) |
| **Frontend** | HTML5, CSS3 (Glassmorphism), Vanilla JavaScript |
| **Backend Logic** | Node.js (Main Process), IPC Bridge |
| **AI Models — Cloud** | Google Gemini 3.6 Flash, Gemini 3.1 Flash-Lite, Gemini Vision |
| **AI Models — Cloud** | Groq (Qwen 3.8, GPT-OSS 20B/120B), Whisper Large-v3-Turbo |
| **AI Models — Local** | Ollama (Llama 3.2, DeepSeek-R1, Qwen2.5-Coder) |
| **Voice — Offline** | @xenova/transformers ONNX (Whisper Tiny.en) |
| **Browser Automation** | Playwright (Python), FastAPI microservice, browser-use |
| **Windows Automation** | PowerShell, Win32 P/Invoke, Electron shell APIs |
| **Screen Capture** | GDI+ Bitmap streams (100% in-memory, RAM-only) |
| **Testing** | Jest (7 test suites, 113 tests) |
| **Language** | JavaScript (Node.js), Python 3.10+, C# (.NET) |

</div>

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INPUT LAYER                                │
│   🎙️ Voice (Web Audio API)   ⌨️ HUD Text Prompt   ✂️ Screen Snipper     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                     VOICE TRANSCRIPTION ENGINE                          │
│      Groq Whisper Large-v3-Turbo  ──failover──▶  Local ONNX Whisper     │
│              16kHz Float32 PCM  •  <300ms latency                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                         INTENT ROUTER                                   │
│  Regex + Pattern Matching • Contextual Classification • 20+ Intent Types│
│  ┌──────────────┬───────────┬──────────────┬──────────┬───────────────┐ │
│  │  App Launch  │  WhatsApp │  Email Compose│  File Op │  Web Search   │ │
│  │  Filesystem  │  Contacts │  Vision Click │  Browser │  Conversational│ │
│  └──────────────┴───────────┴──────────────┴──────────┴───────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│               AI ORCHESTRATION LAYER (5-Tier Model Matrix)              │
│   Simple ▶ Gemini 3.6 Flash     │   Coding  ▶ Qwen 3.8 / Ollama        │
│   Medium ▶ Gemini / Qwen        │   Vision  ▶ Gemini Vision Models      │
│   Complex▶ GPT-OSS 120B         │   Failover Chain: Gemini▶Groq▶Ollama  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
┌──────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  WINDOWS OS      │   │  GEMINI VISION       │   │  BROWSER AGENT      │
│  AGENT           │   │  MOUSE AGENT         │   │  (FastAPI+Playwright)│
│  • App Launcher  │   │  • GDI RAM Capture   │   │  • Multi-step Nav   │
│  • Filesystem    │   │  • Coord Detection   │   │  • Form Fill & Click│
│  • Media Control │   │  • Win32 P/Invoke    │   │  • Content Extract  │
│  • PowerShell    │   │  • Screen Snipper    │   │  • Live Step HUD    │
└──────────────────┘   └─────────────────────┘   └─────────────────────┘
        │                        │                          │
        └────────────────────────┼─────────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │   OBSIDIAN GLASS HUD   │
                    │  Floating • Always-On  │
                    │  Top • Frameless       │
                    └────────────────────────┘
```

---

## 🪟 The Floating Glass HUD

The **Obsidian Glass HUD** is FahOS's core interface — a sleek, borderless floating window that sits above every application on your desktop.

**Key UI Features:**
- ✦ **Glassmorphic Design** — Semi-transparent obsidian backdrop with ambient twinkle star animations
- 📍 **Always-On-Top** — Floats above all open applications; never gets lost
- ↕️ **Zero-Flicker Drag & Resize** — Native OS-level smooth repositioning and vertical drag expansion
- 🎛️ **Speed-Dial Droplet Menu** — Expandable `+` button revealing Snip, Directory, and History shortcuts
- 🏷️ **Real-Time Action Pill** — Shows current model, tier, and execution status at a glance
- 🔔 **Security Modal** — Inline red-tier confirmation modal for dangerous operations
- ⌨️ **Smart Textarea Input** — Voice or keyboard input with snipped image attachment preview

**Hotkeys:**

| Shortcut | Action |
|----------|--------|
| `Ctrl + Space` | Summon / Dismiss FahOS HUD |
| `Alt + Space` | Summon / Dismiss FahOS HUD |
| `Enter` | Submit prompt |
| `Escape` | Dismiss HUD |

---

## 🧭 Intent Router

The **Intent Router** (`router.js`) is FahOS's first line of intelligence. Before any AI model is invoked, the router performs **instant, deterministic pattern matching** to classify exactly what the user wants.

This makes common actions **near-instantaneous** — no model roundtrip needed.

**How it works:**
1. Raw voice or text input arrives.
2. The router applies a priority-ordered chain of regex patterns and contextual rules.
3. If a direct match is found (e.g., file creation, WhatsApp message), the intent is dispatched instantly to the correct executor.
4. If no direct match exists, the query is forwarded to the AI Orchestrator for reasoning.

**Intent types recognized:**

| Priority | Intent | Example Command |
|:--------:|--------|----------------|
| 1 | Informational / Educational Query | *"What is quantum computing?"* |
| 2 | Stop / Cancel Active Task | *"Stop browser"* |
| 3 | Save / Add Contact | *"Save contact Sai as 9876543210"* |
| 4 | List All Contacts | *"Show contacts"* |
| 5 | WhatsApp Message | *"Send hi to Sai on WhatsApp"* |
| 6 | Email Compose | *"Compose email to Sai about demo"* |
| 7 | WhatsApp Chat Open | *"Open Sai chat"* |
| 8 | File / Folder Creation | *"Create notes.txt in Downloads"* |
| 9 | File Read | *"Read notes.txt from Downloads"* |
| 10 | Directory Listing | *"List files in Downloads"* |
| 11 | YouTube / Web Search | *"Search TechCrunch for AI news"* |
| 12 | File / Folder Deletion | *"Delete notes.txt from Downloads"* |
| 13 | App / Folder Open | *"Open Calculator"* |
| 14 | Visual Click | *"Click on the search bar"* |
| 15 | AI Orchestrated Response | Everything else |

> **What you see in the terminal:**
> ```
> [FahOS Agent] Direct routing to send WhatsApp message to: "Sai", text: "hi"
> [FahOS Agent] Direct routing to create file: "notes.txt" in "Downloads"
> [FahOS Orchestrator] Query: "Explain blockchain..." → Tier: medium
> ```

---

## 🧠 AI Orchestration Layer & 5-Tier Model Matrix

The **AI Orchestrator** (`orchestrator.js`) sits behind the Intent Router and handles all queries requiring reasoning or generation. It dynamically classifies every query into one of **5 complexity tiers** and routes it to the most suitable model — automatically failing over across providers.

### The 5 Tiers

| Tier | Description | Primary Model | Max Tokens | Temperature |
|:----:|-------------|:-------------:|:----------:|:-----------:|
| 🟢 **Simple** | Quick facts, greetings, basic info | Gemini 3.6 Flash | 500 | 0.1 |
| 🔵 **Medium** | Explanations, summaries, comparisons | Gemini 3.6 Flash / Qwen 3.8 | 1,500 | 0.2 |
| 🟠 **Complex** | Deep reasoning, business plans, analysis | GPT-OSS 120B / Gemini | 3,000 | 0.3 |
| 🔴 **Coding** | Code generation, debugging, architecture | Qwen 3.8 / DeepSeek-R1 | 4,000 | 0.1 |
| 👁️ **Vision** | Image analysis, OCR, diagram reading | Gemini Vision Models | 2,000 | 0.2 |

### Failover Chain

```
Gemini 3.6 Flash  ──▶  Groq (Qwen 3.8 / GPT-OSS)  ──▶  Local Ollama  ──▶  Mock Provider
```

If any provider fails or rate-limits, FahOS automatically cascades to the next without any interruption to the user.

### Tool Synthesis System

When the orchestrator determines an action is required, it instructs the AI model to return a structured tool command in a code block:

```
web_search: latest AI news
youtube_search: lofi hip hop music
open_app: calculator
create_file: report.txt | Downloads
delete_file: old_notes.txt | Desktop
send_whatsapp_message: Sai | Good morning!
compose_email: sai@example.com | Project update
visual_click: search bar
browser_control: Find the top 5 AI startups on TechCrunch
```

The router parses this output and dispatches the appropriate Windows, browser, or vision action.

> **What you see in the terminal:**
> ```
> ======================================================
> [FahOS Agent] [Qwen Brain] Synthesized Windows Command:
> >> open_app: calculator
> ======================================================
> [FahOS OS Agent] [Success] App launched successfully (Exit Code: 0)
> ```

---

## 🎙️ Dual-Engine Voice Pipeline

FahOS uses a **two-stage, fault-tolerant voice architecture** to guarantee transcription under any network condition.

### Stage 1 — Cloud (Primary): Groq Whisper Large-v3-Turbo

- Captures microphone input via the **Web Audio API**
- Resamples 48kHz stereo input to **16kHz mono Float32 PCM** in real-time using `OfflineAudioContext`
- Synthesizes a dynamic **RIFF WAV header** entirely in memory (no disk I/O)
- Streams the buffer to **Groq's LPU cloud** running `whisper-large-v3-turbo`
- Average latency: **< 300 milliseconds**

### Stage 2 — Local (Fallback): ONNX Whisper

- Powered by `@xenova/transformers` running directly inside the Electron renderer process
- Activates automatically if Groq API key is missing, rate-limited, or internet is unavailable
- Uses the compact `Whisper Tiny.en` ONNX model for offline English transcription
- **Zero cloud dependency** — works completely air-gapped

> *Example: Say "What is the capital of France?" — transcribed in under 300ms.*

---

## 🚀 Open Any App with Voice

FahOS includes a **dynamic app resolution system** that combines a built-in app catalog with live Windows Start Menu scanning and fuzzy typo correction.

**How it resolves apps:**
1. **Exact alias match** from the built-in `KNOWN_APPS` catalog
2. **Prefix / substring match** across all registered aliases
3. **Levenshtein fuzzy match** — tolerates typos (e.g. "Calclator" → Calculator)
4. **Live Start Menu `.lnk` Scanner** — deep-indexes `%APPDATA%\Microsoft\Windows\Start Menu\Programs` to find any installed application

**Built-in App Catalog (Includes):**

| App | Voice Aliases |
|-----|--------------|
| WhatsApp | *whatsapp, whattsapp, whatapp, wtsp* |
| Calculator | *calculator, calc, calcy, math* |
| Notepad | *notepad, notes, text editor* |
| Chrome | *chrome, browser, internet, google chrome* |
| VS Code | *vscode, code, editor, visual studio code* |
| Spotify | *spotify, spotfy, spotifi* |
| YouTube | *youtube, yt, ytube* |
| Settings | *settings, control panel, preferences* |
| File Explorer | *explorer, files, file manager, this pc* |
| Task Manager | *task manager, taskmgr, tasks* |
| CMD | *cmd, command prompt, console* |
| PowerShell | *powershell, posh* |

> *Say: **"Open Calculator"** → FahOS resolves `calc.exe` → launches instantly*

---

## 💬 Quick WhatsApp Messaging

Send WhatsApp messages to saved contacts directly from the HUD — no manual navigation required.

**How it works:**
1. The Intent Router detects WhatsApp message intent using 6 specialized regex patterns
2. Extracts the **contact name** and **message text** from natural speech
3. Looks up the phone number from the local FahOS Contacts Directory
4. Opens WhatsApp via the native `whatsapp:` deep-link protocol and navigates to the chat

**Supported voice patterns:**
```
"Send hi to Sai on WhatsApp"
"Send a WhatsApp message to Sai saying good morning"
"WhatsApp Sai: I'll be late today"
"Message Sai good luck for the exam"
"Open WhatsApp and send hi to Sai"
```

> The router also handles fuzzy app names: *"whattsapp", "whatapp", "watsap"* — all resolve correctly.

---

## 📧 Quick Gmail Compose

Compose and pre-fill Gmail emails without opening a browser manually.

**How it works:**
1. Intent Router extracts recipient, subject, and body from natural speech
2. Validates the target (must not be a programming query or WhatsApp-type message)
3. Opens Gmail in the default browser with a **pre-filled compose window** using Gmail's URL API

**Supported voice patterns:**
```
"Compose email to Sai about project update saying the demo is ready"
"Send an email to Sai saying good morning"
"Draft a mail to sai@example.com with subject Meeting Tomorrow"
"Email Sai about the internship"
```

---

## 📁 Filesystem CRUD Agent

FahOS acts as a natural language filesystem agent supporting full **Create, Read, List, and Delete** operations across your personal folders.

### Supported Directories

| Folder | Aliases |
|--------|---------|
| Desktop | *desktop, dekstop, desktp* |
| Downloads | *downloads, download, downlod* |
| Documents | *documents, docs, my documents* |
| Pictures | *pictures, photos, images, pics* |
| Music | *music, songs, audio* |
| Videos | *videos, movies* |

### Operations

| Operation | Example Command |
|-----------|----------------|
| **Create File** | *"Create notes.txt in Downloads"* |
| **Create Folder** | *"Create a folder named Projects in Desktop"* |
| **Read File** | *"Read notes.txt from Downloads"* |
| **List Directory** | *"List files in Downloads"* |
| **Delete** | *"Delete notes.txt from Downloads"* *(requires confirmation)* |

**Smart Features:**
- Files larger than 1 MB display file size info instead of dumping content
- Directory listings show up to 30 items with overflow counts
- All paths resolve through both OneDrive-linked and standard Windows home directories

---

## 📇 Contacts Directory

FahOS has a built-in **local-first contact book** that powers quick WhatsApp messaging and Gmail compose.

**Features:**
- ➕ **Add Contact** — via voice (*"Save contact Sai as 9876543210 email sai@gmail.com"*) or the UI
- 📋 **View All Contacts** — voice (*"Show contacts"*) or click the Directory icon in the HUD
- 🔍 **Fuzzy Contact Lookup** — partial name matching when resolving contacts for WhatsApp/Gmail
- 📱 **Auto Phone Formatting** — automatically adds country code `91` for 10-digit Indian numbers and strips `+` for WhatsApp deep links
- ❌ **Delete Contact** — via the Directory UI
- 💾 **Stored locally** in `%APPDATA%\FahOS\fahos_contacts.json` — zero cloud sync

**Directory UI:**
- Slide-in view with name, phone, and email input fields
- One-touch **WhatsApp** and **Gmail** deep-link buttons per contact
- Real-time contact count badge

---

## 📜 Private Conversation History

Every interaction with FahOS is logged in a **local, private history store**.

**Features:**
- 🗂️ Stores up to **200 most recent** queries and responses
- ⬇️ New entries prepended at the top (newest first)
- 🧹 **One-click Clear History** button in the History drawer
- 📅 Each entry is timestamped with a unique ID (`Date.now().toString(36)`)
- 💾 Stored in `%APPDATA%\FahOS\fahos_history.json`
- 🔒 **Zero cloud tracking** — completely on-device, never transmitted

**Access:** Click the `+` droplet menu → History icon (clock)

---

## ✂️ Screen Snipper & Gemini Vision

FahOS can **see your screen** and interact with it — powering two distinct visual capabilities.

### 1. Interactive Screen Snipper

A full-screen transparent overlay that lets you drag-select any region of your desktop.

**How to use:**
1. Click the `+` droplet → **Snip** button (✂️ scissors icon)
2. The screen dims and a crosshair cursor appears
3. Drag to select any region (chart, error message, code, UI element)
4. The snipped image attaches as a thumbnail in the HUD prompt input
5. Type or speak your question — e.g., *"What is shown in this image?"*

**Privacy:** The snipped region is captured purely in RAM and sent directly to Gemini Vision. **Nothing is saved to disk.**

### 2. Visual Mouse Agency ("Computer Use")

FahOS can **click on-screen elements** using natural language commands.

**How it works:**
1. You say: *"Click on the search bar"*
2. FahOS captures a full-screen GDI bitmap stream **in memory** (RAM only, zero disk traces)
3. The base64 image is sent to **Gemini 3.6 Flash** with a structured coordinate-detection prompt
4. Gemini returns `{"found": true, "x": 843, "y": 312, "label": "search bar"}`
5. FahOS uses **Win32 P/Invoke** to physically move the cursor and click
6. 3-tier Gemini model cascade: `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.1-flash-lite`

> *Say: **"Click on the search bar"** — hands off the mouse and watch the cursor move*

---

## 🌐 Autonomous Browser Agent

For multi-step web tasks, FahOS deploys its **Autonomous Browser Agent** — a full headless Playwright browser controlled by AI.

### Architecture

```
FahOS HUD Command
        │
        ▼
agentBrowserWindow.js  ──▶  creates FahOS Unified Browser Window
        │
        ▼
agentBrowserController.js  (Native Electron / Gemini-powered DOM navigator)
        │                    OR
        ▼
FastAPI Python Microservice (browser-service/)
        │
        ▼
Playwright Chromium  ──▶  Real website navigation
        │
        ▼
Gemini 3.1 Flash-Lite  ──▶  Decision making & content extraction
        │
        ▼
Summary returned to FahOS HUD
```

### Agent Browser Window

The **FahOS Unified Browser** is a large-screen Electron window (`94% width × 92% height`) featuring:

- 📡 **Live Step Counter** — shows exactly which step the agent is executing
- 🟢 **Activity Indicator** — animated status pill showing agent state
- ⏹️ **Instant Stop Button** — cancels the browser task at any time
- 💬 **Execution Log** — real-time log of agent decisions inside the HUD
- 🔐 **Persistent Profile** — preserves cookies and authenticated sessions across tasks

### Supported Tasks

```
"Search TechCrunch for latest AI news"
"Open GitHub and find trending repositories"
"Look up the stock price of Microsoft"
"Open YouTube and search for lofi music"
"Search Google for the best Python tutorials"
```

---

## 🛡️ 3-Tier Security Guard

Every action that FahOS executes passes through a **deterministic, auditable security boundary**.

```
🟢 SAFE ──────────────────────────── Executes Immediately
   • Read files          • List directories
   • Launch apps         • Open websites
   • Get system info     • Voice Q&A

🟡 CONFIRM ────────────────────────── Shows Preview First
   • Create files        • Create folders
   • Compose emails      • Click UI elements
   • Run PowerShell      • Browser navigation

🔴 DANGEROUS ──────────────────────── Strictly Blocked Until Approved
   • Delete files        • Delete folders
   • Install programs    • Shutdown / Restart PC
```

**Red Tier Flow:**
1. User says *"Delete notes.txt from Downloads"*
2. FahOS detects `DANGEROUS` tier
3. An interactive **Security Confirmation Modal** appears in the HUD
4. The modal shows: file name, full path, and a warning message
5. User must explicitly click **"Confirm & Execute"** — or click **"Cancel Action"**
6. No deletion occurs unless the user physically confirms

---

## 🌍 Live Web Grounding

For real-time and temporal queries (news, current leaders, live prices), FahOS injects **live web snippets** into the AI context before generating a response.

**How it works:**
- Concurrent fetch from **DuckDuckGo HTML** and **Wikipedia Search API**
- Snippets scored by relevance (current-year dates, proper names, leadership verbs)
- Top-scored snippets injected into the system prompt context
- Uses a **persistent HTTPS keep-alive agent** to eliminate TLS cold-start delays

> *Ask: **"Who is the current Prime Minister of India?"** — FahOS fetches live data before answering*

---

## 🎵 Media & System Controls

Control your Windows system state with simple voice commands.

| Command | Action |
|---------|--------|
| *"Volume up"* | Increases master volume via PowerShell |
| *"Volume down"* | Decreases master volume |
| *"Mute audio"* | Mutes system audio |
| *"Lock PC"* | Instantly locks the workstation |
| *"Open Spotify and play lofi"* | Launches Spotify via `spotify:` protocol |
| *"Play [song] on YouTube"* | Resolves direct YouTube watch URL & plays |

---

## 🧪 Automated Test Suites

FahOS is backed by **7 Jest test suites with 113 passing tests** — a 100% pass rate across all critical paths.

| Test Suite | File | Coverage Area |
|------------|------|---------------|
| **Whisper Core** | `whisper.test.js` | 16kHz PCM resampling, RIFF WAV header synthesis |
| **Whisper Edge Cases** | `whisper_edge_cases.test.js` | Boundary values, odd sample counts, corrupt headers |
| **Intent Classification** | `intent.test.js` | Intent routing precision and confidence thresholds |
| **AI Orchestrator** | `orchestrator.test.js` | Multi-provider failover chains, tier classification |
| **Visual Agent** | `visualAgent.test.js` | Mock screen captures, coordinate bounds, click simulation |
| **Contacts** | `contacts.test.js` | Contact matching, phone normalization, CRUD logic |
| **Markdown** | `markdown.test.js` | Markdown sanitization, rendering edge cases |

```bash
npm test
# Output: Test Suites: 7 passed, 7 total | Tests: 113 passed, 113 total
```

---

## ⚙️ Quick Start

### Prerequisites

| Requirement | Version |
|------------|---------|
| Node.js | v18.0.0 or higher |
| Python | 3.10+ (for browser automation) |
| OS | Windows 10 / 11 |

### 1. Clone & Install

```bash
git clone https://github.com/akhilgandloji789/FahOS.git
cd FahOS
npm install
```

### 2. Browser Automation Support (Optional)

```bash
cd browser-service
pip install -r requirements.txt
playwright install chromium
cd ..
```

### 3. Configuration

```bash
copy fahos.config.example.json fahos.config.json
```

Open `fahos.config.json` and add your API keys:

```json
{
  "aiProvider": "gemini",
  "geminiApiKey": "YOUR_GEMINI_API_KEY_HERE",
  "providers": {
    "openaiCompatible": {
      "apiKey": "YOUR_GROQ_API_KEY_HERE",
      "baseUrl": "https://api.groq.com/openai/v1",
      "model": "qwen/qwen3.8-27b"
    },
    "ollama": {
      "model": "llama3.2:1b"
    }
  }
}
```

> Get a free Gemini key at [ai.google.dev](https://ai.google.dev) and a free Groq key at [console.groq.com](https://console.groq.com)

### 4. Run Tests

```bash
npm test
```

### 5. Launch FahOS

```bash
npm start
# OR double-click:
run-fahos.bat
```

Press **`Ctrl + Space`** from anywhere in Windows to summon FahOS.

---

## 💡 Example Voice Commands

| Category | Command | What Happens |
|:---------|:--------|:-------------|
| **Voice Q&A** | *"What is the capital of France?"* | Gemini answers inside the HUD in <300ms |
| **Open App** | *"Open Calculator"* | Start Menu scanner resolves and launches `calc.exe` |
| **Open App** | *"Launch VS Code"* | Resolves and opens Visual Studio Code |
| **WhatsApp** | *"Send hi to Sai on WhatsApp"* | Opens WhatsApp chat with message pre-populated |
| **WhatsApp** | *"Message Sai I'll be late"* | Same — 6 natural language patterns supported |
| **Gmail** | *"Compose email to Sai about project update"* | Opens Gmail compose with fields filled |
| **Create File** | *"Create notes.txt in Downloads"* | File created; confirmation card shown |
| **Create Folder** | *"Create a folder named Projects in Desktop"* | Folder created on Desktop |
| **Read File** | *"Read notes.txt from Downloads"* | File contents displayed in HUD |
| **List Files** | *"List files in Downloads"* | Directory contents displayed with icons |
| **Delete (Safe)** | *"Delete notes.txt from Downloads"* | Security modal appears; deletion blocked |
| **Save Contact** | *"Save contact Sai as 9876543210"* | Contact saved to local directory |
| **Show Contacts** | *"Show contacts"* | Full contact list displayed in HUD |
| **Snip Screen** | Click `+` → Snip → drag region | Screen region captured; ask Gemini about it |
| **Vision Click** | *"Click on the search bar"* | GDI capture → Gemini finds coordinates → cursor clicks |
| **Web Search** | *"Search Google for latest AI news"* | Playwright browser agent navigates and summarizes |
| **YouTube** | *"Play lofi music on YouTube"* | Resolves direct watch URL and plays |
| **Browser** | *"Search TechCrunch for AI startups"* | Agent browser navigates site autonomously |
| **Media** | *"Volume up"* | Windows master volume increases |
| **Media** | *"Mute audio"* | System audio muted |
| **System** | *"Lock PC"* | Workstation locks immediately |
| **History** | Click `+` → History | Last 200 interactions displayed |

---

## 📂 Project Structure

```
FahOS/
├── src/
│   ├── main/                          # Electron Main Process
│   │   ├── main.js                    # App entry, BrowserWindow, IPC, hotkeys
│   │   ├── preload.js                 # Secure IPC bridge (contextBridge)
│   │   ├── config.js                  # Config loader (fahos.config.json)
│   │   └── features/
│   │       ├── ai/
│   │       │   ├── router.js          # 🧭 Intent Router (900 lines, 15+ intent types)
│   │       │   ├── orchestrator.js    # 🧠 5-Tier AI Model Orchestrator
│   │       │   ├── prompts.js         # System prompt & tool synthesis templates
│   │       │   ├── webSearchService.js# 🌍 Live DuckDuckGo + Wikipedia grounding
│   │       │   └── providers/
│   │       │       ├── gemini.js      # Google Gemini API provider
│   │       │       ├── openai-compatible.js # Groq / OpenAI-compatible provider
│   │       │       ├── ollama.js      # Local Ollama provider
│   │       │       └── mock.js        # Mock provider (testing)
│   │       ├── voice/
│   │       │   ├── whisperService.js  # 🎙️ Groq Whisper + ONNX fallback
│   │       │   ├── localWhisper.js    # Local @xenova/transformers ONNX runner
│   │       │   ├── nativeStt.js       # Native Windows Speech-to-Text bridge
│   │       │   ├── FahOSSpeech.cs     # C# Windows Speech Recognition
│   │       │   └── TriggerVoiceTyping.cs # C# voice trigger utility
│   │       ├── vision/
│   │       │   └── visualAgent.js     # 👁️ GDI capture + Gemini Vision + Win32 mouse
│   │       ├── browser/
│   │       │   ├── agentBrowserWindow.js    # Large-screen unified browser window manager
│   │       │   ├── agentBrowserController.js# Gemini-powered DOM navigator (536 lines)
│   │       │   ├── browserService.js        # FastAPI microservice bridge
│   │       │   └── agentBrowserPreload.js   # Browser window IPC preload
│   │       ├── system/
│   │       │   ├── systemActions.js   # ⚡ 1280-line Windows OS action engine
│   │       │   └── actionRouter.js    # Action dispatching layer
│   │       ├── contacts/
│   │       │   └── contactsService.js # 📇 Local contacts CRUD + phone normalization
│   │       └── history/
│   │           └── historyService.js  # 📜 Rolling 200-entry local history store
│   └── renderer/                      # Electron Renderer Process
│       ├── overlay/
│       │   ├── index.html             # Main HUD layout (240 lines)
│       │   ├── overlay.js             # HUD logic, mic, voice, history, contacts
│       │   └── styles.css             # Glassmorphic CSS (36KB)
│       ├── browser/
│       │   ├── agentBrowser.html      # Unified browser window HTML
│       │   ├── agentBrowser.js        # Live step HUD + webview controller
│       │   └── agentBrowser.css       # Browser window styling
│       ├── snipper/
│       │   ├── snip.html              # Full-screen transparent snipper overlay
│       │   └── snip.js                # Drag-select + clipboard + IPC capture
│       └── shared/
│           ├── markdown.js            # Markdown → HTML renderer
│           └── theme.css              # Shared CSS variables
├── browser-service/                   # Python FastAPI Browser Microservice
│   ├── main.py                        # FastAPI app entry point
│   ├── agent.py                       # browser-use Agent wrapper (Gemini)
│   ├── browser_manager.py             # Playwright browser lifecycle manager
│   ├── task_manager.py                # Async task queue manager
│   ├── config.py                      # Config reader (fahos.config.json)
│   ├── schemas.py                     # Pydantic request/response schemas
│   └── requirements.txt               # Python dependencies
├── tests/                             # Jest Test Suites
│   ├── whisper.test.js                # Audio pipeline tests
│   ├── whisper_edge_cases.test.js     # 113 edge-case audio tests
│   ├── intent.test.js                 # Intent routing precision
│   ├── orchestrator.test.js           # AI failover chain tests
│   ├── visualAgent.test.js            # Vision coordinate tests
│   ├── contacts.test.js               # Contact CRUD + matching
│   └── markdown.test.js              # Markdown rendering tests
├── fahos.config.example.json          # Config template
├── package.json                       # Node.js dependencies
├── jest.config.js                     # Jest test configuration
├── run-fahos.bat                      # One-click launch script
└── setup-and-run.bat                  # Full setup + launch script
```

---

<div align="center">

## 🌟 Core Highlights at a Glance

| Metric | Value |
|--------|-------|
| Voice Transcription Latency | **< 300ms** |
| Screen Capture Method | **100% In-Memory (Zero Disk)** |
| AI Model Tiers | **5 Dynamic Tiers** |
| Provider Failover Chain | **Gemini → Groq → Ollama → Mock** |
| Intent Types Recognized | **15+ Deterministic Patterns** |
| Security Tiers | **3 (Safe / Confirm / Dangerous)** |
| Automated Tests | **113 Passing / 113 Total** |
| Test Suites | **7 Jest Suites** |
| History Capacity | **200 Local Entries (Private)** |
| Cloud Data Sent | **Zero (Local-First)** |

<br/>

**Built with ❤️ for the Hackathon · MIT License**

*"Operating systems should adapt to human speech — not the other way around."*

</div>
