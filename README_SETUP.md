# FahOS — How to Run on Another Laptop (Complete Guide)

Follow these simple steps to run FahOS on any other Windows 10/11 laptop or PC.

---

## ⚡ Method 1: The Fastest 1-Click Plug & Play (Recommended for Demos)

This method requires **zero internet download** on the other laptop and works in under 30 seconds.

### Step 1: On Your Current Laptop
1. Plug in a **USB Pendrive** (or use Google Drive / OneDrive).
2. Copy the entire `fahos` folder to the USB drive:
   - Location: The `FahOS` repository folder
   - *Tip:* If you copy the entire folder including `node_modules` and `fahos.config.json`, the other laptop won't even need to run `npm install`!

### Step 2: On the Other Laptop
1. Make sure **Node.js** is installed.
   - If not installed, download the **LTS installer** from [nodejs.org](https://nodejs.org/) (takes ~1 minute to install).
2. Paste the `fahos` folder onto the other laptop (e.g. on Desktop).
3. **Double-click `setup-and-run.bat`** (or `run-fahos.bat`):
   - It will automatically check Node.js, install dependencies if missing, and launch FahOS!
4. Press **`Ctrl + Space`** or **`Alt + Space`** to summon the FahOS overlay!

---

## 📦 Method 2: Lightweight ZIP (Small File Size ~10 MB)

If you want to send the project over WhatsApp, Discord, or Email without a pendrive:

### Step 1: On Your Current Laptop
1. In the `fahos` folder, delete or exclude the `node_modules/` folder (it's ~250MB and can be recreated automatically).
2. Right-click the `fahos` folder ➔ **Compress to ZIP file**. The zip will only be **~8-12 MB**!
3. Send the ZIP file to the other laptop.

### Step 2: On the Other Laptop
1. Extract the ZIP file.
2. Install **Node.js (LTS)** from [nodejs.org](https://nodejs.org/).
3. Double-click **`setup-and-run.bat`**:
   - It will detect that `node_modules` is missing, automatically run `npm install`, and launch FahOS.

---

## 🌐 Method 3: Via GitHub (For Developers & Teammates)

If you use GitHub:

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "feat: FahOS modular architecture & unified browser"
git remote add origin https://github.com/YOUR_USERNAME/fahos.git
git push -u origin main
```

### Step 2: On the Other Laptop
```bash
git clone https://github.com/YOUR_USERNAME/fahos.git
cd fahos
setup-and-run.bat
```

---

## 🔑 Important Checklist for the Other Laptop

| Item | Requirement | Notes |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 or Windows 11 | Windows architecture required for hooks and speech API. |
| **Node.js** | Node.js v18, v20, or v22 (LTS) | Download free from [nodejs.org](https://nodejs.org/). |
| **Google Chrome** | Installed | Standard Chrome at default Windows path. |
| **API Keys (`fahos.config.json`)** | Included | Ensure `fahos.config.json` is in the folder with your `geminiApiKey` and `openaiCompatible` keys. |
| **Global Shortcuts** | `Ctrl + Space` or `Alt + Space` | Press either shortcut to summon/dismiss the overlay. |
