// tests/whisper_edge_cases.test.js
// Comprehensive edge case tests for decodeWavToFloat32 in whisperService.js
const { decodeWavToFloat32 } = require('../src/main/features/voice/whisperService');

function buildWavBuffer(options = {}) {
  const {
    riffTag = 'RIFF',
    waveTag = 'WAVE',
    fmtTag = 'fmt ',
    fmtSize = 16,
    audioFormat = 1,
    numChannels = 1,
    sampleRate = 16000,
    bitsPerSample = 16,
    preFmtChunks = [],
    postFmtChunks = [],
    includeDataChunk = true,
    dataChunkTag = 'data',
    customDataBytes = null,
    samples = null,
    truncateAt = null
  } = options;

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  let preFmtLength = 0;
  for (const chunk of preFmtChunks) {
    const pad = chunk.data.length % 2;
    preFmtLength += 8 + chunk.data.length + pad;
  }

  let postFmtLength = 0;
  for (const chunk of postFmtChunks) {
    const pad = chunk.data.length % 2;
    postFmtLength += 8 + chunk.data.length + pad;
  }

  let dataPayload;
  if (customDataBytes) {
    dataPayload = customDataBytes;
  } else if (samples) {
    if (bitsPerSample === 16) {
      dataPayload = Buffer.alloc(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        dataPayload.writeInt16LE(samples[i], i * 2);
      }
    } else if (bitsPerSample === 32) {
      dataPayload = Buffer.alloc(samples.length * 4);
      for (let i = 0; i < samples.length; i++) {
        dataPayload.writeFloatLE(samples[i], i * 4);
      }
    } else {
      dataPayload = Buffer.alloc(0);
    }
  } else {
    dataPayload = Buffer.alloc(0);
  }

  const dataChunkSize = includeDataChunk ? (8 + dataPayload.length) : 0;
  const totalLength = 12 + preFmtLength + (8 + fmtSize) + postFmtLength + dataChunkSize;

  const buf = Buffer.alloc(totalLength);
  let offset = 0;

  buf.write(riffTag, 0);
  buf.writeUInt32LE(totalLength - 8, 4);
  buf.write(waveTag, 8);
  offset = 12;

  for (const chunk of preFmtChunks) {
    buf.write(chunk.id, offset);
    buf.writeUInt32LE(chunk.data.length, offset + 4);
    chunk.data.copy(buf, offset + 8);
    const pad = chunk.data.length % 2;
    offset += 8 + chunk.data.length + pad;
  }

  buf.write(fmtTag, offset);
  buf.writeUInt32LE(fmtSize, offset + 4);
  buf.writeUInt16LE(audioFormat, offset + 8);
  buf.writeUInt16LE(numChannels, offset + 10);
  buf.writeUInt32LE(sampleRate, offset + 12);
  buf.writeUInt32LE(byteRate, offset + 16);
  buf.writeUInt16LE(blockAlign, offset + 20);
  buf.writeUInt16LE(bitsPerSample, offset + 22);
  offset += 8 + fmtSize;

  for (const chunk of postFmtChunks) {
    buf.write(chunk.id, offset);
    buf.writeUInt32LE(chunk.data.length, offset + 4);
    chunk.data.copy(buf, offset + 8);
    const pad = chunk.data.length % 2;
    offset += 8 + chunk.data.length + pad;
  }

  if (includeDataChunk) {
    buf.write(dataChunkTag, offset);
    buf.writeUInt32LE(dataPayload.length, offset + 4);
    dataPayload.copy(buf, offset + 8);
  }

  if (truncateAt !== null && truncateAt < buf.length) {
    return buf.subarray(0, truncateAt);
  }

  return buf;
}

describe('decodeWavToFloat32 Edge Cases', () => {
  describe('1. 16-bit Mono WAV PCM Buffers', () => {
    test('TC1.1: Standard 16-bit Mono PCM WAV values', () => {
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [0, 16384, -16384, 32767]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(4);
      expect(res[0]).toBeCloseTo(0.0, 2);
      expect(res[1]).toBeCloseTo(0.5, 2);
      expect(res[2]).toBeCloseTo(-0.5, 2);
      expect(res[3]).toBeCloseTo(1.0, 2);
    });

    test('TC1.2: Boundary sample values (-32768, 32767, 0)', () => {
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [-32768, 32767, 0]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(3);
      expect(res[0]).toBeCloseTo(-1.0, 2);
      expect(res[1]).toBeCloseTo(1.0, 2);
      expect(res[2]).toBeCloseTo(0.0, 2);
    });

    test('TC1.3: Odd sample count', () => {
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [8192, 16384, 24576]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(3);
      expect(res[0]).toBeCloseTo(0.25, 2);
      expect(res[1]).toBeCloseTo(0.5, 2);
      expect(res[2]).toBeCloseTo(0.75, 2);
    });

    test('TC1.4: Non-16kHz sample rate (44.1kHz)', () => {
      const buf = buildWavBuffer({
        numChannels: 1,
        sampleRate: 44100,
        bitsPerSample: 16,
        samples: [16384, -16384]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });

    test('TC1.5: Empty data chunk (0 payload)', () => {
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: []
      });
      const res = decodeWavToFloat32(buf);
      expect(res).toBeNull();
    });

    test('TC1.6: Inflated chunkSize in data header', () => {
      const payload = Buffer.alloc(10);
      payload.writeInt16LE(16384, 0);
      payload.writeInt16LE(16384, 2);
      payload.writeInt16LE(16384, 4);
      payload.writeInt16LE(16384, 6);
      payload.writeInt16LE(16384, 8);
      const buf = buildWavBuffer({ numChannels: 1, bitsPerSample: 16, customDataBytes: payload });
      buf.writeUInt32LE(100, 40);
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(5);
    });
  });

  describe('2. Stereo WAV PCM Buffers & Channel Striding', () => {
    test('TC2.1: Stereo 16-bit PCM channel striding & downmixing', () => {
      const buf = buildWavBuffer({
        numChannels: 2,
        bitsPerSample: 16,
        samples: [16384, 16384, 32767, 0]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.5, 2);
      expect(res[1]).toBeCloseTo(0.5, 2);
    });

    test('TC2.2: Stereo 16-bit PCM opposite phases downmixing', () => {
      const buf = buildWavBuffer({
        numChannels: 2,
        bitsPerSample: 16,
        samples: [32767, -32768, -16384, 16384]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.0, 2);
      expect(res[1]).toBeCloseTo(0.0, 2);
    });

    test('TC2.3: Stereo 32-bit Float PCM downmixing', () => {
      const buf = buildWavBuffer({
        numChannels: 2,
        bitsPerSample: 32,
        samples: [0.8, 0.2, -0.4, -0.6]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.5, 2);
      expect(res[1]).toBeCloseTo(-0.5, 2);
    });

    test('TC2.4: Multi-channel (4-channel 16-bit PCM)', () => {
      const buf = buildWavBuffer({
        numChannels: 4,
        bitsPerSample: 16,
        samples: [16384, 16384, 32767, 32767, 32767, 0, 1000, 2000]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.75, 2);
    });

    test('TC2.5: Stereo 16-bit PCM with incomplete frame at end', () => {
      const payload = Buffer.alloc(6);
      payload.writeInt16LE(16384, 0);
      payload.writeInt16LE(16384, 2);
      payload.writeInt16LE(32767, 4);
      const buf = buildWavBuffer({ numChannels: 2, bitsPerSample: 16, customDataBytes: payload });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(1);
    });

    test('TC2.6: Trailing metadata chunk after data chunk is ignored for frame count', () => {
      const wavBuf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [16384, -16384]
      });
      // Append extra trailing metadata chunk to buffer
      const extraMeta = Buffer.from('LIST\x0e\x00\x00\x00FahOS Metadata\x00');
      const bufWithMeta = Buffer.concat([wavBuf, extraMeta]);
      const res = decodeWavToFloat32(bufWithMeta);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.5, 2);
      expect(res[1]).toBeCloseTo(-0.5, 2);
    });

    test('TC2.7: JSON-serialized Node Buffer object decoding', () => {
      const wavBuf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [16384, -16384]
      });
      const jsonBuf = JSON.parse(JSON.stringify(wavBuf));
      expect(jsonBuf.type).toBe('Buffer');
      const res = decodeWavToFloat32(jsonBuf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.5, 2);
    });
  });

  describe('3. Metadata Headers & Chunk Placement', () => {
    test('TC3.1: Metadata chunk (LIST/INFO) after fmt chunk before data chunk', () => {
      const listData = Buffer.from('ISFT\x0e\x00\x00\x00FahOS Audio v1\x00', 'binary');
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        postFmtChunks: [{ id: 'LIST', data: listData }],
        samples: [16384, -16384]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });

    test('TC3.2: Metadata chunk (JUNK) with odd length requiring pad byte', () => {
      const junkData = Buffer.from('123456789012345');
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        postFmtChunks: [{ id: 'JUNK', data: junkData }],
        samples: [16384, 32767]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });

    test('TC3.3: Metadata chunk BEFORE fmt chunk (successfully parsed by dynamic header chunk finder)', () => {
      const junkData = Buffer.alloc(24, 0xAA);
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        preFmtChunks: [{ id: 'JUNK', data: junkData }],
        samples: [16384, 16384]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });

    test('TC3.4: Multiple metadata chunks (LIST, JUNK, bext) after fmt chunk', () => {
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        postFmtChunks: [
          { id: 'JUNK', data: Buffer.from('junk-content') },
          { id: 'LIST', data: Buffer.from('list-content') },
          { id: 'bext', data: Buffer.alloc(16, 0) }
        ],
        samples: [16384, -16384]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });

    test('TC3.5: Metadata chunk payload containing string "data"', () => {
      const junkData = Buffer.from('Text payload containing data string inside', 'utf8');
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        postFmtChunks: [{ id: 'JUNK', data: junkData }],
        samples: [16384, 16384]
      });
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });
  });

  describe('4. Truncated & Invalid Header Error Handling', () => {
    test('TC4.1: null input buffer', () => {
      expect(decodeWavToFloat32(null)).toBeNull();
    });

    test('TC4.2: undefined input buffer', () => {
      expect(decodeWavToFloat32(undefined)).toBeNull();
    });

    test('TC4.3: Empty Buffer.alloc(0)', () => {
      expect(decodeWavToFloat32(Buffer.alloc(0))).toBeNull();
    });

    test('TC4.4: Short Buffer (< 44 bytes)', () => {
      expect(decodeWavToFloat32(Buffer.alloc(30))).toBeNull();
    });

    test('TC4.5: Invalid RIFF tag ("NOPE")', () => {
      const buf = buildWavBuffer({ riffTag: 'NOPE', samples: [16384] });
      expect(decodeWavToFloat32(buf)).toBeNull();
    });

    test('TC4.6: Invalid WAVE format tag ("MP3 ")', () => {
      const buf = buildWavBuffer({ waveTag: 'MP3 ', samples: [16384] });
      expect(decodeWavToFloat32(buf)).toBeNull();
    });

    test('TC4.7: Unsupported 8-bit PCM', () => {
      const buf = buildWavBuffer({ bitsPerSample: 8, samples: [] });
      expect(decodeWavToFloat32(buf)).toBeNull();
    });

    test('TC4.8: Unsupported 24-bit PCM', () => {
      const buf = buildWavBuffer({ bitsPerSample: 24, samples: [] });
      expect(decodeWavToFloat32(buf)).toBeNull();
    });

    test('TC4.9: Missing data chunk completely', () => {
      const buf = buildWavBuffer({ includeDataChunk: false, samples: [] });
      expect(decodeWavToFloat32(buf)).toBeNull();
    });

    test('TC4.10: Truncated data chunk header', () => {
      const buf = buildWavBuffer({ samples: [16384, 16384] });
      const truncBuf = buf.subarray(0, 40);
      expect(decodeWavToFloat32(truncBuf)).toBeNull();
    });

    test('TC4.11: Zero-length metadata chunk before data chunk (chunkSize = 0)', () => {
      const buf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        postFmtChunks: [{ id: 'JUNK', data: Buffer.alloc(0) }],
        samples: [16384, 16384]
      });
      // Dynamic chunk reader advances offset by 8 bytes when chunkSize === 0, reaching data chunk
      const res = decodeWavToFloat32(buf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });

    test('TC4.12: Node Buffer subarray with byteOffset > 0', () => {
      const fullBuf = Buffer.alloc(100);
      const wavBuf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [16384, -16384]
      });
      wavBuf.copy(fullBuf, 20);
      const slicedBuf = fullBuf.subarray(20, 20 + wavBuf.length);

      const res = decodeWavToFloat32(slicedBuf);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.5, 2);
      expect(res[1]).toBeCloseTo(-0.5, 2);
    });

    test('TC4.13: ArrayBuffer input directly without DataView TypeError', () => {
      const wavBuf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [16384, -16384]
      });
      const arrayBuffer = wavBuf.buffer.slice(wavBuf.byteOffset, wavBuf.byteOffset + wavBuf.byteLength);
      expect(arrayBuffer instanceof ArrayBuffer).toBe(true);
      const res = decodeWavToFloat32(arrayBuffer);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
      expect(res[0]).toBeCloseTo(0.5, 2);
      expect(res[1]).toBeCloseTo(-0.5, 2);
    });

    test('TC4.14: Uint8Array input directly', () => {
      const wavBuf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [16384, -16384]
      });
      const uint8 = new Uint8Array(wavBuf.buffer, wavBuf.byteOffset, wavBuf.byteLength);
      const res = decodeWavToFloat32(uint8);
      expect(res).not.toBeNull();
      expect(res.length).toBe(2);
    });
  });

  describe('5. Cloud-to-Local Fallback & Config Integration', () => {
    const originalEnv = process.env.GROQ_API_KEY;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.GROQ_API_KEY = originalEnv;
      } else {
        delete process.env.GROQ_API_KEY;
      }
    });

    test('GROQ_API_KEY is mapped in loadConfig', () => {
      const { loadConfig } = require('../src/main/config');
      process.env.GROQ_API_KEY = 'test-groq-key-123';
      const cfg = loadConfig();
      expect(cfg.providers.openaiCompatible.apiKey).toBe('test-groq-key-123');
    });

    test('Empty cloud response falls back to local Whisper', async () => {
      const whisperService = require('../src/main/features/voice/whisperService');
      const localWhisper = require('../src/main/features/voice/localWhisper');

      process.env.GROQ_API_KEY = 'mock-key';

      // Mock fetch returning empty text
      const origFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: '' })
      });

      const spyLocal = jest.spyOn(localWhisper, 'transcribeAudio').mockResolvedValue({
        ok: true,
        text: 'local fallback text'
      });

      const wavBuf = buildWavBuffer({
        numChannels: 1,
        bitsPerSample: 16,
        samples: [16384, -16384]
      });

      const result = await whisperService.transcribeAudio(wavBuf);
      expect(result.ok).toBe(true);
      expect(result.text).toBe('local fallback text');
      expect(result.source).toBe('local-whisper-tiny.en');

      spyLocal.mockRestore();
      global.fetch = origFetch;
    });
  });
});
