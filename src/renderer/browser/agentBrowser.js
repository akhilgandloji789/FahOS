/**
 * FahOS Unified Browser Renderer Controller
 * Handles navigation controls, step progress, real-time extraction reporting, and stop controls.
 */
const webview = document.getElementById('agent-webview');
const goalText = document.getElementById('goal-text');
const statusBadge = document.getElementById('status-badge');
const pulseLed = document.getElementById('pulse-led');
const stepsContainer = document.getElementById('steps-container');
const resultLabel = document.getElementById('result-label');
const resultText = document.getElementById('result-text');
const btnStop = document.getElementById('btn-stop');
const btnClose = document.getElementById('btn-close');
const urlInput = document.getElementById('url-input');
const navBack = document.getElementById('nav-back');
const navForward = document.getElementById('nav-forward');
const navRefresh = document.getElementById('nav-refresh');

// Navigation Controls
navBack.addEventListener('click', () => { if (webview.canGoBack()) webview.goBack(); });
navForward.addEventListener('click', () => { if (webview.canGoForward()) webview.goForward(); });
navRefresh.addEventListener('click', () => webview.reload());

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    let val = urlInput.value.trim();
    if (!val) return;
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      if (val.includes('.') && !val.includes(' ')) {
        val = 'https://' + val;
      } else {
        val = 'https://www.google.com/search?q=' + encodeURIComponent(val);
      }
    }
    webview.src = val;
  }
});

webview.addEventListener('did-navigate', (e) => {
  urlInput.value = e.url;
});
webview.addEventListener('did-navigate-in-page', (e) => {
  urlInput.value = e.url;
});

btnStop.addEventListener('click', () => {
  if (window.fahosAgent && window.fahosAgent.stopTask) {
    window.fahosAgent.stopTask();
  }
  statusBadge.textContent = 'STOPPED';
  statusBadge.style.color = '#ef4444';
  pulseLed.style.background = '#ef4444';
  pulseLed.style.boxShadow = '0 0 10px #ef4444';
  pulseLed.style.animation = 'none';
});

btnClose.addEventListener('click', () => {
  if (window.fahosAgent && window.fahosAgent.closeWindow) {
    window.fahosAgent.closeWindow();
  } else {
    window.close();
  }
});

function initAgentBridge() {
  if (!window.fahosAgent) {
    setTimeout(initAgentBridge, 100);
    return;
  }

  // Listen for task initialization
  window.fahosAgent.onTaskInit((data) => {
    goalText.textContent = data.task || 'Autonomous Browser Task';
    statusBadge.textContent = 'RUNNING';
    statusBadge.style.color = '#38bdf8';
    pulseLed.style.background = '#10b981';
    stepsContainer.innerHTML = '';
    addStepPill('1. Initializing Browser Session...', 'active');
    if (data.initialUrl) {
      webview.src = data.initialUrl;
      urlInput.value = data.initialUrl;
    }
  });

  // Listen for real-time step updates
  window.fahosAgent.onStepUpdate((data) => {
    statusBadge.textContent = `STEP ${data.stepIndex}`;
    resultText.textContent = data.description || 'Executing autonomous action...';

    const pills = stepsContainer.querySelectorAll('.step-pill');
    pills.forEach(p => {
      p.classList.remove('active');
      p.classList.add('completed');
    });

    addStepPill(data.description, 'active');

    if (data.url && webview.src !== data.url) {
      webview.src = data.url;
      urlInput.value = data.url;
    }
  });

  // Listen for task completion & final extracted result
  window.fahosAgent.onResultUpdate((data) => {
    if (data.ok) {
      statusBadge.textContent = 'COMPLETED';
      statusBadge.style.color = '#34d399';
      pulseLed.style.background = '#34d399';
      pulseLed.style.animation = 'none';

      resultLabel.textContent = 'EXTRACTED RESULT';
      resultText.textContent = data.summary || 'Task completed successfully.';

      const pills = stepsContainer.querySelectorAll('.step-pill');
      pills.forEach(p => {
        p.classList.remove('active');
        p.classList.add('completed');
      });
      addStepPill('✓ Task Complete', 'completed');
    } else {
      statusBadge.textContent = 'FAILED';
      statusBadge.style.color = '#ef4444';
      pulseLed.style.background = '#ef4444';
      pulseLed.style.animation = 'none';
      resultLabel.textContent = 'ERROR';
      resultText.textContent = data.summary || data.error || 'Could not complete task.';
    }
  });
}

initAgentBridge();

function addStepPill(text, statusClass) {
  if (stepsContainer.children.length > 0) {
    const arrow = document.createElement('span');
    arrow.className = 'step-arrow';
    arrow.textContent = '➔';
    stepsContainer.appendChild(arrow);
  }
  const pill = document.createElement('div');
  pill.className = `step-pill ${statusClass}`;
  pill.textContent = text;
  stepsContainer.appendChild(pill);
  stepsContainer.scrollLeft = stepsContainer.scrollWidth;
}
