// tests/intent.test.js
// Verifies the WhatsApp message extraction regex patterns in router.js
const { extractWhatsAppMessage } = require('../src/main/features/ai/router');

describe('extractWhatsAppMessage', () => {
  test('Pattern 1: send message to contact', () => {
    expect(extractWhatsAppMessage('send message to Dad hello'))
      .toEqual({ contact: 'Dad', message: 'hello' });
  });

  test('Pattern 1: send a whatsapp message to contact saying X', () => {
    expect(extractWhatsAppMessage('send a whatsapp message to Mom saying I am running late'))
      .toEqual({ contact: 'Mom', message: 'I am running late' });
  });

  test('Pattern 2: send message to contact on whatsapp', () => {
    expect(extractWhatsAppMessage('send hello to Agasthya on whatsapp'))
      .toEqual({ contact: 'Agasthya', message: 'hello' });
  });

  test('Pattern 3: send to contact saying X', () => {
    expect(extractWhatsAppMessage('send to Akka saying hi there'))
      .toEqual({ contact: 'Akka', message: 'hi there' });
  });

  test('Pattern 4: send contact message saying X', () => {
    expect(extractWhatsAppMessage('send John a message saying test'))
      .toEqual({ contact: 'John', message: 'test' });
  });

  test('Pattern 5: whatsapp contact saying X', () => {
    expect(extractWhatsAppMessage('whatsapp Alice hello world'))
      .toEqual({ contact: 'Alice', message: 'hello world' });
  });

  test('Pattern 6: message contact saying X', () => {
    expect(extractWhatsAppMessage('message Bob greetings'))
      .toEqual({ contact: 'Bob', message: 'greetings' });
  });

  test('rejects informational queries', () => {
    expect(extractWhatsAppMessage('tell me about photosynthesis')).toBeNull();
    expect(extractWhatsAppMessage('what is artificial intelligence')).toBeNull();
    expect(extractWhatsAppMessage('explain quantum computing')).toBeNull();
    expect(extractWhatsAppMessage('how does wifi work')).toBeNull();
  });

  test('handles phone numbers as contacts', () => {
    expect(extractWhatsAppMessage('send message to 9876543210 hi'))
      .toEqual({ contact: '9876543210', message: 'hi' });
  });

  test('strips trailing punctuation', () => {
    expect(extractWhatsAppMessage('send message to Dad I am late.'))
      .toEqual({ contact: 'Dad', message: 'I am late' });
  });

  test('handles empty input', () => {
    expect(extractWhatsAppMessage('')).toBeNull();
    expect(extractWhatsAppMessage(null)).toBeNull();
  });

  test('handles start/open whatsapp prefix', () => {
    expect(extractWhatsAppMessage('start whatsapp and send message to Dad test'))
      .toEqual({ contact: 'Dad', message: 'test' });
  });
});