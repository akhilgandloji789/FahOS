'use strict';
/**
 * FahOS — AI Model Orchestrator
 * Analyzes incoming queries and routes to the optimal model based on complexity,
 * domain, and required capabilities.
 */

const { createProvider } = require('./router');

/**
 * Complexity tiers and their recommended models
 */
const MODEL_TIERS = {
  simple: {
    description: 'Fast greetings, short factual lookups, basic info',
    preferredModels: {
      openaiCompatible: ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
      gemini: ['gemini-3.6-flash'],
      ollama: ['llama3.2:1b', 'qwen2.5-coder']
    },
    providers: ['gemini', 'openaiCompatible', 'ollama', 'mock'], // Groq -> Gemini -> Ollama -> Mock
    maxTokens: 500,
    temperature: 0.1,
    examples: [
      'what time is it',
      'hello',
      'what is the capital of france',
      'define photosynthesis',
      'how are you'
    ]
  },
  medium: {
    description: 'Explanations, summaries, analysis, multi-step Q&A',
    preferredModels: {
      openaiCompatible: ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
      gemini: ['gemini-3.6-flash'],
      ollama: ['llama3.1', 'qwen2.5-coder']
    },
    providers: ['gemini', 'openaiCompatible', 'ollama', 'mock'], // Groq -> Gemini -> Ollama -> Mock
    maxTokens: 1500,
    temperature: 0.2,
    examples: [
      'explain how blockchain works',
      'summarize this article',
      'compare react vs vue',
      'why does the sky appear blue',
      'write a professional email'
    ]
  },
  complex: {
    description: 'Deep reasoning, complex analysis, step-by-step logic',
    preferredModels: {
      openaiCompatible: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
      gemini: ['gemini-3.6-flash'],
      ollama: ['deepseek-r1:14b', 'qwen2.5-coder']
    },
    providers: ['gemini', 'openaiCompatible', 'ollama', 'mock'], // Groq -> Gemini -> Ollama -> Mock
    maxTokens: 3000,
    temperature: 0.3,
    examples: [
      'write a complete business plan',
      'analyze the geopolitical implications',
      'create a marketing strategy',
      'solve this complex math problem step by step'
    ]
  },
  coding: {
    description: 'Code generation, debugging, refactoring, architecture',
    preferredModels: {
      openaiCompatible: ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'],
      gemini: ['gemini-3.6-flash'],
      ollama: ['qwen2.5-coder', 'llama3.1']
    },
    providers: ['gemini', 'openaiCompatible', 'ollama', 'mock'], // Groq -> Gemini -> Ollama -> Mock
    maxTokens: 4000,
    temperature: 0.1,
    examples: [
      'write a react component for',
      'debug this python error',
      'refactor this function',
      'create an api endpoint',
      'explain this code'
    ]
  },
  vision: {
    description: 'Image analysis, screen snip interpretation, OCR, diagram reading',
    preferredModels: {
      gemini: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'],
      ollama: ['qwen3-vl:8b', 'gemma3:12b', 'llava:13b', 'llava']
    },
    providers: ['gemini', 'ollama', 'mock'], // Gemini -> Ollama -> Mock
    maxTokens: 2000,
    temperature: 0.2,
    examples: [
      'analyze this screenshot',
      'read text from this image',
      'explain this diagram',
      'what is in this photo'
    ]
  }
};

/**
 * Keywords that strongly indicate a specific tier
 */
const TIER_KEYWORDS = {
  coding: [
    'code', 'function', 'component', 'api', 'endpoint', 'debug', 'error',
    'refactor', 'implement', 'algorithm', 'database', 'sql', 'query',
    'react', 'vue', 'angular', 'node', 'python', 'javascript', 'typescript',
    'java', 'c++', 'c#', 'cpp', 'csharp',
    'class', 'interface', 'hook', 'state', 'props', 'render', 'compile',
    'build', 'deploy', 'docker', 'kubernetes', 'git', 'github', 'gitlab'
  ],
  vision: [
    'screenshot', 'image', 'photo', 'picture', 'diagram', 'chart', 'graph',
    'snip', 'screen', 'visual', 'ocr', 'read this', 'analyze this',
    'what do you see', 'look at this'
  ],
  complex: [
    'business plan', 'strategy', 'comprehensive', 'detailed analysis',
    'research', 'thesis', 'dissertation', 'architecture', 'design pattern',
    'system design', 'scalability', 'optimization', 'trade-off',
    'explain clearly', 'explain in detail', 'explain detaily', 'in detail',
    'in depth', 'in-depth', 'detaily', 'deeply', 'thoroughly', 'elaborate'
  ],
  simple: [
    'hello', 'hi', 'hey', 'thanks', 'thank you', 'bye', 'goodbye',
    'what time', 'date today', 'weather', 'joke', 'fun fact'
  ]
};

/**
 * Classify query complexity and domain
 * @param {string} text - User query
 * @param {boolean} hasImage - Whether an image is attached
 * @returns {Object} Classification result
 */
function classifyQuery(text, hasImage = false) {
  // Normalize text: replace punctuation with space to separate concatenated words (e.g. "mcp?explain")
  const rawStr = String(text || '').trim();
  const normalized = rawStr.toLowerCase().replace(/[\.\?!,;:\/\\_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  // Vision always takes priority if image present
  if (hasImage) {
    return { tier: 'vision', confidence: 1.0, reason: 'Image attached' };
  }

  // Check for explicit detailed explanation requests (e.g. "explain it clearly", "explain in detail", "explain detaily")
  const DETAILED_EXPLANATION_REGEX = /\b(explain\s+(?:[a-z0-9_-]+\s+)?clearly|explain\s+(?:[a-z0-9_-]+\s+)?in\s+detail|explain\s+(?:[a-z0-9_-]+\s+)?detaily|in\s+detail|in-depth|detaily|deeply|thoroughly|comprehensive|elaborate|step\s+by\s+step)\b/i;
  if (DETAILED_EXPLANATION_REGEX.test(normalized)) {
    const match = normalized.match(DETAILED_EXPLANATION_REGEX);
    return { tier: 'complex', confidence: 0.95, reason: `Detailed explanation requested: "${match[0]}"` };
  }

  // Check for explicit coding keywords using strict word boundaries
  for (const kw of TIER_KEYWORDS.coding) {
    const kwRegex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (kwRegex.test(normalized)) {
      return { tier: 'coding', confidence: 0.9, reason: `Coding keyword: "${kw}"` };
    }
  }

  // Check for vision-related keywords (even without image)
  for (const kw of TIER_KEYWORDS.vision) {
    const kwRegex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (kwRegex.test(normalized)) {
      return { tier: 'vision', confidence: 0.7, reason: `Vision keyword: "${kw}"` };
    }
  }

  // Check for explicit complex keywords
  for (const kw of TIER_KEYWORDS.complex) {
    const kwRegex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (kwRegex.test(normalized)) {
      return { tier: 'complex', confidence: 0.85, reason: `Complex keyword: "${kw}"` };
    }
  }

  // Check for simple greetings/basic queries (only if brief <= 8 words)
  if (wordCount <= 8) {
    for (const kw of TIER_KEYWORDS.simple) {
      const kwRegex = new RegExp(`^${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (kwRegex.test(normalized)) {
        return { tier: 'simple', confidence: 0.95, reason: `Simple keyword: "${kw}"` };
      }
    }
  }

  // Short factual queries without explanation intent
  if (wordCount <= 5 && /^(what|who|where|when|define)\b/i.test(normalized) && !/\b(explain|describe|clearly|detail|detaily|deeply|how|why)\b/i.test(normalized)) {
    return { tier: 'simple', confidence: 0.7, reason: 'Short factual query' };
  }

  if (wordCount > 25 || (wordCount > 12 && /^(analyze|compare|evaluate|design|create|write)\b/i.test(normalized))) {
    return { tier: 'complex', confidence: 0.75, reason: 'Long or analytical query' };
  }

  if (wordCount > 5 || /^(explain|describe|summarize)\b/i.test(normalized)) {
    return { tier: 'medium', confidence: 0.7, reason: 'Explanation or medium-length query' };
  }

  // Default to medium for ambiguous queries
  return { tier: 'medium', confidence: 0.5, reason: 'Default classification' };
}

/**
 * Get the best available provider for a tier
 * @param {Object} cfg - Configuration object
 * @param {string} tier - Complexity tier
 * @returns {Object} Provider instance
 */
function getProviderForTier(cfg, tier) {
  const tierConfig = MODEL_TIERS[tier] || MODEL_TIERS.medium;

  // Try providers in order of preference for this tier without mutating original config
  for (const providerName of tierConfig.providers) {
    try {
      const clonedCfg = JSON.parse(JSON.stringify(cfg || {}));
      clonedCfg.aiProvider = providerName;

      const normKey = (providerName === 'openai-compatible' || providerName === 'openaicompatible') ? 'openaiCompatible' : providerName;
      const rawPreferred = tierConfig.preferredModels?.[providerName] || tierConfig.preferredModels?.[normKey];
      const preferred = Array.isArray(rawPreferred) ? rawPreferred[0] : rawPreferred;

      if (preferred) {
        if (!clonedCfg.providers) clonedCfg.providers = {};
        if (!clonedCfg.providers[normKey]) clonedCfg.providers[normKey] = {};
        clonedCfg.providers[normKey].model = preferred;
        if (normKey !== providerName) {
          if (!clonedCfg.providers[providerName]) clonedCfg.providers[providerName] = {};
          clonedCfg.providers[providerName].model = preferred;
        }
      }

      const provider = createProvider(clonedCfg);

      // Verify provider has valid API key (if needed)
      if (providerName !== 'mock' && providerName !== 'ollama') {
        const key = clonedCfg.providers?.[normKey]?.apiKey || clonedCfg.providers?.[providerName]?.apiKey;
        if (!key) continue;
      }

      const modelName = clonedCfg.providers?.[normKey]?.model || clonedCfg.providers?.[providerName]?.model || 'default';
      console.log(`[Orchestrator] Selected ${provider.name} (model: ${modelName}) for tier: ${tier}`);
      return provider;
    } catch (e) {
      console.warn(`[Orchestrator] Provider ${providerName} unavailable for tier ${tier}:`, e.message);
    }
  }

  // Fallback: use configured default
  console.log(`[Orchestrator] Falling back to default provider for tier: ${tier}`);
  return createProvider(cfg);
}

/**
 * Generate response using the orchestrated model
 * @param {Object} cfg - Configuration
 * @param {string} text - User query
 * @param {boolean} hasImage - Whether image is attached
 * @param {string} imageBase64 - Base64 image data (for vision)
 * @returns {Promise<Object>} Response
 */
async function orchestrateResponse(cfg, text, hasImage = false, imageBase64 = null) {
  const classification = classifyQuery(text, hasImage);
  const { tier, confidence, reason } = classification;

  const tierConfig = MODEL_TIERS[tier] || MODEL_TIERS.medium;
  const candidateNames = tierConfig.providers || ['mock'];

  const tierLabel = {
    simple: '[SIMPLE]',
    medium: '[MEDIUM]',
    complex: '[COMPLEX]',
    coding: '[CODING]',
    vision: '[VISION]'
  };
  const label = tierLabel[tier] || '[INFO]';
  const tierUpper = tier.toUpperCase();

  let lastError = null;

  for (const providerName of candidateNames) {
    const normKey = (providerName === 'openai-compatible' || providerName === 'openaicompatible') ? 'openaiCompatible' : providerName;
    const rawPreferred = tierConfig.preferredModels?.[providerName] || tierConfig.preferredModels?.[normKey];
    const modelList = Array.isArray(rawPreferred) ? rawPreferred : (rawPreferred ? [rawPreferred] : ['default']);

    for (const targetModel of modelList) {
      try {
        const clonedCfg = JSON.parse(JSON.stringify(cfg || {}));
        clonedCfg.aiProvider = providerName;

        if (!clonedCfg.providers) clonedCfg.providers = {};
        if (!clonedCfg.providers[normKey]) clonedCfg.providers[normKey] = {};
        clonedCfg.providers[normKey].model = targetModel;
        if (normKey !== providerName) {
          if (!clonedCfg.providers[providerName]) clonedCfg.providers[providerName] = {};
          clonedCfg.providers[providerName].model = targetModel;
        }

        const provider = createProvider(clonedCfg);

        if (providerName !== 'mock' && providerName !== 'ollama') {
          const key = clonedCfg.providers?.[normKey]?.apiKey || clonedCfg.providers?.[providerName]?.apiKey;
          if (!key) break; // Skip provider if API key missing
        }

        const assignedModel = targetModel;

        console.log('');
        console.log('==============================================================================');
        console.log(`| ${label} FAHOS ORCHESTRATOR -- MODEL SELECTION`);
        console.log('------------------------------------------------------------------------------');
        console.log(`|  Query: "${text.slice(0, 70)}${text.length > 70 ? '...' : ''}"`);
        console.log(`|  ---------------------------------------------------------------------------`);
        console.log(`|  Complexity Tier:  ${tierUpper.padEnd(8)} (${(confidence * 100).toFixed(0)}% confidence)`);
        console.log(`|  Reason:           ${reason}`);
        console.log(`|  Model Provider:   ${provider.name}`);
        console.log(`|  Assigned Model:   ${assignedModel}`);
        console.log(`|  Max Tokens:       ${tierConfig.maxTokens}`);
        console.log(`|  Temperature:      ${tierConfig.temperature}`);
        if (hasImage) console.log(`|  Vision Mode:      Image attached -- using Gemini Vision`);
        console.log('==============================================================================');
        console.log('');

        let response;
        if (tier === 'vision' && imageBase64) {
          response = await provider.analyzeImage({
            system: tierConfig.systemPrompt || 'Analyze this image and answer the user\'s question.',
            prompt: text || 'What do you see in this image?',
            base64Image: imageBase64
          });
        } else {
          let { system, prompt } = buildTierPrompt(tier, text);

          // Dynamic Live Web Grounding for real-time factual queries across any topic/country
          const isRealTimeQuery = /^(who\s+is|what\s+is|who\s+was|who\s+won|current|latest|today|now|recent|president|prime\s+minister|chief\s+minister|cm\s+of|pm\s+of|governor|ceo|score|weather|news|population)\b/i.test(text) || /\b(current|latest|today|2024|2025|2026)\b/i.test(text);
          if (isRealTimeQuery) {
            try {
              const { fetchLiveWebSnippets } = require('./webSearchService');
              const liveSnippets = await fetchLiveWebSnippets(text);
              if (liveSnippets) {
                system += `\n\nLIVE REAL-TIME WEB CONTEXT (2026):\n${liveSnippets}\n\nINSTRUCTION: Use the above live web context to provide an accurate, up-to-date 2026 answer. Do NOT rely on historical pre-training memory if it contradicts this live context.`;
                prompt = `LIVE REAL-TIME WEB SEARCH CONTEXT (2026):\n${liveSnippets}\n\nUSER QUESTION: ${text}`;
              }
            } catch (e) {
              console.warn('[Orchestrator] Web snippet retrieval notice:', e.message);
            }
          }

          response = await provider.generate({
            system,
            prompt,
            maxTokens: tierConfig.maxTokens,
            temperature: tierConfig.temperature
          });
        }

        return {
          ok: true,
          tier,
          confidence,
          provider: `${provider.name} (${assignedModel})`,
          classification: reason,
          output: response
        };
      } catch (e) {
        console.warn(`[Orchestrator] Provider "${providerName}" (model: "${targetModel}") failed:`, e.message);
        lastError = e;
      }
    }
  }

  // Fallback: use default provider or mock
  try {
    const defaultProvider = createProvider(cfg);
    const { system, prompt } = buildTierPrompt(tier, text);
    const response = await defaultProvider.generate({
      system,
      prompt,
      maxTokens: tierConfig.maxTokens,
      temperature: tierConfig.temperature
    });
    return {
      ok: true,
      tier,
      confidence,
      provider: defaultProvider.name,
      classification: reason,
      output: response
    };
  } catch (finalErr) {
    const cleanMsg = lastError ? lastError.message : finalErr.message;
    return { ok: false, error: cleanMsg, tier, provider: 'orchestrator' };
  }
}

/**
 * Build tier-specific prompts
 * @param {string} tier
 * @param {string} text
 * @returns {Object} { system, prompt }
 */
function buildTierPrompt(tier, text) {
  const baseSystem = `You are FahOS, an intelligent Windows OS AI assistant with direct execution and automation capabilities.
Current Year: 2026. Always provide accurate, up-to-date 2026 information for all political, leadership, real-time, and factual questions.
CRITICAL INSTRUCTION: You have direct system control over the computer. NEVER state that you cannot access files, control the computer, open applications, or run commands. If asked to perform an OS action, open an app, search the web, manage files, or play media, fulfill the request and provide clear guidance.`;

  const tierInstructions = {
    simple: `${baseSystem}
Keep answers extremely concise (1-2 sentences). Be direct and helpful.`,
    medium: `${baseSystem}
Provide clear, well-structured answers. Use examples where helpful.
Aim for 2-4 paragraphs. Be practical and actionable.`,
    complex: `${baseSystem}
Provide comprehensive, deep analysis. Structure with clear sections.
Use examples, analogies, and step-by-step reasoning. Be thorough.`,
    coding: `${baseSystem}
You are an expert software engineer. Always provide clean, production-ready code in a beautiful, neat, easy-to-read format.

STRUCTURE YOUR RESPONSE NEATLY:
1. A brief 1-2 sentence overview of the approach.
2. The complete, production-ready code enclosed in a single fenced code block with proper language identifier (e.g. \`\`\`java). Avoid extra blank lines between every line.
3. Key Design Decisions & Complexity Analysis formatted as a clean Markdown table or bulleted list.`,
    vision: `${baseSystem}
Analyze the image carefully. Answer the user's specific question about it.
Be precise and descriptive.`
  };

  return {
    system: tierInstructions[tier] || tierInstructions.medium,
    prompt: text
  };
}

/**
 * Get tier configuration for UI display
 * @param {string} tier
 * @returns {Object}
 */
function getTierInfo(tier) {
  return MODEL_TIERS[tier] || MODEL_TIERS.medium;
}

/**
 * List all available tiers
 * @returns {string[]}
 */
function listTiers() {
  return Object.keys(MODEL_TIERS);
}

module.exports = {
  MODEL_TIERS,
  TIER_KEYWORDS,
  classifyQuery,
  getProviderForTier,
  orchestrateResponse,
  buildTierPrompt,
  getTierInfo,
  listTiers
};