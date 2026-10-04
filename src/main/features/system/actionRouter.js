'use strict';
// FahOS — Action Router & Intent Classifier
// Detects whether a request is an OS / desktop command or a conversational question.

const systemActions = require('./systemActions');

// Fast deterministic matching for zero-latency execution
function matchFastAction(rawText) {
  const t = rawText.toLowerCase().trim();

  // Volume & Media Controls
  if (/^(volume\s+up|increase\s+volume|louder)/i.test(t)) {
    return { type: 'system', action: 'volume_up' };
  }
  if (/^(volume\s+down|decrease\s+volume|lower\s+volume)/i.test(t)) {
    return { type: 'system', action: 'volume_down' };
  }
  if (/^(mute|unmute|mute\s+audio|unmute\s+audio|mute\s+volume)/i.test(t)) {
    return { type: 'system', action: 'mute' };
  }
  if (/^(pause|resume|play|play\s+pause|pause\s+music|resume\s+music|stop\s+music)$/i.test(t)) {
    return { type: 'system', action: 'play_pause' };
  }
  if (/^(next\s+track|next\s+song|skip\s+song|next)/i.test(t)) {
    return { type: 'system', action: 'next_track' };
  }
  if (/^(previous\s+track|previous\s+song|prev\s+song)/i.test(t)) {
    return { type: 'system', action: 'prev_track' };
  }
  if (/^(lock\s+screen|lock\s+pc|lock\s+computer|lock\s+laptop)/i.test(t)) {
    return { type: 'system', action: 'lock' };
  }

  // WhatsApp Send Message
  const waMatch = t.match(/^(?:open\s+whatsapp\s+(?:and\s+)?(?:send\s+(?:a\s+)?message\s+)?|send\s+(?:a\s+)?(?:whatsapp\s+)?message\s+(?:saying\s+|that\s+|to\s+say\s+)?)(.*)$/i);
  if (waMatch && waMatch[1] && waMatch[1].trim()) {
    return { type: 'whatsapp_message', text: waMatch[1].trim().replace(/^['"]|['"]$/g, '') };
  }

  // Spotify Search & Play
  const spotMatch = t.match(/^(?:open\s+spotify\s+and\s+play\s+|play\s+(?:song\s+)?)(.*?)(?:\s+on\s+spotify)?$/i);
  if (spotMatch && spotMatch[1] && spotMatch[1].trim() && (t.includes('spotify') || t.startsWith('play '))) {
    return { type: 'spotify_play', query: spotMatch[1].trim() };
  }

  // YouTube Search
  const ytMatch = t.match(/^(?:open\s+youtube\s+and\s+search\s+|search\s+(?:on\s+)?youtube\s+(?:for\s+)?)(.*)$/i);
  if (ytMatch && ytMatch[1] && ytMatch[1].trim()) {
    return { type: 'web_search', engine: 'youtube', query: ytMatch[1].trim() };
  }

  // Google Search
  const gMatch = t.match(/^(?:search\s+google\s+(?:for\s+)?|google\s+search\s+(?:for\s+)?|search\s+on\s+google\s+(?:for\s+)?)(.*)$/i);
  if (gMatch && gMatch[1] && gMatch[1].trim()) {
    return { type: 'web_search', engine: 'google', query: gMatch[1].trim() };
  }

  // Notepad Note Writing
  const noteMatch = t.match(/^(?:open\s+notepad\s+and\s+(?:write|note\s+down)\s+|take\s+a\s+note\s+(?:saying\s+|that\s+)?|write\s+note\s+)(.*)$/i);
  if (noteMatch && noteMatch[1] && noteMatch[1].trim()) {
    return { type: 'notepad_write', content: noteMatch[1].trim() };
  }

  // Direct App Open (e.g. "open whatsapp", "open calculator", "open vs code", "open spotify")
  const openMatch = t.match(/^(?:open|launch|start)\s+(whatsapp|spotify|calculator|calc|notepad|vs\s*code|code|chrome|browser|explorer|files|settings|terminal|cmd|powershell)$/i);
  if (openMatch && openMatch[1]) {
    return { type: 'open_app', app: openMatch[1].trim() };
  }

  return null;
}

// Execute the recognized action
async function executeAction(actionPlan) {
  switch (actionPlan.type) {
    case 'open_app':
      return await systemActions.openApp(actionPlan.app);
    case 'whatsapp_message':
      return await systemActions.sendWhatsAppMessage({ text: actionPlan.text });
    case 'spotify_play':
      return await systemActions.spotifySearch({ query: actionPlan.query });
    case 'web_search':
      return await systemActions.webSearch({ engine: actionPlan.engine, query: actionPlan.query });
    case 'system':
      return await systemActions.systemControl({ action: actionPlan.action });
    case 'notepad_write':
      return await systemActions.notepadWrite({ content: actionPlan.content });
    default:
      return null;
  }
}

module.exports = { matchFastAction, executeAction };
