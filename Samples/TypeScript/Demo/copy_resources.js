/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

"use strict";
const fs = require('fs');
const publicResources = [
  {src: '../../../Core', dst: './public/Core'},
  {src: '../../Resources', dst: './public/Resources'},
  {src: '../../../Framework/Shaders', dst: './public/Framework/Shaders'},
];

publicResources.forEach((e) => {
  try {
    if (fs.existsSync(e.dst)) {
      fs.rmSync(e.dst, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[Warning] Could not clean directory ${e.dst}: ${err.message}. Overwriting files in-place instead.`);
  }
});

publicResources.forEach((e) => {
  try {
    fs.cpSync(e.src, e.dst, { recursive: true });
    console.log(`[Success] Copied resources from ${e.src} to ${e.dst}`);
  } catch (err) {
    console.error(`[Error] Failed to copy resources from ${e.src} to ${e.dst}: ${err.message}`);
  }
});
