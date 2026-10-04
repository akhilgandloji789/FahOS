'use strict';
// Local, free, open-source models via Ollama (https://ollama.com).
// Run `ollama pull llama3.1` (and `ollama pull llava` for vision) then set
// "aiProvider": "ollama" in fahos.config.json. No API key, nothing leaves the machine.
function createOllamaProvider(cfg) {
  const baseUrl = (cfg.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  return {
    name: 'ollama',
    async generate({ system, prompt }) {
      const res = await fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.model || 'llama3.1',
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ]
        })
      });
      if (!res.ok) throw new Error('Ollama HTTP ' + res.status + ' — is `ollama serve` running?');
      const data = await res.json();
      return (data.message && data.message.content) ? data.message.content : '';
    },
    async analyzeImage({ system, prompt, imageBase64 }) {
      const res = await fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.visionModel || 'llava',
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt, images: [imageBase64] }
          ]
        })
      });
      if (!res.ok) throw new Error('Ollama vision HTTP ' + res.status);
      const data = await res.json();
      return (data.message && data.message.content) ? data.message.content : '';
    }
  };
}
module.exports = { createOllamaProvider };
