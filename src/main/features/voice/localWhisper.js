'use strict';
// FahOS — Built-in Local Whisper Engine (100% Private, Offline, Zero External Popups)
let transcriber = null;
let isLoading = false;
let pipelineFn = null;

async function getPipeline() {
  if (!pipelineFn) {
    const module = await import('@xenova/transformers');
    pipelineFn = module.pipeline;
  }
  return pipelineFn;
}

async function getTranscriber() {
  if (transcriber) return transcriber;
  if (!isLoading) {
    isLoading = true;
    console.log('[FahOS Local Whisper] Loading whisper-tiny.en model...');
    try {
      const pipeline = await getPipeline();
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      console.log('[FahOS Local Whisper] Whisper model ready!');
    } catch (e) {
      console.error('[FahOS Local Whisper] Model load error:', e);
    } finally {
      isLoading = false;
    }
  }
  while (isLoading) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return transcriber;
}

async function transcribeAudio(samples) {
  try {
    const p = await getTranscriber();
    if (!p) return { ok: false, error: 'Model failed to load' };

    const float32 = samples instanceof Float32Array ? samples : new Float32Array(samples);
    if (float32.length === 0) return { ok: true, text: '' };

    const output = await p(float32);
    const text = (output && output.text) ? output.text.trim() : '';
    console.log('[FahOS Local Whisper] Transcribed:', text);
    return { ok: true, text };
  } catch (err) {
    console.error('[FahOS Local Whisper] Transcription error:', err);
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = { getTranscriber, transcribeAudio };
