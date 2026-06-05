import type { HarukaEngineMode } from './harukaChatContract';
import { defaultHarukaSettings, type FactItem, type HarukaSettings } from './harukaSettingsSchema';
import { HARUKA_SOUL_PROFILES, getHarukaSoulProfile } from './harukaSoulProfiles';

export interface RelayActivity {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  type: string;
  title: string;
  detail: string;
  username?: string;
  message?: string;
}

export interface RelayBridgeState {
  available: boolean;
  running: boolean;
  pumpConnected: boolean;
  harukaConnected: boolean;
  queueLength: number;
  forwardedCount: number;
  droppedCount: number;
  lastError: string | null;
  activeTokenAddress: string;
  lastForwardedAt: string | null;
  recentActivities: RelayActivity[];
}

type Listener = (settings: HarukaSettings) => void;

const STORAGE_KEY = 'haruka.settings.v3';

function mergeSettings(raw: Partial<HarukaSettings>): HarukaSettings {
  return {
    ...defaultHarukaSettings,
    ...raw,
    facts: Array.isArray(raw.facts) ? raw.facts : defaultHarukaSettings.facts
  };
}

export class HarukaSettingsManager {
  private settings: HarukaSettings;
  private listeners = new Set<Listener>();
  private importInput: HTMLInputElement | null = null;
  private relayState: RelayBridgeState | null = null;
  private bridgeAvailable = false;
  private bridgeBusy = false;

  constructor() {
    this.settings = this.readStoredSettings();
    this.injectRelayUI();
    this.injectProviderEngineUi();
    this.bindModalControls();
    this.bindSettingsControls();
    this.applySettingsToDom();
    this.renderFacts();
  }

  public getSettings(): HarukaSettings {
    return this.settings;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public showToast(title: string, desc: string): void {
    const toast = document.getElementById('settings-toast');
    const titleNode = toast?.querySelector('.toast-title');
    const descNode = toast?.querySelector('.toast-desc');

    if (!toast || !titleNode || !descNode) {
      return;
    }

    titleNode.textContent = title;
    descNode.textContent = desc;
    toast.classList.add('active');
    window.setTimeout(() => {
      toast.classList.remove('active');
    }, 3000);
  }

  public closeModal(): void {
    document.getElementById('settings-modal')?.classList.remove('active');
  }

  public updateRelayState(state: RelayBridgeState, bridgeAvailable: boolean, bridgeBusy: boolean): void {
    this.relayState = state;
    this.bridgeAvailable = bridgeAvailable;
    this.bridgeBusy = bridgeBusy;
    this.renderRelayConsole();
    this.renderRelayPanel();
  }

  private readStoredSettings(): HarukaSettings {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultHarukaSettings;
      }
      return mergeSettings(JSON.parse(raw) as Partial<HarukaSettings>);
    } catch {
      return defaultHarukaSettings;
    }
  }

  private persistSettings(): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.listeners.forEach((listener) => listener(this.settings));
  }

  private bindModalControls(): void {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const saveBtn = document.getElementById('btn-settings-save');
    const resetBtn = document.getElementById('btn-settings-reset');

    settingsBtn?.addEventListener('click', () => {
      settingsModal?.classList.add('active');
    });

    settingsCloseBtn?.addEventListener('click', () => {
      this.closeModal();
    });

    settingsModal?.addEventListener('click', (event) => {
      if (event.target === settingsModal) {
        this.closeModal();
      }
    });

    document.querySelectorAll<HTMLElement>('.settings-nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.setActiveTab(item.dataset.tab || 'haruka-card');
      });
    });

    saveBtn?.addEventListener('click', () => {
      const original = saveBtn.innerHTML;
      saveBtn.setAttribute('disabled', 'true');
      saveBtn.innerHTML = '<span class="save-spinner"></span><span>Saving...</span>';
      window.setTimeout(() => {
        saveBtn.removeAttribute('disabled');
        saveBtn.innerHTML = original;
        this.closeModal();
        this.showToast('Settings Saved', "Haruka's stage customized successfully.");
      }, 600);
    });

    resetBtn?.addEventListener('click', () => {
      if (!window.confirm('Reset all configurations to system defaults?')) {
        return;
      }

      this.settings = mergeSettings(defaultHarukaSettings);
      this.applySettingsToDom();
      this.renderFacts();
      this.persistSettings();
      this.showToast('Defaults Restored', 'Settings reverted successfully.');
    });
  }

  private bindSettingsControls(): void {
    const textBindings: Array<[string, keyof HarukaSettings]> = [
      ['opensouls-base-url', 'openSoulsBaseUrl'],
      ['conn-endpoint', 'pumpWsUrl'],
      ['relay-token-address', 'pumpTokenAddress'],
      ['relay-room-username', 'pumpRoomUsername']
    ];

    const numberBindings: Array<[string, keyof HarukaSettings]> = [
      ['scene-bright', 'sceneBrightness'],
      ['scene-wind', 'windSpeed'],
      ['model-eye', 'eyeTracking'],
      ['memory-buffer', 'bufferAllocation'],
      ['system-scale', 'layoutScale'],
      ['relay-history-limit', 'pumpHistoryLimit'],
      ['relay-queue-delay', 'queueDelayMs'],
      ['relay-queue-max', 'queueMaxSize'],
      ['relay-min-length', 'minCommentLength'],
      ['relay-max-length', 'maxCommentLength']
    ];

    const checkboxBindings: Array<[string, keyof HarukaSettings]> = [
      ['card-sync', 'syncPreset'],
      ['module-thinking', 'thinkingMode'],
      ['module-vision', 'visionModule'],
      ['module-speech', 'speechSynthesis'],
      ['module-gaming', 'gamingCompanion'],
      ['memory-db', 'vectorMemory'],
      ['conn-autoreconnect', 'autoReconnect'],
      ['relay-enabled', 'relayEnabled'],
      ['relay-mirror-ui', 'mirrorPumpToUi']
    ];

    const selectBindings: Array<[string, keyof HarukaSettings]> = [
      ['card-preset-select', 'presetCard'],
      ['chat-engine-mode', 'chatEngineMode'],
      ['scene-lighting', 'lightingSystem'],
      ['model-framework', 'rigArchitecture'],
      ['model-physics', 'rigPhysics'],
      ['provider-llm', 'chatProvider'],
      ['provider-tts', 'speechProvider'],
      ['provider-stt', 'sttProvider']
    ];

    textBindings.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('input', (event) => {
        this.settings[key] = (event.target as HTMLInputElement).value as never;
        this.persistSettings();
        this.applyRuntimeSettings();
      });
    });

    numberBindings.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('input', (event) => {
        const value = Number.parseInt((event.target as HTMLInputElement).value, 10);
        this.settings[key] = value as never;
        this.updateRangeLabel(id, value);
        this.persistSettings();
        this.applyRuntimeSettings();
      });
    });

    checkboxBindings.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('change', (event) => {
        this.settings[key] = (event.target as HTMLInputElement).checked as never;
        this.persistSettings();
        this.applyRuntimeSettings();
      });
    });

    selectBindings.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('change', (event) => {
        this.settings[key] = (event.target as HTMLSelectElement).value as never;
        if (key === 'presetCard') {
          this.updateOpenSoulsProfileHint();
        }
        if (key === 'chatEngineMode') {
          this.updateProviderEngineUi();
        }
        if (key === 'chatProvider') {
          this.settings.chatEngineMode = this.settings.chatProvider === 'opensouls-local' ? 'opensouls-bridge' : 'direct';
          this.setInputValue('chat-engine-mode', this.settings.chatEngineMode);
          this.updateProviderEngineUi();
        }
        this.persistSettings();
        this.applyRuntimeSettings();
        this.updatePreviewCard();
      });
    });

    document.getElementById('relay-blocked-words')?.addEventListener('input', (event) => {
      this.settings.blockedWords = (event.target as HTMLTextAreaElement).value;
      this.persistSettings();
    });

    document.getElementById('relay-message-template')?.addEventListener('input', (event) => {
      this.settings.harukaMessageTemplate = (event.target as HTMLTextAreaElement).value;
      this.persistSettings();
    });

    document.getElementById('fact-list')?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('.delete-fact-btn');
      if (!button) {
        return;
      }

      const item = button.closest('.fact-item');
      const factId = Number.parseInt(item?.getAttribute('data-id') || '', 10);
      if (!Number.isFinite(factId)) {
        return;
      }

      this.settings.facts = this.settings.facts.filter((fact) => fact.id !== factId);
      this.renderFacts();
      this.persistSettings();
      this.showToast('Fact Removed', 'Companion memory updated successfully.');
    });

    document.querySelectorAll<HTMLElement>('.theme-swatch-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.settings.themePalette = button.dataset.theme || 'gold';
        this.applyThemeSelection();
        this.persistSettings();
      });
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this.settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'haruka-settings.json';
      anchor.click();
      URL.revokeObjectURL(url);
      this.showToast('Export Complete', 'JSON settings backup downloaded.');
    });

    this.importInput = document.createElement('input');
    this.importInput.type = 'file';
    this.importInput.accept = 'application/json';
    this.importInput.hidden = true;
    document.body.appendChild(this.importInput);

    document.getElementById('btn-import-archive')?.addEventListener('click', () => {
      this.importInput?.click();
    });

    this.importInput.addEventListener('change', async () => {
      const file = this.importInput?.files?.[0];
      if (!file) {
        return;
      }

      try {
        const imported = mergeSettings(JSON.parse(await file.text()) as Partial<HarukaSettings>);
        this.settings = imported;
        this.applySettingsToDom();
        this.renderFacts();
        this.persistSettings();
        this.showToast('Import Complete', 'Configurations restored successfully.');
      } catch {
        this.showToast('Import Failed', 'The selected file is not a valid HARUKA settings backup.');
      } finally {
        if (this.importInput) {
          this.importInput.value = '';
        }
      }
    });

    document.getElementById('btn-wipe-data')?.addEventListener('click', () => {
      if (!window.confirm('Wipe all local memory databases and relay presets? This cannot be undone!')) {
        return;
      }

      this.settings = { ...defaultHarukaSettings, facts: [] };
      this.applySettingsToDom();
      this.renderFacts();
      this.persistSettings();
      this.showToast('Database Purged', 'All learned context and saved relay presets have been wiped.');
    });
  }

  private applySettingsToDom(): void {
    this.setInputValue('card-preset-select', this.settings.presetCard);
    this.setCheckboxValue('card-sync', this.settings.syncPreset);
    this.setCheckboxValue('module-thinking', this.settings.thinkingMode);
    this.setCheckboxValue('module-vision', this.settings.visionModule);
    this.setCheckboxValue('module-speech', this.settings.speechSynthesis);
    this.setCheckboxValue('module-gaming', this.settings.gamingCompanion);
    this.setInputValue('scene-lighting', this.settings.lightingSystem);
    this.setInputValue('scene-bright', String(this.settings.sceneBrightness));
    this.setInputValue('scene-wind', String(this.settings.windSpeed));
    this.setInputValue('model-framework', this.settings.rigArchitecture);
    this.setInputValue('model-physics', this.settings.rigPhysics);
    this.setInputValue('model-eye', String(this.settings.eyeTracking));
    this.setCheckboxValue('memory-db', this.settings.vectorMemory);
    this.setInputValue('memory-buffer', String(this.settings.bufferAllocation));
    this.setInputValue('chat-engine-mode', this.settings.chatEngineMode);
    this.setInputValue('provider-llm', this.settings.chatProvider);
    this.setInputValue('provider-tts', this.settings.speechProvider);
    this.setInputValue('provider-stt', this.settings.sttProvider);
    this.setInputValue('opensouls-base-url', this.settings.openSoulsBaseUrl);
    this.setInputValue('conn-endpoint', this.settings.pumpWsUrl);
    this.setCheckboxValue('conn-autoreconnect', this.settings.autoReconnect);
    this.setInputValue('system-scale', String(this.settings.layoutScale));
    this.setInputValue('relay-token-address', this.settings.pumpTokenAddress);
    this.setInputValue('relay-room-username', this.settings.pumpRoomUsername);
    this.setCheckboxValue('relay-enabled', this.settings.relayEnabled);
    this.setCheckboxValue('relay-mirror-ui', this.settings.mirrorPumpToUi);
    this.setInputValue('relay-history-limit', String(this.settings.pumpHistoryLimit));
    this.setInputValue('relay-queue-delay', String(this.settings.queueDelayMs));
    this.setInputValue('relay-queue-max', String(this.settings.queueMaxSize));
    this.setInputValue('relay-min-length', String(this.settings.minCommentLength));
    this.setInputValue('relay-max-length', String(this.settings.maxCommentLength));
    this.setTextAreaValue('relay-blocked-words', this.settings.blockedWords);
    this.setTextAreaValue('relay-message-template', this.settings.harukaMessageTemplate);
    this.updateRangeLabel('scene-bright', this.settings.sceneBrightness);
    this.updateRangeLabel('scene-wind', this.settings.windSpeed);
    this.updateRangeLabel('model-eye', this.settings.eyeTracking);
    this.updateRangeLabel('memory-buffer', this.settings.bufferAllocation);
    this.updateRangeLabel('system-scale', this.settings.layoutScale);

    this.applyThemeSelection();
    this.updatePreviewCard();
    this.updateProviderEngineUi();
    this.updateOpenSoulsProfileHint();
    this.applyRuntimeSettings();
    this.renderRelayConsole();
    this.renderRelayPanel();
  }

  private applyRuntimeSettings(): void {
    document.documentElement.style.setProperty('--chat-layout-scale', `${this.settings.layoutScale / 100}`);
    const chatManager = (window as any).chatManager;
    if (chatManager && typeof chatManager.applyRuntimeSettings === 'function') {
      chatManager.applyRuntimeSettings({
        speechSynthesis: this.settings.speechSynthesis,
        chatProvider: this.settings.chatProvider,
        chatEngineMode: this.settings.chatEngineMode,
        presetCard: this.settings.presetCard,
        openSoulsBaseUrl: this.settings.openSoulsBaseUrl
      });
    }
  }

  private updatePreviewCard(): void {
    const preset = HARUKA_SOUL_PROFILES[this.settings.presetCard] || HARUKA_SOUL_PROFILES.classic;
    this.setTextContent('preview-name', preset.name);
    this.setTextContent('preview-tag', preset.tag);
    this.setTextContent('preview-bio', preset.bio);
    this.setTextContent('stat-val-visual', `${preset.visual}%`);
    this.setTextContent('stat-val-memory', `${preset.memory}%`);
    this.setTextContent('stat-val-logic', `${preset.logic}%`);
    this.setElementWidth('stat-bar-visual', `${preset.visual}%`);
    this.setElementWidth('stat-bar-memory', `${preset.memory}%`);
    this.setElementWidth('stat-bar-logic', `${preset.logic}%`);
  }

  private renderFacts(): void {
    const container = document.getElementById('fact-list');
    if (!container) {
      return;
    }

    container.innerHTML = this.settings.facts
      .map(
        (fact: FactItem) => `
          <div class="fact-item" data-id="${fact.id}">
            <span>${fact.text}</span>
            <button class="delete-fact-btn" aria-label="Delete memory">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        `
      )
      .join('');
  }

  private renderRelayConsole(): void {
    const root = document.getElementById('relay-console');
    if (!root) {
      return;
    }

    const state = this.relayState;
    root.innerHTML = `
      <div class="relay-console-head">
        <div>
          <span class="relay-console-eyebrow">Pump.fun</span>
          <h3>Live Relay</h3>
        </div>
        <button type="button" class="relay-inline-link" id="relay-open-settings">Configure</button>
      </div>
      <div class="relay-console-status-row">
        <span class="relay-status-pill ${this.bridgeAvailable ? 'ok' : 'warn'}">${this.bridgeAvailable ? 'Live stream ready' : 'Live stream unavailable'}</span>
        <span class="relay-status-pill ${state?.running ? 'live' : 'idle'}">${state?.running ? 'Relay live' : 'Relay idle'}</span>
      </div>
      <div class="relay-console-grid">
        <div class="relay-console-card">
          <span class="relay-console-value">${state?.forwardedCount ?? 0}</span>
          <span class="relay-console-label">Forwarded</span>
        </div>
        <div class="relay-console-card">
          <span class="relay-console-value">${state?.droppedCount ?? 0}</span>
          <span class="relay-console-label">Dropped</span>
        </div>
        <div class="relay-console-card">
          <span class="relay-console-value">${state?.queueLength ?? 0}</span>
          <span class="relay-console-label">Queue</span>
        </div>
        <div class="relay-console-card">
          <span class="relay-console-value relay-console-token">${this.settings.pumpTokenAddress.slice(0, 6) || '--'}...</span>
          <span class="relay-console-label">Token</span>
        </div>
      </div>
      <div class="relay-target-card">
        <div>
          <span class="relay-target-title">Pump.fun websocket</span>
          <span class="relay-target-sub">${this.settings.pumpWsUrl}</span>
        </div>
        <div class="relay-chip-list">
          <span class="relay-status-pill ${state?.harukaConnected ? 'ok' : 'idle'}">${state?.harukaConnected ? 'Browser responder ready' : 'Browser responder idle'}</span>
          <span class="relay-status-pill ${state?.pumpConnected ? 'ok' : 'idle'}">${state?.pumpConnected ? 'Pump chat connected' : 'Pump chat idle'}</span>
        </div>
      </div>
      <div class="relay-console-actions">
        <button type="button" class="btn-secondary-custom" id="relay-console-connect"${this.bridgeBusy || !this.bridgeAvailable ? ' disabled' : ''}>Connect</button>
        <button type="button" class="btn-secondary-custom" id="relay-console-disconnect"${this.bridgeBusy || !this.bridgeAvailable ? ' disabled' : ''}>Stop</button>
        <button type="button" class="btn-secondary-custom" id="relay-console-test"${this.bridgeBusy || !this.bridgeAvailable ? ' disabled' : ''}>Test</button>
      </div>
      <div class="relay-feed">
        <div class="relay-feed-head">
          <span>Recent activity</span>
          <span>${state?.lastForwardedAt ? new Date(state.lastForwardedAt).toLocaleTimeString() : 'No sends yet'}</span>
        </div>
        <div class="relay-feed-list">
          ${this.renderActivityItems(state?.recentActivities || [])}
        </div>
      </div>
    `;

    root.querySelector('#relay-open-settings')?.addEventListener('click', () => {
      document.getElementById('settings-modal')?.classList.add('active');
      this.setActiveTab('pumpfun');
    });
  }

  private renderRelayPanel(): void {
    const state = this.relayState;
    this.setTextContent('relay-bridge-availability', this.bridgeAvailable ? 'Live stream ready' : 'Live stream unavailable');
    this.setClassName('relay-bridge-availability', `relay-status-pill ${this.bridgeAvailable ? 'ok' : 'warn'}`);
    this.setTextContent('relay-running-status', state?.running ? 'Streaming' : 'Stopped');
    this.setClassName('relay-running-status', `relay-status-pill ${state?.running ? 'live' : 'idle'}`);
    this.setTextContent('relay-forwarded-count', String(state?.forwardedCount ?? 0));
    this.setTextContent('relay-queue-count', String(state?.queueLength ?? 0));
    this.setTextContent('relay-dropped-count', String(state?.droppedCount ?? 0));
    this.setTextContent('relay-haruka-status', state?.harukaConnected ? 'Browser responder ready' : 'Browser responder idle');
    this.setClassName('relay-haruka-status', `relay-status-pill ${state?.harukaConnected ? 'ok' : 'idle'}`);
    this.setTextContent('relay-pump-status', state?.pumpConnected ? 'Pump chat connected' : 'Pump chat idle');
    this.setClassName('relay-pump-status', `relay-status-pill ${state?.pumpConnected ? 'ok' : 'idle'}`);

    const activityList = document.getElementById('relay-panel-activity-list');
    if (activityList) {
      activityList.innerHTML = this.renderActivityItems(state?.recentActivities || []);
    }
  }

  private renderActivityItems(activities: RelayActivity[]): string {
    if (activities.length === 0) {
      return '<div class="relay-feed-empty">No relay activity yet.</div>';
    }

    return activities
      .slice(0, 6)
      .map(
        (activity) => `
          <div class="relay-feed-item ${activity.level}">
            <div class="relay-feed-item-head">
              <span>${activity.title}</span>
              <span>${new Date(activity.timestamp).toLocaleTimeString()}</span>
            </div>
            <p>${activity.detail}</p>
            ${activity.message ? `<span class="relay-feed-quote">${activity.username}: ${activity.message}</span>` : ''}
          </div>
        `
      )
      .join('');
  }

  private injectRelayUI(): void {
    const connectionNav = document.querySelector('.settings-nav-item[data-tab="connection"]');
    if (connectionNav && !document.querySelector('.settings-nav-item[data-tab="pumpfun"]')) {
      connectionNav.insertAdjacentHTML(
        'beforebegin',
        `
          <div class="settings-nav-item" data-tab="pumpfun">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l2.2 6.7H21l-5.4 3.9L17.8 19 12 15l-5.8 4 2.2-6.4L3 8.7h6.8z"></path>
            </svg>
            <span>Pump.fun Relay</span>
          </div>
        `
      );
    }

    const connectionPanel = document.getElementById('panel-connection');
    if (connectionPanel && !document.getElementById('panel-pumpfun')) {
      connectionPanel.insertAdjacentHTML(
        'beforebegin',
        `
          <div class="settings-section-panel" id="panel-pumpfun">
            <h3 class="settings-section-title">Pump.fun Live Relay</h3>
            <p class="settings-section-desc">Configure the Vercel-compatible live stream that listens to Pump.fun comments and lets Haruka answer inside this page while the tab stays open.</p>
            <div class="relay-summary-card">
              <div class="relay-summary-row">
                <span class="relay-summary-label">Live stream</span>
                <span id="relay-bridge-availability" class="relay-status-pill warn">Waiting</span>
              </div>
              <div class="relay-summary-row">
                <span class="relay-summary-label">Relay status</span>
                <span id="relay-running-status" class="relay-status-pill idle">Stopped</span>
              </div>
              <div class="relay-summary-grid">
                <div><span id="relay-forwarded-count" class="relay-summary-stat">0</span><span class="relay-summary-sub">Forwarded</span></div>
                <div><span id="relay-queue-count" class="relay-summary-stat">0</span><span class="relay-summary-sub">Queued</span></div>
                <div><span id="relay-dropped-count" class="relay-summary-stat">0</span><span class="relay-summary-sub">Dropped</span></div>
              </div>
            </div>
            <div class="settings-switch-row">
              <div class="settings-switch-label-group">
                <span class="settings-switch-title">Enable Relay</span>
                <span class="settings-switch-desc">Start the live Pump.fun stream and the Haruka browser responder.</span>
              </div>
              <label class="tactile-switch">
                <input type="checkbox" id="relay-enabled">
                <span class="tactile-slider"></span>
              </label>
            </div>
            <div class="settings-switch-row">
              <div class="settings-switch-label-group">
                <span class="settings-switch-title">Mirror comments in UI</span>
                <span class="settings-switch-desc">Show Haruka's live replies directly inside this page.</span>
              </div>
              <label class="tactile-switch">
                <input type="checkbox" id="relay-mirror-ui">
                <span class="tactile-slider"></span>
              </label>
            </div>
            <div class="settings-row">
              <label class="settings-row-label" for="relay-token-address">Pump.fun Token Address</label>
              <input type="text" id="relay-token-address" class="settings-input-text">
              <span class="settings-row-sub">Room ID used by the Pump.fun chat socket.</span>
            </div>
            <div class="settings-row">
              <label class="settings-row-label" for="relay-room-username">Relay Username Label</label>
              <input type="text" id="relay-room-username" class="settings-input-text">
            </div>
            <div class="settings-row">
              <label class="settings-row-label" for="conn-endpoint">Pump.fun WebSocket URL</label>
              <input type="text" id="conn-endpoint" class="settings-input-text">
              <span class="settings-row-sub">Advanced: override the default livechat websocket only if Pump.fun changes its socket endpoint.</span>
            </div>
            <div class="relay-field-grid">
              <div class="settings-row">
                <label class="settings-row-label" for="relay-history-limit">History sync size</label>
                <input type="number" id="relay-history-limit" class="settings-input-text">
              </div>
              <div class="settings-row">
                <label class="settings-row-label" for="relay-queue-delay">Queue delay (ms)</label>
                <input type="number" id="relay-queue-delay" class="settings-input-text">
              </div>
            </div>
            <div class="relay-field-grid">
              <div class="settings-row">
                <label class="settings-row-label" for="relay-queue-max">Queue max size</label>
                <input type="number" id="relay-queue-max" class="settings-input-text">
              </div>
              <div class="settings-row">
                <label class="settings-row-label" for="relay-min-length">Minimum comment length</label>
                <input type="number" id="relay-min-length" class="settings-input-text">
              </div>
            </div>
            <div class="settings-row">
              <label class="settings-row-label" for="relay-max-length">Maximum comment length</label>
              <input type="number" id="relay-max-length" class="settings-input-text">
            </div>
            <div class="settings-row">
              <label class="settings-row-label" for="relay-blocked-words">Blocked words</label>
              <textarea id="relay-blocked-words" class="settings-textarea"></textarea>
            </div>
            <div class="settings-row">
              <label class="settings-row-label" for="relay-message-template">Relay message template</label>
              <textarea id="relay-message-template" class="settings-textarea"></textarea>
              <span class="settings-row-sub">This text becomes the viewer context sent into Haruka's live browser prompt.</span>
            </div>
            <div class="relay-chip-list" style="margin-bottom: 16px;">
              <span id="relay-haruka-status" class="relay-status-pill idle">Browser responder idle</span>
              <span id="relay-pump-status" class="relay-status-pill idle">Pump chat idle</span>
            </div>
            <div class="data-buttons-row">
              <button type="button" class="btn-secondary-custom" id="relay-connect-btn">Connect Relay</button>
              <button type="button" class="btn-secondary-custom" id="relay-disconnect-btn">Disconnect Relay</button>
              <button type="button" class="btn-secondary-custom" id="relay-test-btn">Send Test Comment</button>
            </div>
            <div class="relay-feed relay-feed-panel">
              <div class="relay-feed-head">
                <span>Recent relay activity</span>
                <span>Live status</span>
              </div>
              <div id="relay-panel-activity-list" class="relay-feed-list">
                <div class="relay-feed-empty">No relay activity yet.</div>
              </div>
            </div>
          </div>
        `
      );
    }

    const overlay = document.getElementById('ui-overlay');
    const topActions = document.getElementById('chat-top-actions');
    if (overlay && topActions && !document.getElementById('relay-console')) {
      topActions.insertAdjacentHTML(
        'afterend',
        `
          <aside id="relay-console" class="relay-console"></aside>
        `
      );
    }
  }

  private injectProviderEngineUi(): void {
    const providerSelect = document.getElementById('provider-llm') as HTMLSelectElement | null;
    if (providerSelect && !providerSelect.querySelector('option[value="opensouls-local"]')) {
      providerSelect.insertAdjacentHTML(
        'afterbegin',
        '<option value="opensouls-local">OpenSouls Bridge (bundled / Vercel-ready)</option>'
      );
    }

    const providersPanel = document.getElementById('panel-providers');
    if (providersPanel && !document.getElementById('opensouls-engine-card')) {
      providersPanel.insertAdjacentHTML(
        'afterbegin',
        `
          <div id="opensouls-engine-card" class="providers-alert-note" style="margin-bottom: 16px;">
            <div class="alert-note-header">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l7 4v5c0 5-3.5 7.8-7 9-3.5-1.2-7-4-7-9V7l7-4z"></path>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
              <span>Soul Engine Mode</span>
            </div>
            <p class="alert-note-body" style="margin-bottom: 14px;">
              Use the active Character Card preset as Haruka's bias, branding, and response posture. OpenSouls mode can run through the bundled bridge in this repo with no extra service by default.
            </p>
            <div class="providers-help-links">
              <a class="providers-help-link" href="docs.html#feature-map" target="_blank" rel="noreferrer">
                <span>How to enable embed</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 17L17 7"></path>
                  <path d="M8 7h9v9"></path>
                </svg>
              </a>
              <a class="providers-help-link" href="roadmap.html" target="_blank" rel="noreferrer">
                <span>Roadmap concepts</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 17L17 7"></path>
                  <path d="M8 7h9v9"></path>
                </svg>
              </a>
            </div>
            <div class="settings-row">
              <label class="settings-row-label" for="chat-engine-mode">
                <span>Conversation Engine</span>
                <span class="settings-row-sub">Direct adapter uses the local /api/haruka/chat route. OpenSouls bridge uses the bundled bridge in this project and only needs an external URL if you intentionally split the runtime later.</span>
              </label>
              <select id="chat-engine-mode" class="settings-select">
                <option value="direct">Direct LLM Adapter</option>
                <option value="opensouls-bridge">OpenSouls Bridge</option>
              </select>
            </div>
            <div id="opensouls-bridge-fields">
              <div class="settings-row">
                <label class="settings-row-label" for="opensouls-base-url">External OpenSouls Bridge URL (optional)</label>
                <input type="text" id="opensouls-base-url" class="settings-input-text">
                <span id="opensouls-profile-hint" class="settings-row-sub"></span>
              </div>
            </div>
          </div>
        `
      );
    }
  }

  private setActiveTab(tabName: string): void {
    document.querySelectorAll<HTMLElement>('.settings-nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });
    document.querySelectorAll<HTMLElement>('.settings-section-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    });
  }

  private applyThemeSelection(): void {
    document.querySelectorAll<HTMLElement>('.theme-swatch-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.theme === this.settings.themePalette);
    });
  }

  private updateProviderEngineUi(): void {
    const bridgeFields = document.getElementById('opensouls-bridge-fields');
    const providerSelect = document.getElementById('provider-llm') as HTMLSelectElement | null;
    const isOpenSouls = this.settings.chatEngineMode === 'opensouls-bridge';

    if (bridgeFields) {
      bridgeFields.style.display = isOpenSouls ? 'block' : 'none';
    }

    if (providerSelect && isOpenSouls) {
      providerSelect.value = 'opensouls-local';
    } else if (providerSelect && providerSelect.value === 'opensouls-local') {
      providerSelect.value = 'openai-compatible';
      this.settings.chatProvider = 'openai-compatible';
    }
  }

  private updateOpenSoulsProfileHint(): void {
    const profile = getHarukaSoulProfile(this.settings.presetCard);
    this.setTextContent(
      'opensouls-profile-hint',
      `Active preset drives the unified Haruka soul automatically: ${profile.name} (${profile.tag}), ${profile.memory}% memory emphasis, ${profile.logic}% reasoning emphasis. Leave this URL empty to use the bundled bridge in this project, including on Vercel. Only fill it if you intentionally move OpenSouls to a separate service later.`
    );
  }

  private updateRangeLabel(id: string, value: number): void {
    const mapping: Record<string, string> = {
      'scene-bright': `${value}%`,
      'scene-wind': `${(value / 10).toFixed(1)} m/s`,
      'model-eye': `${(value / 100).toFixed(2)}s`,
      'memory-buffer': `${value.toLocaleString()} Tokens`,
      'system-scale': `${(value / 100).toFixed(1)}x`
    };

    const targetId: Record<string, string> = {
      'scene-bright': 'val-scene-bright',
      'scene-wind': 'val-scene-wind',
      'model-eye': 'val-model-eye',
      'memory-buffer': 'val-memory-buffer',
      'system-scale': 'val-system-scale'
    };

    if (mapping[id] && targetId[id]) {
      this.setTextContent(targetId[id], mapping[id]);
    }
  }

  private setInputValue(id: string, value: string): void {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (element) {
      element.value = value;
    }
  }

  private setCheckboxValue(id: string, value: boolean): void {
    const element = document.getElementById(id) as HTMLInputElement | null;
    if (element) {
      element.checked = value;
    }
  }

  private setTextAreaValue(id: string, value: string): void {
    const element = document.getElementById(id) as HTMLTextAreaElement | null;
    if (element) {
      element.value = value;
    }
  }

  private setTextContent(id: string, value: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  private setElementWidth(id: string, value: string): void {
    const element = document.getElementById(id);
    if (element) {
      (element as HTMLElement).style.width = value;
    }
  }

  private setClassName(id: string, value: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.className = value;
    }
  }
}
