const LOCAL_RUNTIME_ORIGIN = 'http://127.0.0.1:5000';
const DEFAULT_CAPTURE_INTERVAL = 10;
const BUNDLED_CONFIG_URL = chrome.runtime.getURL('runtime-config.json');
const sessions = new Map();

let bundledConfigPromise = null;

function isSupportedKintaraUrl(url) {
  try {
    const parsed = new URL(url);
    const haystack = `${parsed.hostname} ${parsed.pathname}`.toLowerCase();
    return haystack.includes('kintara');
  } catch {
    return false;
  }
}

function normalizeRuntimeOrigin(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return '';
  }
}

async function readBundledConfig() {
  if (!bundledConfigPromise) {
    bundledConfigPromise = fetch(BUNDLED_CONFIG_URL)
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }

  return bundledConfigPromise;
}

async function resolveDefaultSettings() {
  const bundledConfig = await readBundledConfig();
  const runtimeOrigin = normalizeRuntimeOrigin(bundledConfig.runtimeOrigin) || LOCAL_RUNTIME_ORIGIN;
  const captureIntervalSec = Math.max(
    6,
    Math.min(30, Number.parseInt(String(bundledConfig.captureIntervalSec || DEFAULT_CAPTURE_INTERVAL), 10) || DEFAULT_CAPTURE_INTERVAL)
  );

  return {
    runtimeOrigin,
    captureIntervalSec
  };
}

async function getSettings() {
  const defaults = await resolveDefaultSettings();
  return chrome.storage.local.get({
    runtimeOrigin: defaults.runtimeOrigin,
    captureIntervalSec: defaults.captureIntervalSec
  });
}

async function notifyTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

async function ensureContentScriptReady(tabId) {
  const pingResult = await notifyTab(tabId, { type: 'HARUKA_PING' });
  if (pingResult && pingResult.ok) {
    return true;
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content.css']
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });

  const secondPing = await notifyTab(tabId, { type: 'HARUKA_PING' });
  return Boolean(secondPing && secondPing.ok);
}

async function processFrameForTab(tabId, senderTab, pageContext, requestMode) {
  const session = sessions.get(tabId);
  if (!session || !session.active || !senderTab) {
    return { ok: false, shouldSpeak: false };
  }

  const imageDataUrl = await chrome.tabs.captureVisibleTab(senderTab.windowId, {
    format: 'jpeg',
    quality: 55
  });

  const response = await fetch(`${session.runtimeOrigin.replace(/\/$/, '')}/api/haruka/game-frame`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      selectedGame: 'kintara',
      sessionId: session.sessionId,
      requestMode: requestMode === 'what-now' ? 'what-now' : 'ambient',
      imageDataUrl,
      pageContext,
      language: 'en',
      profileId: session.profileId,
      engineMode: session.engineMode,
      providerId: 'openai-compatible'
    })
  });

  return response.json();
}

async function checkRuntime(runtimeOrigin) {
  try {
    const response = await fetch(`${String(runtimeOrigin || LOCAL_RUNTIME_ORIGIN).replace(/\/$/, '')}/api/haruka/health`);
    if (!response.ok) {
      return { ok: false };
    }

    const payload = await response.json().catch(() => ({}));
    return {
      ok: Boolean(payload && payload.ok),
      routeVersion: payload.routeVersion || null,
      deploymentEnv: payload.deploymentEnv || null
    };
  } catch {
    return { ok: false };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const defaults = await resolveDefaultSettings();
    const current = await chrome.storage.local.get(['runtimeOrigin', 'captureIntervalSec']);
    const nextState = {};

    if (!normalizeRuntimeOrigin(current.runtimeOrigin)) {
      nextState.runtimeOrigin = defaults.runtimeOrigin;
    }

    if (!Number.isFinite(Number(current.captureIntervalSec))) {
      nextState.captureIntervalSec = defaults.captureIntervalSec;
    }

    if (Object.keys(nextState).length > 0) {
      await chrome.storage.local.set(nextState);
    }
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  sessions.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }

  if (!isSupportedKintaraUrl(changeInfo.url)) {
    const session = sessions.get(tabId);
    if (session && session.manualOverride) {
      return;
    }
    sessions.delete(tabId);
    void notifyTab(tabId, { type: 'HARUKA_STOP_SESSION' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    switch (message.type) {
      case 'GET_STATUS': {
        const session = sessions.get(message.tabId);
        sendResponse({
          supported: isSupportedKintaraUrl(message.url || ''),
          active: Boolean(session && session.active)
        });
        return;
      }
      case 'SAVE_SETTINGS': {
        sendResponse({ ok: true });
        return;
      }
      case 'CHECK_RUNTIME': {
        const result = await checkRuntime(message.runtimeOrigin);
        sendResponse(result);
        return;
      }
      case 'START_SESSION': {
        const settings = await getSettings();
        const defaults = await resolveDefaultSettings();
        const runtimeOrigin = normalizeRuntimeOrigin(message.runtimeOrigin || settings.runtimeOrigin || defaults.runtimeOrigin) || defaults.runtimeOrigin;
        const captureIntervalSec = Math.max(
          6,
          Math.min(30, Number.parseInt(String(message.captureIntervalSec || settings.captureIntervalSec || defaults.captureIntervalSec), 10))
        );

        sessions.set(message.tabId, {
          active: true,
          tabId: message.tabId,
          runtimeOrigin,
          captureIntervalSec,
          engineMode: 'direct',
          profileId: 'classic',
          sessionId: `kintara-${message.tabId}-${Date.now()}`,
          manualOverride: true
        });

        const contentScriptReady = await ensureContentScriptReady(message.tabId).catch(() => false);
        if (!contentScriptReady) {
          sessions.delete(message.tabId);
          sendResponse({
            ok: false,
            error: 'Unable to inject HARUKA overlay into this tab. Reload the page once, then try again.'
          });
          return;
        }

        const startResult = await notifyTab(message.tabId, {
          type: 'HARUKA_START_SESSION',
          captureIntervalSec,
          runtimeOrigin
        });

        if (startResult === null) {
          sessions.delete(message.tabId);
          sendResponse({
            ok: false,
            error: 'HARUKA overlay did not respond in this tab. Reload the page once, then try again.'
          });
          return;
        }

        sendResponse({ ok: true });
        return;
      }
      case 'STOP_SESSION': {
        sessions.delete(message.tabId);
        await notifyTab(message.tabId, { type: 'HARUKA_STOP_SESSION' });
        sendResponse({ ok: true });
        return;
      }
      case 'PROCESS_FRAME': {
        if (!sender.tab || !sender.tab.id) {
          sendResponse({ ok: false, shouldSpeak: false, error: 'Missing sender tab.' });
          return;
        }

        const result = await processFrameForTab(
          sender.tab.id,
          sender.tab,
          message.pageContext || {},
          message.requestMode || 'ambient'
        ).catch((error) => ({
          ok: false,
          shouldSpeak: false,
          error: error instanceof Error ? error.message : String(error)
        }));

        sendResponse(result);
        return;
      }
      default: {
        sendResponse({ ok: false, error: 'Unknown message type.' });
      }
    }
  })();

  return true;
});
