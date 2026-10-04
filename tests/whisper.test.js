// tests/whisper.test.js
// Verifies WAV audio decoding and float32 conversion logic in whisperService.js
const { decodeWavToFloat32 } = require('../src/main/features/voice/whisperService');

describe('decodeWavToFloat32', () => {
  test('returns null for null, empty or invalid buffer', () => {
    expect(decodeWavToFloat32(null)).toBeNull();
    expect(decodeWavToFloat32(Buffer.alloc(0))).toBeNull();
    expect(decodeWavToFloat32(Buffer.alloc(30))).toBeNull();
  });

  test('returns null for buffer lacking RIFF/WAVE header', () => {
    const invalidBuf = Buffer.alloc(50);
    expect(decodeWavToFloat32(invalidBuf)).toBeNull();
  });

  test('decodes valid 16-bit mono PCM WAV buffer', () => {
    // Construct a minimal 16-bit mono 16kHz WAV buffer with 4 samples
    const sampleCount = 4;
    const headerSize = 44;
    const buf = Buffer.alloc(headerSize + sampleCount * 2);
    
    // RIFF header
    buf.write('RIFF', 0);
    buf.writeUInt32LE(headerSize + sampleCount * 2 - 8, 4);
    buf.write('WAVE', 8);
    
    // fmt chunk
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); // Subchunk1Size
    buf.writeUInt16LE(1, 20);  // AudioFormat (PCM)
    buf.writeUInt16LE(1, 22);  // NumChannels (mono)
    buf.writeUInt32LE(16000, 24); // SampleRate
    buf.writeUInt32LE(32000, 28); // ByteRate
    buf.writeUInt16LE(2, 32);  // BlockAlign
    buf.writeUInt16LE(16, 34); // BitsPerSample
    
    // data chunk
    buf.write('data', 36);
    buf.writeUInt32LE(sampleCount * 2, 40);
    
    // PCM samples: 0, 16384 (0.5), -16384 (-0.5), 32767 (~1.0)
    buf.writeInt16LE(0, 44);
    buf.writeInt16LE(16384, 46);
    buf.writeInt16LE(-16384, 48);
    buf.writeInt16LE(32767, 50);

    const float32 = decodeWavToFloat32(buf);
    expect(float32).not.toBeNull();
    expect(float32.length).toBe(4);
    expect(float32[0]).toBeCloseTo(0, 2);
    expect(float32[1]).toBeCloseTo(0.5, 2);
    expect(float32[2]).toBeCloseTo(-0.5, 2);
    expect(float32[3]).toBeCloseTo(1.0, 2);
  });

  test('decodes stereo WAV and downmixes to mono without throwing RangeError', () => {
    const frames = 2;
    const headerSize = 44;
    const buf = Buffer.alloc(headerSize + frames * 2 * 2); // 2 frames * 2 channels * 2 bytes
    
    buf.write('RIFF', 0);
    buf.writeUInt32LE(buf.length - 8, 4);
    buf.write('WAVE', 8);
    
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(2, 22); // Stereo (2 channels)
    buf.writeUInt32LE(16000, 24);
    buf.writeUInt32LE(64000, 28);
    buf.writeUInt16LE(4, 32);
    buf.writeUInt16LE(16, 34);
    
    buf.write('data', 36);
    buf.writeUInt32LE(frames * 4, 40);
    
    // Frame 0: Left = 16384 (0.5), Right = 16384 (0.5) => Average = 0.5
    buf.writeInt16LE(16384, 44);
    buf.writeInt16LE(16384, 46);
    
    // Frame 1: Left = 32767 (~1.0), Right = 0 (0.0) => Average = ~0.5
    buf.writeInt16LE(32767, 48);
    buf.writeInt16LE(0, 50);

    const float32 = decodeWavToFloat32(buf);
    expect(float32).not.toBeNull();
    expect(float32.length).toBe(2);
    expect(float32[0]).toBeCloseTo(0.5, 2);
    expect(float32[1]).toBeCloseTo(0.5, 2);
  });
});
