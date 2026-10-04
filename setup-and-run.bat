@echo off
setlocal enabledelayedexpansion
title FahOS Setup & Launcher
cd /d "%~dp0"

echo ===================================================
echo             FahOS Automated Setup & Launcher
echo ===================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is NOT installed on this machine!
    echo.
    echo Please install Node.js (LTS version) from:
    echo   https://nodejs.org/
    echo.
    echo After installing Node.js, double-click this file again.
    echo ===================================================
    pause
    exit /b 1
)

echo [OK] Node.js is installed:
node -v
echo.

:: 2. Check if dependencies are installed
if not exist "node_modules\" (
    echo [SETUP] Installing required dependencies (first-time setup)...
    echo This may take 30-60 seconds depending on your internet speed.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install dependencies via npm install.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully!
    echo.
) else (
    echo [OK] Dependencies already installed.
    echo.
)

:: 3. Check if config file exists
if not exist "fahos.config.json" (
    if exist "fahos.config.example.json" (
        echo [SETUP] Creating fahos.config.json from example...
        copy /y "fahos.config.example.json" "fahos.config.json" >nul
        echo [NOTICE] Created fahos.config.json. Please ensure your API keys are added.
        echo.
    )
)

:: 4. Start FahOS
echo [STARTING] Launching FahOS Desktop Agent...
echo Press Ctrl + Space or Alt + Space to summon FahOS!
echo ===================================================
echo.
npm start

pause
