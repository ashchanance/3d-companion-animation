/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import * as LAppDefine from './lappdefine';
import { ChatManager } from './chatmanager';

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
    (window as any).chatManager = new ChatManager();
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
