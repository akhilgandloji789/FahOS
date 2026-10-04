// tests/markdown.test.js
// Verifies the markdown renderer in src/renderer/shared/markdown.js
const { renderMarkdown, sanitizeMath } = require('../src/renderer/shared/markdown.js');

describe('renderMarkdown', () => {
  test('renders bold text', () => {
    expect(renderMarkdown('**hello**'))
      .toContain('<strong class="ai-strong">hello</strong>');
  });

  test('renders italic text', () => {
    expect(renderMarkdown('*hello*'))
      .toContain('<em class="ai-em">hello</em>');
  });

  test('renders inline code', () => {
    expect(renderMarkdown('`console.log()`'))
      .toContain('<code class="ai-code">console.log()</code>');
  });

  test('renders fenced code blocks', () => {
    const md = '```js\nconsole.log("hi")\n```';
    const result = renderMarkdown(md);
    expect(result).toContain('console.log("hi")');
    expect(result).toContain('ai-code-wrapper');
  });

  test('renders headings', () => {
    expect(renderMarkdown('# Title')).toContain('<h2 class="ai-h2">Title</h2>');
    expect(renderMarkdown('## Subtitle')).toContain('<h3 class="ai-h3">Subtitle</h3>');
    expect(renderMarkdown('### Section')).toContain('<h4 class="ai-h4">Section</h4>');
  });

  test('renders tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = renderMarkdown(md);
    expect(result).toContain('<table class="ai-table">');
    expect(result).toContain('<th>A</th>');
    expect(result).toContain('<th>B</th>');
    expect(result).toContain('<td>1</td>');
    expect(result).toContain('<td>2</td>');
  });

  test('renders bullet lists', () => {
    const md = '* item 1\n* item 2';
    const result = renderMarkdown(md);
    expect(result).toContain('<ul class="ai-list">');
    expect(result).toContain('<li>item 1</li>');
    expect(result).toContain('<li>item 2</li>');
  });

  test('renders numbered lists', () => {
    const md = '1. first\n2. second';
    const result = renderMarkdown(md);
    expect(result).toContain('<ol class="ai-num-list">');
    expect(result).toContain('<li>first</li>');
    expect(result).toContain('<li>second</li>');
  });

  test('sanitizes LaTeX fractions', () => {
    expect(sanitizeMath('\\frac{1}{2}')).toBe('(1 / 2)');
  });

  test('sanitizes LaTeX symbols', () => {
    expect(sanitizeMath('\\times')).toBe('×');
    expect(sanitizeMath('\\div')).toBe('÷');
    expect(sanitizeMath('\\pm')).toBe('±');
    expect(sanitizeMath('\\sqrt{4}')).toBe('√(4)');
    expect(sanitizeMath('\\pi')).toBe('π');
    expect(sanitizeMath('\\theta')).toBe('θ');
  });

  test('sanitizes superscripts', () => {
    expect(sanitizeMath('x^2')).toBe('x²');
    expect(sanitizeMath('x^3')).toBe('x³');
    expect(sanitizeMath('x^n')).toBe('xⁿ');
  });

  test('handles empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });

  test('XSS protection: escapes HTML tags', () => {
    const malicious = '<script>alert(1)</script>';
    const result = renderMarkdown(malicious);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('XSS protection: escapes HTML in bold', () => {
    const malicious = '**<img src=x onerror=alert(1)>**';
    const result = renderMarkdown(malicious);
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });
});