'use strict';
/**
 * FahOS — Live Web Search Grounding Service
 * Fetches real-time live web search snippets for current events, real-time factual queries,
 * leaders, news, and live updates dynamically without hardcoding any specific names or facts.
 */

const https = require('https');

// Create persistent keep-alive agent to eliminate cold-start TLS handshake delays
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 5000
});

/**
 * Score snippet based on presence of current office verbs, dates, and proper names
 * @param {string} snippet
 * @returns {number}
 */
function scoreSnippet(snippet) {
  let score = 0;
  if (!snippet) return 0;
  if (/\b(serving as|current|appointed|took office|elected|sworn in|incumbent|head of government)\b/i.test(snippet)) score += 10;
  if (/\b(2024|2025|2026)\b/.test(snippet)) score += 5;
  if (/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/.test(snippet)) score += 3;
  return score;
}

/**
 * Fetch live search snippets concurrently across DuckDuckGo HTML and Wikipedia APIs
 * @param {string} query - Search query
 * @returns {Promise<string>} Cleaned, prioritized text snippets
 */
async function fetchLiveWebSnippets(query) {
  if (!query || typeof query !== 'string') return '';
  // Clean query: strip filler words like 'this' or excess whitespace
  const cleanQuery = query.replace(/\bthis\b/gi, '').replace(/\s+/g, ' ').trim();
  if (cleanQuery.length < 3) return '';

  try {
    // 1. DuckDuckGo HTML Search Task
    const ddgTask = (async () => {
      const htmlUrl = `https://html.duckduckgo.com/html/`;
      const bodyParams = `q=${encodeURIComponent(cleanQuery)}`;
      const htmlRes = await fetchPostWithTimeout(htmlUrl, bodyParams, 4500);
      if (htmlRes && htmlRes.ok && htmlRes.body) {
        const matches = htmlRes.body.match(/<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi) ||
                        htmlRes.body.match(/<td class=['"]result-snippet['"]>([\s\S]*?)<\/td>/gi);
        if (matches && matches.length > 0) {
          return matches.slice(0, 5).map(m => {
            return m.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
          }).filter(b => b.length > 15);
        }
      }
      return [];
    })();

    // 2. Wikipedia Search API Task
    const wikiTask = (async () => {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=1&format=json`;
      const wikiRes = await fetchWithTimeout(wikiUrl, 4500);
      if (wikiRes && wikiRes.ok && wikiRes.body) {
        try {
          const data = JSON.parse(wikiRes.body);
          if (data.query && Array.isArray(data.query.search)) {
            return data.query.search.slice(0, 4).map(s => {
              const snippetText = s.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
              return `${s.title}: ${snippetText}`;
            }).filter(Boolean);
          }
        } catch (_) {}
      }
      return [];
    })();

    // Execute search endpoints concurrently in parallel
    const results = await Promise.allSettled([ddgTask, wikiTask]);
    let combinedSnippets = [];

    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        for (const snippet of r.value) {
          if (!combinedSnippets.includes(snippet)) {
            combinedSnippets.push(snippet);
          }
        }
      }
    }

    if (combinedSnippets.length > 0) {
      // Prioritize high-value factual snippets containing current office verbs/names/dates
      combinedSnippets.sort((a, b) => scoreSnippet(b) - scoreSnippet(a));
      return combinedSnippets.slice(0, 4).join('\n');
    }

    // 3. Fallback: DuckDuckGo Instant Answer API
    const jsonUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const jsonRes = await fetchWithTimeout(jsonUrl, 2500);
    if (jsonRes && jsonRes.ok) {
      const data = JSON.parse(jsonRes.body);
      let snippets = [];
      if (data.AbstractText) snippets.push(data.AbstractText);
      if (data.Answer) snippets.push(data.Answer);
      if (snippets.length > 0) return snippets.join('\n');
    }
  } catch (err) {
    console.warn('[FahOS WebSearch] Live search notice:', err.message);
  }
  return '';
}

function fetchWithTimeout(urlStr, timeoutMs = 4500) {
  return new Promise((resolve) => {
    try {
      const req = https.get(urlStr, { agent: keepAliveAgent, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body: data }));
      });
      req.on('error', () => resolve(null));
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    } catch (_) {
      resolve(null);
    }
  });
}

function fetchPostWithTimeout(urlStr, bodyData, timeoutMs = 4500) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = https.request(u, {
        method: 'POST',
        agent: keepAliveAgent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(bodyData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body: data }));
      });
      req.on('error', () => resolve(null));
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
      req.write(bodyData);
      req.end();
    } catch (_) {
      resolve(null);
    }
  });
}

module.exports = {
  fetchLiveWebSnippets
};
