import { type ChatManager } from './chatmanager';
import { type HarukaSettings } from './harukaSettingsSchema';
import { HarukaSettingsManager, type RelayActivity, type RelayBridgeState } from './harukaSettingsManager';

interface QueueItem {
  id: string;
  username: string;
  message: string;
}

interface BridgeStatePayload {
  running?: boolean;
  pumpConnected?: boolean;
  lastError?: string | null;
  activeTokenAddress?: string;
}

interface ActivityPayload {
  timestamp?: string;
  level: 'info' | 'warn' | 'error';
  type: string;
  title: string;
  detail: string;
  username?: string;
  message?: string;
}

interface CommentPayload {
  username?: string;
  message?: string;
}

export class PumpRelayController {
  private state: RelayBridgeState = {
    available: true,
    running: false,
    pumpConnected: false,
    harukaConnected: false,
    queueLength: 0,
    forwardedCount: 0,
    droppedCount: 0,
    lastError: null,
    activeTokenAddress: '',
    lastForwardedAt: null,
    recentActivities: []
  };

  private bridgeAvailable = true;
  private bridgeBusy = false;
  private bridgeStream: EventSource | null = null;
  private settings!: HarukaSettings;
  private recentFingerprints = new Map<string, number>();
  private queue: QueueItem[] = [];
  private isProcessingQueue = false;

  constructor(
    private readonly settingsManager: HarukaSettingsManager,
    private readonly chatManager: ChatManager
  ) {
    this.bindButtons();
    this.settingsManager.subscribe((settings) => {
      this.settings = settings;
      this.state.harukaConnected = this.shouldUseBrowserResponder();
      void this.autoToggle(settings);
      this.chatManager.applyRuntimeSettings({ speechSynthesis: settings.speechSynthesis });
      this.commitUi();
    });
    void this.bootstrapBridgeState();
    this.commitUi();
  }

  private bindButtons(): void {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      if (!button) {
        return;
      }

      if (button.id === 'relay-connect-btn' || button.id === 'relay-console-connect') {
        void this.connect();
      }

      if (button.id === 'relay-disconnect-btn' || button.id === 'relay-console-disconnect') {
        void this.disconnect();
      }

      if (button.id === 'relay-test-btn' || button.id === 'relay-console-test') {
        void this.test();
      }
    });
  }

  private async bootstrapBridgeState(): Promise<void> {
    try {
      const response = await fetch('/__pumpfun_live/state');
      if (!response.ok) {
        this.bridgeAvailable = false;
        this.commitUi();
        return;
      }

      this.bridgeAvailable = true;
      const payload = (await response.json()) as BridgeStatePayload;
      this.applyBridgeState(payload);
      this.ensureBridgeStream();
    } catch {
      this.bridgeAvailable = false;
      this.commitUi();
    }
  }

  private async autoToggle(settings: HarukaSettings): Promise<void> {
    if (settings.relayEnabled && !this.state.running) {
      await this.connect();
      return;
    }

    if (!settings.relayEnabled && this.state.running) {
      await this.disconnect();
    }
  }

  private shouldUseBrowserResponder(): boolean {
    return this.state.running && this.settings.mirrorPumpToUi;
  }

  private addActivity(
    level: 'info' | 'warn' | 'error',
    type: string,
    title: string,
    detail: string,
    username?: string,
    message?: string
  ): void {
    const activity: RelayActivity = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      type,
      title,
      detail,
      username,
      message
    };

    this.state.recentActivities = [activity, ...this.state.recentActivities].slice(0, 18);
    this.commitUi();
  }

  private addBridgeActivity(payload: ActivityPayload): void {
    const activity: RelayActivity = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: payload.timestamp || new Date().toISOString(),
      level: payload.level,
      type: payload.type,
      title: payload.title,
      detail: payload.detail,
      username: payload.username,
      message: payload.message
    };

    this.state.recentActivities = [activity, ...this.state.recentActivities].slice(0, 18);
    this.commitUi();
  }

  private applyBridgeState(payload: BridgeStatePayload): void {
    if (typeof payload.running === 'boolean') {
      this.state.running = payload.running;
    }
    if (typeof payload.pumpConnected === 'boolean') {
      this.state.pumpConnected = payload.pumpConnected;
    }
    if (typeof payload.activeTokenAddress === 'string') {
      this.state.activeTokenAddress = payload.activeTokenAddress;
    }
    if (typeof payload.lastError === 'string' || payload.lastError === null) {
      this.state.lastError = payload.lastError ?? null;
    }

    this.state.harukaConnected = this.shouldUseBrowserResponder();
    this.commitUi();
  }

  private ensureBridgeStream(): void {
    if (this.bridgeStream) {
      return;
    }

    try {
      const stream = new EventSource('/__pumpfun_live/events');
      this.bridgeStream = stream;

      stream.addEventListener('state', (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as BridgeStatePayload;
        this.bridgeAvailable = true;
        this.applyBridgeState(payload);
      });

      stream.addEventListener('activity', (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as ActivityPayload;
        this.addBridgeActivity(payload);
      });

      stream.addEventListener('comment', (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as CommentPayload;
        const username = payload.username?.trim() || 'anonymous';
        const message = payload.message?.trim() || '';
        this.enqueueComment(username, message);
      });

      stream.onerror = () => {
        this.bridgeAvailable = false;
        this.commitUi();
      };
    } catch {
      this.bridgeAvailable = false;
      this.commitUi();
    }
  }

  private async connect(): Promise<void> {
    if (this.state.running) {
      return;
    }

    const tokenAddress = this.settings.pumpTokenAddress.trim();
    if (!tokenAddress) {
      this.state.lastError = 'Pump.fun token address is required.';
      this.addActivity('error', 'validation-error', 'Missing token address', 'Enter a Pump.fun token address before starting the relay.');
      return;
    }

    this.bridgeBusy = true;
    this.commitUi();

    try {
      this.ensureBridgeStream();
      const response = await fetch('/__pumpfun_live/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokenAddress,
          username: this.settings.pumpRoomUsername.trim(),
          historyLimit: this.settings.pumpHistoryLimit,
          pumpWsUrl: this.settings.pumpWsUrl.trim()
        })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; state?: BridgeStatePayload };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to start the local Pump.fun helper.');
      }

      if (payload.state) {
        this.applyBridgeState(payload.state);
      } else {
        this.state.running = true;
        this.state.activeTokenAddress = tokenAddress;
      }

      this.state.harukaConnected = this.shouldUseBrowserResponder();
      if (this.state.harukaConnected) {
        this.addActivity('info', 'browser-ready', 'Browser responder ready', 'Haruka will answer live comments directly in this page while it stays open.');
      } else {
        this.addActivity('warn', 'browser-muted', 'Browser responder muted', 'Live replies are disabled in the UI settings, so comments will only be logged.');
      }
    } catch (error) {
      this.state.running = false;
      this.state.pumpConnected = false;
      this.state.harukaConnected = false;
      this.state.lastError = error instanceof Error ? error.message : 'Unknown relay start error.';
      this.addActivity('error', 'relay-start-error', 'Relay start failed', this.state.lastError);
    } finally {
      this.bridgeBusy = false;
      this.commitUi();
    }
  }

  private async disconnect(): Promise<void> {
    this.bridgeBusy = true;
    this.commitUi();

    try {
      await fetch('/__pumpfun_live/disconnect', {
        method: 'POST'
      });
    } catch {
      // Ignore disconnect request failures and fall back to local state reset.
    } finally {
      this.state.running = false;
      this.state.pumpConnected = false;
      this.state.harukaConnected = false;
      this.state.lastError = null;
      this.queue = [];
      this.state.queueLength = 0;
      this.bridgeBusy = false;
      this.commitUi();
    }
  }

  private async test(): Promise<void> {
    this.bridgeBusy = true;
    this.commitUi();

    try {
      const username = 'HarukaConsole';
      const message = 'This is a live relay health check.';
      this.addActivity('info', 'test', 'Test comment queued', 'Sending a local test comment through the browser responder.', username, message);
      await this.respondToViewerComment(username, message);
    } finally {
      this.bridgeBusy = false;
      this.commitUi();
    }
  }

  private shouldDropComment(username: string, message: string): string | null {
    const normalized = message.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return 'Ignored an empty chat message.';
    }
    if (normalized.length < this.settings.minCommentLength) {
      return `Ignored a short comment from ${username}.`;
    }
    if (normalized.length > this.settings.maxCommentLength) {
      return `Ignored a long comment from ${username}.`;
    }

    const lowered = normalized.toLowerCase();
    const blockedList = this.settings.blockedWords
      .split(',')
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean);
    if (blockedList.some((word) => lowered.includes(word))) {
      return `Blocked a filtered comment from ${username}.`;
    }

    const fingerprint = `${username}:${normalized.toLowerCase()}`;
    const now = Date.now();

    for (const [key, timestamp] of this.recentFingerprints.entries()) {
      if (now - timestamp > 15000) {
        this.recentFingerprints.delete(key);
      }
    }

    if (this.recentFingerprints.has(fingerprint)) {
      return `Ignored a duplicate comment from ${username}.`;
    }

    this.recentFingerprints.set(fingerprint, now);
    return null;
  }

  private enqueueComment(username: string, message: string): void {
    const reason = this.shouldDropComment(username, message);
    if (reason) {
      this.state.droppedCount += 1;
      this.addActivity('warn', 'filtered', 'Comment skipped', reason, username, message);
      return;
    }

    if (this.queue.length >= this.settings.queueMaxSize) {
      this.state.droppedCount += 1;
      this.addActivity('warn', 'queue-full', 'Queue is full', `Dropped ${username}'s comment because the live queue is full.`, username, message);
      return;
    }

    this.queue.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      username,
      message: message.trim()
    });
    this.state.queueLength = this.queue.length;
    this.addActivity('info', 'queued', 'Viewer comment queued', `Queued ${username}'s comment for the live browser responder.`, username, message);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.state.running && this.queue.length > 0) {
      const nextItem = this.queue.shift();
      if (!nextItem) {
        continue;
      }

      this.state.queueLength = this.queue.length;
      this.commitUi();

      const result = await this.respondToViewerComment(nextItem.username, nextItem.message);
      if (!result && this.state.running) {
        this.queue.unshift(nextItem);
        this.state.queueLength = this.queue.length;
        await this.sleep(300);
        continue;
      }

      if (this.queue.length > 0) {
        await this.sleep(this.settings.queueDelayMs);
      }
    }

    this.isProcessingQueue = false;
  }

  private async respondToViewerComment(username: string, message: string): Promise<boolean> {
    if (!this.settings.mirrorPumpToUi) {
      this.state.forwardedCount += 1;
      this.state.lastForwardedAt = new Date().toISOString();
      this.addActivity('info', 'forwarded', 'Viewer comment logged', `Captured ${username}'s comment, but live UI replies are disabled.`, username, message);
      return true;
    }

    if (!this.chatManager.canAcceptExternalComment()) {
      return false;
    }

    const formatted = this.buildFormattedMessage(username, message);
    const prompt = `${formatted}\nReply directly to ${username} as Haruka. Keep it short, expressive, and suitable for a live Pump.fun chat.`;

    this.state.forwardedCount += 1;
    this.state.lastForwardedAt = new Date().toISOString();
    this.addActivity('info', 'forwarded', 'Viewer comment relayed', `Handed ${username}'s comment to Haruka inside this page.`, username, message);

    const result = await this.chatManager.handleExternalViewerComment(username, message, prompt);
    if (result.ok) {
      this.addActivity('info', 'haruka-response', 'Haruka responded', 'Haruka answered the viewer live in this browser tab.', 'Haruka', result.reply);
      this.state.lastError = null;
      return true;
    }

    this.state.droppedCount += 1;
    this.state.lastError = result.reply;
    this.addActivity('error', 'dropped', 'Comment response failed', `Haruka could not answer ${username}'s live comment.`, username, message);
    return true;
  }

  private buildFormattedMessage(username: string, message: string): string {
    let output = this.settings.harukaMessageTemplate;
    output = output.split('{{username}}').join(username);
    output = output.split('{{message}}').join(message);
    output = output.split('{{formatted}}').join(message);
    return output;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private commitUi(): void {
    this.settingsManager.updateRelayState(this.state, this.bridgeAvailable, this.bridgeBusy);
  }
}
