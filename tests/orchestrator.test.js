// tests/orchestrator.test.js
// Verifies the AI Model Orchestrator classification and routing logic
const { classifyQuery, MODEL_TIERS, buildTierPrompt } = require('../src/main/features/ai/orchestrator');

describe('classifyQuery', () => {
  test('classifies vision when image attached', () => {
    const result = classifyQuery('what is in this', true);
    expect(result.tier).toBe('vision');
    expect(result.confidence).toBe(1.0);
  });

  test('classifies coding queries', () => {
    const result = classifyQuery('write a react component for a todo list');
    expect(result.tier).toBe('coding');
  });

  test('classifies simple greetings', () => {
    const result = classifyQuery('hello');
    expect(result.tier).toBe('simple');
  });

  test('classifies short factual queries appropriately', () => {
    const result = classifyQuery('what is the capital of france');
    // Should NOT be coding (no word-boundary keyword match), and should not trigger
    // false positive from "api" inside "capital". Medium or simple is acceptable.
    expect(result.tier).not.toBe('coding');
  });

  test('classifies complex analytical queries', () => {
    const result = classifyQuery('write a complete business plan for a startup');
    expect(result.tier).toBe('complex');
  });

  test('classifies long queries as medium', () => {
    const result = classifyQuery('can you explain the difference between machine learning and deep learning and provide examples of when each is used');
    expect(result.tier).toBe('medium');
  });

  test('classifies simple greetings with trailing punctuation', () => {
    const result = classifyQuery('hello!');
    expect(result.tier).toBe('simple');
  });

  test('classifies keywords surrounded by parentheses without false positive', () => {
    const result = classifyQuery('what is the (api) key?');
    expect(result.tier).toBe('coding');
  });

  test('classifies short explain queries as medium per example specs', () => {
    const result = classifyQuery('explain how blockchain works');
    expect(result.tier).toBe('medium');
  });

  test('defaults to medium for ambiguous queries', () => {
    const result = classifyQuery('tell me something interesting');
    expect(result.tier).toBe('medium');
  });

  test('classifies explicit detailed explanation requests as complex', () => {
    const res1 = classifyQuery('what is mcp?explain it clearly');
    expect(res1.tier).toBe('complex');

    const res2 = classifyQuery('explain in detail how quantum computers work');
    expect(res2.tier).toBe('complex');
  });
});

describe('MODEL_TIERS', () => {
  test('has all required tiers', () => {
    expect(Object.keys(MODEL_TIERS)).toEqual(
      expect.arrayContaining(['simple', 'medium', 'complex', 'coding', 'vision'])
    );
  });

  test('each tier has providers and config', () => {
    for (const [tier, config] of Object.entries(MODEL_TIERS)) {
      expect(config.providers.length).toBeGreaterThan(0);
      expect(config.maxTokens).toBeGreaterThan(0);
      expect(typeof config.temperature).toBe('number');
      expect(config.description).toBeTruthy();
    }
  });

  test('simple tier prefers local providers first', () => {
    expect(MODEL_TIERS.simple.providers).toContain('mock');
  });

  test('vision tier only uses gemini (has vision capability)', () => {
    expect(MODEL_TIERS.vision.providers).toContain('gemini');
  });

  test('complex tier has higher token budget than simple', () => {
    expect(MODEL_TIERS.complex.maxTokens).toBeGreaterThan(MODEL_TIERS.simple.maxTokens);
  });

  test('coding tier has highest token budget', () => {
    const tokens = Object.values(MODEL_TIERS).map(c => c.maxTokens);
    expect(MODEL_TIERS.coding.maxTokens).toBe(Math.max(...tokens));
  });
});

describe('buildTierPrompt', () => {
  test('simple tier gives concise instructions', () => {
    const { system } = buildTierPrompt('simple', 'what is the weather');
    expect(system).toContain('concise');
    expect(system).toContain('1-2 sentences');
  });

  test('coding tier gives expert instructions', () => {
    const { system } = buildTierPrompt('coding', 'write a function');
    expect(system).toContain('expert software engineer');
  });

  test('complex tier gives deep analysis instructions', () => {
    const { system } = buildTierPrompt('complex', 'analyze this');
    expect(system).toContain('comprehensive');
  });

  test('fallback to medium for unknown tier', () => {
    const { system } = buildTierPrompt('unknown', 'test');
    expect(system).toContain('clear, well-structured');
  });
});