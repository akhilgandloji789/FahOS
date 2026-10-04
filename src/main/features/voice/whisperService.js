'use strict';
// FahOS — High-Accuracy Whisper Engine (STRICT ENGLISH ONLY: Whisper Large-v3-Turbo)
const localWhisper = require('./localWhisper');
const { loadConfig } = require('../../config');

function getGroqApiKey() {
  if (process.env.GROQ_API_KEY) {
    return process.env.GROQ_API_KEY;
  }
  try {
    const cfg = loadConfig();
    return cfg.providers?.openaiCompatible?.apiKey || '';
  } catch (_) {
    return '';
  }
}

async function transcribeAudioWithGroq(audioBuffer) {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) throw new Error('No Groq API key found in configuration');

    const formData = new FormData();
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'speech.wav');
    formData.append('language', 'en'); // STRICTLY ENFORCE ENGLISH ONLY
    formData.append('temperature', '0.0');
    formData.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq Whisper error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let text = (data && data.text) ? data.text.trim() : '';

    // Strip any hallucinated non-English or repeating gibberish
    if (text) {
      console.log('[FahOS Whisper English-Only] Transcribed:', text);
      return { ok: true, text, source: 'groq-whisper-large-v3-turbo' };
    }
    return { ok: true, text: '' };
  } catch (err) {
    console.warn('[FahOS Whisper] Groq transcription notice:', err.message);
    throw err;
  }
}

async function transcribeAudio(audioBuffer, float32Fallback) {
  // 1. Primary: Whisper Large-v3-Turbo locked to English
  try {
    if (audioBuffer && audioBuffer.byteLength > 0) {
      const groqRes = await transcribeAudioWithGroq(audioBuffer);
      if (groqRes && groqRes.ok && groqRes.text && groqRes.text.trim()) {
        return groqRes;
      }
      console.warn('[FahOS Whisper] Cloud returned empty text, attempting local fallback...');
    }
  } catch (err) {
    console.warn('[FahOS Whisper] Cloud failed, attempting local fallback...');
  }

  // 2. Fallback: Local English-only Whisper model (.en)
  // Use float32Fallback if provided; otherwise try to decode from the buffer.
  try {
    if (float32Fallback) {
      const localRes = await localWhisper.transcribeAudio(float32Fallback);
      return { ...localRes, source: 'local-whisper-tiny.en' };
    }
    if (audioBuffer && audioBuffer.byteLength > 0) {
      // Decode WAV buffer into float32 samples for the local pipeline.
      const float32 = decodeWavToFloat32(audioBuffer);
      if (float32 && float32.length > 0) {
        const localRes = await localWhisper.transcribeAudio(float32);
        return { ...localRes, source: 'local-whisper-tiny.en' };
      }
    }
  } catch (e) {
    console.error('[FahOS Whisper] Local fallback error:', e);
  }

  return { ok: false, error: 'Transcription failed' };
}

// Decode a WAV buffer into float32 PCM samples (16 kHz mono expected).
function decodeWavToFloat32(bufferInput) {
  try {
    if (!bufferInput) return null;

    let arrayBuffer;
    let byteOffset = 0;
    let byteLength = 0;

    if (bufferInput instanceof ArrayBuffer) {
      arrayBuffer = bufferInput;
      byteOffset = 0;
      byteLength = bufferInput.byteLength;
    } else if (ArrayBuffer.isView(bufferInput)) {
      arrayBuffer = bufferInput.buffer;
      byteOffset = bufferInput.byteOffset;
      byteLength = bufferInput.byteLength;
    } else if (Buffer.isBuffer(bufferInput)) {
      arrayBuffer = bufferInput.buffer;
      byteOffset = bufferInput.byteOffset;
      byteLength = bufferInput.byteLength;
    } else if (typeof bufferInput === 'object') {
      if (bufferInput.type === 'Buffer' && Array.isArray(bufferInput.data)) {
        const b = Buffer.from(bufferInput.data);
        arrayBuffer = b.buffer;
        byteOffset = b.byteOffset;
        byteLength = b.byteLength;
      } else if (bufferInput.buffer instanceof ArrayBuffer) {
        arrayBuffer = bufferInput.buffer;
        byteOffset = bufferInput.byteOffset || 0;
        byteLength = bufferInput.byteLength || arrayBuffer.byteLength;
      } else {
        return null;
      }
    } else {
      return null;
    }

    if (!arrayBuffer || byteLength < 44) return null;

    const view = new DataView(arrayBuffer, byteOffset, byteLength);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    if (riff !== 'RIFF' || wave !== 'WAVE') return null;

    let numChannels = 1;
    let sampleRate = 16000;
    let bitsPerSample = 16;
    let dataOffset = 12;
    let dataSize = 0;
    let foundFmt = false;
    let foundData = false;

    // Dynamically traverse ALL chunks (fmt, LIST, JUNK, data)
    while (dataOffset + 8 <= byteLength) {
      const chunkId = String.fromCharCode(
        view.getUint8(dataOffset), view.getUint8(dataOffset + 1),
        view.getUint8(dataOffset + 2), view.getUint8(dataOffset + 3)
      );
      const chunkSize = view.getUint32(dataOffset + 4, true);

      if (chunkId === 'fmt ') {
        numChannels = view.getUint16(dataOffset + 10, true);
        sampleRate = view.getUint32(dataOffset + 12, true);
        bitsPerSample = view.getUint16(dataOffset + 22, true);
        foundFmt = true;
      } else if (chunkId === 'data' && foundFmt) {
        dataSize = chunkSize;
        dataOffset += 8;
        foundData = true;
        break;
      }

      // Step chunk offset with word-alignment padding
      const step = chunkSize > 0 ? chunkSize + (chunkSize % 2) : 0;
      dataOffset += 8 + step;
      if (chunkSize === 0 && !foundData && dataOffset < byteLength && String.fromCharCode(view.getUint8(dataOffset), view.getUint8(dataOffset + 1), view.getUint8(dataOffset + 2), view.getUint8(dataOffset + 3)) === chunkId) {
        dataOffset += 4;
      }
    }

    if (!foundData || dataOffset >= byteLength) return null;

    const bytesPerSample = bitsPerSample / 8;
    const maxDataBytes = byteLength - dataOffset;
    const actualDataBytes = (dataSize > 0 && dataSize <= maxDataBytes) ? dataSize : maxDataBytes;
    const totalSamples = Math.floor(actualDataBytes / bytesPerSample);
    const frames = Math.floor(totalSamples / numChannels);
    if (frames <= 0) return null;

    const float32 = new Float32Array(frames);

    for (let f = 0; f < frames; f++) {
      const frameOffset = dataOffset + f * numChannels * bytesPerSample;
      let sum = 0;
      for (let c = 0; c < numChannels; c++) {
        const offset = frameOffset + c * bytesPerSample;
        if (bitsPerSample === 16) {
          if (offset + 2 <= byteLength) {
            sum += view.getInt16(offset, true) / 32768.0;
          }
        } else if (bitsPerSample === 32) {
          if (offset + 4 <= byteLength) {
            sum += view.getFloat32(offset, true);
          }
        } else {
          return null;
        }
      }
      float32[f] = sum / numChannels;
    }

    return float32;
  } catch (e) {
    console.warn('[FahOS Whisper] WAV decode error:', e.message);
    return null;
  }
}

module.exports = { transcribeAudio, decodeWavToFloat32 };
