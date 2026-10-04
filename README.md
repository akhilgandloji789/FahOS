<div align="center">

<img src="src/renderer/shared/assets/logo.png" alt="FahOS Logo" width="160"/>

# FahOS
### The Voice-First AI Operating Layer for Windows

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-31.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

> **FahOS** turns your Windows PC into a conversational AI operating environment.  
> Speak naturally or type commands — FahOS hears, perceives, and executes actions directly on your desktop.

</div>

---

## 📌 Overview

FahOS is designed as an ultra-lightweight, floating obsidian glass HUD that sits on top of Windows. It provides:

- 🎤 **Voice-First Interaction**: Integrated Whisper STT for real-time speech-to-text.
- 🧠 **Dynamic AI Routing**: Multi-provider intelligence dispatching queries across optimal LLMs (Gemini, Groq, Ollama).
- 🖥️ **Desktop Automation**: Autonomous CRUD filesystem operations, Start Menu app discovery, and P/Invoke mouse cursor manipulation.
- 👁️ **Visual Screen Perception**: In-memory ephemeral screen inspection powered by multimodal vision models.
- 🌐 **Autonomous Browser Agent**: Background browser task execution via Playwright.

---

## 🚀 Hackathon Roadmap & Progress

- [x] **Phase 1: Core Scaffolding & Glass HUD** *(Current)*
  - Transparent obsidian glass overlay window
  - Zero-flicker dragging and frameless styling
  - IPC context isolation bridge
- [ ] **Phase 2: Pluggable AI Multi-Provider Foundation & Router**
- [ ] **Phase 3: System Automation, CRUD Filesystem & 3-Tier Security Guard**
- [ ] **Phase 4: Real-Time Dual Whisper STT Audio Pipeline**
- [ ] **Phase 5: Gemini Multimodal Vision & Native Mouse Control**
- [ ] **Phase 6: Playwright Autonomous Web Microservice**
- [ ] **Phase 7: End-to-End Test Suite & Final System Polish**

---

## 🛠️ Quick Start (Phase 1)

### Prerequisites
- Node.js 18+
- Windows 10 or 11

### Installation
```bash
git clone https://github.com/akhilgandloji789/FahOS.git
cd FahOS
npm install
```

### Configuration
Copy the configuration template:
```bash
cp fahos.config.example.json fahos.config.json
```

### Launch
```bash
npm start
```
Summon the HUD anytime using **`Ctrl + Space`** or **`Alt + Space`**.

---

## 📄 License
MIT License. Built with precision for the hackathon.
