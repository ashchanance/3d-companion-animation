/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

"use strict";
const fs = require('fs');
const PUBLIC_DIR = './public';
const ACCESS_DENIED_CODES = new Set(['EACCES', 'EIO', 'EPERM']);
const publicResources = [
  {src: '../../../Core', dst: `${PUBLIC_DIR}/Core`},
  {src: '../../Resources', dst: `${PUBLIC_DIR}/Resources`},
  // Primary shaders path (accessible, no permission issues)
  {src: '../../../Framework/Shaders/WebGL', dst: `${PUBLIC_DIR}/shaders/WebGL`},
  // Legacy path attempt (may fail if locked - that's OK, primary path is used)
  {src: '../../../Framework/Shaders', dst: `${PUBLIC_DIR}/Framework/Shaders`},
];

const cleanupResultByDestination = new Map();

function isAccessDeniedError(err) {
  if (!err) {
    return false;
  }

  const message = typeof err.message === 'string' ? err.message : '';
  return ACCESS_DENIED_CODES.has(err.code)
    || message.includes('Access is denied')
    || message.includes('Permission denied');
}

publicResources.forEach((e) => {
  const destinationExists = fs.existsSync(e.dst);

  if (!destinationExists) {
    cleanupResultByDestination.set(e.dst, { destinationExists, cleaned: true });
    return;
  }

  try {
    fs.rmSync(e.dst, { recursive: true, force: true });
    cleanupResultByDestination.set(e.dst, { destinationExists, cleaned: true });
  } catch (err) {
    console.warn(`[Warning] Could not clean directory ${e.dst}: ${err.message}. Keeping the existing files in place.`);
    cleanupResultByDestination.set(e.dst, { destinationExists, cleaned: false });
  }
});

publicResources.forEach((e) => {
  const cleanupResult = cleanupResultByDestination.get(e.dst) || { destinationExists: fs.existsSync(e.dst), cleaned: true };

  if (cleanupResult.destinationExists && !cleanupResult.cleaned) {
    console.log(`[Skip] Reusing existing resource directory at ${e.dst}`);
    return;
  }

  try {
    fs.cpSync(e.src, e.dst, { recursive: true });
    console.log(`[Success] Copied resources from ${e.src} to ${e.dst}`);
  } catch (err) {
    if (isAccessDeniedError(err)) {
      console.warn(`[Warning] Reusing locked resource directory at ${e.dst}: ${err.message}`);
      return;
    }

    console.error(`[Error] Failed to copy resources from ${e.src} to ${e.dst}: ${err.message}`);
  }
});
