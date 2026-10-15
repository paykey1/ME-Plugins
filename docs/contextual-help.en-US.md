# Plugin contextual help example

This API 2 workspace example uses browser DOM APIs and the existing `MEPlugin.ready()` and `MEPlugin.subscribe()` methods. It needs no additional permissions and does not call host UI internals. It demonstrates contextual help only; it does not run recognition or write data.

Start from the runnable example in section 6 of the [complete guide](plugin-development-guide.en-US.md). Add the HTML below inside `main` in `ui/index.html`, append the CSS to `ui/style.css`, and append the JavaScript to `ui/app.js`. Keep relative script and stylesheet references; do not use inline scripts or event handlers. The existing manifest already includes these three files; no extra manifest fields are needed.

The host's `public-help.js/css` and DOM annotations are not plugin SDK APIs. ME renders API 1 forms: use documented description fields, never invent help fields. API 2 sandbox frames do not inherit host DOM, scripts or styles. Do not access the parent page, copy host bridge code or call a nonexistent `MEPlugin.help` method. The `mountExampleHelp` function below belongs to the plugin itself.

Put ordinary supplementary information behind a circled exclamation button next to its control. Consequences, permissions, deletion risks, errors and live status must remain directly visible; required confirmation still follows the host contract. Help contains short plain text, not interactive forms.

## HTML

<!-- help-example:html -->
```html
<section id="threshold-field" class="example-field">
  <div class="example-label-row">
    <label for="threshold" data-label></label>
    <button type="button" class="example-help" data-help aria-describedby="threshold-help">!</button>
  </div>
  <input id="threshold" type="number" min="0" max="1" step="0.05" value="0.35">
  <div id="threshold-help" class="example-help-text" role="tooltip" popover="manual"></div>
  <p data-state role="status" aria-live="polite"></p>
</section>
```

## CSS

<!-- help-example:css -->
```css
.example-field { min-width: 0; }
.example-label-row { display: flex; align-items: center; gap: .5rem; }
.example-help { border: 1px solid var(--line); border-radius: 50%; width: 1.75rem;
  height: 1.75rem; padding: 0; color: var(--muted); background: var(--panel); cursor: pointer; }
.example-help:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
.example-help-text { position: fixed; inset: auto; margin: 0; box-sizing: border-box;
  width: max-content; max-width: min(24rem, calc(100vw - 16px)); max-height: calc(100vh - 16px);
  overflow: auto; overflow-wrap: anywhere; padding: .75rem; border: 1px solid var(--line);
  border-radius: .5rem; color: var(--ink); background: var(--panel); }
```

## JavaScript

<!-- help-example:js -->
```js
// Plugin-owned example helper, not an ME SDK method.
const exampleHelpInstances = new WeakMap();
function mountExampleHelp(root) {
  if (exampleHelpInstances.has(root)) return exampleHelpInstances.get(root);
  const button = root.querySelector('[data-help]');
  const tip = root.querySelector('[role="tooltip"]');
  const abort = new AbortController(), options = { signal: abort.signal };
  let alive = true, hoverTimer, leaveTimer;
  const isOpen = () => tip.matches(':popover-open');
  function close() {
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    if (isOpen()) tip.hidePopover();
  }
  function position() {
    if (!isOpen()) return;
    const anchor = button.getBoundingClientRect(), box = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(anchor.left, innerWidth - box.width - 8)) + 'px';
    tip.style.top = Math.max(8, Math.min(anchor.bottom + 8, innerHeight - box.height - 8)) + 'px';
  }
  function show() {
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    if (!alive || !button.isConnected) return;
    if (!isOpen()) tip.showPopover();
    position();
  }
  const text = {
    'en-US': { label: 'Threshold', help: 'About the threshold',
      body: 'A higher threshold keeps fewer, more confident results. This field is a demonstration only.',
      state: 'Example only; no files are changed.' },
    'zh-CN': { label: '\u8bc6\u522b\u9608\u503c', help: '\u8bc6\u522b\u9608\u503c\u8bf4\u660e',
      body: '\u9608\u503c\u8d8a\u9ad8\uff0c\u4fdd\u7559\u7684\u7ed3\u679c\u8d8a\u5c11\uff0c\u7f6e\u4fe1\u5ea6\u8d8a\u9ad8\u3002\u672c\u5b57\u6bb5\u4ec5\u4f5c\u6f14\u793a\u3002',
      state: '\u4ec5\u4f5c\u6f14\u793a\uff0c\u4e0d\u4fee\u6539\u6587\u4ef6\u3002' }
  };
  function render(locale) {
    if (!alive) return;
    const value = text[locale] || text['en-US'];
    root.querySelector('[data-label]').textContent = value.label;
    button.setAttribute('aria-label', value.help);
    tip.textContent = value.body;
    root.querySelector('[data-state]').textContent = value.state;
    position(); // Does not rebuild inputs or clear the current value.
  }
  const listen = (target, type, handler, extra = {}) => target.addEventListener(type, handler, { ...options, ...extra });
  const leave = () => { clearTimeout(hoverTimer); leaveTimer = setTimeout(close, 150); };
  listen(button, 'pointerenter', () => { clearTimeout(leaveTimer); hoverTimer = setTimeout(show, 500); });
  listen(button, 'pointerleave', leave);
  listen(button, 'focus', show); listen(button, 'blur', leave);
  listen(button, 'click', event => { event.preventDefault(); event.stopPropagation(); show(); });
  listen(tip, 'pointerenter', () => clearTimeout(leaveTimer)); listen(tip, 'pointerleave', leave);
  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && isOpen()) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }, { capture: true });
  listen(document, 'pointerdown', event => { if (!button.contains(event.target) && !tip.contains(event.target)) close(); }, { capture: true });
  listen(document, 'scroll', event => { if (!tip.contains(event.target)) close(); }, { capture: true });
  listen(window, 'resize', close);
  listen(document, 'visibilitychange', () => { if (document.hidden) close(); });
  const unsubscribe = MEPlugin.subscribe(event => { if (event.type === 'context') render(event.locale); });
  render('en-US');
  MEPlugin.ready().then(context => render(context.locale)).catch(() => {});
  function dispose() {
    if (!alive) return;
    alive = false; close(); abort.abort(); unsubscribe(); observer.disconnect();
    exampleHelpInstances.delete(root);
  }
  const observer = new MutationObserver(() => { if (!root.isConnected) dispose(); });
  observer.observe(document.body, { childList: true, subtree: true });
  listen(window, 'unload', dispose, { once: true });
  exampleHelpInstances.set(root, dispose);
  return dispose;
}
mountExampleHelp(document.querySelector('#threshold-field'));
```

## Verification requirements

- Tab focus, click and touch open help immediately. Hover opens after a delay; moving onto the text keeps it open.
- While help is open, Escape closes only the help, without closing the plugin dialog, stopping a task or saving. A subsequent Escape follows the containing window's behavior.
- Give the button a readable name tied to its control, an `aria-describedby` relationship and visible focus. The icon alone is not an accessible name.
- Language changes update open help and accessible names without clearing inputs. Use ME theme variables; explicit developer color overrides stay within the plugin.
- Test narrow windows, scrolling containers, dialogs, viewport edges and long-text scrolling. A popover stays inside its plugin iframe; it cannot escape the host boundary.
- Repeated mounting of the same node returns the same disposer. Call it before rebuilding; removing the node or closing the page cleans up listeners, subscriptions, timers and observers. Dynamic lists need unique help IDs; do not duplicate the example's IDs.
- This example uses the host browser's Popover API. Verify it in every ME version you claim to support. A native `title` must not be the only help entry point.
