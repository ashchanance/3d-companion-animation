export interface HarukaEmbedContext {
  enabled: boolean;
  apiKey: string;
  userId: string;
  sessionId: string;
  language: 'en' | 'jp';
  view: 'widget' | 'companion';
}

declare global {
  interface Window {
    __harukaEmbedContext?: HarukaEmbedContext;
  }
}

const EMBED_STYLE_ID = 'haruka-widget-embed-style';
const SESSION_STORAGE_KEY = 'haruka.embed.session.id';
const USER_STORAGE_KEY = 'haruka.embed.user.id';

function readBooleanParam(value: string | null): boolean {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function createStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStoredId(storage: Storage, key: string, prefix: string): string {
  const existing = storage.getItem(key)?.trim();
  if (existing) {
    return existing;
  }

  const generated = createStableId(prefix);
  storage.setItem(key, generated);
  return generated;
}

function ensureEmbedStyles(): void {
  if (document.getElementById(EMBED_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = EMBED_STYLE_ID;
  style.textContent = `
    body.mode-widget-embed {
      overflow: hidden !important;
      width: 100vw;
      height: 100vh;
      background: #09111b;
    }

    body.mode-widget-embed #home-btn,
    body.mode-widget-embed #bg-selector-container,
    body.mode-widget-embed #relay-console {
      display: none !important;
    }

    body.mode-widget-embed #ui-overlay {
      padding: 14px;
      align-items: stretch;
    }

    body.mode-widget-embed #chat-top-actions {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    body.mode-widget-embed #settings-selector-container button {
      padding: 10px;
      border-radius: 999px;
    }

    body.mode-widget-embed #settings-selector-container button span {
      display: none;
    }

    body.mode-widget-embed #chat-bubble {
      max-width: min(320px, calc(100vw - 28px));
      right: 14px;
      left: auto;
      top: 20px;
    }

    body.mode-widget-embed #language-toggle-bar {
      bottom: 92px;
      right: 14px;
      left: auto;
    }

    body.mode-widget-embed #chat-input-container {
      bottom: 14px;
      width: calc(100% - 28px);
      max-width: none;
      border-radius: 26px;
      padding: 6px;
      box-shadow: 0 18px 36px rgba(9, 17, 27, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.55);
    }

    body.mode-widget-embed #chat-input {
      font-size: 14px;
      padding: 10px 14px;
    }

    body.mode-widget-embed #chat-send-btn,
    body.mode-widget-embed .chat-action-btn {
      width: 42px;
      height: 42px;
    }

    body.mode-widget-embed canvas {
      transform: scale(1.02);
      transform-origin: center center;
    }

    @media (max-width: 520px) {
      body.mode-widget-embed #chat-bubble {
        max-width: calc(100vw - 24px);
      }

      body.mode-widget-embed #language-toggle-bar {
        bottom: 88px;
      }
    }

    body.mode-companion-embed {
      overflow: hidden !important;
      width: 100vw;
      height: 100vh;
      background: transparent !important;
    }

    body.mode-companion-embed #landing-page,
    body.mode-companion-embed #chat-bg-container,
    body.mode-companion-embed #ui-overlay,
    body.mode-companion-embed #relay-console,
    body.mode-companion-embed #settings-modal {
      display: none !important;
    }

    body.mode-companion-embed > canvas {
      width: 100vw !important;
      height: 100vh !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: none !important;
      transform: scale(1.18) translateY(7%);
      transform-origin: center bottom;
      filter: drop-shadow(0 18px 28px rgba(7, 12, 18, 0.2));
    }

    @media (max-width: 520px) {
      body.mode-companion-embed > canvas {
        transform: scale(1.08) translateY(6%);
      }
    }
  `;

  document.head.appendChild(style);
}

function applyEmbedDomMode(view: 'widget' | 'companion'): void {
  if (!document.body) {
    return;
  }

  document.body.classList.remove('mode-landing');
  document.body.classList.add('mode-chat');
  ensureEmbedStyles();

  if (view === 'companion') {
    document.body.classList.add('mode-companion-embed');
    document.body.classList.remove('mode-widget-embed');
    return;
  }

  document.body.classList.add('mode-widget-embed');
  document.body.classList.remove('mode-companion-embed');

  const input = document.getElementById('chat-input') as HTMLInputElement | null;
  if (input) {
    input.placeholder = 'Chat with Haruka...';
  }
}

export function initializeHarukaEmbedMode(): HarukaEmbedContext {
  const params = new URLSearchParams(window.location.search);
  const enabled = readBooleanParam(params.get('embed'));
  const language = params.get('lang') === 'jp' ? 'jp' : 'en';
  const view = params.get('view') === 'companion' ? 'companion' : 'widget';
  const sessionId = params.get('sessionId')?.trim() || getStoredId(window.sessionStorage, SESSION_STORAGE_KEY, 'session');
  const userId = params.get('userId')?.trim() || getStoredId(window.localStorage, USER_STORAGE_KEY, 'user');

  const context: HarukaEmbedContext = {
    enabled,
    apiKey: params.get('apiKey')?.trim() || '',
    userId,
    sessionId,
    language,
    view
  };

  window.__harukaEmbedContext = context;

  if (!enabled) {
    return context;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyEmbedDomMode(view), { once: true });
  } else {
    applyEmbedDomMode(view);
  }

  return context;
}
