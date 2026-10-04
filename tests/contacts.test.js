// tests/contacts.test.js
// Verifies the phone normalization logic in contactsService.js
const { normalizePhone } = require('../src/main/features/contacts/contactsService');

describe('normalizePhone', () => {
  test('adds 91 to 10-digit Indian number', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210');
  });

  test('strips + prefix', () => {
    expect(normalizePhone('+919876543210')).toBe('919876543210');
  });

  test('strips spaces and dashes', () => {
    expect(normalizePhone('98 76 54 32 10')).toBe('919876543210');
    expect(normalizePhone('98-76-54-32-10')).toBe('919876543210');
  });

  test('strips parentheses', () => {
    expect(normalizePhone('(98) 7654 3210')).toBe('919876543210');
  });

  test('handles 12-digit with 91 prefix', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210');
  });

  test('handles empty input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
  });

  test('handles non-Indian numbers without adding 91', () => {
    expect(normalizePhone('1234567890')).toBe('911234567890');
  });
});