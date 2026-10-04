'use strict';
// Loads FahOS configuration. Precedence: environment variables > fahos.config.json > built-in defaults.
// SECURITY: this runs only in the Electron MAIN process. API keys never reach the renderer / web page.
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  shortcut: 'CommandOrControl+Space',
  aiProvider: 'mock',
  providers: {
    ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.1', visionModel: 'llava' },
    gemini: { apiKey: '', model: 'gemini-1.5-flash' },
    openaiCompatible: { baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', model: 'llama-3.1-8b-instant' }
  }
};

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function deepMerge(base, extra) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const k of Object.keys(extra || {})) {
    if (isObject(out[k]) && isObject(extra[k])) out[k] = deepMerge(out[k], extra[k]);
    else out[k] = extra[k];
  }
  return out;
}

function loadConfig() {
  let cfg = deepMerge({}, DEFAULTS);

  // fahos.config.json in the project root (gitignored)
  const cfgPath = path.join(process.cwd(), 'fahos.config.json');
  try {
    if (fs.existsSync(cfgPath)) {
      const user = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      cfg = deepMerge(cfg, user);
    }
  } catch (e) {
    console.error('[FahOS] Could not read fahos.config.json:', e.message);
  }

  // Environment overrides (handy for CI / not committing keys)
  const env = process.env;
  if (env.FAHOS_SHORTCUT) cfg.shortcut = env.FAHOS_SHORTCUT;
  if (env.FAHOS_PROVIDER) cfg.aiProvider = env.FAHOS_PROVIDER;
  if (env.OLLAMA_BASE_URL) cfg.providers.ollama.baseUrl = env.OLLAMA_BASE_URL;
  if (env.OLLAMA_MODEL) cfg.providers.ollama.model = env.OLLAMA_MODEL;
  if (env.GEMINI_API_KEY) cfg.providers.gemini.apiKey = env.GEMINI_API_KEY;
  if (env.GEMINI_MODEL) cfg.providers.gemini.model = env.GEMINI_MODEL;
  if (env.OPENAI_API_KEY) cfg.providers.openaiCompatible.apiKey = env.OPENAI_API_KEY;
  if (env.GROQ_API_KEY) cfg.providers.openaiCompatible.apiKey = env.GROQ_API_KEY;
  if (env.OPENAI_BASE_URL) cfg.providers.openaiCompatible.baseUrl = env.OPENAI_BASE_URL;
  if (env.OPENAI_MODEL) cfg.providers.openaiCompatible.model = env.OPENAI_MODEL;

  return cfg;
}

module.exports = { loadConfig, DEFAULTS };
