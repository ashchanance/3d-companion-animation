(function initHarukaContentScript() {
  if (window.__HARUKA_KINTARA_CONTENT_SCRIPT_READY__) {
    return;
  }

  window.__HARUKA_KINTARA_CONTENT_SCRIPT_READY__ = true;

  const state = {
    active: false,
    muted: false,
    captureIntervalSec: 12,
    intervalId: null,
    lastReply: '',
    runtimeOrigin: '',
    pendingSpeechText: ''
  };

  let overlay = null;
  let modelFrame = null;
  let replyNode = null;
  let metaNode = null;
  let statusNode = null;

  function ensureOverlay() {
    if (overlay) {
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'haruka-kintara-overlay';
    overlay.className = 'haruka-hidden';
    overlay.innerHTML = `
      <div class="haruka-model-shell">
        <iframe
          class="haruka-model-frame"
          title="HARUKA Companion Viewer"
          allow="autoplay"
          loading="eager"
          referrerpolicy="no-referrer"
        ></iframe>
        <div class="haruka-model-fallback">HARUKA model loading...</div>
      </div>
      <div class="haruka-head">
        <div>
          <div class="haruka-badge">HARUKA</div>
          <div class="haruka-status">Idle</div>
        </div>
      </div>
      <div class="haruka-body">
        <div class="haruka-reply">Waiting for Kintara context...</div>
        <div class="haruka-meta">Overlay ready.</div>
        <div class="haruka-actions">
          <button type="button" data-action="mute">Mute</button>
          <button type="button" class="secondary" data-action="hide">Hide</button>
        </div>
      </div>
    `;

    modelFrame = overlay.querySelector('.haruka-model-frame');
    replyNode = overlay.querySelector('.haruka-reply');
    metaNode = overlay.querySelector('.haruka-meta');
    statusNode = overlay.querySelector('.haruka-status');

    overlay.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.getAttribute('data-action');
      if (action === 'mute') {
        state.muted = !state.muted;
        target.textContent = state.muted ? 'Unmute' : 'Mute';
        if (state.muted) {
          state.pendingSpeechText = '';
          postToCompanionViewer('HARUKA_COMPANION_STOP');
          window.speechSynthesis?.cancel();
        }
      }

      if (action === 'hide') {
        stopSession(true);
      }
    });

    makeDraggable(overlay.querySelector('.haruka-head'));
    document.documentElement.appendChild(overlay);
  }

  function buildCompanionViewerUrl() {
    const base = String(state.runtimeOrigin || '').trim();
    if (!base) {
      return '';
    }

    try {
      const url = new URL(base);
      url.searchParams.set('embed', '1');
      url.searchParams.set('view', 'companion');
      url.searchParams.set('lang', 'en');
      return url.toString();
    } catch {
      return '';
    }
  }

  function syncModelViewer() {
    if (!overlay || !modelFrame) {
      return;
    }

    const fallbackNode = overlay.querySelector('.haruka-model-fallback');
    const viewerUrl = buildCompanionViewerUrl();
    if (!viewerUrl) {
      modelFrame.removeAttribute('src');
      if (fallbackNode) {
        fallbackNode.textContent = 'HARUKA model unavailable.';
      }
      return;
    }

    if (modelFrame.getAttribute('src') !== viewerUrl) {
      if (fallbackNode) {
        fallbackNode.textContent = 'HARUKA model loading...';
      }

      modelFrame.onload = () => {
        if (fallbackNode) {
          fallbackNode.textContent = '';
        }

        if (!state.muted && state.pendingSpeechText.trim()) {
          postToCompanionViewer('HARUKA_COMPANION_SPEAK', state.pendingSpeechText.trim());
          state.pendingSpeechText = '';
        }
      };

      modelFrame.src = viewerUrl;
    }
  }

  function postToCompanionViewer(type, text) {
    if (!modelFrame || !modelFrame.contentWindow) {
      return false;
    }

    const viewerUrl = buildCompanionViewerUrl();
    if (!viewerUrl) {
      return false;
    }

    try {
      const targetOrigin = new URL(viewerUrl).origin;
      modelFrame.contentWindow.postMessage(
        {
          source: 'haruka-kintara-extension',
          type,
          text: typeof text === 'string' ? text : ''
        },
        targetOrigin
      );
      return true;
    } catch {
      return false;
    }
  }

  function makeDraggable(handle) {
    if (!handle) {
      return;
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    handle.addEventListener('pointerdown', (event) => {
      if (!overlay) {
        return;
      }

      const rect = overlay.getBoundingClientRect();
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.right = 'auto';
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener('pointermove', (event) => {
      if (!dragging || !overlay) {
        return;
      }

      overlay.style.left = `${startLeft + event.clientX - startX}px`;
      overlay.style.top = `${startTop + event.clientY - startY}px`;
    });

    handle.addEventListener('pointerup', () => {
      dragging = false;
    });
  }

  function extractPageContext() {
    return {
      url: window.location.href,
      title: document.title,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 1500)
    };
  }

  async function processFrame() {
    if (!state.active) {
      return;
    }

    ensureOverlay();
    overlay.classList.remove('haruka-hidden');
    statusNode.textContent = 'Watching Kintara';

    const result = await chrome.runtime.sendMessage({
      type: 'PROCESS_FRAME',
      pageContext: extractPageContext()
    });

    if (!result) {
      return;
    }

    if (!result.ok && result.error) {
      replyNode.textContent = 'HARUKA runtime is unavailable right now.';
      metaNode.textContent = result.error;
      return;
    }

    if (!result.shouldSpeak) {
      metaNode.textContent = `Realm: ${result.gameContext?.realm || 'Unknown'} | Activity: ${result.gameContext?.activity || 'Unknown'}`;
      return;
    }

    if (typeof result.overlayReply === 'string' && result.overlayReply.trim()) {
      replyNode.textContent = result.overlayReply.trim();
      metaNode.textContent = `Realm: ${result.gameContext?.realm || 'Unknown'} | Danger: ${result.gameContext?.danger || 'Unknown'}`;

      if (!state.muted && result.overlayReply !== state.lastReply) {
        const nextSpeech = result.overlayReply.trim();
        state.pendingSpeechText = nextSpeech;
        const posted = postToCompanionViewer('HARUKA_COMPANION_SPEAK', nextSpeech);
        if (posted) {
          state.pendingSpeechText = '';
        }
      }

      state.lastReply = result.overlayReply;
    }
  }

  function startSession(captureIntervalSec) {
    ensureOverlay();
    state.active = true;
    state.captureIntervalSec = captureIntervalSec || 12;
    syncModelViewer();
    overlay.classList.remove('haruka-hidden');
    statusNode.textContent = 'Watching Kintara';

    if (state.intervalId) {
      window.clearInterval(state.intervalId);
    }

    state.intervalId = window.setInterval(() => {
      void processFrame();
    }, state.captureIntervalSec * 1000);

    void processFrame();
  }

  function stopSession(hiddenOnly) {
    state.active = false;
    state.pendingSpeechText = '';
    if (state.intervalId) {
      window.clearInterval(state.intervalId);
      state.intervalId = null;
    }

    if (overlay) {
      statusNode.textContent = 'Stopped';
      if (hiddenOnly) {
        overlay.classList.add('haruka-hidden');
      }
    }

    postToCompanionViewer('HARUKA_COMPANION_STOP');
    window.speechSynthesis?.cancel();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'HARUKA_PING') {
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'HARUKA_START_SESSION') {
      state.runtimeOrigin = typeof message.runtimeOrigin === 'string' ? message.runtimeOrigin : '';
      startSession(message.captureIntervalSec);
      sendResponse({ ok: true, active: true });
      return false;
    }

    if (message.type === 'HARUKA_STOP_SESSION') {
      stopSession(true);
      sendResponse({ ok: true, active: false });
      return false;
    }

    sendResponse({ ok: false, error: 'Unknown content-script message type.' });
    return false;
  });

  ensureOverlay();
})();
