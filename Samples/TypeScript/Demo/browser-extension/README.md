# HARUKA Kintara Companion Extension

This extension is the browser surface for HARUKA's Kintara gaming companion flow.

## What it does

- Detects a Kintara browser tab
- Starts a compact in-tab HARUKA overlay
- Captures the visible tab on an interval
- Sends the frame and page context to `/api/haruka/game-frame`
- Shows HARUKA's short gaming reactions back on top of the tab

## Load locally

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Choose `Load unpacked`
4. Select this folder:

`Samples/TypeScript/Demo/browser-extension`

## Runtime target

By default the popup points to:

`http://127.0.0.1:5000`

That means the HARUKA app should be running locally with:

```bash
npm start
```

You can also point it to a deployed HARUKA runtime if that deployment exposes:

- `/api/haruka/chat`
- `/api/haruka/game-frame`

## Notes

- The popup now checks whether the HARUKA runtime is reachable before you start.
- Manual start acts as an override for the current tab, so beta testers can run it even if the game URL pattern is not perfect yet.
- The overlay uses browser speech synthesis as a lightweight speech fallback.
- For frame analysis, the runtime can use `HARUKA_VISION_API_KEY`, `HARUKA_VISION_BASE_URL`, and `HARUKA_VISION_MODEL`.
- If no vision provider is configured, the runtime falls back to page-context heuristics.

## Beta sharing mode

To share this as a public beta, edit:

`Samples/TypeScript/Demo/browser-extension/runtime-config.json`

Recommended values:

```json
{
  "runtimeOrigin": "https://your-public-haruka.example.com",
  "captureIntervalSec": 12,
  "betaLabel": "HARUKA Private Beta",
  "betaNote": "Pointed to the hosted HARUKA runtime for Kintara testing."
}
```

How it works:

- If `runtimeOrigin` is filled, new installs default to that public runtime automatically
- Friends can still override it from the popup if needed
- `Reset To Bundled Beta Defaults` returns the popup to the value from `runtime-config.json`

Recommended beta distribution flow:

1. Deploy HARUKA runtime publicly
2. Confirm `/api/haruka/health` and `/api/haruka/game-frame` are live on that URL
3. Fill `runtime-config.json` with that public origin
4. Zip the entire `browser-extension` folder
5. Send the zip plus short tester instructions
6. Testers extract it and use `Load unpacked`

## Fast beta flow for friends

1. Extract the shared `browser-extension` folder
2. Open `chrome://extensions` or `edge://extensions`
3. Enable `Developer mode`
4. Choose `Load unpacked`
5. Select the extracted `browser-extension` folder
6. Open the Kintara game tab
7. Open the extension popup
8. Make sure `Runtime` shows `Connected`
9. Click `Start Kintara Companion`
10. The overlay should appear on top of the current tab
