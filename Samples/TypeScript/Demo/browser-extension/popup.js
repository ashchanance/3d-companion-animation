const LOCAL_RUNTIME_ORIGIN = 'http://127.0.0.1:5000';
const DEFAULT_CAPTURE_INTERVAL = 10;
const BUNDLED_CONFIG_URL = chrome.runtime.getURL('runtime-config.json');

let bundledConfigPromise = null;

function normalizeRuntimeOrigin(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return '';
  }
}

function isLocalRuntimeOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function validateRuntimeOrigin(origin) {
  const normalized = normalizeRuntimeOrigin(origin);
  if (!normalized) {
    return {
      ok: false,
      message: 'Runtime origin must be a full URL such as http://127.0.0.1:5000 or https://haruka.example.com.'
    };
  }

  try {
    const parsed = new URL(normalized);
    const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    if (!local && parsed.protocol !== 'https:') {
      return {
        ok: false,
        message: 'Public beta runtime should use https so Chrome and Edge treat it as a trusted remote origin.'
      };
    }
  } catch {
    return {
      ok: false,
      message: 'Runtime origin is not a valid URL.'
    };
  }

  return {
    ok: true,
    normalized,
    message: isLocalRuntimeOrigin(normalized)
      ? 'Local development runtime detected.'
      : 'Public beta runtime detected.'
  };
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
    captureIntervalSec,
    betaLabel: String(bundledConfig.betaLabel || '').trim(),
    betaNote: String(bundledConfig.betaNote || '').trim()
  };
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function getSettings() {
  const defaults = await resolveDefaultSettings();
  return chrome.storage.local.get({
    runtimeOrigin: defaults.runtimeOrigin,
    captureIntervalSec: defaults.captureIntervalSec
  });
}

function setSaveFeedback(message, variant) {
  const node = document.getElementById('save-feedback');
  node.textContent = message;
  node.className = 'field-note';
  if (variant === 'error') {
    node.classList.add('is-error');
  }
  if (variant === 'success') {
    node.classList.add('is-success');
  }
}

function renderBetaBanner(defaults) {
  const betaStatus = document.getElementById('beta-status');
  const betaNote = document.getElementById('beta-note');

  if (isLocalRuntimeOrigin(defaults.runtimeOrigin)) {
    betaStatus.textContent = defaults.betaLabel || 'Local Development Mode';
    betaNote.textContent = defaults.betaNote || 'Edit runtime-config.json with your public runtime URL before sharing this unpacked extension.';
    return;
  }

  betaStatus.textContent = defaults.betaLabel || 'Bundled Public Beta Runtime Ready';
  betaNote.textContent = defaults.betaNote || `Friends can load this extension and it will default to ${defaults.runtimeOrigin}.`;
}

function renderRuntimeDetails(runtimeHealth, runtimeOrigin) {
  const runtimeDetails = document.getElementById('runtime-details');
  if (!runtimeHealth || !runtimeHealth.ok) {
    runtimeDetails.textContent = isLocalRuntimeOrigin(runtimeOrigin)
      ? 'Local runtime unreachable. Start the HARUKA app first.'
      : 'Public runtime unreachable. Check deployment URL or CORS/health route.';
    return;
  }

  runtimeDetails.textContent = `Route version: ${runtimeHealth.routeVersion || 'unknown'} | ${isLocalRuntimeOrigin(runtimeOrigin) ? 'Local runtime' : 'Public runtime'}`;
}

async function refreshStatus() {
  const tab = await getCurrentTab();
  const defaults = await resolveDefaultSettings();
  const settings = await getSettings();
  const runtimeOrigin = normalizeRuntimeOrigin(settings.runtimeOrigin) || defaults.runtimeOrigin;

  renderBetaBanner(defaults);
  document.getElementById('runtime-origin').value = runtimeOrigin;
  document.getElementById('capture-interval').value = String(settings.captureIntervalSec);

  const tabStatus = document.getElementById('tab-status');
  const sessionStatus = document.getElementById('session-status');
  const runtimeStatus = document.getElementById('runtime-status');

  const runtimeHealth = await chrome.runtime.sendMessage({
    type: 'CHECK_RUNTIME',
    runtimeOrigin
  });
  runtimeStatus.textContent = runtimeHealth.ok ? 'Connected' : 'Unavailable';
  renderRuntimeDetails(runtimeHealth, runtimeOrigin);

  if (!tab || !tab.id) {
    tabStatus.textContent = 'No active tab';
    sessionStatus.textContent = 'Inactive';
    return;
  }

  const status = await chrome.runtime.sendMessage({
    type: 'GET_STATUS',
    tabId: tab.id,
    url: tab.url || ''
  });

  tabStatus.textContent = status.supported ? 'Kintara detected' : 'Manual beta mode';
  sessionStatus.textContent = status.active ? 'Active' : 'Inactive';
}

async function saveSettings() {
  const defaults = await resolveDefaultSettings();
  const validation = validateRuntimeOrigin(document.getElementById('runtime-origin').value.trim() || defaults.runtimeOrigin);
  if (!validation.ok) {
    setSaveFeedback(validation.message, 'error');
    return;
  }

  const captureIntervalSec = Math.max(
    6,
    Math.min(30, Number.parseInt(document.getElementById('capture-interval').value || String(DEFAULT_CAPTURE_INTERVAL), 10))
  );

  await chrome.storage.local.set({
    runtimeOrigin: validation.normalized,
    captureIntervalSec
  });

  await chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    runtimeOrigin: validation.normalized,
    captureIntervalSec
  });

  setSaveFeedback(validation.message, 'success');
  await refreshStatus();
}

async function resetToBundledDefaults() {
  const defaults = await resolveDefaultSettings();
  await chrome.storage.local.set({
    runtimeOrigin: defaults.runtimeOrigin,
    captureIntervalSec: defaults.captureIntervalSec
  });

  setSaveFeedback('Settings reset to bundled defaults.', 'success');
  await refreshStatus();
}

async function startSession() {
  const tab = await getCurrentTab();
  if (!tab || !tab.id) {
    return;
  }

  const settings = await getSettings();
  const result = await chrome.runtime.sendMessage({
    type: 'START_SESSION',
    tabId: tab.id,
    url: tab.url || '',
    runtimeOrigin: settings.runtimeOrigin,
    captureIntervalSec: settings.captureIntervalSec
  });

  if (!result || !result.ok) {
    setSaveFeedback(result && result.error ? result.error : 'Unable to start HARUKA in this tab.', 'error');
    return;
  }

  setSaveFeedback('HARUKA companion started for this tab.', 'success');
  await refreshStatus();
}

async function stopSession() {
  const tab = await getCurrentTab();
  if (!tab || !tab.id) {
    return;
  }

  await chrome.runtime.sendMessage({
    type: 'STOP_SESSION',
    tabId: tab.id
  });

  await refreshStatus();
}

async function openRuntime() {
  const settings = await getSettings();
  await chrome.tabs.create({ url: settings.runtimeOrigin });
}

document.getElementById('save-settings').addEventListener('click', () => {
  void saveSettings();
});

document.getElementById('reset-beta-defaults').addEventListener('click', () => {
  void resetToBundledDefaults();
});

document.getElementById('start-session').addEventListener('click', () => {
  void startSession();
});

document.getElementById('stop-session').addEventListener('click', () => {
  void stopSession();
});

document.getElementById('open-runtime').addEventListener('click', () => {
  void openRuntime();
});

void refreshStatus();
