"""
Configuration manager for FahOS Browser Service.
Reads secrets & model endpoints cleanly from environment or parent fahos.config.json.
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Check parent fahos.config.json if env vars not explicitly exported
CONFIG_DIR = Path(__file__).resolve().parent
PARENT_CONFIG = CONFIG_DIR.parent / "fahos.config.json"

FAHOS_CONFIG = {}
if PARENT_CONFIG.exists():
    try:
        with open(PARENT_CONFIG, "r", encoding="utf-8") as f:
            FAHOS_CONFIG = json.load(f)
    except Exception as e:
        print(f"[FahOS Browser Config] Notice reading parent config: {e}")

def get_gemini_api_key() -> str:
    return (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or FAHOS_CONFIG.get("geminiApiKey")
        or FAHOS_CONFIG.get("providers", {}).get("gemini", {}).get("apiKey")
        or ""
    )

def get_groq_api_key() -> str:
    return (
        os.getenv("GROQ_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or FAHOS_CONFIG.get("providers", {}).get("openaiCompatible", {}).get("apiKey")
        or ""
    )

def get_groq_model() -> str:
    return os.getenv("BROWSER_LLM_MODEL") or "llama-3.3-70b-versatile"

def get_gemini_model() -> str:
    return os.getenv("GEMINI_MODEL") or "gemini-3.6-flash"

PORT = int(os.getenv("PORT", "8484"))
HOST = os.getenv("HOST", "127.0.0.1")
