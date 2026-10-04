<div align="center">

<img src="src/renderer/shared/assets/logo.png" alt="FahOS Logo" width="160"/>

# FahOS
### The Voice-First AI Operating Layer for Windows

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-31.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Playwright](https://img.shields.io/badge/Playwright-1.44.0-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![Tests](https://img.shields.io/badge/Tests-113%20Passing-brightgreen?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io)
[![Gemini](https://img.shields.io/badge/Gemini-3.6%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Groq](https://img.shields.io/badge/Groq-Qwen%203.8-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

> **FahOS** turns your Windows PC into a conversational AI operating environment.  
> Speak naturally or type commands — FahOS hears, perceives, navigates, and executes actions directly on your desktop.

</div>

---

## 📌 Executive Summary

Modern desktop operating systems remain tied to manual paradigms developed thirty years ago: navigating nested menus, juggling application windows, and repetitive mouse clicks. While Large Language Models (LLMs) have mastered conversational intelligence, they remain trapped inside web chat windows.

**FahOS bridges the "last mile"** — collapsing the gap between natural human intent and native OS execution. By combining high-speed voice transcription, a 5-tier multi-model reasoning matrix, native Windows automation, multimodal screen perception, and autonomous browser navigation, FahOS gives AI actual hands and eyes to control your PC.

---

## ✨ Features Implemented (Current Build)

### 🎙️ Dual-Engine Voice Pipeline
- **Real-Time 16kHz Resampling**: Captures microphone input via Web Audio API and resamples 48kHz stereo to 16kHz mono PCM Float32 samples in-memory using `OfflineAudioContext`.
- **Groq Cloud Whisper**: Sub-300ms speech-to-text powered by `whisper-large-v3-turbo` with dynamic RIFF WAV header synthesis.
- **Offline ONNX Fallback**: Local browser/device speech recognition via `@xenova/transformers` ensures uninterrupted transcription even without an active internet connection.

### 🧠 5-Tier AI Orchestrator & Intent Router
- **Multi-Provider Failover Matrix**: Seamless cascading failover across **Google Gemini 3.6 Flash**, **Groq (Qwen 3.8 / GPT-OSS)**, and local **Ollama** models.
- **Complexity Tier Classification**: Classifies queries into 5 specialized tiers (Simple, Medium, Complex, Coding, and Vision) to balance latency and computational depth.
- **Live Web Grounding**: Injects real-time DuckDuckGo and Wikipedia search snippets for temporal and current-event queries.

### 🌐 Autonomous Browser Agent & Embedded Live Controller
- **FastAPI Microservice Backend**: Dedicated asynchronous Python backend (`browser_service.py`) running headless Playwright automation.
- **Autonomous Navigation & Interaction**: Capable of multi-step website navigation, search queries, form inputs, and content summarization.
- **Persistent Profile Sessions**: Preserves browser context, cookies, and authenticated states across sessions.
- **Embedded Agent Browser Window**: Interactive Electron browser window (`agentBrowserWindow.js`) with live execution logs, activity indicators, step progress counters, and real-time cancellation controls.

### 👁️ Multimodal Screen Perception & Native Cursor Control
- **Ephemeral In-Memory GDI Capture**: High-speed desktop snapshot taking using GDI/Bitmap streams without ever writing image bytes to disk (zero disk traces, 100% ephemeral privacy).
- **Gemini Spatial UI Grounding**: AI screen perception model locating buttons, icons, and menus from natural language descriptions with 3-tier model failover (`gemini-3.6-flash` ➔ `gemini-3.5-flash` ➔ `gemini-3.1-flash-lite`).
- **Interactive Screen Region Snipper**: Full-screen transparent overlay allowing users to drag and snip any region of their desktop to ask visual questions (`snip.html` & `snip.js`).
- **Native Mouse Agency**: Windows P/Invoke cursor movement and click simulation to physically interact with on-screen elements.

### ⚡ Native Windows OS & Filesystem Actions
- **CRUD Filesystem Agent**: Natural language creation, reading, directory listing, and safe deletion across Desktop, Documents, and Downloads (`systemActions.js`).
- **Dynamic Start Menu Scanner**: Deep search indexing of installed Windows applications and shortcuts for instant voice-activated app launching.
- **Media & System Controls**: Voice-driven volume adjustment, track skipping, and instant workstation locking.

### 🛡️ 3-Tier Security Guard
To prevent accidental data loss, every action passes through an auditable security boundary:
- 🟢 **SAFE**: Reading files, listing directories, launching apps, answering questions (executes immediately).
- 🟡 **CONFIRM**: Creating files, composing draft emails (shows preview first).
- 🔴 **DANGEROUS**: Deleting files or directories (blocked until explicit `"confirm delete..."` command).

### 💾 Local-First Contacts & History Store
- **Private Conversation History**: Rolling 200-entry conversation log stored locally in `fahos_history.json`. 100% private — zero cloud storage.
- **Smart Contacts Directory**: Local address book supporting one-touch deep-link messaging via WhatsApp and Gmail.

### 🧪 Comprehensive Automated Test Suites (100% Pass Rate)
- **7 Jest Test Suites (113 Passing Tests)**: Rigorous automated verification across all critical paths.
- **Audio & Decoder Tests** (`whisper.test.js`, `whisper_edge_cases.test.js`): 16kHz PCM audio resampling, boundary values, odd sample counts, and corrupt header handling.
- **Intent & Routing Tests** (`intent.test.js`, `orchestrator.test.js`): Classification precision, confidence thresholds, and multi-provider failover chains.
- **Vision Agent Tests** (`visualAgent.test.js`): Mock screen captures, coordinate bounds, and cursor simulation checks.
- **Utilities & State Tests** (`contacts.test.js`, `markdown.test.js`): Contact matching, markdown sanitization, and state persistence.

### 🪟 Obsidian Glass HUD
- **Floating Frameless Window**: Obsidian glassmorphic overlay with top slide-down summon animation.
- **Global Hotkeys**: Instant access via `Ctrl + Space` or `Alt + Space`.
- **Zero-Flicker Dragging**: Native OS-level smooth repositioning and vertical expansion.

---

## 🔮 Upcoming & Planned Features (Next Hackathon Sprints)

The following capabilities are actively scheduled for the final sprint:

### 1. 📐 System Architecture Whitepaper & Specifications
- **ARCHITECTURE.md Deep-Dive**: Comprehensive system architecture documentation, IPC communication contracts, security threat modeling, and multi-threaded dataflow diagrams.
- **PRODUCT_REQUIREMENTS.md**: Full PRD covering core problem statements, target personas, latency budgets, non-functional requirements, and future platform roadmap.

### 2. 🎬 Live Hackathon Demo Walkthrough & Jury Guide
- **Curated Demonstration Script**: Tested voice workflows for live jury presentation (instant voice query ➔ GDI vision click ➔ autonomous Playwright browser automation ➔ protected filesystem deletion).

---

## 🛠️ Quick Start & Demo Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: 3.10+ (for browser microservice)
- **OS**: Windows 10 / 11

### 1. Installation
```bash
git clone https://github.com/akhilgandloji789/FahOS.git
cd FahOS
npm install
```

For browser automation support:
```bash
cd src/python
pip install -r requirements.txt
playwright install chromium
cd ../..
```

### 2. Configuration
Copy the template configuration file:
```bash
copy fahos.config.example.json fahos.config.json
```
*(Open `fahos.config.json` to insert your free Gemini or Groq API keys).*

### 3. Run Test Suites
Verify all 7 test suites (113 tests):
```bash
npm test
```

### 4. Launch Application
Run via npm or double-click the one-click batch script:
```bash
npm start
# OR double-click:
run-fahos.bat
```

Press **`Ctrl + Space`** or **`Alt + Space`** to summon the FahOS overlay from anywhere in Windows.

---

## 💡 Example Voice Commands to Try

| Category | Example Command | Expected Behavior |
|:---|:---|:---|
| **Autonomous Browsing** | *"Search for latest AI news on techcrunch"* | Opens embedded agent browser, navigates autonomously, and extracts summaries. |
| **Web Research** | *"Look up the stock price of Microsoft"* | Launches browser agent or live search grounding to fetch real-time financial data. |
| **Filesystem CRUD** | *"Create project_notes.txt in downloads"* | Creates file in `Downloads` and displays confirmation card. |
| **Directory Inspection** | *"List files in downloads"* | Reads and formats directory contents in HUD. |
| **File Reading** | *"Read project_notes.txt from downloads"* | Displays file contents in markdown view. |
| **Safety Guard** | *"Delete project_notes.txt from downloads"* | **Blocked** by security guard; prompts for explicit confirmation. |
| **Visual Snipping** | Click **✂️ Snip** button / shortcut | Opens transparent region snipper to ask multimodal questions about UI. |
| **Vision Mouse Click** | *"Click on the search bar"* | In-memory GDI capture ➔ Gemini Vision finds coordinates ➔ moves cursor and clicks. |
| **App Control** | *"Open Calculator"* / *"Launch Notepad"* | Indexes Start Menu and starts application. |
| **Media** | *"Volume up"* / *"Mute audio"* / *"Lock PC"* | Triggers native Windows system controls. |
| **Reasoning & AI** | *"Explain quantum computing simply"* | Dynamically routes query to optimal AI tier. |

---

## 📄 License
MIT License. Built with precision for the hackathon.
