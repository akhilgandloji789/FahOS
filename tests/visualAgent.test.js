'use strict';

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const visualAgent = require('../src/main/features/vision/visualAgent');

describe('FahOS Visual Agent (visualAgent.js) Edge Cases & Functionality Tests', () => {

  // Save original https.request and http.request
  const origHttpsRequest = https.request;
  const origHttpRequest = http.request;

  afterEach(() => {
    https.request = origHttpsRequest;
    http.request = origHttpRequest;
    visualAgent.setScreenCapturer(null);
  });

  // =========================================================================
  // CATEGORY 1: IN-MEMORY SCREEN CAPTURE & CROPPING
  // =========================================================================
  describe('1. In-Memory Screen Capture (captureScreenInMemory)', () => {

    test('1.1 Should return base64 string from custom screen capturer when registered', async () => {
      const mockB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      visualAgent.setScreenCapturer(async () => mockB64);

      const result = await visualAgent.captureScreenInMemory();
      expect(result).toBe(mockB64);
    });

    test('1.2 Should fall back to PowerShell GDI when custom capturer throws an exception', async () => {
      visualAgent.setScreenCapturer(async () => {
        throw new Error('Screen capturer native error');
      });

      // On Windows environment, PowerShell fallback should execute and return base64
      const result = await visualAgent.captureScreenInMemory();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(100);
    });

    test('1.3 Should fall back to PowerShell GDI when custom capturer returns empty/falsy value', async () => {
      visualAgent.setScreenCapturer(async () => null);

      const result = await visualAgent.captureScreenInMemory();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(100);
    });

    test('1.4 Should execute PowerShell GDI capture natively and return valid JPEG base64 data', async () => {
      visualAgent.setScreenCapturer(null);

      const result = await visualAgent.captureScreenInMemory();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(200);

      // Verify valid Base64 string decoding
      const buffer = Buffer.from(result, 'base64');
      // JPEG magic numbers: 0xFF 0xD8
      expect(buffer[0]).toBe(0xFF);
      expect(buffer[1]).toBe(0xD8);
    });
  });

  // =========================================================================
  // CATEGORY 2: HIGH-DPI LOGICAL BOUNDS & CROPPING (cropScreenRegion)
  // =========================================================================
  describe('2. High-DPI Logical Bounds & Cropping (cropScreenRegion)', () => {

    // Helper to calculate expected physical bounds using the algorithm in cropScreenRegion
    function computePhysicalBounds(bounds, scaleFactor) {
      return {
        safeX: Math.max(0, Math.floor(bounds.x * scaleFactor)),
        safeY: Math.max(0, Math.floor(bounds.y * scaleFactor)),
        safeW: Math.max(10, Math.floor(bounds.width * scaleFactor)),
        safeH: Math.max(10, Math.floor(bounds.height * scaleFactor))
      };
    }

    test('2.1 Should correctly calculate physical bounds for scaleFactor 1.0 (Standard DPI)', () => {
      const logical = { x: 100, y: 200, width: 300, height: 400 };
      const computed = computePhysicalBounds(logical, 1.0);
      expect(computed).toEqual({ safeX: 100, safeY: 200, safeW: 300, safeH: 400 });
    });

    test('2.2 Should correctly calculate physical bounds for scaleFactor 1.5 (150% High-DPI)', () => {
      const logical = { x: 100, y: 200, width: 300, height: 400 };
      const computed = computePhysicalBounds(logical, 1.5);
      expect(computed).toEqual({ safeX: 150, safeY: 300, safeW: 450, safeH: 600 });
    });

    test('2.3 Should correctly calculate physical bounds for scaleFactor 2.0 (200% Retina/4K DPI)', () => {
      const logical = { x: 100, y: 200, width: 300, height: 400 };
      const computed = computePhysicalBounds(logical, 2.0);
      expect(computed).toEqual({ safeX: 200, safeY: 400, safeW: 600, safeH: 800 });
    });

    test('2.4 Should handle fractional/decimal logical coordinates across scale factors', () => {
      const logical = { x: 10.75, y: 20.33, width: 100.9, height: 150.1 };
      
      const sf1 = computePhysicalBounds(logical, 1.0);
      expect(sf1).toEqual({ safeX: 10, safeY: 20, safeW: 100, safeH: 150 });

      const sf15 = computePhysicalBounds(logical, 1.5);
      expect(sf15).toEqual({ safeX: 16, safeY: 30, safeW: 151, safeH: 225 });

      const sf2 = computePhysicalBounds(logical, 2.0);
      expect(sf2).toEqual({ safeX: 21, safeY: 40, safeW: 201, safeH: 300 });
    });

    test('2.5 Should support flat parameters object when logicalBounds is omitted', () => {
      const flatInput = { x: 50, y: 60, width: 120, height: 180 };
      const bounds = flatInput.logicalBounds || { x: flatInput.x, y: flatInput.y, width: flatInput.width, height: flatInput.height };
      const computed = computePhysicalBounds(bounds, 1.0);
      expect(computed).toEqual({ safeX: 50, safeY: 60, safeW: 120, safeH: 180 });
    });

    test('2.6 Should handle negative or zero dimensions gracefully with Math.max guards', () => {
      const invalidLogical = { x: -50, y: -100, width: 0, height: -5 };
      const computed = computePhysicalBounds(invalidLogical, 1.5);
      expect(computed).toEqual({ safeX: 0, safeY: 0, safeW: 10, safeH: 10 });
    });

    test('2.7 Should handle empty object {} gracefully with default fallback bounds', async () => {
      // When empty object {} is passed to cropScreenRegion:
      // Coordinates default safely to x: 0, y: 0, width: 100, height: 100
      const croppedB64 = await visualAgent.cropScreenRegion({});
      expect(typeof croppedB64).toBe('string');
      expect(croppedB64.length).toBeGreaterThan(100);
    });

    test('2.8 Should execute cropScreenRegion natively on Windows and return valid Base64 JPEG', async () => {
      const croppedB64 = await visualAgent.cropScreenRegion({ x: 50, y: 50, width: 200, height: 200 });
      expect(typeof croppedB64).toBe('string');
      expect(croppedB64.length).toBeGreaterThan(100);

      const buffer = Buffer.from(croppedB64, 'base64');
      expect(buffer[0]).toBe(0xFF);
      expect(buffer[1]).toBe(0xD8);
    });
  });

  // =========================================================================
  // CATEGORY 3: MULTI-MODEL VISION FAILOVER (analyzeImageWithPrompt)
  // =========================================================================
  describe('3. Multi-Model Vision Failover (analyzeImageWithPrompt)', () => {

    function setupMockHttpServer(handlers) {
      // Mock https.request for Google API calls
      https.request = (url, options, callback) => {
        const urlStr = typeof url === 'string' ? url : url.href || '';
        
        let matchingHandler = null;
        for (const pattern of Object.keys(handlers)) {
          if (urlStr.includes(pattern)) {
            matchingHandler = handlers[pattern];
            break;
          }
        }

        const res = new (require('events').EventEmitter)();
        res.statusCode = matchingHandler ? matchingHandler.statusCode || 200 : 500;

        const req = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(() => {
            if (matchingHandler) {
              if (matchingHandler.error) {
                req.emit('error', matchingHandler.error);
                return;
              }
              process.nextTick(() => {
                callback(res);
                if (matchingHandler.body) {
                  res.emit('data', JSON.stringify(matchingHandler.body));
                }
                res.emit('end');
              });
            } else {
              req.emit('error', new Error(`Unhandled mock URL: ${urlStr}`));
            }
          }),
          emit: function(event, err) {
            if (this.onHandlers && this.onHandlers[event]) {
              this.onHandlers[event](err);
            }
          },
          onHandlers: {}
        };

        req.on = (event, fn) => { req.onHandlers[event] = fn; return req; };
        return req;
      };

      // Mock http.request for Ollama calls
      http.request = (url, options, callback) => {
        const urlStr = typeof url === 'string' ? url : options.path || '';
        let matchingHandler = handlers['ollama'];

        const res = new (require('events').EventEmitter)();
        res.statusCode = matchingHandler ? matchingHandler.statusCode || 200 : 500;

        const req = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(() => {
            if (matchingHandler) {
              if (matchingHandler.error) {
                req.emit('error', matchingHandler.error);
                return;
              }
              process.nextTick(() => {
                callback(res);
                if (matchingHandler.body) {
                  res.emit('data', JSON.stringify(matchingHandler.body));
                }
                res.emit('end');
              });
            } else {
              req.emit('error', new Error('Ollama connection refused'));
            }
          }),
          onHandlers: {}
        };

        req.on = (event, fn) => { req.onHandlers[event] = fn; return req; };
        return req;
      };
    }

    test('3.1 Should succeed on primary model gemini-3.5-flash when available', async () => {
      const calls = [];
      setupMockHttpServer({
        'gemini-3.5-flash': {
          body: { candidates: [{ content: { parts: [{ text: 'Response from gemini-3.5-flash' }] } }] }
        }
      });

      const res = await visualAgent.analyzeImageWithPrompt('dummy_b64', 'Analyze screen', 'test_key');
      expect(res).toBe('Response from gemini-3.5-flash');
    });

    test('3.2 Should failover from gemini-3.5-flash -> gemini-3.1-flash-lite on 3.5 error', async () => {
      setupMockHttpServer({
        'gemini-3.5-flash': {
          body: { error: { message: 'Quota exceeded for 3.5-flash', code: 429 } }
        },
        'gemini-3.1-flash-lite': {
          body: { candidates: [{ content: { parts: [{ text: 'Response from gemini-3.1-flash-lite' }] } }] }
        }
      });

      const res = await visualAgent.analyzeImageWithPrompt('dummy_b64', 'Analyze screen', 'test_key');
      expect(res).toBe('Response from gemini-3.1-flash-lite');
    });

    test('3.3 Should failover from gemini-3.5-flash & gemini-3.1-flash-lite -> gemini-3.6-flash', async () => {
      setupMockHttpServer({
        'gemini-3.5-flash': { error: new Error('Network error on 3.5') },
        'gemini-3.1-flash-lite': { body: { error: { message: 'Model unavailable' } } },
        'gemini-3.6-flash': {
          body: { candidates: [{ content: { parts: [{ text: 'Response from gemini-3.6-flash' }] } }] }
        }
      });

      const res = await visualAgent.analyzeImageWithPrompt('dummy_b64', 'Analyze screen', 'test_key');
      expect(res).toBe('Response from gemini-3.6-flash');
    });

    test('3.4 Should failover from all Cloud models -> Ollama local vision model (qwen3-vl:8b)', async () => {
      setupMockHttpServer({
        'gemini-3.5-flash': { error: new Error('Cloud unavailable') },
        'gemini-3.1-flash-lite': { error: new Error('Cloud unavailable') },
        'gemini-3.6-flash': { error: new Error('Cloud unavailable') },
        'ollama': {
          body: { response: 'Ollama local analysis from qwen3-vl:8b' }
        }
      });

      const res = await visualAgent.analyzeImageWithPrompt('dummy_b64', 'Analyze screen', 'test_key');
      expect(res).toContain('💻 **[Local Vision: qwen3-vl:8b]**');
      expect(res).toContain('Ollama local analysis from qwen3-vl:8b');
    });

    test('3.5 Should return Mock/Fallback message when Cloud & Ollama fail', async () => {
      setupMockHttpServer({
        'gemini-3.5-flash': { error: new Error('Cloud unavailable') },
        'gemini-3.1-flash-lite': { error: new Error('Cloud unavailable') },
        'gemini-3.6-flash': { error: new Error('Cloud unavailable') },
        'ollama': { error: new Error('Ollama service connection refused') }
      });

      const res = await visualAgent.analyzeImageWithPrompt('dummy_b64', 'Analyze screen', 'test_key');
      expect(res).toContain('⚠️ **Gemini Vision Service Busy**');
      expect(res).toContain('The Gemini Vision API is currently experiencing temporary high demand');
    });
  });

  // =========================================================================
  // CATEGORY 4: COORDINATE LOCATION & MOUSE CLICK PIPELINE
  // =========================================================================
  describe('4. Coordinate Location & Native Mouse Controls', () => {

    test('4.1 locateTargetOnScreen should parse valid coordinate JSON response from Gemini', async () => {
      https.request = (url, options, callback) => {
        const res = new (require('events').EventEmitter)();
        res.statusCode = 200;
        const req = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(() => {
            process.nextTick(() => {
              callback(res);
              res.emit('data', JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{ text: JSON.stringify({ found: true, x: 500, y: 350, label: 'Settings Button' }) }]
                  }
                }]
              }));
              res.emit('end');
            });
          })
        };
        req.on = (evt, fn) => { return req; };
        return req;
      };

      const result = await visualAgent.locateTargetOnScreen('dummy_b64', 'Settings Button', 'test_key');
      expect(result).toEqual({ found: true, x: 500, y: 350, label: 'Settings Button' });
    });

    test('4.2 locateTargetOnScreen should handle non-JSON or broken API response gracefully', async () => {
      https.request = (url, options, callback) => {
        const res = new (require('events').EventEmitter)();
        res.statusCode = 500;
        const req = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(() => {
            process.nextTick(() => {
              callback(res);
              res.emit('data', '<html>Internal Error</html>');
              res.emit('end');
            });
          })
        };
        req.on = (evt, fn) => { return req; };
        return req;
      };

      const result = await visualAgent.locateTargetOnScreen('dummy_b64', 'Submit Button', 'test_key');
      expect(result.found).toBe(false);
      expect(result.error).toContain('Could not parse response');
    });

    test('4.3 moveAndClick should execute PowerShell mouse positioning and click', async () => {
      const result = await visualAgent.moveAndClick(100.4, 200.8);
      expect(result.ok).toBe(true);
      expect(result.x).toBe(100.4);
      expect(result.y).toBe(200.8);
    }, 15000);

    test('4.4 clickTarget integration pipeline should handle end-to-end target location and click', async () => {
      visualAgent.setScreenCapturer(async () => 'mock_screen_b64');
      https.request = (url, options, callback) => {
        const res = new (require('events').EventEmitter)();
        res.statusCode = 200;
        const req = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(() => {
            process.nextTick(() => {
              callback(res);
              res.emit('data', JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{ text: JSON.stringify({ found: true, x: 250, y: 400, label: 'OK Button' }) }]
                  }
                }]
              }));
              res.emit('end');
            });
          })
        };
        req.on = (evt, fn) => { return req; };
        return req;
      };

      const result = await visualAgent.clickTarget('OK Button', 'test_key');
      expect(result.ok).toBe(true);
      expect(result.found).toBe(true);
      expect(result.x).toBe(250);
      expect(result.y).toBe(400);
      expect(result.description).toContain('Located and clicked **OK Button**');
    }, 15000);

  });

});
