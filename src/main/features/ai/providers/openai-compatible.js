'use strict';
// Works with ANY OpenAI-compatible /chat/completions endpoint (Groq, OpenAI, etc.)
function createOpenAICompatibleProvider(cfg) {
  const baseUrl = (cfg.baseUrl || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const model = cfg.model || 'qwen/qwen3.8-27b';

  return {
    name: `Qwen (${model})`,

    async generate({ system, prompt }) {
      if (!cfg.apiKey) throw new Error('API key missing — set providers.openaiCompatible.apiKey or OPENAI_API_KEY.');
      const res = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.2,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt }
          ]
        })
      });
      if (!res.ok) throw new Error('Provider HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
      const data = await res.json();
      return (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content : '';
    },

    async analyzeImage({ system, prompt, base64Image }) {
      if (!cfg.apiKey) throw new Error('API key missing for vision analysis.');
      const imageUrl = base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`;
      
      const res = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.2,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt || 'Extract and explain all information from this image in detail.' },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ]
        })
      });
      if (!res.ok) throw new Error('Vision HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
      const data = await res.json();
      return (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content : '';
    }
  };
}

module.exports = { createOpenAICompatibleProvider };
