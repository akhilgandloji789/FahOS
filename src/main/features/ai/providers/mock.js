'use strict';
// Zero-dependency, zero-setup provider so FahOS runs the instant you `npm start`.
// It does not call any model — it echoes what it received so you can see the full
// UI -> IPC -> router -> provider -> UI round trip working. Swap to a real provider
// (ollama / gemini / openaiCompatible) in fahos.config.json when you are ready.
function createMockProvider() {
  return {
    name: 'mock',
    async generate({ prompt }) {
      const text = (prompt || '').trim();
      const lower = text.toLowerCase().replace(/[\.\?!,;]+$/, '').trim();

      if (/^(hi|hello|hey|good morning|good evening|good afternoon|howdy|greetings)$/i.test(lower)) {
        return "Hello! How can I help you today?";
      }
      if (/^(how are you|how is it going)$/i.test(lower)) {
        return "I'm doing great! How can I assist you today?";
      }
      if (/^(who are you|what are you)$/i.test(lower)) {
        return "I am FahOS, your intelligent voice & visual AI assistant for Windows.";
      }

      return `${text}\n\n*(Note: FahOS is currently in local mode. Configure a Gemini or OpenAI API key in fahos.config.json for live web answers.)*`;
    },
    async analyzeImage() {
      return 'MOCK vision: connect a vision model (e.g. gemini-3.6-flash) to describe screen regions.';
    }
  };
}
module.exports = { createMockProvider };
