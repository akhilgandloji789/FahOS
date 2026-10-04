"""
Browser Manager for FahOS.
Launches the user's REAL default Google Chrome browser in a visible, maximized window
with window activation explicitly enabled and keep_alive=True so judges can watch it live.
"""
import os
import shutil
import ctypes
from ctypes import wintypes
from pathlib import Path
from browser_use import Browser

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
]

def find_chrome_executable():
    for p in CHROME_PATHS:
        if os.path.isfile(p):
            return p
    return None

def bring_browser_to_front():
    """Bring the active Google Chrome window to the foreground."""
    try:
        user32 = ctypes.windll.user32
        EnumWindows = user32.EnumWindows
        EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        GetWindowTextW = user32.GetWindowTextW
        GetWindowTextLengthW = user32.GetWindowTextLengthW
        IsWindowVisible = user32.IsWindowVisible
        SetForegroundWindow = user32.SetForegroundWindow
        ShowWindow = user32.ShowWindow

        def foreach_window(hwnd, lParam):
            if IsWindowVisible(hwnd):
                length = GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    GetWindowTextW(hwnd, buff, length + 1)
                    title = buff.value.lower()
                    if any(k in title for k in ["chrome", "google", "wikipedia", "youtube", "amazon", "github", "example"]):
                        ShowWindow(hwnd, 3)  # SW_MAXIMIZE
                        SetForegroundWindow(hwnd)
            return True

        EnumWindows(EnumWindowsProc(foreach_window), 0)
    except Exception:
        pass

class BrowserManager:
    def __init__(self):
        self.profile_dir = Path.home() / ".fahos" / "chrome_agent_profile"
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.chrome_exe = find_chrome_executable()

    def cleanup_stale_locks(self):
        lock_names = ["lockfile", "SingletonLock", "SingletonCookie", "SingletonSocket"]
        for name in lock_names:
            p = self.profile_dir / name
            try:
                if p.is_file() or p.is_symlink():
                    p.unlink(missing_ok=True)
                elif p.is_dir():
                    shutil.rmtree(p, ignore_errors=True)
            except Exception:
                pass

    def get_browser(self, headless: bool = False) -> Browser:
        self.cleanup_stale_locks()
        
        browser_kwargs = {
            "headless": headless,
            "user_data_dir": str(self.profile_dir),
            "ignore_default_args": [
                "--disable-window-activation",
                "--disable-focus-on-load"
            ],
            "args": [
                "--start-maximized",
                "--new-window",
                "--no-default-browser-check",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding"
            ],
            "disable_security": False,
            "enable_default_extensions": False,
            "highlight_elements": True,
            "keep_alive": True,
            "wait_between_actions": 1.2
        }

        if self.chrome_exe and os.path.exists(self.chrome_exe):
            browser_kwargs["executable_path"] = self.chrome_exe

        return Browser(**browser_kwargs)

browser_manager = BrowserManager()
