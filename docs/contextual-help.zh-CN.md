# 插件说明提示示例

本示例用于接口 2 自定义工作区，使用浏览器 DOM 和已有的 `MEPlugin.ready()`、`MEPlugin.subscribe()`；不增加权限，不调用主体内部组件。它只演示说明交互，不执行识别或写入。

在[完整指南](plugin-development-guide.zh-CN.md)第 6 节可运行示例基础上，将下面 HTML 加到 `ui/index.html` 的 `main` 内，CSS 追加到 `ui/style.css`，JavaScript 追加到 `ui/app.js`。保持脚本、样式以相对路径加载；不使用内联事件或脚本。原清单已包含这三个文件，无需增加清单字段。

主体的 `public-help.js/css` 及其 DOM 标记不是插件 SDK。接口 1 表单由 ME 渲染，使用规范已有的描述字段，不添加臆造的帮助字段。接口 2 沙箱不继承主体 DOM、脚本或样式；不要访问父页面、复制主体桥接代码，或调用不存在的 `MEPlugin.help`。以下 `mountExampleHelp` 是插件自己定义的函数。

普通补充说明放在对应控件旁的圈叹号按钮中。操作后果、权限、删除风险、错误和实时状态必须直接可见，确认仍通过主体规定的流程完成。提示只承载简短纯文本，不在其中放交互表单。

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

## 验证要求

- Tab 聚焦和点击、触摸立即显示；鼠标悬停延迟显示，移动到提示内容时保持打开。
- 提示打开时 Escape 只关闭提示，不能同时关闭插件弹窗、停止任务或触发保存；再次 Escape 的行为由所在窗口决定。
- 按钮有与控件相关的可读名称，`aria-describedby` 关联说明，焦点清晰；图标不能作为唯一可访问名称。
- 中英文切换同步更新已打开提示与可读名称，不清空输入；主题使用 ME 变量，开发者明确覆盖的颜色仅作用于自己的插件。
- 在窄窗口、滚动容器、弹窗和窗口边缘检查位置与长文本滚动。弹层只能在插件 iframe 范围内显示，不能跨越主体边界。
- 同一节点重复挂载返回同一清理函数；重建前调用该函数，移除节点或关闭页面会清理监听、订阅、计时器和观察器。动态列表使用唯一说明 ID，不直接重复本例的 ID。
- 该示例使用宿主浏览器的 Popover API，必须在声明支持的 ME 版本中验证。不要把原生 `title` 当作唯一帮助入口。
