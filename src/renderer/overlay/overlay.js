'use strict';
// FahOS Voice-First Pop-up Controller

const $ = (id) => document.getElementById(id);

const widget            = $('widget');
const promptInput       = $('promptInput');
const sendBtn           = $('sendBtn');
const micIconBtn        = $('micIconBtn');
const micBtn            = $('micBtn');
const micStatus         = $('micStatus');
const closeBtn          = $('closeBtn');
const historyBtn        = $('historyBtn');
const chatView          = $('chatView');
const historyView       = $('historyView');
const historyBackBtn    = $('historyBackBtn');
const clearHistoryBtn   = $('clearHistoryBtn');
const historyList       = $('historyList');
const historyCountBadge = $('historyCountBadge');
const phonebookBtn      = $('phonebookBtn');
const phonebookView     = $('phonebookView');
const phonebookBackBtn  = $('phonebookBackBtn');
const phonebookList     = $('phonebookList');
const phonebookCountBadge = $('phonebookCountBadge');
const contactNameInput  = $('contactNameInput');
const contactPhoneInput = $('contactPhoneInput');
const contactEmailInput = $('contactEmailInput');
const saveContactBtn    = $('saveContactBtn');
const dropletMenuWrapper = $('dropletMenuWrapper');
const dropletTriggerBtn   = $('dropletTriggerBtn');
const resetSizeBtn        = $('resetSizeBtn');
const openBrowserBtn       = $('openBrowserBtn');
const bottomResizeHandle  = $('bottomResizeHandle');
const snipBtn             = $('snipBtn');
const attachedImagePill   = $('attachedImagePill');
const attachedThumbImg    = $('attachedThumbImg');
const removeImageBtn      = $('removeImageBtn');
const aiResponseText      = $('aiResponseText');
const pillIcon            = $('pillIcon');
const pillText            = $('pillText');
const pillStatus          = $('pillStatus');

let currentAttachedImage = null;

let isListening  = false;
let audioStream  = null;
let mediaRecorder = null;
let audioChunks  = [];

function setPill(icon, text, badge, badgeColor) {
  pillIcon.textContent   = icon;
  pillText.textContent   = text;
  pillStatus.textContent = badge || 'bullet';
  pillStatus.style.color = badgeColor || '#FFFFFF';
}

// renderHistory and renderPhonebook are used by switchView, so hoisted here
async function renderHistory() {
  if (!window.fahos || !window.fahos.getHistory) return;
  try {
    const history = await window.fahos.getHistory();
    historyCountBadge.textContent = history.length;
    if (!history || history.length === 0) {
      historyList.innerHTML = '<div class="history-empty"><div class="history-empty-icon">history_icon</div><div class="history-empty-title">No History Yet</div><div class="history-empty-desc">Your questions and answers are saved here.</div></div>';
      return;
    }
    historyList.innerHTML = history.map((item, idx) => {
      const formattedA = window.renderMarkdown ? window.renderMarkdown(item.response) : item.response;
      const d = new Date(item.timestamp);
      const now = new Date();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const timeLabel = d.toDateString() === now.toDateString() ? 'Today at ' + timeStr : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + timeStr;
      
      const isLong = item.response && (item.response.length > 130 || item.response.includes('\n'));
      const answerClass = isLong ? 'history-ai-answer collapsed' : 'history-ai-answer';
      const showMoreBtnHtml = isLong ? '<button class="history-expand-btn" data-idx="' + idx + '"><span>Show More ▾</span></button>' : '';

      return '<div class="history-card" data-idx="' + idx + '">' +
        '<div class="history-card-top">' +
          '<span class="history-time-badge"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' + timeLabel + '</span>' +
          '<div class="history-card-actions">' +
            '<button class="history-mini-btn copy-btn" data-text="' + encodeURIComponent(item.response) + '">Copy</button>' +
            '<button class="history-mini-btn reuse-btn" data-query="' + encodeURIComponent(item.query) + '">Ask Again</button>' +
          '</div>' +
        '</div>' +
        '<div class="history-user-query"><span class="history-role-tag">YOU</span><span>' + item.query + '</span></div>' +
        '<div class="' + answerClass + '">' + formattedA + '</div>' +
        showMoreBtnHtml +
      '</div>';
    }).join('');

    // Wire expand / collapse buttons
    historyList.querySelectorAll('.history-expand-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var card = btn.closest('.history-card');
        if (!card) return;
        var answerEl = card.querySelector('.history-ai-answer');
        if (!answerEl) return;
        var isCollapsed = answerEl.classList.contains('collapsed');
        if (isCollapsed) {
          answerEl.classList.remove('collapsed');
          answerEl.classList.add('expanded');
          btn.innerHTML = '<span>Show Less ▴</span>';
        } else {
          answerEl.classList.remove('expanded');
          answerEl.classList.add('collapsed');
          btn.innerHTML = '<span>Show More ▾</span>';
        }
      });
    });

    historyList.querySelectorAll('.copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigator.clipboard.writeText(decodeURIComponent(btn.getAttribute('data-text') || ''));
        var prev = btn.textContent; btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = prev; }, 1500);
      });
    });
    historyList.querySelectorAll('.reuse-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var q = decodeURIComponent(btn.getAttribute('data-query') || '');
        switchView('chat'); promptInput.value = q; promptInput.focus();
      });
    });
  } catch (e) { console.error('[FahOS History]', e); }
}

async function renderPhonebook() {
  if (!window.fahos || !window.fahos.getContacts) return;
  try {
    const contacts = await window.fahos.getContacts();
    if (phonebookCountBadge) phonebookCountBadge.textContent = contacts.length;
    if (!contacts || contacts.length === 0) {
      phonebookList.innerHTML = '<div class="history-empty"><div class="history-empty-icon">pb_icon</div><div class="history-empty-title">Directory is Empty</div><div class="history-empty-desc">Add contacts above or say "Save contact Dad as +91..."</div></div>';
      return;
    }
    phonebookList.innerHTML = contacts.map(function(c) {
      var phoneHtml = c.phone ? '<span class="contact-phone">+' + c.phone + '</span>' : '';
      var emailHtml = c.email ? '<span class="contact-email"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>' + c.email + '</span>' : '';

      var chatBtnHtml = c.phone
        ? '<button class="contact-btn chat-btn" data-name="' + c.displayName + '" title="Open WhatsApp Chat"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M20.52 3.48A11.89 11.89 0 0 0 12.07 0C5.45 0 .07 5.38.07 12a11.9 11.9 0 0 0 1.62 6L0 24l6.19-1.62A11.94 11.94 0 0 0 12.07 24c6.62 0 12-5.38 12-12 0-3.21-1.25-6.23-3.55-8.52z"/></svg><span>Chat</span></button>'
        : '';

      var composeBtnHtml = c.email
        ? '<button class="contact-btn email-btn" data-target="' + (c.email || c.displayName) + '" data-name="' + c.displayName + '" title="Compose Email"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg><span>Compose</span></button>'
        : '';

      return '<div class="contact-card">' +
        '<div class="contact-info">' +
          '<span class="contact-name">' + c.displayName + '</span>' +
          '<div class="contact-details-row">' + phoneHtml + emailHtml + '</div>' +
        '</div>' +
        '<div class="contact-actions">' +
          chatBtnHtml +
          composeBtnHtml +
          '<button class="contact-btn delete-btn" data-name="' + c.displayName + '" title="Delete"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>' +
        '</div>' +
      '</div>';
    }).join('');

    phonebookList.querySelectorAll('.chat-btn').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        var name = btn.getAttribute('data-name');
        if (window.fahos && window.fahos.openContactChat) {
          btn.innerHTML = '<span>Opening...</span>'; btn.style.opacity = '0.7';
          setPill('💬', 'Opening ' + name + '...', '•••', '#34D399');
          await window.fahos.openContactChat(name);
          setPill('✓', 'Opened ' + name, '✓', '#34D399');
          setTimeout(function() { if (window.fahos && window.fahos.hide) window.fahos.hide(); }, 700);
        }
      });
    });

    phonebookList.querySelectorAll('.email-btn').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        var target = btn.getAttribute('data-target');
        var name = btn.getAttribute('data-name');
        if (window.fahos && window.fahos.composeEmail) {
          btn.innerHTML = '<span>Opening...</span>'; btn.style.opacity = '0.7';
          setPill('✉', 'Composing to ' + name + '...', '•••', '#60A5FA');
          await window.fahos.composeEmail({ contactOrEmail: target });
          setPill('✓', 'Opened composer', '✓', '#60A5FA');
          setTimeout(function() { if (window.fahos && window.fahos.hide) window.fahos.hide(); }, 700);
        }
      });
    });

    phonebookList.querySelectorAll('.delete-btn').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        var name = btn.getAttribute('data-name');
        if (window.fahos && window.fahos.deleteContact) {
          var card = btn.closest('.contact-card');
          if (card) { card.style.opacity = '0.3'; card.style.transition = 'opacity 0.2s'; }
          await window.fahos.deleteContact(name);
          await renderPhonebook();
        }
      });
    });
  } catch (e) { console.error('[FahOS Directory]', e); }
}

// switchView must be defined BEFORE resetToFreshState
let activeView = 'chat';
function switchView(target) {
  activeView = target;
  chatView.classList.add('hidden');
  historyView.classList.add('hidden');
  phonebookView.classList.add('hidden');
  historyBtn.classList.remove('active');
  phonebookBtn.classList.remove('active');
  if (target === 'history') {
    historyView.classList.remove('hidden'); historyBtn.classList.add('active');
    if (window.fahos && window.fahos.setHeight) window.fahos.setHeight(320);
    renderHistory();
  } else if (target === 'phonebook') {
    phonebookView.classList.remove('hidden'); phonebookBtn.classList.add('active');
    if (window.fahos && window.fahos.setHeight) window.fahos.setHeight(320);
    renderPhonebook();
  } else {
    chatView.classList.remove('hidden');
    if (window.fahos && window.fahos.setHeight) window.fahos.setHeight(265);
    promptInput.focus();
  }
}

function setListeningState(listening) {
  isListening = listening;
  if (listening) {
    micIconBtn.classList.add('active', 'listening'); micBtn.classList.add('active');
    micStatus.textContent = 'Recording';
    promptInput.placeholder = '🔴 Recording... Click mic again when done';
    setPill('🎤', 'Recording — click mic when done', '●', '#F87171');
    micIconBtn.innerHTML = '<svg class="mic-svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';
  } else {
    micIconBtn.classList.remove('active', 'listening'); micBtn.classList.remove('active');
    micStatus.textContent = 'Muted';
    promptInput.placeholder = 'Type or speak, then press Enter or click Send...';
    setPill('✶', 'FahOS Ready', '●', '#FFFFFF');
    micIconBtn.innerHTML = '<svg class="mic-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>';
  }
}

async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    // Prefer webm/opus for best compatibility; fallback to default
    var mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    mediaRecorder = mimeType
      ? new MediaRecorder(audioStream, { mimeType })
      : new MediaRecorder(audioStream);
    audioChunks = [];
    mediaRecorder.ondataavailable = function(evt) {
      if (evt.data && evt.data.size > 0) audioChunks.push(evt.data);
    };
    mediaRecorder.start(100); // collect chunks every 100ms for smooth audio
    console.log('[FahOS Voice] Recording started, mimeType:', mediaRecorder.mimeType);
  } catch (err) {
    console.error('[FahOS Mic]', err);
    setListeningState(false);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setPill('✕', 'Mic blocked — allow access', '✕', '#F87171');
    } else if (err.name === 'NotFoundError') {
      setPill('✕', 'No microphone found', '✕', '#F87171');
    } else {
      setPill('✕', 'Mic error: ' + err.name, '✕', '#A1A1AA');
    }
    setTimeout(function() { setPill('✶', 'FahOS Ready', '●', '#FFFFFF'); }, 2500);
  }
}

function encodeWav(samples, sampleRate) {
  var buffer = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  var offset = 44;
  for (var i = 0; i < samples.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Uint8Array(buffer);
}

async function resampleTo16kMono(audioBuffer) {
  var targetSampleRate = 16000;
  var numChannels = audioBuffer.numberOfChannels;
  var originalSampleRate = audioBuffer.sampleRate;

  var monoSamples;
  if (numChannels === 1) {
    monoSamples = audioBuffer.getChannelData(0);
  } else {
    var len = audioBuffer.length;
    monoSamples = new Float32Array(len);
    for (var c = 0; c < numChannels; c++) {
      var chData = audioBuffer.getChannelData(c);
      for (var i = 0; i < len; i++) {
        monoSamples[i] += chData[i] / numChannels;
      }
    }
  }

  if (originalSampleRate === targetSampleRate) {
    return monoSamples;
  }

  try {
    var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OfflineCtx) {
      var targetLength = Math.max(1, Math.round(audioBuffer.duration * targetSampleRate));
      var offlineCtx = new OfflineCtx(1, targetLength, targetSampleRate);
      var source = offlineCtx.createBufferSource();
      var monoAudioBuf = offlineCtx.createBuffer(1, monoSamples.length, originalSampleRate);
      monoAudioBuf.getChannelData(0).set(monoSamples);
      source.buffer = monoAudioBuf;
      source.connect(offlineCtx.destination);
      source.start(0);
      var rendered = await offlineCtx.startRendering();
      return rendered.getChannelData(0);
    }
  } catch (err) {
    console.warn('[FahOS Voice] OfflineAudioContext resampling notice:', err);
  }

  // Linear interpolation fallback
  var ratio = originalSampleRate / targetSampleRate;
  var newLength = Math.max(1, Math.round(monoSamples.length / ratio));
  var resampled = new Float32Array(newLength);
  for (var j = 0; j < newLength; j++) {
    var origin = j * ratio;
    var index = Math.floor(origin);
    var decimal = origin - index;
    var nextIndex = Math.min(index + 1, monoSamples.length - 1);
    resampled[j] = monoSamples[index] * (1 - decimal) + monoSamples[nextIndex] * decimal;
  }
  return resampled;
}

async function stopRecordingAndTranscribe() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return null;
  return new Promise(function(resolve) {
    mediaRecorder.onstop = async function() {
      // Release mic
      if (audioStream) { audioStream.getTracks().forEach(function(t) { t.stop(); }); audioStream = null; }
      var audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];

      if (audioBlob.size < 300) {
        setPill('✶', 'Too short — speak longer', '●', '#F59E0B');
        setTimeout(function() { setPill('✶', 'FahOS Ready', '●', '#FFFFFF'); }, 1800);
        resolve(null);
        return;
      }

      setPill('🎤', 'Transcribing...', '●', '#FFFFFF');
      try {
        var rawArrayBuffer = await audioBlob.arrayBuffer();
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var decoded = await audioCtx.decodeAudioData(rawArrayBuffer);
        var samples = await resampleTo16kMono(decoded);
        var wavBytes = encodeWav(samples, 16000);
        audioCtx.close().catch(function() {});

        if (window.fahos && window.fahos.transcribeAudio) {
          var res = await window.fahos.transcribeAudio({
            wav: wavBytes,
            float32: samples
          });
          if (res && res.ok && res.text && res.text.trim()) {
            var cur = promptInput.value.trim();
            var transcribed = res.text.trim();
            promptInput.value = cur ? (cur + ' ' + transcribed) : transcribed;
            setPill('✶', '"' + transcribed.slice(0, 40) + '"', '●', '#FFFFFF');
            resolve(transcribed);
          } else {
            setPill('✶', 'No speech detected — try again', '●', '#A1A1AA');
            setTimeout(function() { setPill('✶', 'FahOS Ready', '●', '#FFFFFF'); }, 2000);
            resolve(null);
          }
        } else {
          setPill('✕', 'Voice not available', '✕', '#A1A1AA');
          resolve(null);
        }
      } catch (err) {
        console.error('[FahOS Voice] Transcription error:', err);
        setPill('✕', 'Transcription failed', '✕', '#F87171');
        setTimeout(function() { setPill('✶', 'FahOS Ready', '●', '#FFFFFF'); }, 2000);
        resolve(null);
      }
    };
    mediaRecorder.stop();
  });
}

async function handleMicClick() {
  if (isListening) {
    setListeningState(false);
    var transcribed = await stopRecordingAndTranscribe();
    // Do NOT auto-execute directly; populate input so user can review/edit and send via Enter or Send button
    if (transcribed && transcribed.trim()) {
      promptInput.focus();
      promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
      setPill('✶', 'Review & press Enter or click Send', '●', '#10B981');
    }
    return;
  }
  // Start recording
  setListeningState(true);
  promptInput.focus();
  await startRecording();
}

// resetToFreshState now safe to call switchView
function resetToFreshState() {
  currentAttachedImage = null;
  if (attachedImagePill) {
    attachedImagePill.classList.remove('visible');
    attachedImagePill.classList.add('hidden');
  }
  if (attachedThumbImg) attachedThumbImg.src = '';
  promptInput.placeholder = 'Type or speak, then press Enter or click Send...';
  promptInput.value = '';
  aiResponseText.innerHTML = '';
  aiResponseText.classList.add('hidden');
  setPill('✶', 'FahOS Ready', '●', '#FFFFFF');
  if (isListening) setListeningState(false);
  switchView('chat');
}

function triggerAppear() {
  widget.classList.remove('anim-exit'); widget.style.animation = 'none';
  void widget.offsetHeight;
  widget.style.animation = 'smoothPopIn 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards';
  resetToFreshState();
}

function dismissWithAnimation() {
  if (widget.classList.contains('anim-exit')) return;
  widget.classList.add('anim-exit');
  setTimeout(function() {
    if (window.fahos && window.fahos.hide) { window.fahos.hide(); widget.classList.remove('anim-exit'); resetToFreshState(); }
  }, 220);
}

if (window.fahos) {
  if (window.fahos.onAppear)      window.fahos.onAppear(triggerAppear);
  if (window.fahos.onPrepareHide) window.fahos.onPrepareHide(dismissWithAnimation);
  if (window.fahos.onFocusInput)  window.fahos.onFocusInput(resetToFreshState);
}

window.addEventListener('DOMContentLoaded', resetToFreshState);
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    dismissWithAnimation();
  } else if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
    e.preventDefault();
    dismissWithAnimation();
  }
});

promptInput.addEventListener('input', function() {
  var v = promptInput.value.trim();
  setPill(v ? '🎤' : '✶', v ? ('"' + v.slice(-32) + '"') : 'FahOS Ready', '●', '#FFFFFF');
});
promptInput.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
    e.preventDefault();
    dismissWithAnimation();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    executePrompt();
  }
});
if (sendBtn) {
  sendBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    executePrompt();
  });
}
closeBtn.addEventListener('click', function(e) { e.stopPropagation(); dismissWithAnimation(); });
function toggleDropletMenu(forceState) {
  if (!dropletMenuWrapper) return;
  var isOpen = typeof forceState === 'boolean' ? forceState : !dropletMenuWrapper.classList.contains('open');
  if (isOpen) {
    dropletMenuWrapper.classList.add('open');
    if (dropletTriggerBtn) dropletTriggerBtn.classList.add('open');
  } else {
    dropletMenuWrapper.classList.remove('open');
    if (dropletTriggerBtn) dropletTriggerBtn.classList.remove('open');
  }
}

if (dropletTriggerBtn) {
  dropletTriggerBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleDropletMenu();
  });
}

document.addEventListener('click', function(e) {
  if (dropletMenuWrapper && dropletMenuWrapper.classList.contains('open')) {
    if (!e.target.closest('#dropletMenuWrapper')) {
      toggleDropletMenu(false);
    }
  }
});

micIconBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleDropletMenu(false); handleMicClick(); });
micBtn.addEventListener('click', function(e) { e.stopPropagation(); handleMicClick(); });

if (snipBtn) {
  snipBtn.addEventListener('click', async function(e) {
    e.stopPropagation();
    toggleDropletMenu(false);
    if (window.fahos && window.fahos.startSnipper) {
      setPill('✂', 'Drag to select screen region...', '•••', '#34D399');
      await window.fahos.startSnipper();
    }
  });
}

if (removeImageBtn) {
  removeImageBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    currentAttachedImage = null;
    if (attachedImagePill) {
      attachedImagePill.classList.remove('visible');
      attachedImagePill.classList.add('hidden');
    }
    if (attachedThumbImg) attachedThumbImg.src = '';
    promptInput.placeholder = 'Type or speak, then press Enter or click Send...';
    setPill('✦', 'FahOS Voice Assistant Ready', '●', '#10B981');
  });
}

if (window.fahos && window.fahos.onImageSnipped) {
  window.fahos.onImageSnipped(function(data) {
    if (data && data.image) {
      currentAttachedImage = data.image;
      if (attachedThumbImg) attachedThumbImg.src = 'data:image/jpeg;base64,' + data.image;
      if (attachedImagePill) {
        attachedImagePill.classList.remove('hidden');
        attachedImagePill.classList.add('visible');
      }
      promptInput.placeholder = 'Ask a question about this snip, or press Enter/Send...';
      promptInput.focus();
      setPill('✂', 'Region attached — add prompt & press Send', '✓', '#34D399');
    }
  });
}

function showThinkingAnimation(subtitle) {
  aiResponseText.innerHTML = '<div class="thinking-card"><div class="thinking-spinner"><span></span><span></span><span></span></div><div class="thinking-title">✦ FahOS is thinking...</div><div class="thinking-subtitle">' + (subtitle || 'Analyzing and preparing a simple, human-friendly explanation') + '</div></div>';
  aiResponseText.classList.remove('hidden');
}

async function executePrompt() {
  var text = promptInput.value.trim();
  if (!text && !currentAttachedImage) return;
  if (isListening) handleMicClick();

  // 1. Multimodal Vision Analysis on attached screen snip
  if (currentAttachedImage) {
    setPill('⚡', 'Analyzing screen snip with Gemini Vision...', '•••', '#34D399');
    const imgToAnalyze = currentAttachedImage;
    currentAttachedImage = null;
    if (attachedImagePill) {
      attachedImagePill.classList.remove('visible');
      attachedImagePill.classList.add('hidden');
    }
    if (attachedThumbImg) attachedThumbImg.src = '';
    promptInput.placeholder = 'Type or speak, then press Enter or click Send...';
    promptInput.value = '';

    // Immediately remove previous output and show thinking animation
    showThinkingAnimation('Analyzing your screen snip in simple terms...');

    try {
      const res = await window.fahos.analyzeAttachedImage({
        image: imgToAnalyze,
        prompt: text
      });
      if (res && res.ok && res.output) {
        const thumbHtml = '<div style="margin-bottom: 10px;"><img src="data:image/jpeg;base64,' + imgToAnalyze + '" style="max-width: 100%; max-height: 160px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.18); display: block;" /></div>';
        const renderedAns = window.renderMarkdown ? window.renderMarkdown(res.output) : res.output;
        aiResponseText.innerHTML = thumbHtml + renderedAns;
        aiResponseText.scrollTop = 0;
        aiResponseText.classList.remove('hidden');
        setPill('✓', 'Vision Analysis Complete', '✓', '#34D399');
        if (window.fahos && window.fahos.addHistory) {
          window.fahos.addHistory({ query: text ? ('[Screen Snip] ' + text) : '[Screen Snip Analysis]', response: res.output }).catch(console.warn);
        }
      } else {
        const err = (res && res.error) || 'Failed to analyze snipped image.';
        const formattedErr = window.renderMarkdown ? window.renderMarkdown(err) : err;
        aiResponseText.innerHTML = '<div class="ai-p" style="color:#FCA5A5">' + formattedErr + '</div>';
        aiResponseText.classList.remove('hidden');
        setPill('✕', 'Analysis Error', '✕', '#FCA5A5');
      }
    } catch (err) {
      aiResponseText.innerHTML = '<p class="ai-p" style="color:#F87171">' + (err.message || String(err)) + '</p>';
      aiResponseText.classList.remove('hidden');
      setPill('✕', 'Error', '✕', '#F87171');
    }
    return;
  }

  if (/^(?:start\s+|open\s+)?(?:snip(?:per)?|select\s+region|screen\s+snip|snip\s+screen|crop\s+screen)(?:\s+and\s+explain)?$/i.test(text)) {
    if (window.fahos && window.fahos.startSnipper) {
      setPill('✂', 'Drag to select screen region...', '•••', '#34D399');
      promptInput.value = '';
      await window.fahos.startSnipper();
    }
    return;
  }

  if (/^(?:open\s+)?(?:fahos\s+)?phonebook$/i.test(text) || /^contacts$/i.test(text)) {
    switchView('phonebook'); setPill('📖', 'FahOS Phonebook', '●', '#10B981'); promptInput.value = ''; return;
  }
  if (/^(?:open\s+|show\s+)?history$/i.test(text)) {
    switchView('history'); setPill('⏱', 'Total History', '●', '#FFFFFF'); promptInput.value = ''; return;
  }

  setPill('⚡', 'Classifying intent & model tier...', '•••', '#FFFFFF');
  showThinkingAnimation('Classifying intent & selecting optimal model tier...');

  try {
    var res = await window.fahos.runAction({ action: 'ask', text });

    if (res && res.ok) {
      if (res.requiresConfirmation) {
        
        // Render Visual Security Modal
        const securityModal = $('securityModal');
        const securityItemBox = $('securityItemBox');
        const securityCancelBtn = $('securityCancelBtn');
        const securityConfirmBtn = $('securityConfirmBtn');

        if (securityModal && securityItemBox && securityCancelBtn && securityConfirmBtn) {
          securityItemBox.textContent = res.itemName || text;
          securityModal.classList.remove('hidden');

          securityCancelBtn.onclick = () => {
            securityModal.classList.add('hidden');
            aiResponseText.innerHTML = '<div class="action-done-card"><div class="action-done-desc">🛑 Security Guard: Action cancelled safely. No files were modified.</div></div>';
            setPill('✓', 'Action Cancelled Safely', '●', '#A1A1AA');
          };

          securityConfirmBtn.onclick = async () => {
            securityModal.classList.add('hidden');
            setPill('⚡', 'Executing deletion...', '•••', '#EF4444');
            var cRes = await window.fahos.runAction({ action: 'ask', text: 'confirm ' + text });
            if (cRes && cRes.ok) {
              aiResponseText.innerHTML = '<div class="action-done-card"><div class="action-done-header"><span class="action-done-badge">WINDOWS AGENT</span><span class="action-done-status">EXECUTED</span></div><div class="action-done-desc">' + (window.renderMarkdown ? window.renderMarkdown(cRes.output) : cRes.output) + '</div></div>';
              setPill('✓', 'Deleted Successfully', '✓', '#4ADE80');
            }
          };
        }

        var cardHtml = '<div class="action-done-card" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08);">' +
          '<div class="action-done-header"><span class="action-done-badge" style="background: rgba(239, 68, 68, 0.25); color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.4);">SECURITY GUARD • CONFIRMATION REQUIRED</span><span class="action-done-status" style="color: #F87171;">PENDING APPROVAL</span></div>' +
          '<div class="action-done-desc">' + (window.renderMarkdown ? window.renderMarkdown(res.output) : res.output) + '</div>' +
          '</div>';
        aiResponseText.innerHTML = cardHtml;
        setPill('⚠️', 'Security Confirmation Required', '!', '#F87171');
      } else if (res.isAction) {
        var providerBadge = res.provider || 'WINDOWS AGENT';
        var isBrowserAgent = /browser/i.test(providerBadge);
        var badgeStyle = isBrowserAgent ? 'background: rgba(59, 130, 246, 0.2); color: #93C5FD; border: 1px solid rgba(59, 130, 246, 0.4);' : '';
        var statusColor = isBrowserAgent ? '#60A5FA' : '#4ADE80';
        var pillIcon = isBrowserAgent ? '🌐' : '⚡';
        var pillLabel = isBrowserAgent ? 'Browser task finished' : 'Action executed';
        var pillColor = isBrowserAgent ? '#60A5FA' : '#4ADE80';

        aiResponseText.innerHTML = '<div class="action-done-card"><div class="action-done-header"><span class="action-done-badge" style="' + badgeStyle + '">' + providerBadge.toUpperCase() + '</span><span class="action-done-status" style="color: ' + statusColor + ';">EXECUTED</span></div><div class="action-done-desc">' + (window.renderMarkdown ? window.renderMarkdown(res.output) : res.output) + '</div>' + (res.command ? '<div class="action-done-cmd"><code>' + res.command + '</code></div>' : '') + '</div>';
        setPill(pillIcon, pillLabel, '✓', pillColor);
      } else {
        aiResponseText.innerHTML = window.renderMarkdown ? window.renderMarkdown(res.output) : (res.output || '');
        setPill('✓', 'Done', '✓', '#FFFFFF');
      }
      aiResponseText.scrollTop = 0; aiResponseText.classList.remove('hidden');
      if (window.fahos && window.fahos.addHistory) window.fahos.addHistory({ query: text, response: res.output }).catch(console.warn);
    } else {
      var errMsg = (res && (res.error || res.output)) || 'Failed.';
      var formattedErr = window.renderMarkdown ? window.renderMarkdown(errMsg) : errMsg;
      if (res && res.notFound) {
        aiResponseText.innerHTML = '<div class="action-done-card" style="border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.06);"><div class="action-done-header"><span class="action-done-badge" style="background: rgba(245, 158, 11, 0.2); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3);">NOT FOUND</span><span class="action-done-status" style="color: #FBBF24;">LOOKUP FAILED</span></div><div class="action-done-desc">' + formattedErr + '</div></div>';
        setPill('ℹ️', 'Not Found', '●', '#FBBF24');
      } else {
        aiResponseText.innerHTML = '<div class="ai-p" style="color:#FCA5A5">' + formattedErr + '</div>';
        setPill('✕', 'Notice', '✕', '#FCA5A5');
      }
      aiResponseText.scrollTop = 0; aiResponseText.classList.remove('hidden');
    }
  } catch (err) {
    aiResponseText.innerHTML = '<p class="ai-p" style="color:#F87171">' + (err.message || String(err)) + '</p>';
    aiResponseText.classList.remove('hidden'); setPill('✕', 'Error', '✕', '#A1A1AA');
  }
}

// Open FahOS Browser Window Button Listener (Allows login to Google, GitHub, etc.)
if (openBrowserBtn) {
  openBrowserBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (window.fahos && window.fahos.openBrowserWindow) {
      window.fahos.openBrowserWindow('https://www.google.com');
      setPill('🌐', 'Opening FahOS Browser (Sign In & Browse)...', '●', '#38bdf8');
      setTimeout(function() {
        setPill('✶', 'FahOS Ready', '●', '#FFFFFF');
      }, 2500);
    }
  });
}

// Reset Window Size Button Listener (resets to default 265px)
if (resetSizeBtn) {
  resetSizeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (window.fahos && window.fahos.setHeight) {
      window.fahos.setHeight(265);
      setPill('↺', 'Window size reset to default (265px)', '●', '#60A5FA');
      setTimeout(function() {
        setPill('✶', 'FahOS Ready', '●', '#FFFFFF');
      }, 1400);
    }
  });
}

// Bottom Resize Handle Dragging (allows dragging vertically down to any height)
if (bottomResizeHandle) {
  var isDraggingResize = false;
  var resizeStartY = 0;
  var resizeStartHeight = 265;

  bottomResizeHandle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingResize = true;
    resizeStartY = e.screenY;
    resizeStartHeight = window.outerHeight || window.innerHeight || 265;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', function(e) {
    if (!isDraggingResize) return;
    var deltaY = e.screenY - resizeStartY;
    var targetH = Math.max(200, Math.min(920, Math.round(resizeStartHeight + deltaY)));
    if (window.fahos && window.fahos.setHeight) {
      window.fahos.setHeight(targetH);
    }
  });

  window.addEventListener('mouseup', function() {
    if (isDraggingResize) {
      isDraggingResize = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

historyBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleDropletMenu(false); switchView(activeView === 'history' ? 'chat' : 'history'); });
historyBackBtn.addEventListener('click', function(e) { e.stopPropagation(); switchView('chat'); });
clearHistoryBtn.addEventListener('click', async function(e) {
  e.stopPropagation(); clearHistoryBtn.style.opacity = '0.5';
  if (window.fahos && window.fahos.clearHistory) { await window.fahos.clearHistory(); await renderHistory(); }
  clearHistoryBtn.style.opacity = '1';
});
if (phonebookBtn) phonebookBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleDropletMenu(false); switchView(activeView === 'phonebook' ? 'chat' : 'phonebook'); });
if (phonebookBackBtn) phonebookBackBtn.addEventListener('click', function(e) { e.stopPropagation(); switchView('chat'); });

async function handleAddContact() {
  var name = (contactNameInput.value || '').trim();
  var phone = (contactPhoneInput.value || '').trim();
  var email = (contactEmailInput.value || '').trim();
  if (!name || (!phone && !email)) {
    if (!name) {
      contactNameInput.style.outline = '1px solid #F87171';
      setTimeout(function() { contactNameInput.style.outline = ''; }, 1500);
      contactNameInput.focus();
    } else {
      contactPhoneInput.style.outline = '1px solid #F87171';
      contactEmailInput.style.outline = '1px solid #F87171';
      setTimeout(function() { contactPhoneInput.style.outline = ''; contactEmailInput.style.outline = ''; }, 1500);
      contactPhoneInput.focus();
    }
    return;
  }
  if (window.fahos && window.fahos.saveContact) {
    var orig = saveContactBtn.innerHTML;
    saveContactBtn.innerHTML = '<span>✓</span>';
    saveContactBtn.style.background = '#059669';
    await window.fahos.saveContact({ name: name, phone: phone, email: email });
    contactNameInput.value = '';
    contactPhoneInput.value = '';
    contactEmailInput.value = '';
    await renderPhonebook();
    setTimeout(function() { saveContactBtn.innerHTML = orig; saveContactBtn.style.background = ''; }, 800);
  }
}

if (saveContactBtn)    saveContactBtn.addEventListener('click', function(e) { e.stopPropagation(); handleAddContact(); });
if (contactNameInput)  contactNameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); contactPhoneInput.focus(); } });
if (contactPhoneInput) contactPhoneInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); contactEmailInput.focus(); } });
if (contactEmailInput) contactEmailInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); handleAddContact(); } });

// Smooth Window Dragging Listener (100% reliable window movement)
(function enableWindowDragging() {
  let isDraggingWindow = false;
  let startMouseX = 0;
  let startMouseY = 0;

  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, textarea, a, .ai-text, .ai-code-wrapper, .history-card, .contact-card, .phonebook-add-bar, .droplet-menu-wrapper, .bottom-resize-handle')) {
      return;
    }
    isDraggingWindow = true;
    startMouseX = e.screenX;
    startMouseY = e.screenY;
  }

  function onMouseMove(e) {
    if (!isDraggingWindow) return;
    const deltaX = e.screenX - startMouseX;
    const deltaY = e.screenY - startMouseY;
    if (deltaX === 0 && deltaY === 0) return;
    startMouseX = e.screenX;
    startMouseY = e.screenY;
    if (window.fahos && window.fahos.moveWindow) {
      window.fahos.moveWindow(deltaX, deltaY);
    }
  }

  function onMouseUp() {
    isDraggingWindow = false;
  }

  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
})();
