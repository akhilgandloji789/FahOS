'use strict';
// The Model & Action Router.
// Qwen 3.8 dynamically reasons, extracts the intent, and synthesizes the exact Windows command.
// FahOS executes it directly on Windows via CMD / PowerShell / Visual Mouse Agent (Gemini Vision).

const fs = require('fs');
const path = require('path');
const { buildPrompt } = require('./prompts');
const { createMockProvider } = require('./providers/mock');
const { createOllamaProvider } = require('./providers/ollama');
const { createGeminiProvider } = require('./providers/gemini');
const { createOpenAICompatibleProvider } = require('./providers/openai-compatible');
const systemActions = require('../system/systemActions');
const visualAgent = require('../vision/visualAgent');
const browserService = require('../browser/browserService');
const agentBrowserWindow = require('../browser/agentBrowserWindow');
const contactsService = require('../contacts/contactsService');


function createProvider(cfg) {
  const which = String(cfg.aiProvider || 'mock').toLowerCase();
  switch (which) {
    case 'ollama': return createOllamaProvider(cfg.providers.ollama || {});
    case 'gemini': return createGeminiProvider(cfg.providers.gemini || {});
    case 'openai':
    case 'openai-compatible':
    case 'openaicompatible': return createOpenAICompatibleProvider(cfg.providers.openaiCompatible || {});
    case 'mock':
    default: return createMockProvider();
  }
}

// Helper to extract WhatsApp message sending intent: contact + message
function extractWhatsAppMessage(rawText) {
  // Strip trailing punctuation like periods from Whisper STT
  let text = String(rawText || '').trim().replace(/[\.\?!,;]+$/, '').trim();
  if (!text) return null;

  // Informational / Study / Conversational queries must NEVER match WhatsApp messaging
  if (/^(?:tell\s+me|tell\s+us|what\s+is|what\s+are|what\s+was|how\s+to|how\s+do|how\s+does|why\s+is|why\s+are|explain|who\s+is|who\s+was|describe|define|teach\s+me|can\s+you\s+explain|give\s+me\s+info)\b/i.test(text)) {
    return null;
  }

  // Normalized prefix for WhatsApp (explicit start or open)
  // Note: \b after the full "what?ts?app" (two p's) is required — with a single 'p',
  // \b would fail right before the second 'p' of "whatsapp" (no word boundary between two word chars).
  const waPrefix = '^(?:(?:start|open|then|in|go\\s+to)\\s+what?ts?app\\b\\s+(?:and\\s+)?)?';

  // Pattern 1: (start/open whatsapp and)? send (a)? (whatsapp)? (message|msg|text) to <contact> (saying/that/with)? <msg>
  let m = text.match(new RegExp(`${waPrefix}send\\s+(?:a\\s+)?(?:what?ts?app\\s+)?(?:message|msg|text)\\s+to\\s+([a-zA-Z0-9_\\s\\+]+?)(?:\\s+(?:saying|that|with|texting)\\s+|\\s*:\\s*|\\s+)(.+)$`, 'i'));
  if (m) return { contact: m[1].trim(), message: m[2].trim() };

  // Pattern 2: (start/open whatsapp and)? send <msg> to <contact> (on/via/in whatsapp)?
  m = text.match(new RegExp(`${waPrefix}send\\s+(?!a\\s+(?:message|msg|text)\\b)(.+?)\\s+to\\s+([a-zA-Z0-9_\\s\\+]+?)(?:\\s+(?:on|via|in)\\s+what?ts?app)?$`, 'i'));
  if (m) {
    const c = m[2].trim();
    if (c.toLowerCase() === 'me' && !/what?ts?app/i.test(text)) {
      return null;
    }
    return { contact: c, message: m[1].trim() };
  }

  // Pattern 3: (start/open whatsapp and)? send to <contact> (saying/that/with)? <msg>
  m = text.match(new RegExp(`${waPrefix}send\\s+to\\s+([a-zA-Z0-9_\\s\\+]+?)(?:\\s+(?:saying|that|with)\\s+|\\s+)(.+)$`, 'i'));
  if (m) return { contact: m[1].trim(), message: m[2].trim() };

  // Pattern 4: (start/open whatsapp and)? send <contact> (a)? (message|msg|text) (saying/that/with)? <msg>
  m = text.match(new RegExp(`${waPrefix}send\\s+([a-zA-Z0-9_\\+]+)\\s+(?:a\\s+)?(?:message|msg|text)(?:\\s+(?:saying|that|with|texting)\\s+|\\s*:\\s*|\\s+)(.+)$`, 'i'));
  if (m) return { contact: m[1].trim(), message: m[2].trim() };

  // Pattern 5: whatsapp <contact> (saying/that)? <msg>
  m = text.match(/^what?ts?app\s+([a-zA-Z0-9_\+]+)(?:\s+(?:saying|that|with|texting)\s+|\s*:\s*|\s+)(.+)$/i);
  if (m) return { contact: m[1].trim(), message: m[2].trim() };

  // Pattern 6: message/msg/text <contact> (saying/that)? <msg>
  m = text.match(/^(?:message|msg|text)\s+([a-zA-Z0-9_\+]+)(?:\s+(?:saying|that|with|texting)\s+|\s*:\s*|\s+)(.+)$/i);
  if (m) return { contact: m[1].trim(), message: m[2].trim() };

  return null;
}

// Helper to extract Email compose intent: target contact/email + details/subject
function extractEmailCompose(rawText) {
  let text = String(rawText || '').trim().replace(/[\.\?!,;]+$/, '').trim();
  if (!text) return null;

  // Never match WhatsApp messages or programming/study/action queries as email compose
  if (/what?ts?app/i.test(text)) return null;
  if (/^(?:tell\s+me|tell\s+us|what\s+is|what\s+are|how\s+to|explain|java|python|code|write\s+(?:a\s+)?(?:java|python|js|react|function|program|code|checker|script))\b/i.test(text)) return null;

  const mailPrefix = '^(?:(?:start|open|go\\s+to|launch|in)\\s+(?:gmail|mail|email)\\s+(?:and\\s+)?)?';

  const isInvalidTarget = (t) => {
    if (!t) return true;
    const clean = t.trim().toLowerCase();
    if (/^(gmail|email|mail|a|the)$/i.test(clean)) return true;
    if (/^(?:check|create|build|make|delete|remove|run|search|play|find|get|show|to|a\s+string|if\s+a\s+string)\b/i.test(clean)) return true;
    return false;
  };

  // Pattern 1: (prefix)? (compose|send|write|draft) (an)? (email|mail|message) (to)? <target> (about/subject/saying/with)? <details>
  let m = text.match(new RegExp(`${mailPrefix}(?:compose|send|write|draft)\\s+(?:an?\\s+)?(?:email|mail|message|msg)\\s+(?:to\\s+)?([a-zA-Z0-9_\\s\\.\\+]+?)(?:\\s+(?:about|subject|saying|with\\s+message|that|with\\s+subject)\\s+(.+))?$`, 'i'));
  if (m && m[1] && !isInvalidTarget(m[1])) {
    return { target: m[1].trim(), details: m[2] ? m[2].trim() : '' };
  }

  // Pattern 2: (prefix)? email/mail <target> (about/subject/saying)? <details>
  m = text.match(new RegExp(`${mailPrefix}(?:email|mail)\\s+(?:to\\s+)?([a-zA-Z0-9_\\s\\.\\+]+?)(?:\\s+(?:about|subject|saying|with\\s+message|that|with\\s+subject)\\s+(.+))?$`, 'i'));
  if (m && m[1] && !isInvalidTarget(m[1])) {
    return { target: m[1].trim(), details: m[2] ? m[2].trim() : '' };
  }

  // Pattern 3: (prefix)? compose/write/draft email to <target> (no body required)
  m = text.match(new RegExp(`${mailPrefix}(?:compose|write|draft)\\s+(?:an?\\s+)?(?:email|mail|message)\\s+to\\s+([a-zA-Z0-9_\\s\\.\\+]+?)$`, 'i'));
  if (m && m[1] && !isInvalidTarget(m[1])) {
    return { target: m[1].trim(), details: '' };
  }

  return null;
}

// Single entry point used by the IPC handler in main.js
async function runAction({ cfg, action, text }) {
  let rawText = String(text || '').trim();
  // Pre-process concatenated commands like 'openchrome' -> 'open chrome', 'opennotepad' -> 'open notepad', 'opencalculator' -> 'open calculator'
  rawText = rawText.replace(/\b(open|launch|start|run)(chrome|notepad|calculator|calc|spotify|whatsapp|youtube|yt|browser|cmd|powershell|vscode|code)\b/gi, '$1 $2');

  // Import the orchestrator
  const { orchestrateResponse, classifyQuery, getProviderForTier } = require('./orchestrator');

  // 0. Informational / Educational / Conversational queries (e.g. "tell me about HemoConnect", "what is photosynthesis")
  // MUST NEVER trigger app launches, commands, or WhatsApp messages.
  const isInformationalQuery = /^(?:tell\s+me|tell\s+us|what\s+is|what\s+are|what\s+was|how\s+to|how\s+do|how\s+does|why\s+is|why\s+are|explain|who\s+is|who\s+was|describe|define|teach\s+me|can\s+you\s+explain|prime\s+minister|president\s+of|capital\s+of|who|what|where|when|why|how)\b/i.test(rawText);
  if (isInformationalQuery) {
    console.log(`[FahOS Agent] Educational/conversational query detected: "${rawText}" - routing to orchestrator for optimal model selection.`);
    try {
      const result = await orchestrateResponse(cfg, rawText, false, null);
      if (result.ok) {
        const cleanAnswer = result.output.replace(/```(?:cmd|powershell|ps1|sh|bash)\r?\n[\s\S]*?```/gi, '').trim() || result.output;
        return {
          ok: true,
          isAction: false,
          provider: result.provider,
          tier: result.tier,
          classification: result.classification,
          output: cleanAnswer
        };
      } else {
        const errMsg = result.error || 'High demand spike on AI provider. Please try again.';
        return { ok: false, provider: result.provider, error: errMsg };
      }
    } catch (e) {
      // Fallback to original behavior
      console.warn('[FahOS Agent] Orchestrator failed, falling back to default provider:', e.message);
      const provider = createProvider(cfg);
      const { system, prompt } = buildPrompt(action, rawText);
      const rawOutput = await provider.generate({ system, prompt });
      const cleanAnswer = rawOutput.replace(/```(?:cmd|powershell|ps1|sh|bash)\r?\n[\s\S]*?```/gi, '').trim() || rawOutput;
      return { ok: true, isAction: false, provider: provider.name, output: cleanAnswer };
    }
  }

  // 0. Instant Stop / Cancellation Intent (e.g. "stop", "cancel", "halt browser")
  if (/^(?:stop|cancel|halt|abort)(?:\s+(?:browser|task|it))?$/i.test(rawText)) {
    console.log('[FahOS Agent] Stop intent triggered. Cancelling active browser task...');
    const agentController = require('../browser/agentBrowserController');
    agentController.cancel();
    return {
      ok: true,
      isAction: true,
      provider: 'FahOS Task Manager',
      command: 'Cancel Active Tasks',
      output: '🛑 Stopped and cancelled the active browser task.'
    };
  }

  // 1. Save or Add Contact with Phone and optional Email (e.g. "save contact Akka as 9876543210", "save contact Akka phone 9876543210 email akka@mail.com")
  const saveContactMatch = rawText.match(/(?:save|add|set)\s+contact\s+([a-zA-Z\s]+?)(?:\s+(?:as|number|phone|with)\s+([\+\d\s\-]+))?(?:\s+(?:and\s+)?email\s+([^\s@]+@[^\s@]+\.[^\s@]+))?$/i);
  if (saveContactMatch && (saveContactMatch[2] || saveContactMatch[3])) {
    const cName = saveContactMatch[1].trim();
    const cPhone = (saveContactMatch[2] || '').trim();
    const cEmail = (saveContactMatch[3] || '').trim();
    const saved = contactsService.saveContact(cName, cPhone, cEmail);
    const details = [];
    if (saved.phone) details.push(`\`+${saved.phone}\``);
    if (saved.email) details.push(`\`${saved.email}\``);
    return {
      ok: true,
      isAction: true,
      provider: 'FahOS Directory',
      command: `Save Contact: ${saved.displayName}`,
      output: `Saved **${saved.displayName}** (${details.join(', ')}) to your FahOS directory.`
    };
  }

  // 2. List Contacts (e.g. "show contacts", "list contacts")
  if (/^(show|list|view)\s+contacts$/i.test(rawText)) {
    const all = contactsService.getAllContacts();
    if (all.length === 0) {
      return {
        ok: true,
        isAction: true,
        provider: 'FahOS Contacts Directory',
        command: 'List Contacts',
        output: "Your FahOS contacts directory is empty.\n\nSay *'Save contact Akka as +91XXXXXXXXXX'* or open the Directory to add one!"
      };
    }
    const list = all.map(c => {
      let s = `• **${c.displayName}**`;
      if (c.phone) s += ` — Phone: \`+${c.phone}\``;
      if (c.email) s += ` — Email: \`${c.email}\``;
      return s;
    }).join('\n');
    return {
      ok: true,
      isAction: true,
      provider: 'FahOS Contacts Directory',
      command: `List Contacts (${all.length})`,
      output: `### Saved Contacts Directory (${all.length}):\n\n${list}`
    };
  }

  // 3. Direct WhatsApp Send Message to Contact (MUST BE BEFORE EMAIL COMPOSE!)
  const waMsgIntent = extractWhatsAppMessage(rawText);
  if (waMsgIntent && waMsgIntent.contact && waMsgIntent.message) {
    console.log(`[FahOS Agent] Direct routing to send WhatsApp message to: "${waMsgIntent.contact}", text: "${waMsgIntent.message}"`);
    const waRes = await systemActions.openWhatsAppChat(waMsgIntent.contact, waMsgIntent.message);
    return {
      ok: waRes.ok,
      isAction: true,
      provider: 'WhatsApp Official Protocol',
      command: waRes.command || `WhatsApp Send: "${waMsgIntent.contact}"`,
      output: waRes.description,
      error: waRes.ok ? undefined : waRes.description
    };
  }

  // 3.5. Direct Email Compose Intent
  const emailIntent = extractEmailCompose(rawText);
  if (emailIntent && emailIntent.target) {
    console.log(`[FahOS Agent] Direct routing to compose email to: "${emailIntent.target}", details: "${emailIntent.details}"`);
    const emailRes = await systemActions.composeEmail(emailIntent.target, emailIntent.details ? `Message regarding: ${emailIntent.details.slice(0, 30)}` : '', emailIntent.details);
    return {
      ok: emailRes.ok,
      isAction: true,
      provider: 'Gmail (Default Browser)',
      command: emailRes.command || `Email: "${emailIntent.target}"`,
      output: emailRes.description,
      error: emailRes.ok ? undefined : emailRes.description
    };
  }

  // 4. Direct WhatsApp Contact Chat Opening (e.g. "open whattsapp and Open Agasthya chat", "open Akka chat")
  const isExplicitChat = /\bchat\b/i.test(rawText);
  const isWhatsAppMention = /what?ts?app/i.test(rawText);
  if (isExplicitChat || isWhatsAppMention) {
    if (!/calculator|calc|notepad|spotify|code|chrome|history/i.test(rawText)) {
      let candidate = rawText
        .replace(/^(?:open\s+)?(?:what?ts?app\s+)?(?:and\s+)?(?:open\s+)?(?:chat\s+(?:with\s+)?)?/i, '')
        .replace(/(?:\s+in\s+what?ts?app)?(?:\s+chat)?$/i, '')
        .trim();

      // If candidate is an app name (e.g. "whatsapp", "whatapp", "whattsapp"), let Step 5 handle it
      const isAppName = systemActions.resolveApp(candidate);
      if (!isAppName && candidate && candidate.length > 0 && candidate.length < 35) {
        if (isExplicitChat || contactsService.getPhoneForContact(candidate)) {
          console.log(`[FahOS Agent] Direct routing to WhatsApp contact: "${candidate}"`);
          const waRes = await systemActions.openWhatsAppChat(candidate);
          return {
            ok: waRes.ok,
            isAction: true,
            provider: 'WhatsApp Official Protocol',
            command: waRes.command || `WhatsApp Open Chat: "${candidate}"`,
            output: waRes.description,
            error: waRes.ok ? undefined : waRes.description
          };
        }
      }
    }
  }

  // 4.5. Direct File or Folder Creation Intent (e.g. "Can you add a file named sai in Downloads?", "create a folder named test on Desktop", "make file notes.txt in Documents")
  const createFileMatch = rawText.match(/^(?:can\s+you\s+)?(?:create|make|add|generate|new)\s+(?:a\s+)?(file|folder|document|directory)\s+(?:named|called|with\s+name)?\s*([a-zA-Z0-9_\-\.\s]+?)(?:\s+(?:in|on|at|inside)\s+(?:the\s+)?([a-zA-Z0-9_\-\\\/\s]+))?$/i);
  if (createFileMatch && createFileMatch[2]) {
    const itemType = (createFileMatch[1] || 'file').toLowerCase();
    const isFolder = itemType === 'folder' || itemType === 'directory';
    const itemName = createFileMatch[2].trim().replace(/[\.\?!,;]+$/, '').trim();
    const destFolder = (createFileMatch[3] || 'Desktop').trim().replace(/[\.\?!,;]+$/, '').trim();

    console.log(`[FahOS Agent] Direct routing to create ${isFolder ? 'folder' : 'file'}: "${itemName}" in "${destFolder}"`);
    const createRes = await systemActions.createFileOrFolder({
      name: itemName,
      targetFolder: destFolder,
      isFolder: isFolder
    });

    return {
      ok: createRes.ok,
      isAction: true,
      provider: 'FahOS Filesystem Agent',
      command: createRes.command || `Create: "${itemName}"`,
      output: createRes.description,
      error: createRes.ok ? undefined : createRes.description
    };
  }

  // 4.5b. Shorthand File/Folder Creation WITHOUT "file/folder" keyword
  // Handles: "create hi.txt in downloads", "make test.txt on Desktop", "create myFolder in Documents"
  const createShortMatch = rawText.match(/^(?:can\s+you\s+)?(?:create|make|add|new)\s+([a-zA-Z0-9_\-\.]+)\s+(?:in|on|at|inside)\s+(?:the\s+)?([a-zA-Z0-9_\-\\\/\s]+)$/i);
  if (createShortMatch && createShortMatch[1]) {
    const itemName = createShortMatch[1].trim();
    const destFolder = createShortMatch[2].trim().replace(/[.?!,;]+$/, '').trim();
    const isFolder = !path.extname(itemName); // has extension = file, no extension = folder
    console.log(`[FahOS Agent] Shorthand create: "${itemName}" in "${destFolder}" (isFolder=${isFolder})`);
    const createRes = await systemActions.createFileOrFolder({
      name: itemName,
      targetFolder: destFolder,
      isFolder: isFolder
    });
    return {
      ok: createRes.ok,
      isAction: true,
      provider: 'FahOS Filesystem Agent',
      command: createRes.command || `Create: "${itemName}"`,
      output: createRes.description,
      error: createRes.ok ? undefined : createRes.description
    };
  }

  // 4.5c. Read File Content Intent (e.g. "read file notes.txt", "show contents of hi.txt in downloads")
  const readFileMatch = rawText.match(/^(?:read|show\s+contents?\s+of|display\s+contents?\s+of|open\s+and\s+read|get\s+contents?\s+of)\s+(?:file\s+)?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)(?:\s+(?:in|on|from|at)\s+(?:the\s+)?([a-zA-Z0-9_\-\\\/\s]+))?$/i);
  if (readFileMatch && readFileMatch[1]) {
    const fileName = readFileMatch[1].trim();
    const folderHint = readFileMatch[2] ? readFileMatch[2].trim() : '';
    console.log(`[FahOS Agent] Direct routing to read file: "${fileName}" from "${folderHint || 'system'}"`);

    let searchRoot = '';
    if (folderHint) {
      const rd = systemActions.resolveDirectory(folderHint);
      if (rd && rd.path) searchRoot = rd.path;
    }

    const knownRoots = ['downloads', 'desktop', 'documents'].map(n => {
      const r = systemActions.resolveDirectory(n);
      return r && r.path ? r.path : null;
    }).filter(Boolean);

    const searchRoots = searchRoot ? [searchRoot] : knownRoots;

    let foundPath = null;
    for (const root of searchRoots) {
      const candidate = path.join(root, fileName);
      if (fs.existsSync(candidate)) { foundPath = candidate; break; }
    }

    if (!foundPath) {
      return {
        ok: false, isAction: true,
        provider: 'FahOS Filesystem Agent',
        command: `Read: "${fileName}"`,
        output: `File **${fileName}** was not found in ${folderHint || 'Downloads, Desktop, or Documents'}.`
      };
    }

    try {
      const stats = fs.statSync(foundPath);
      if (stats.size > 1024 * 1024) {
        return {
          ok: true, isAction: true,
          provider: 'FahOS Filesystem Agent',
          command: `Read: "${foundPath}"`,
          output: `File **${fileName}** is ${(stats.size / 1024).toFixed(1)} KB — too large to display inline.\nPath: \`${foundPath}\``
        };
      }
      const content = fs.readFileSync(foundPath, 'utf8');
      return {
        ok: true, isAction: true,
        provider: 'FahOS Filesystem Agent',
        command: `Read: "${foundPath}"`,
        output: `**Contents of ${fileName}** (\`${foundPath}\`):\n\n\`\`\`\n${content || '(empty file)'}\n\`\`\``
      };
    } catch (err) {
      return {
        ok: false, isAction: true,
        provider: 'FahOS Filesystem Agent',
        command: `Read: "${foundPath}"`,
        output: `Could not read **${fileName}**: ${err.message}`
      };
    }
  }

  // 4.5d. List Files in Directory Intent (e.g. "list files in downloads", "show files on desktop", "what's in documents")
  const listDirMatch = rawText.match(/^(?:list\s+files?\s+(?:in|on|from|at)|show\s+files?\s+(?:in|on|from|at)|what(?:'s|\s+is|\s+are)\s+in)\s+(?:the\s+)?([a-zA-Z0-9_\-\\\/\s]+?)(?:\s+(?:folder|directory))?$/i);
  if (listDirMatch && listDirMatch[1]) {
    const folderName = listDirMatch[1].trim().replace(/[.?!,;]+$/, '').trim();
    const resolvedDir = systemActions.resolveDirectory(folderName);
    if (resolvedDir && resolvedDir.path && fs.existsSync(resolvedDir.path)) {
      console.log(`[FahOS Agent] Direct routing to list directory: "${resolvedDir.name}" (${resolvedDir.path})`);
      try {
        const items = fs.readdirSync(resolvedDir.path, { withFileTypes: true });
        const folders = items.filter(i => i.isDirectory()).map(i => `📁 ${i.name}`);
        const files = items.filter(i => i.isFile()).map(i => `📄 ${i.name}`);
        const all = [...folders, ...files];
        const preview = all.slice(0, 30);
        const more = all.length > 30 ? `\n\n_...and ${all.length - 30} more items_` : '';
        return {
          ok: true, isAction: true,
          provider: 'FahOS Filesystem Agent',
          command: `List: "${resolvedDir.path}"`,
          output: `**${resolvedDir.name}** (${all.length} items):\n\n${preview.join('\n')}${more}`
        };
      } catch (err) {
        return {
          ok: false, isAction: true,
          provider: 'FahOS Filesystem Agent',
          command: `List: "${resolvedDir.path}"`,
          output: `Could not list **${resolvedDir.name}**: ${err.message}`
        };
      }
    }
  }

  // 4.55. Direct Compound Web / YouTube Search (Always opens in FahOS Unified Browser)

  const ytMatch = rawText.match(/^(?:(?:open|launch)\s+(?:youtube|yt)\s+(?:and\s+)?(?:search|look\s+up|play)(?:\s+(?:for|about))?\s+(.+)|(?:search|play|look\s+up)(?:\s+(?:for|about))?\s+(.+?)\s+(?:on|in|using)\s+(?:youtube|yt)|(?:youtube|yt)\s+(?:search|play)\s+(.+))$/i);
  if (ytMatch) {
    const query = (ytMatch[1] || ytMatch[2] || ytMatch[3] || '').trim().replace(/[\.\?!,;]+$/, '').trim();
    if (query) {
      console.log(`[FahOS Agent] Routing YouTube task to FahOS Unified Browser: "${rawText}"`);
      const browserRes = await agentBrowserWindow.runAgentTask(rawText);
      return {
        ok: browserRes.ok,
        isAction: true,
        provider: 'FahOS Unified Browser (Large Screen)',
        command: `YouTube Task: "${query}"`,
        output: browserRes.summary || `Opened YouTube search for "${query}" in FahOS Unified Browser.`,
        error: browserRes.ok ? undefined : browserRes.error
      };
    }
  }

  const searchMatch = rawText.match(/^(?:(?:open|launch)\s+(?:chrome|browser|google\s+chrome|edge|firefox|brave)\s+(?:and\s+)?(?:search|look\s+up|google)(?:\s+(?:for|about))?\s+(.+)|(?:search|google|look\s+up)(?:\s+(?:for|about))?\s+(.+?)(?:\s+(?:on|in|using)\s+(?:chrome|browser|google|google\s+chrome|edge|firefox|brave))?)$/i);
  if (searchMatch) {
    const query = (searchMatch[1] || searchMatch[2] || '').trim().replace(/[\.\?!,;]+$/, '').trim();
    if (query && !/^(?:files?|folders?|apps?)$/i.test(query)) {
      console.log(`[FahOS Agent] Routing Search task to FahOS Unified Browser: "${rawText}"`);
      const browserRes = await agentBrowserWindow.runAgentTask(rawText);
      return {
        ok: browserRes.ok,
        isAction: true,
        provider: 'FahOS Unified Browser (Large Screen)',
        command: `Web Search: "${query}"`,
        output: browserRes.summary || `Searched "${query}" in FahOS Unified Browser.`,
        error: browserRes.ok ? undefined : browserRes.error
      };
    }
  }

  // 4.6. Direct File or Folder Deletion Intent (e.g. "Can you delete a file named sai in Downloads?", "confirm delete file notes.txt on Desktop", "delete file notes.txt")
  const deleteFileMatch = rawText.match(/^(?:can\s+you\s+)?(?:confirm\s+|yes\s+|approve\s+|proceed\s+)?(?:delete|remove|erase)\s+(?:a\s+)?(?:file|folder|document|directory)?\s*(?:named|called|with\s+name)?\s*([a-zA-Z0-9_\-\.\s]+?)(?:\s+(?:in|on|at|inside|from)\s+(?:the\s+)?([a-zA-Z0-9_\-\\\/\s]+))?$/i);
  if (deleteFileMatch && deleteFileMatch[1]) {
    const itemName = deleteFileMatch[1].trim().replace(/[\.\?!,;]+$/, '').trim();
    const destFolder = deleteFileMatch[2] ? deleteFileMatch[2].trim().replace(/[\.\?!,;]+$/, '').trim() : '';

    console.log(`[FahOS Agent] Direct routing to delete file/folder: "${itemName}" from "${destFolder || 'system'}"`);
    const isExplicitYes = /\b(?:confirm|yes|approve|proceed)\b/i.test(rawText);
    const deleteRes = await systemActions.deleteFileOrFolder({
      name: itemName,
      targetFolder: destFolder,
      confirmed: isExplicitYes
    });

    return {
      ok: deleteRes.ok,
      isAction: true,
      requiresConfirmation: deleteRes.requiresConfirmation || false,
      tier: deleteRes.tier || 'DANGEROUS',
      itemPath: deleteRes.itemPath,
      itemName: deleteRes.itemName,
      provider: deleteRes.requiresConfirmation ? 'FahOS Security Guard (Permission Required)' : 'FahOS Filesystem Agent',
      command: deleteRes.command || `Delete: "${itemName}"`,
      output: deleteRes.description,
      error: deleteRes.ok ? undefined : deleteRes.description
    };
  }

  // 5. Observe-Plan-Verify Agent Loop (Open Apps, Specific Folders, and Local Files)
  // Browser-Use Intercept: commands containing multi-step web queries route to Browser Use first.
  const openMatch = rawText.match(/^(?:open|launch|start|run|go\s+to|show|view)(?:\s+(?:the|folder|directory|app|file))?\s+(.+)$/i);
  if (openMatch && openMatch[1]) {
    const rawTarget = openMatch[1].trim().replace(/[.?!,;]+$/, '').trim();

    const BROWSER_TASK_SIGNALS = [
      /\band\s+(tell|show|find|get|search|look|check|read|navigate|fetch|go|click|type|enter|fill)\b/i,
      /\b(tell\s+me|find\s+out|how\s+many|what\s+is|what'?s|who\s+is|when\s+is|look\s+up|check\s+for|read\s+about|search\s+for)\b/i,
      /\b(github\.com|google\.com|youtube\.com|reddit\.com|twitter\.com|linkedin\.com|amazon\.com)\b/i,
      /\b(stars?|forks?|issues?|followers?|trending|price|news|article|rating|review|score|count)\b/i,
      // Known website names by themselves → open in browser (not as local app/file)
      /^(browser|chrome|google|youtube|yt|github|gitlab|reddit|twitter|x|instagram|facebook|linkedin|amazon|netflix|spotify\.com|twitch|stackoverflow|medium|wikipedia|chatgpt|openai|vercel|heroku|discord\.gg)$/i
    ];

    const isBrowserTask = BROWSER_TASK_SIGNALS.some(re => re.test(rawTarget));

    if (isBrowserTask) {
      // Check if it's JUST a website name (no complex query) → open URL directly in browser (fast)
      const SIMPLE_SITE_MAP = {
        browser: 'https://www.google.com',
        chrome: 'https://www.google.com',
        google: 'https://www.google.com',
        youtube: 'https://www.youtube.com',
        yt: 'https://www.youtube.com',
        github: 'https://github.com',
        gitlab: 'https://gitlab.com',
        reddit: 'https://reddit.com',
        twitter: 'https://twitter.com',
        x: 'https://twitter.com',
        instagram: 'https://instagram.com',
        facebook: 'https://facebook.com',
        linkedin: 'https://linkedin.com',
        amazon: 'https://www.amazon.in',
        netflix: 'https://netflix.com',
        twitch: 'https://twitch.tv',
        stackoverflow: 'https://stackoverflow.com',
        medium: 'https://medium.com',
        wikipedia: 'https://wikipedia.org',
        chatgpt: 'https://chatgpt.com',
        openai: 'https://openai.com',
        vercel: 'https://vercel.com',
        heroku: 'https://heroku.com'
      };

      const simpleKey = rawTarget.toLowerCase().trim();
      if (SIMPLE_SITE_MAP[simpleKey]) {
        console.log(`[FahOS Agent] Simple website open in FahOS Unified Browser: ${SIMPLE_SITE_MAP[simpleKey]}`);
        agentBrowserWindow.createAgentBrowserWindow(SIMPLE_SITE_MAP[simpleKey]);
        return {
          ok: true,
          isAction: true,
          provider: 'FahOS Unified Browser',
          command: `Open: ${SIMPLE_SITE_MAP[simpleKey]}`,
          output: `Opened **${rawTarget}** in FahOS Unified Browser.`
        };
      }

      // Complex task → Large-Screen Integrated Agent Browser
      console.log(`[FahOS Agent] Routing to Large-Screen Integrated Agent Browser (complex web task): "${rawText}"`);
      const browserRes = await agentBrowserWindow.runAgentTask(rawText);
      return {
        ok: browserRes.ok,
        isAction: true,
        provider: 'FahOS Autonomous Browser Agent (Large Screen)',
        command: `Browser Task: "${rawTarget}"`,
        output: browserRes.summary || browserRes.error,
        error: browserRes.ok ? undefined : browserRes.error
      };
    }

    // Check if it is a WhatsApp contact chat request before routing
    const isContactChat = /\bchat\b/i.test(rawTarget) || (contactsService.getPhoneForContact(rawTarget) && !systemActions.resolveApp(rawTarget));
    if (!isContactChat) {
      console.log(`[FahOS Agent: Loop] Initiating Observe-Plan-Verify for: "${rawTarget}"`);
      const agentRes = await systemActions.verifyAndOpenItem(rawTarget);
      if (agentRes.ok) {
        return {
          ok: true,
          isAction: true,
          provider: 'FahOS Windows Agent (Observe-Plan-Verify)',
          command: agentRes.command || `Open: "${agentRes.name}"`,
          output: agentRes.description
        };
      } else if (agentRes.notFound) {
        return {
          ok: false,
          isAction: true,
          notFound: true,
          provider: 'FahOS System Agent',
          command: `Lookup: "${rawTarget}"`,
          output: agentRes.description,
          error: agentRes.description
        };
      }
    }
  }

  // 2. Direct Visual Mouse Click command (e.g. "click play", "click search")
  const fastClickMatch = rawText.match(/^click\s+(?:on\s+)?(.*)/i);
  if (fastClickMatch && fastClickMatch[1]) {
    const target = fastClickMatch[1].trim();
    const gemKey = cfg.geminiApiKey || cfg.providers?.gemini?.apiKey;
    const res = await visualAgent.clickTarget(target, gemKey);
    return {
      ok: res.ok,
      isAction: true,
      provider: 'Gemini 3.6 Vision + Windows Mouse',
      command: `Mouse Click: (${res.x || '?'}, ${res.y || '?'})`,
      output: res.description
    };
  }

  // 2. Query Orchestrated Model for OS actions or conversational reasoning
  const classification = classifyQuery(rawText);
  let rawOutput = '';
  let activeProviderName = 'orchestrator';

  try {
    const orchRes = await orchestrateResponse(cfg, rawText, false, null);
    if (orchRes && orchRes.ok && orchRes.output) {
      rawOutput = orchRes.output;
      activeProviderName = orchRes.provider;
    } else {
      const provider = getProviderForTier(cfg, classification.tier);
      activeProviderName = provider.name;
      const { system, prompt } = buildPrompt(action, rawText);
      rawOutput = await provider.generate({ system, prompt });
    }

    // Check if AI synthesized an explicit shell script or action directive block
    const cmdMatch = rawOutput.match(/```(?:cmd|powershell|ps1|sh|bash)\r?\n([\s\S]*?)```/i) ||
                     rawOutput.match(/```\r?\n((?:create_file|delete_file|web_search|youtube_search|spotify_search|open_app|open_folder|browser_control|compose_email|send_whatsapp_message|visual_click):\s*[\s\S]*?)```/i);

    if (cmdMatch && cmdMatch[1] && cmdMatch[1].trim()) {
      let commandToRun = cmdMatch[1].trim();
      const cleanDesc = rawOutput.replace(/```[\s\S]*?```/g, '').trim();

      // Check if command contains a WhatsApp message sending request
      const waMsgCmdMatch = commandToRun.match(/send_whatsapp_message:\s*([^|\r\n]+)\|\s*([^\r\n]+)/i);
      if (waMsgCmdMatch) {
        const contactName = waMsgCmdMatch[1].trim();
        const msgText = waMsgCmdMatch[2].trim();
        console.log(`[FahOS Agent] AI synthesized WhatsApp message to: "${contactName}", text: "${msgText}"`);
        const waRes = await systemActions.openWhatsAppChat(contactName, msgText);
        return {
          ok: waRes.ok,
          isAction: true,
          provider: 'Windows OS Agent (WhatsApp Automation)',
          command: `WhatsApp Send Message: "${contactName}"`,
          output: waRes.description
        };
      }

      // Check if command contains a File/Folder creation request
      const createFileCmdMatch = commandToRun.match(/create_file:\s*([^|\r\n]+)(?:\|\s*([^\r\n]*))?/i);
      if (createFileCmdMatch) {
        const itemName = createFileCmdMatch[1].trim();
        const targetFolder = createFileCmdMatch[2] ? createFileCmdMatch[2].trim() : 'Desktop';
        const isFolder = /folder|directory/i.test(itemName) || /folder|directory/i.test(rawText);
        console.log(`[FahOS Agent] AI synthesized Create File/Folder: "${itemName}" in "${targetFolder}"`);
        const createRes = await systemActions.createFileOrFolder({
          name: itemName.replace(/\b(?:folder|file|document)\b/gi, '').trim(),
          targetFolder: targetFolder,
          isFolder: isFolder
        });
        return {
          ok: createRes.ok,
          isAction: true,
          provider: 'FahOS Filesystem Agent',
          command: createRes.command || `Create: "${itemName}"`,
          output: createRes.description,
          error: createRes.ok ? undefined : createRes.description
        };
      }

      // Check if command contains a File/Folder deletion request
      const deleteFileCmdMatch = commandToRun.match(/delete_file:\s*([^|\r\n]+)(?:\|\s*([^\r\n]*))?/i);
      if (deleteFileCmdMatch) {
        const itemName = deleteFileCmdMatch[1].trim();
        const targetFolder = deleteFileCmdMatch[2] ? deleteFileCmdMatch[2].trim() : '';
        console.log(`[FahOS Agent] AI synthesized Delete File/Folder: "${itemName}" from "${targetFolder || 'system'}"`);
        const isExplicitYes = /\b(?:confirm|yes|approve|proceed)\b/i.test(rawText);
        const deleteRes = await systemActions.deleteFileOrFolder({
          name: itemName.replace(/\b(?:folder|file|document)\b/gi, '').trim(),
          targetFolder: targetFolder,
          confirmed: isExplicitYes
        });
        return {
          ok: deleteRes.ok,
          isAction: true,
          requiresConfirmation: deleteRes.requiresConfirmation || false,
          tier: deleteRes.tier || 'DANGEROUS',
          itemPath: deleteRes.itemPath,
          itemName: deleteRes.itemName,
          provider: deleteRes.requiresConfirmation ? 'FahOS Security Guard (Permission Required)' : 'FahOS Filesystem Agent',
          command: deleteRes.command || `Delete: "${itemName}"`,
          output: deleteRes.description,
          error: deleteRes.ok ? undefined : deleteRes.description
        };
      }

      // Check if command contains a Web Search request (Route to FahOS Unified Browser)
      const webSearchCmdMatch = commandToRun.match(/web_search:\s*([^\r\n]+)/i);
      if (webSearchCmdMatch) {
        const query = webSearchCmdMatch[1].trim();
        console.log(`[FahOS Agent] AI synthesized Web Search in FahOS Unified Browser: "${query}"`);
        const browserRes = await agentBrowserWindow.runAgentTask('Search Google for ' + query);
        return {
          ok: browserRes.ok,
          isAction: true,
          provider: 'FahOS Unified Browser (Large Screen)',
          command: `Web Search: "${query}"`,
          output: browserRes.summary || `Searched "${query}" in FahOS Unified Browser.`,
          error: browserRes.ok ? undefined : browserRes.error
        };
      }

      // Check if command contains a YouTube Search request (Route to FahOS Unified Browser)
      const ytSearchCmdMatch = commandToRun.match(/youtube_search:\s*([^\r\n]+)/i);
      if (ytSearchCmdMatch) {
        const query = ytSearchCmdMatch[1].trim();
        console.log(`[FahOS Agent] AI synthesized YouTube Search in FahOS Unified Browser: "${query}"`);
        const browserRes = await agentBrowserWindow.runAgentTask('Open YouTube and search for ' + query);
        return {
          ok: browserRes.ok,
          isAction: true,
          provider: 'FahOS Unified Browser (Large Screen)',
          command: `YouTube: "${query}"`,
          output: browserRes.summary || `Opened YouTube search for "${query}" in FahOS Unified Browser.`,
          error: browserRes.ok ? undefined : browserRes.error
        };
      }

      // Check if command contains a Spotify Search request
      const spotifyCmdMatch = commandToRun.match(/spotify_search:\s*([^\r\n]+)/i);
      if (spotifyCmdMatch) {
        const query = spotifyCmdMatch[1].trim();
        console.log(`[FahOS Agent] AI synthesized Spotify Search: "${query}"`);
        const spotRes = await systemActions.spotifySearch({ query });
        return {
          ok: spotRes.ok,
          isAction: true,
          provider: 'FahOS Spotify Agent',
          command: spotRes.command || `Spotify: "${query}"`,
          output: spotRes.description,
          error: spotRes.ok ? undefined : spotRes.description
        };
      }

      // Check if command contains an open_app or open_folder request
      const openToolCmdMatch = commandToRun.match(/(?:open_app|open_folder):\s*([^\r\n]+)/i);
      if (openToolCmdMatch) {
        const target = openToolCmdMatch[1].trim();
        console.log(`[FahOS Agent] AI synthesized Open App/Folder: "${target}"`);
        const openRes = await systemActions.verifyAndOpenItem(target);
        return {
          ok: openRes.ok,
          isAction: true,
          provider: 'FahOS Windows Agent',
          command: openRes.command || `Open: "${target}"`,
          output: openRes.description,
          error: openRes.ok ? undefined : openRes.description
        };
      }

      // Check if command contains an Autonomous Browser Control request (Browser Use)
      const browserCmdMatch = commandToRun.match(/browser_control:\s*([^\r\n]+)/i);
      if (browserCmdMatch) {
        const browserTaskText = browserCmdMatch[1].trim();
        console.log(`[FahOS Agent] AI synthesized Browser Control Task: "${browserTaskText}"`);
        const browserRes = await agentBrowserWindow.runAgentTask(browserTaskText);
        return {
          ok: browserRes.ok,
          isAction: true,
          provider: 'FahOS Unified Browser Agent',
          command: `Browser Task: "${browserTaskText}"`,
          output: browserRes.summary || browserRes.error,
          error: browserRes.ok ? undefined : browserRes.error
        };
      }

      // Check if command contains an email compose request
      const emailCmdMatch = commandToRun.match(/compose_email:\s*([^|\r\n]+)(?:\|\s*([^\r\n]*))?/i);
      if (emailCmdMatch) {
        const contactTarget = emailCmdMatch[1].trim();
        const emailNotes = emailCmdMatch[2] ? emailCmdMatch[2].trim() : '';
        console.log(`[FahOS Agent] AI synthesized Email compose to: "${contactTarget}", notes: "${emailNotes}"`);
        const emailRes = await systemActions.composeEmail(contactTarget, emailNotes ? `Message regarding: ${emailNotes.slice(0, 30)}` : '', emailNotes);
        return {
          ok: emailRes.ok,
          isAction: true,
          provider: 'Gmail (Default Browser)',
          command: emailRes.command || `Email: "${contactTarget}"`,
          output: emailRes.description,
          error: emailRes.ok ? undefined : emailRes.description
        };
      }
      const waChatCmdMatch = commandToRun.match(/(?:open_whatsapp_chat|visual_click):\s*([^\r\n]+)/i);
      const isWhatsAppIntent = /whatsapp/i.test(commandToRun + ' ' + rawText);
      if (waChatCmdMatch && isWhatsAppIntent && !/button|link|icon|play|video|pause/i.test(waChatCmdMatch[1])) {
        const contactName = waChatCmdMatch[1].trim();
        console.log(`[FahOS Agent] Navigating directly to WhatsApp contact: "${contactName}"`);
        const waRes = await systemActions.openWhatsAppChat(contactName);
        return {
          ok: true,
          isAction: true,
          provider: 'Windows OS Agent (WhatsApp Automation)',
          command: `WhatsApp Open Chat: "${contactName}"`,
          output: `Opened WhatsApp and navigated directly to chat with **${contactName}**.`
        };
      }

      // Check if command contains a Visual Mouse Click request (e.g. "visual_click: button")
      const clickMatch = commandToRun.match(/visual_click:\s*([^\r\n]+)/i);
      if (clickMatch && clickMatch[1]) {
        const target = clickMatch[1].trim();

        // Run any preceding command (e.g. "start whatsapp:")
        const preCommands = commandToRun
          .replace(/visual_click:\s*[^\r\n]+/gi, '')
          .split(/\r?\n/)
          .map(c => c.trim())
          .filter(Boolean);

        for (const preCmd of preCommands) {
          console.log(`[FahOS Agent] Pre-running: ${preCmd}`);
          await systemActions.runPowerShell(preCmd);
        }

        if (preCommands.length > 0) {
          console.log(`[FahOS Agent] Waiting 2s for app window to render...`);
          await new Promise(r => setTimeout(r, 2000));
        }

        const gemKey = cfg.geminiApiKey || cfg.providers?.gemini?.apiKey;
        console.log(`[FahOS Agent] Triggering Visual Mouse Agent for: "${target}"`);
        let clickRes = await visualAgent.clickTarget(target, gemKey);

        // Fallback for contacts if not immediately found on screen: use search
        if (!clickRes.found && /whatsapp/i.test(commandToRun + rawText)) {
          console.log(`[FahOS Agent] Fallback: Searching WhatsApp for "${target}" via keyboard...`);
          const searchScript = [
            "$ws = New-Object -ComObject WScript.Shell",
            "$ws.AppActivate('WhatsApp')",
            "Start-Sleep -Milliseconds 400",
            "$ws.SendKeys('^f')",
            "Start-Sleep -Milliseconds 300",
            `$ws.SendKeys('${target.replace(/'/g, "''")}')`,
            "Start-Sleep -Milliseconds 600",
            "$ws.SendKeys('{ENTER}')"
          ].join('; ');
          await systemActions.runPowerShell(searchScript);
          clickRes = {
            ok: true,
            found: true,
            description: `Searched and opened chat with **${target}** in WhatsApp.`
          };
        }

        return {
          ok: clickRes.ok,
          isAction: true,
          provider: 'Gemini 3.6 Vision + Windows Mouse',
          command: clickRes.x ? `Click (${clickRes.x}, ${clickRes.y})` : `Open Chat: ${target}`,
          output: clickRes.description || cleanDesc
        };
      }

      // Verify command is a genuine executable Windows shell command (not markdown or programming code)
      const isExecutableShellCommand = /^(?:start\s+|powershell|cmd|cd\s+|mkdir\s+|del\s+|rmdir\s+|copy\s+|move\s+|echo\s+|dir\s+|get-|set-|new-|remove-|invoke-)/i.test(commandToRun);
      if (isExecutableShellCommand) {
        // If opening YouTube search, automatically resolve the direct watch URL for immediate playback!
        const ytMatch = commandToRun.match(/youtube\.com\/results\?search_query=([^\s"'\)]+)/i);
        if (ytMatch && ytMatch[1]) {
          try {
            const rawQuery = decodeURIComponent(ytMatch[1].replace(/\+/g, ' '));
            const directWatchUrl = await systemActions.getFirstYouTubeVideoUrl(rawQuery);
            console.log(`[FahOS Agent] Resolved direct YouTube playback: ${directWatchUrl}`);
            commandToRun = `start ${directWatchUrl}`;
          } catch (_) {}
        }

        console.log(`\n======================================================`);
        console.log(`[FahOS Agent] [Qwen Brain] Synthesized Windows Command:`);
        console.log(`>> ${commandToRun}`);
        console.log(`======================================================`);

        // Execute on Windows via systemActions
        await systemActions.runPowerShell(commandToRun);

        return {
          ok: true,
          isAction: true,
          provider: 'Qwen 3.8 + Windows Shell',
          command: commandToRun,
          output: cleanDesc || `Executed: \`${commandToRun}\``
        };
      }
    }

    // Otherwise standard educational / conversational answer
    return { ok: true, isAction: false, provider: activeProviderName, output: rawOutput };
  } catch (e) {
    return { ok: false, provider: activeProviderName, error: e.message || String(e) };
  }
}

module.exports = {
  createProvider,
  runAction,
  extractWhatsAppMessage,
  extractEmailCompose
};
