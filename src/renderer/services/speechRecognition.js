// FahOS — Speech Recognition Service (Seamless Native Windows Engine + Web Speech fallback)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SpeechService = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  let isRunning = false;
  let recognition = null;
  let currentOnText = null;
  let currentOnError = null;

  // Register IPC listeners ONCE so duplicate handlers never accumulate
  if (typeof window !== 'undefined' && window.fahos && window.fahos.onSpeechText) {
    window.fahos.onSpeechText((data) => {
      if (!isRunning) return;
      if (data && data.text) {
        currentOnText?.(data.text, data.isFinal);
      }
    });
  }

  if (typeof window !== 'undefined' && window.fahos && window.fahos.onSpeechError) {
    window.fahos.onSpeechError((err) => {
      if (!isRunning) return;
      console.warn('[SpeechService error]:', err);
      currentOnError?.(err);
    });
  }

  function startSpeechRecognition({
    language = "en-IN",
    onText,
    onEnd,
    onError,
  }) {
    isRunning = true;
    currentOnText = onText;
    currentOnError = onError;

    // 1. Native Windows 11 WinRT Speech Engine (100% reliable, zero cloud keys needed)
    if (window.fahos && window.fahos.startSpeech) {
      window.fahos.startSpeech().catch((e) => {
        console.warn('[FahOS] Native speech start notice:', e);
      });
      return;
    }

    // 2. Browser Web Speech API fallback
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onError?.("Speech recognition is not supported in this environment.");
      return;
    }

    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }

    recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      onText?.(text, event.results[event.results.length - 1].isFinal);
    };

    recognition.onerror = (event) => {
      onError?.(event.error);
    };

    recognition.onend = () => {
      onEnd?.();
    };

    try {
      recognition.start();
    } catch (e) {
      onError?.(e.message || String(e));
    }
  }

  function stopSpeechRecognition() {
    isRunning = false;

    // Stop Native Windows Engine
    if (window.fahos && window.fahos.stopSpeech) {
      try { window.fahos.stopSpeech(); } catch (_) {}
    }

    // Stop Web Speech fallback
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
      recognition = null;
    }
  }

  return {
    startSpeechRecognition,
    stopSpeechRecognition
  };
});
