'use strict';

const { decodeWavToFloat32 } = require('../src/main/features/voice/whisperService');

// Helper function to build custom WAV buffers
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
    preFmtChunks = [], // Array of { id: 'JUNK', data: Buffer }
    postFmtChunks = [], // Array of { id: 'LIST', data: Buffer }
    includeDataChunk = true,
    dataChunkTag = 'data',
    customDataBytes = null, // Buffer or null
    samples = null, // Array of sample values for 16-bit or 32-bit float
    truncateAt = null // Slice buffer at N bytes if set
  } = options;

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  // Calculate pre-fmt size
  let preFmtLength = 0;
  for (const chunk of preFmtChunks) {
    const pad = chunk.data.length % 2;
    preFmtLength += 8 + chunk.data.length + pad;
  }

  // Calculate post-fmt size
  let postFmtLength = 0;
  for (const chunk of postFmtChunks) {
    const pad = chunk.data.length % 2;
    postFmtLength += 8 + chunk.data.length + pad;
  }

  // Calculate data payload size
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

  // RIFF Header
  buf.write(riffTag, 0);
  buf.writeUInt32LE(totalLength - 8, 4);
  buf.write(waveTag, 8);
  offset = 12;

  // Write pre-fmt chunks
  for (const chunk of preFmtChunks) {
    buf.write(chunk.id, offset);
    buf.writeUInt32LE(chunk.data.length, offset + 4);
    chunk.data.copy(buf, offset + 8);
    const pad = chunk.data.length % 2;
    offset += 8 + chunk.data.length + pad;
  }

  // Write fmt chunk
  buf.write(fmtTag, offset);
  buf.writeUInt32LE(fmtSize, offset + 4);
  buf.writeUInt16LE(audioFormat, offset + 8);
  buf.writeUInt16LE(numChannels, offset + 10);
  buf.writeUInt32LE(sampleRate, offset + 12);
  buf.writeUInt32LE(byteRate, offset + 16);
  buf.writeUInt16LE(blockAlign, offset + 20);
  buf.writeUInt16LE(bitsPerSample, offset + 22);
  offset += 8 + fmtSize;

  // Write post-fmt chunks
  for (const chunk of postFmtChunks) {
    buf.write(chunk.id, offset);
    buf.writeUInt32LE(chunk.data.length, offset + 4);
    chunk.data.copy(buf, offset + 8);
    const pad = chunk.data.length % 2;
    offset += 8 + chunk.data.length + pad;
  }

  // Write data chunk
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

const testResults = [];

function runTest(id, category, description, fn) {
  let status = 'PASS';
  let errorMsg = null;
  let details = null;
  try {
    details = fn();
  } catch (err) {
    status = 'FAIL';
    errorMsg = err.message;
  }
  testResults.push({ id, category, description, status, errorMsg, details });
}

function expect(actual) {
  return {
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, but got ${actual}`);
      return 'Got null as expected';
    },
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${expected}, but got ${actual}`);
      return `Got ${actual}`;
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(actual - expected);
      const tolerance = Math.pow(10, -precision) / 2;
      if (diff > tolerance) throw new Error(`Expected ${expected} ± ${tolerance}, but got ${actual}`);
      return `Got ${actual} (close to ${expected})`;
    },
    toHaveLength(expectedLen) {
      if (!actual || actual.length !== expectedLen) {
        throw new Error(`Expected length ${expectedLen}, but got ${actual ? actual.length : 'null/undefined'}`);
      }
      return `Length is ${expectedLen}`;
    },
    notToBeNull() {
      if (actual === null) throw new Error(`Expected non-null value, but got null`);
      return 'Got non-null output';
    }
  };
}

console.log('Running Edge Case Test Suite for decodeWavToFloat32...\n');

// ---------------------------------------------------------------------------
// Group 1: 16-bit Mono WAV PCM Buffers
// ---------------------------------------------------------------------------

runTest('TC1.1', '16-bit Mono PCM', 'Standard 16-bit Mono 16kHz PCM WAV with typical sample values', () => {
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    samples: [0, 16384, -16384, 32767]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(4);
  expect(res[0]).toBeCloseTo(0.0);
  expect(res[1]).toBeCloseTo(0.5);
  expect(res[2]).toBeCloseTo(-0.5);
  expect(res[3]).toBeCloseTo(1.0);
  return `Samples decoded: [${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC1.2', '16-bit Mono PCM', 'Full range boundary values (-32768, 32767, 0)', () => {
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    samples: [-32768, 32767, 0]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(3);
  expect(res[0]).toBeCloseTo(-1.0);
  expect(res[1]).toBeCloseTo(1.0);
  expect(res[2]).toBeCloseTo(0.0);
  return `Decoded boundary samples: [${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC1.3', '16-bit Mono PCM', 'Odd sample count (3 samples)', () => {
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    samples: [8192, 16384, 24576]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(3);
  expect(res[0]).toBeCloseTo(0.25);
  expect(res[1]).toBeCloseTo(0.5);
  expect(res[2]).toBeCloseTo(0.75);
  return `Decoded 3 samples: [${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC1.4', '16-bit Mono PCM', 'Non-16kHz sample rate (44.1kHz)', () => {
  const buf = buildWavBuffer({
    numChannels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    samples: [16384, -16384]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  return `Successfully decoded 44.1kHz WAV: [${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC1.5', '16-bit Mono PCM', 'Empty data chunk (0 samples payload)', () => {
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    samples: []
  });
  const res = decodeWavToFloat32(buf);
  expect(res).toBeNull();
  return 'Returned null for zero samples as expected';
});

runTest('TC1.6', '16-bit Mono PCM', 'Truncated sample payload (declared chunkSize > actual buffer length)', () => {
  // Build buffer, but declare chunk size larger than payload length
  const payload = Buffer.alloc(10); // 5 samples
  payload.writeInt16LE(16384, 0);
  payload.writeInt16LE(16384, 2);
  payload.writeInt16LE(16384, 4);
  payload.writeInt16LE(16384, 6);
  payload.writeInt16LE(16384, 8);

  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    customDataBytes: payload
  });
  // Corrupt data chunk size header at offset 40 to say 100 bytes
  buf.writeUInt32LE(100, 40);

  const res = decodeWavToFloat32(buf);
  // Calculates totalSamples based on buffer.length - dataOffset (which is 10 bytes = 5 samples)
  expect(res).notToBeNull();
  expect(res).toHaveLength(5);
  return `Decoded 5 available frames despite inflated chunkSize header`;
});

// ---------------------------------------------------------------------------
// Group 2: Stereo WAV PCM Buffers & Channel Striding
// ---------------------------------------------------------------------------

runTest('TC2.1', 'Stereo & Multi-channel', 'Stereo 16-bit PCM channel striding & downmixing (2 frames)', () => {
  // Frame 0: Left=16384 (0.5), Right=16384 (0.5) => Avg = 0.5
  // Frame 1: Left=32767 (1.0), Right=0 (0.0) => Avg = 0.5
  const buf = buildWavBuffer({
    numChannels: 2,
    bitsPerSample: 16,
    samples: [16384, 16384, 32767, 0]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(0.5);
  expect(res[1]).toBeCloseTo(0.5);
  return `Stereo 16-bit decoded frames: [${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC2.2', 'Stereo & Multi-channel', 'Stereo 16-bit PCM opposite phases downmixing to zero', () => {
  // Frame 0: Left=32767 (~1.0), Right=-32768 (-1.0) => Avg = 0
  // Frame 1: Left=-16384 (-0.5), Right=16384 (0.5) => Avg = 0
  const buf = buildWavBuffer({
    numChannels: 2,
    bitsPerSample: 16,
    samples: [32767, -32768, -16384, 16384]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(0.0);
  expect(res[1]).toBeCloseTo(0.0);
  return `Stereo anti-phase decoded: [${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC2.3', 'Stereo & Multi-channel', 'Stereo 32-bit Float PCM downmixing (2 frames)', () => {
  // Frame 0: Left=0.8, Right=0.2 => Avg = 0.5
  // Frame 1: Left=-0.4, Right=-0.6 => Avg = -0.5
  const buf = buildWavBuffer({
    numChannels: 2,
    bitsPerSample: 32,
    samples: [0.8, 0.2, -0.4, -0.6]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(0.5);
  expect(res[1]).toBeCloseTo(-0.5);
  return `Stereo 32-bit Float decoded: [${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC2.4', 'Stereo & Multi-channel', 'Multi-channel (4-channel 16-bit PCM, 2 frames)', () => {
  // 4 channels, 2 bytes/sample = 8 bytes per frame
  // Frame 0: [16384 (0.5), 16384 (0.5), 32767 (1.0), 32767 (1.0)] => Avg = (0.5 + 0.5 + 1.0 + 1.0) / 4 = 0.75
  const buf = buildWavBuffer({
    numChannels: 4,
    bitsPerSample: 16,
    samples: [
      16384, 16384, 32767, 32767,
      32767, 0, 1000, 2000
    ]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(0.75);
  return `4-channel decoded frames count=${res.length}, 4-ch avg=[${Array.from(res).map(n => n.toFixed(3)).join(', ')}]`;
});

runTest('TC2.5', 'Stereo & Multi-channel', 'Stereo 16-bit PCM with incomplete dangling sample bytes at end', () => {
  // 2 channels = 4 bytes per frame. Payload has 6 bytes (1 frame + 2 extra bytes)
  const payload = Buffer.alloc(6);
  payload.writeInt16LE(16384, 0); // L
  payload.writeInt16LE(16384, 2); // R
  payload.writeInt16LE(32767, 4); // L (incomplete frame, R missing)

  const buf = buildWavBuffer({
    numChannels: 2,
    bitsPerSample: 16,
    customDataBytes: payload
  });
  const res = decodeWavToFloat32(buf);
  // frames = Math.floor(3 / 2) = 1 frame
  expect(res).notToBeNull();
  expect(res).toHaveLength(1);
  expect(res[0]).toBeCloseTo(0.5);
  return `Incomplete stereo frame handled cleanly; 1 frame decoded`;
});

// ---------------------------------------------------------------------------
// Group 3: WAV Metadata Headers & Chunk Placement
// ---------------------------------------------------------------------------

runTest('TC3.1', 'Metadata & Headers', 'Metadata chunk (LIST/INFO) placed AFTER fmt chunk before data chunk', () => {
  const listData = Buffer.from('ISFT\x0e\x00\x00\x00FahOS Audio v1\x00', 'binary');
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    postFmtChunks: [{ id: 'LIST', data: listData }],
    samples: [16384, -16384]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(0.5);
  expect(res[1]).toBeCloseTo(-0.5);
  return `Successfully skipped LIST metadata chunk after fmt chunk`;
});

runTest('TC3.2', 'Metadata & Headers', 'Metadata chunk (JUNK) with odd length (15 bytes) after fmt chunk', () => {
  const junkData = Buffer.from('123456789012345'); // 15 bytes -> needs +1 pad byte
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    postFmtChunks: [{ id: 'JUNK', data: junkData }],
    samples: [16384, 32767]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(0.5);
  return `Odd-length chunk padding handled correctly; skipped JUNK chunk`;
});

runTest('TC3.3', 'Metadata & Headers', 'Metadata chunk (JUNK) placed BEFORE fmt chunk (RIFF -> JUNK -> fmt -> data)', () => {
  const junkData = Buffer.alloc(24, 0xAA);
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    preFmtChunks: [{ id: 'JUNK', data: junkData }],
    samples: [16384, 16384]
  });
  const res = decodeWavToFloat32(buf);
  // EXPECTED TO FAIL because decodeWavToFloat32 expects fmt header at fixed offsets 22 and 34!
  if (res === null) {
    return `FAILED as expected: returned null because fmt chunk was displaced by pre-fmt JUNK chunk`;
  }
  return `Unexpectedly returned: ${res}`;
});

runTest('TC3.4', 'Metadata & Headers', 'Multiple metadata chunks (LIST, JUNK, bext) after fmt chunk', () => {
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    postFmtChunks: [
      { id: 'JUNK', data: Buffer.from('junk-data-content') },
      { id: 'LIST', data: Buffer.from('list-metadata-content') },
      { id: 'bext', data: Buffer.alloc(16, 0) }
    ],
    samples: [16384, -16384]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  return `Successfully skipped multiple metadata chunks (JUNK, LIST, bext)`;
});

runTest('TC3.5', 'Metadata & Headers', 'Metadata chunk payload containing sub-string "data"', () => {
  const junkData = Buffer.from('Header containing data string inside payload text', 'utf8');
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    postFmtChunks: [{ id: 'JUNK', data: junkData }],
    samples: [16384, 16384]
  });
  const res = decodeWavToFloat32(buf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  return `Chunk parser correctly skips payload containing 'data' string`;
});

// ---------------------------------------------------------------------------
// Group 4: Truncated or Invalid WAV Header & Error Handling
// ---------------------------------------------------------------------------

runTest('TC4.1', 'Invalid/Truncated Headers', 'null input buffer', () => {
  const res = decodeWavToFloat32(null);
  expect(res).toBeNull();
  return 'Returned null for null input';
});

runTest('TC4.2', 'Invalid/Truncated Headers', 'undefined input buffer', () => {
  const res = decodeWavToFloat32(undefined);
  expect(res).toBeNull();
  return 'Returned null for undefined input';
});

runTest('TC4.3', 'Invalid/Truncated Headers', 'Empty Buffer.alloc(0)', () => {
  const res = decodeWavToFloat32(Buffer.alloc(0));
  expect(res).toBeNull();
  return 'Returned null for 0-byte buffer';
});

runTest('TC4.4', 'Invalid/Truncated Headers', 'Short Buffer (30 bytes, < 44 bytes)', () => {
  const res = decodeWavToFloat32(Buffer.alloc(30));
  expect(res).toBeNull();
  return 'Returned null for buffer length < 44';
});

runTest('TC4.5', 'Invalid/Truncated Headers', 'Invalid RIFF magic tag (e.g., "NOPE")', () => {
  const buf = buildWavBuffer({ riffTag: 'NOPE', samples: [16384] });
  const res = decodeWavToFloat32(buf);
  expect(res).toBeNull();
  return 'Returned null for invalid RIFF header';
});

runTest('TC4.6', 'Invalid/Truncated Headers', 'Invalid WAVE format tag (e.g., "MP3 ")', () => {
  const buf = buildWavBuffer({ waveTag: 'MP3 ', samples: [16384] });
  const res = decodeWavToFloat32(buf);
  expect(res).toBeNull();
  return 'Returned null for invalid WAVE header tag';
});

runTest('TC4.7', 'Invalid/Truncated Headers', 'Unsupported bitsPerSample = 8 (8-bit PCM)', () => {
  const buf = buildWavBuffer({ bitsPerSample: 8, samples: [] });
  const res = decodeWavToFloat32(buf);
  expect(res).toBeNull();
  return 'Returned null for unsupported 8-bit sample depth';
});

runTest('TC4.8', 'Invalid/Truncated Headers', 'Unsupported bitsPerSample = 24 (24-bit PCM)', () => {
  const buf = buildWavBuffer({ bitsPerSample: 24, samples: [] });
  const res = decodeWavToFloat32(buf);
  expect(res).toBeNull();
  return 'Returned null for unsupported 24-bit sample depth';
});

runTest('TC4.9', 'Invalid/Truncated Headers', 'Missing data chunk completely', () => {
  const buf = buildWavBuffer({ includeDataChunk: false, samples: [] });
  const res = decodeWavToFloat32(buf);
  expect(res).toBeNull();
  return 'Returned null when no data chunk exists';
});

runTest('TC4.10', 'Invalid/Truncated Headers', 'Truncated data chunk header (file ends mid data header)', () => {
  const buf = buildWavBuffer({ samples: [16384, 16384] });
  // Truncate at offset 40 (inside data chunk header)
  const truncBuf = buf.subarray(0, 40);
  const res = decodeWavToFloat32(truncBuf);
  expect(res).toBeNull();
  return 'Returned null for truncated data header';
});

runTest('TC4.11', 'Invalid/Truncated Headers', 'Zero-length metadata chunk before data chunk (chunkSize = 0)', () => {
  // A chunk with id 'JUNK' and chunkSize = 0 placed before data chunk
  const buf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    postFmtChunks: [{ id: 'JUNK', data: Buffer.alloc(0) }],
    samples: [16384, 16384]
  });
  const res = decodeWavToFloat32(buf);
  // Line 113: if (chunkSize === 0) break; -> breaks out of loop before finding data chunk!
  if (res === null) {
    return 'FAILED/REJECTED: returned null because chunkSize === 0 triggered loop break before data chunk';
  }
  return `Decoded samples: ${res.length}`;
});

runTest('TC4.12', 'Invalid/Truncated Headers', 'Node Buffer subarray with byteOffset > 0', () => {
  const fullBuf = Buffer.alloc(100);
  const wavBuf = buildWavBuffer({
    numChannels: 1,
    bitsPerSample: 16,
    samples: [16384, -16384]
  });
  wavBuf.copy(fullBuf, 20); // copy into fullBuf starting at offset 20
  const slicedBuf = fullBuf.subarray(20, 20 + wavBuf.length);

  const res = decodeWavToFloat32(slicedBuf);
  expect(res).notToBeNull();
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(0.5);
  expect(res[1]).toBeCloseTo(-0.5);
  return `Node Buffer slice (byteOffset=${slicedBuf.byteOffset}) decoded correctly`;
});

// Output Summary Table & Detailed Log
console.log('=' .repeat(90));
console.log(`TEST RESULTS SUMMARY (${testResults.length} Edge Cases Executed)`);
console.log('=' .repeat(90));

let passCount = 0;
let failCount = 0;

for (const t of testResults) {
  const mark = t.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
  if (t.status === 'PASS') passCount++; else failCount++;
  console.log(`[${t.id}] ${mark} | ${t.category.padEnd(24)} | ${t.description}`);
  if (t.details) console.log(`       Details: ${t.details}`);
  if (t.errorMsg) console.log(`       Error:   ${t.errorMsg}`);
  console.log('-'.repeat(90));
}

console.log(`\nFinal Score: ${passCount} Passed, ${failCount} Failed out of ${testResults.length} total edge cases.`);

// Write JSON summary for script consumption if needed
require('fs').writeFileSync(
  require('path').join(__dirname, 'whisper_test_results.json'),
  JSON.stringify({ passCount, failCount, total: testResults.length, results: testResults }, null, 2)
);
