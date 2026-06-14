/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import * as LAppDefine from './lappdefine';
import { ChatManager } from './chatmanager';
import { Grainient } from './grainient';
import { readStoredPortfolioContext } from './harukaPortfolioContext.js';
import { HarukaSettingsManager } from './harukaSettingsManager';
import { PumpRelayController } from './pumpRelayController';
import { initializeHarukaEmbedMode } from './widgetEmbedMode';

(window as any).__harukaSettingsManagerActive = true;
const embedContext = initializeHarukaEmbedMode();

/**
 * ブラウザロード後の処理
 */
// Global hook to dynamically change characters from landing page
(window as any).loadLive2DModel = (index: number): void => {
  try {
    const delegate = LAppDelegate.getInstance();
    if (!delegate) return;
    const subdelegate = delegate.getSubdelegate(0);
    if (!subdelegate) return;
    const live2dManager = subdelegate.getLive2DManager();
    if (live2dManager) {
      live2dManager.addModel(index);
      console.log(`[Main] Model loaded dynamically at index: ${index}`);
    }
  } catch (e) {
    console.error('Failed to load Live2D model dynamically:', e);
  }
};

window.addEventListener(
  'load',
  (): void => {
    // Initialize WebGL and create the application instance
    if (!LAppDelegate.getInstance().initialize()) {
      return;
    }

    LAppDelegate.getInstance().run();

    // Initialize ChatManager to handle dynamic LLM interaction and speech bubbles
    const chatManager = new ChatManager();
    (window as any).chatManager = chatManager;
    chatManager.setLanguage(embedContext.language);

    if (embedContext.enabled && embedContext.view === 'companion') {
      window.addEventListener('message', (event: MessageEvent) => {
        const payload = event.data;
        if (!payload || typeof payload !== 'object') {
          return;
        }

        if ((payload as { source?: string }).source !== 'haruka-kintara-extension') {
          return;
        }

        if ((payload as { type?: string }).type === 'HARUKA_COMPANION_SPEAK') {
          const text = typeof (payload as { text?: string }).text === 'string' ? (payload as { text: string }).text : '';
          chatManager.playCompanionSpeech(text);
          return;
        }

        if ((payload as { type?: string }).type === 'HARUKA_COMPANION_STOP') {
          chatManager.stopCompanionSpeech();
        }
      });
    }

    const launchParams = new URLSearchParams(window.location.search);
    const storedPortfolioContext = readStoredPortfolioContext();
    if (storedPortfolioContext && (launchParams.get('portfolio') === '1' || launchParams.get('mode') === 'chat')) {
      chatManager.applyPortfolioContext(storedPortfolioContext);
    }

    const settingsManager = new HarukaSettingsManager();
    (window as any).harukaSettingsManager = settingsManager;

    const relayController = new PumpRelayController(settingsManager, chatManager);
    (window as any).pumpRelayController = relayController;

    // Initialize Grainient background
    const bgContainer = document.getElementById('grainient-bg');
    if (bgContainer) {
      new Grainient(bgContainer, {
        color1: '#FAF6F0',            // Cardigan cream
        color2: '#F5EBE6',            // Warm cream
        color3: '#EBD0B9',            // Primary 200 (warm golden sand)
        timeSpeed: 0.12,
        colorBalance: 0.05,
        warpStrength: 0.5,
        warpFrequency: 4.0,
        warpSpeed: 0.8,
        warpAmplitude: 35.0,
        blendAngle: 30.0,
        blendSoftness: 0.08,
        rotationAmount: 180.0,
        noiseScale: 1.6,
        grainAmount: 0.02,
        grainScale: 1.2,
        grainAnimated: true,
        contrast: 1.1,
        gamma: 0.95,
        saturation: 1.0,
        centerX: 0.0,
        centerY: 0.0,
        zoom: 0.95
      });
    }
  },
  { passive: true }
);

/**
 * 終了時の処理
 */
window.addEventListener(
  'beforeunload',
  (): void => LAppDelegate.releaseInstance(),
  { passive: true }
);
