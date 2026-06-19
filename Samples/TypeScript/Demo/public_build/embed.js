(function () {
  if (window.__harukaEmbedLoaded) {
    return;
  }

  window.__harukaEmbedLoaded = true;

  var currentScript = document.currentScript;
  if (!currentScript) {
    return;
  }

  var scriptUrl = new URL(currentScript.src, window.location.href);
  var apiKey = currentScript.getAttribute('data-api-key') || '';
  var lang = currentScript.getAttribute('data-lang') || 'en';
  var defaultOpen = (currentScript.getAttribute('data-open') || 'true').toLowerCase() !== 'false';
  var widgetUrl = new URL('widget.html', scriptUrl);
  widgetUrl.searchParams.set('embed', '1');
  widgetUrl.searchParams.set('lang', lang === 'jp' ? 'jp' : 'en');
  if (apiKey) {
    widgetUrl.searchParams.set('apiKey', apiKey);
  }

  var state = { open: defaultOpen };
  var root = document.createElement('div');
  root.setAttribute('data-haruka-embed-root', 'true');
  root.style.position = 'fixed';
  root.style.right = '20px';
  root.style.bottom = '20px';
  root.style.zIndex = '2147483000';
  root.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';

  var launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.textContent = 'HARUKA';
  launcher.setAttribute('aria-label', 'Toggle HARUKA widget');
  launcher.style.height = '56px';
  launcher.style.minWidth = '56px';
  launcher.style.padding = '0 18px';
  launcher.style.border = '0';
  launcher.style.borderRadius = '999px';
  launcher.style.background = 'linear-gradient(135deg, #d7a434, #7b5533)';
  launcher.style.color = '#fff';
  launcher.style.fontWeight = '700';
  launcher.style.letterSpacing = '0.08em';
  launcher.style.boxShadow = '0 18px 44px rgba(20, 16, 10, 0.28)';
  launcher.style.cursor = 'pointer';

  var frame = document.createElement('iframe');
  frame.src = widgetUrl.toString();
  frame.title = 'HARUKA Companion Widget';
  frame.allow = 'microphone; autoplay';
  frame.style.width = '390px';
  frame.style.height = '640px';
  frame.style.maxWidth = 'calc(100vw - 24px)';
  frame.style.maxHeight = 'calc(100vh - 92px)';
  frame.style.border = '0';
  frame.style.borderRadius = '28px';
  frame.style.background = '#09111b';
  frame.style.boxShadow = '0 28px 80px rgba(9, 17, 27, 0.35)';
  frame.style.overflow = 'hidden';
  frame.style.display = state.open ? 'block' : 'none';
  frame.style.marginBottom = '12px';

  function sync() {
    frame.style.display = state.open ? 'block' : 'none';
    launcher.textContent = state.open ? 'Close HARUKA' : 'HARUKA';
  }

  launcher.addEventListener('click', function () {
    state.open = !state.open;
    sync();
  });

  window.addEventListener('message', function (event) {
    if (!event || !event.data || typeof event.data !== 'object') {
      return;
    }

    if (event.data.type === 'haruka-widget-toggle') {
      state.open = Boolean(event.data.open);
      sync();
    }
  });

  root.appendChild(frame);
  root.appendChild(launcher);
  document.body.appendChild(root);
  sync();
})();
