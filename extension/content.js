// HTML Feedback – Content Script
// Wird per Klick auf das Extension-Icon in die Seite injiziert.
// Ein weiterer Klick blendet die Oberfläche aus bzw. wieder ein.
(() => {
  'use strict';
  if (window.__htmlFeedback) { window.__htmlFeedback.toggle(); return; }

  const PAGE_KEY = 'hf:page:' + location.href.split('#')[0];
  const PREFS_KEY = 'hf:prefs';
  const MAX_SHOT_PX = 1600;
  const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Strg';

  const HINTS = {
    element: 'Klick = Element kommentieren · Alt+↑ / Alt+↓ = größeres / kleineres Element · Shift+Ziehen = Bereich',
    region: 'Ziehen = Bereich mit Screenshot · Klick = Punkt kommentieren',
    off: 'Seite normal bedienen (z. B. Menü aufklappen), danach wieder „Element“ oder „Bereich“ wählen.',
  };

  const state = {
    visible: true,
    mode: 'element',          // 'element' | 'region' | 'off'
    items: [],
    candidate: null,          // aktuell hervorgehobenes Element
    rawTarget: null,          // Element direkt unter der Maus
    downStack: [],            // für Alt+↓ nach Alt+↑
    drag: null,               // { x0, y0 } beim Aufziehen eines Bereichs
    suppressClick: false,
    popup: null,              // { item, isNew }
    markItem: null,           // Element/Bereich, der gerade umrandet wird
    prefs: { side: 'right', collapsed: false },
  };

  // ---------------------------------------------------------------- UI

  const STYLES = `
    :host { all: initial; }
    [hidden] { display: none !important; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
    button { font: inherit; cursor: pointer; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    .hl { position: fixed; border: 2px solid #2563eb; background: rgba(37,99,235,.10); border-radius: 2px; pointer-events: none; }
    .hl-label { position: absolute; left: -2px; bottom: 100%; margin-bottom: 2px; background: #2563eb; color: #fff;
      font: 600 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
    .hl.inside .hl-label { bottom: auto; top: 0; margin: 0; border-radius: 0 0 3px 0; }
    .mark { position: fixed; border: 2px solid #db2777; background: rgba(219,39,119,.08); border-radius: 2px; pointer-events: none; }
    .drag { position: fixed; border: 2px dashed #db2777; background: rgba(219,39,119,.08); pointer-events: none; }

    .pin { position: fixed; left: 0; top: 0; width: 22px; height: 22px; padding: 0; border-radius: 50%;
      background: #db2777; color: #fff; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4);
      font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; pointer-events: auto; }
    .pin:hover { transform-origin: center; filter: brightness(1.15); }

    .panel { position: fixed; top: 12px; right: 12px; bottom: 12px; width: 320px; display: flex; flex-direction: column;
      background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,.20); pointer-events: auto; font-size: 13px; line-height: 1.4; overflow: hidden; }
    .panel.left { right: auto; left: 12px; }
    .panel.collapsed { bottom: auto; }
    .panel.collapsed .body, .panel.collapsed footer { display: none; }
    header { display: flex; align-items: center; gap: 2px; padding: 8px 8px 8px 14px; border-bottom: 1px solid #f1f1f1; }
    header strong { font-size: 13px; }
    .count { margin-left: 6px; color: #6b7280; font-weight: 400; }
    .spacer { flex: 1; }
    .icon { border: 0; background: transparent; color: #4b5563; width: 26px; height: 26px; border-radius: 6px; font-size: 14px; }
    .icon:hover { background: #f3f4f6; color: #111827; }

    .body { flex: 1; overflow: auto; padding: 12px 14px; }
    .modes { display: flex; background: #f3f4f6; border-radius: 8px; padding: 3px; gap: 3px; }
    .modes button { flex: 1; border: 0; background: transparent; padding: 5px 0; border-radius: 6px; color: #374151; }
    .modes button[aria-pressed="true"] { background: #fff; color: #111827; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.12); }
    .hint { color: #6b7280; font-size: 12px; margin: 8px 0 12px; }

    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; cursor: pointer; }
    .item:hover { border-color: #db2777; }
    .item-head { display: flex; align-items: center; gap: 6px; }
    .item-label { flex: 1; min-width: 0; color: #6b7280; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-head .icon { width: 22px; height: 22px; font-size: 12px; }
    .item-comment { margin-top: 4px; white-space: pre-wrap; word-break: break-word; }
    .item img { display: block; margin-top: 6px; max-width: 100%; max-height: 90px; border: 1px solid #f1f1f1; border-radius: 4px; }
    .badge { flex: none; display: inline-block; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
      background: #db2777; color: #fff; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; }
    .empty { color: #9ca3af; text-align: center; margin: 24px 0; }

    footer { border-top: 1px solid #f1f1f1; padding: 10px 14px 12px; }
    .actions { display: flex; gap: 6px; }
    .btn { border: 1px solid #d1d5db; background: #fff; color: #1f2937; border-radius: 7px; padding: 6px 10px; }
    .btn:hover:not(:disabled) { background: #f9fafb; }
    .btn:disabled { opacity: .45; cursor: not-allowed; }
    .btn.primary { background: #db2777; border-color: #db2777; color: #fff; }
    .btn.primary:hover:not(:disabled) { background: #be185d; }
    .btn.danger { color: #b91c1c; }
    .note { color: #6b7280; font-size: 11.5px; margin: 8px 0 0; }

    .popup { position: fixed; width: 340px; background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0,0,0,.25); padding: 12px; pointer-events: auto; font-size: 13px; }
    .popup-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .popup-title { min-width: 0; color: #4b5563; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .popup img { display: block; max-width: 100%; max-height: 140px; margin: 0 auto 8px; border: 1px solid #eee; border-radius: 4px; }
    .popup textarea { display: block; width: 100%; min-height: 90px; resize: vertical; border: 1px solid #d1d5db; border-radius: 7px;
      padding: 8px; font: inherit; color: inherit; background: #fff; outline: none; }
    .popup textarea:focus { border-color: #db2777; box-shadow: 0 0 0 3px rgba(219,39,119,.15); }
    .popup textarea.invalid { border-color: #dc2626; }
    .popup-actions { display: flex; gap: 6px; margin-top: 8px; }

    .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); max-width: min(560px, 90vw);
      background: #111827; color: #fff; padding: 9px 14px; border-radius: 8px; font-size: 13px; white-space: pre-line;
      box-shadow: 0 6px 20px rgba(0,0,0,.3); pointer-events: none; word-break: break-all; }
    .toast.error { background: #b91c1c; }
  `;

  const host = document.createElement('html-feedback-overlay');
  host.setAttribute('style', 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${STYLES}</style>
    <div class="hl" hidden><span class="hl-label"></span></div>
    <div class="mark" hidden></div>
    <div class="drag" hidden></div>
    <div class="pins"></div>
    <aside class="panel">
      <header>
        <strong>HTML Feedback<span class="count"></span></strong>
        <span class="spacer"></span>
        <button class="icon" data-act="side" title="Panel auf die andere Seite">⇆</button>
        <button class="icon" data-act="collapse" title="Ein-/Ausklappen">▾</button>
        <button class="icon" data-act="close" title="Ausblenden (Kommentare bleiben erhalten)">✕</button>
      </header>
      <div class="body">
        <div class="modes">
          <button data-mode="element">Element</button>
          <button data-mode="region">Bereich</button>
          <button data-mode="off">Aus</button>
        </div>
        <p class="hint"></p>
        <ol class="list"></ol>
        <p class="empty">Noch keine Kommentare.</p>
      </div>
      <footer>
        <div class="actions">
          <button class="btn" data-act="copy">Kopieren</button>
          <button class="btn primary" data-act="export" title="⌥/Alt-Klick: Speicherort wählen">Exportieren</button>
          <span class="spacer"></span>
          <button class="btn danger" data-act="clear" title="Alle Kommentare löschen">Löschen</button>
        </div>
        <p class="note"></p>
      </footer>
    </aside>
    <div class="popup" hidden>
      <div class="popup-head"><span class="badge"></span><span class="popup-title mono"></span></div>
      <img alt="" hidden>
      <textarea placeholder="Was soll sich hier ändern?"></textarea>
      <div class="popup-actions">
        <button class="btn danger" data-act="delete">Löschen</button>
        <span class="spacer"></span>
        <button class="btn" data-act="cancel">Abbrechen</button>
        <button class="btn primary" data-act="save">Speichern ${MOD}↵</button>
      </div>
    </div>
    <div class="toast" hidden></div>
  `;
  document.documentElement.appendChild(host);

  const $ = (sel) => root.querySelector(sel);
  const ui = {
    hl: $('.hl'), hlLabel: $('.hl-label'), mark: $('.mark'), drag: $('.drag'), pins: $('.pins'),
    panel: $('.panel'), count: $('.count'), hint: $('.hint'), list: $('.list'), empty: $('.empty'), note: $('.note'),
    copy: $('[data-act="copy"]'), export: $('[data-act="export"]'), clear: $('[data-act="clear"]'),
    popup: $('.popup'), popupBadge: $('.popup .badge'), popupTitle: $('.popup-title'), popupImg: $('.popup img'),
    textarea: $('.popup textarea'), popupDelete: $('[data-act="delete"]'), toast: $('.toast'),
  };

  // ---------------------------------------------------------------- Hilfsfunktionen

  const swallow = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const ownEvent = (e) => e.composedPath().includes(host);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clip = (s, n) => (s.length > n ? s.slice(0, n) + ' …[gekürzt]' : s);
  const textOf = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));
  const localIso = (d = new Date()) => d.toLocaleString('sv-SE').replace(' ', 'T');

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function placeBox(el, r) {
    Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  }

  function rectFrom(x0, y0, x1, y1) {
    return new DOMRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  }

  function clipToViewport(r) {
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    const w = Math.min(innerWidth, r.right) - x, h = Math.min(innerHeight, r.bottom) - y;
    return w > 1 && h > 1 ? new DOMRect(x, y, w, h) : null;
  }

  const toPageRect = (r) => ({
    x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
  });

  function shortName(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = [...el.classList].slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    return s;
  }

  function isUnique(sel) {
    try { return document.querySelectorAll(sel).length === 1; } catch { return false; }
  }

  // Möglichst kurzer, eindeutiger und lesbarer CSS-Selektor.
  function cssPath(el) {
    if (el.id && isUnique('#' + CSS.escape(el.id))) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let cur = el; cur && cur.nodeType === 1 && cur !== document.documentElement; cur = cur.parentElement) {
      if (cur !== el && cur.id && isUnique('#' + CSS.escape(cur.id))) {
        parts.unshift('#' + CSS.escape(cur.id));
        break;
      }
      let part = cur.tagName.toLowerCase();
      const cls = [...cur.classList].filter((c) => /^[a-zA-Z_-][\w-]*$/.test(c) && c.length < 40).slice(0, 2);
      if (cls.length) part += '.' + cls.map((c) => CSS.escape(c)).join('.');
      const parent = cur.parentElement;
      if (parent) {
        const same = [...parent.children].filter((s) => s.tagName === cur.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      if (isUnique(parts.join(' > '))) break;
    }
    return parts.join(' > ');
  }

  const STYLE_PROPS = ['display', 'position', 'width', 'height', 'margin', 'padding', 'font-family', 'font-size',
    'font-weight', 'line-height', 'color', 'background-color', 'border', 'border-radius', 'text-align'];
  const FLEX_PROPS = ['flex-direction', 'justify-content', 'align-items', 'gap'];
  const GRID_PROPS = ['grid-template-columns', 'align-items', 'gap'];
  const BORING = new Set(['none', 'normal', 'auto', '0px', 'rgba(0, 0, 0, 0)', 'static']);

  function pickStyles(el) {
    const cs = getComputedStyle(el);
    const props = [...STYLE_PROPS];
    if (cs.display.includes('flex')) props.push(...FLEX_PROPS);
    else if (cs.display.includes('grid')) props.push(...GRID_PROPS);
    const out = {};
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      if (v && !BORING.has(v) && !v.startsWith('0px none')) out[p] = v;
    }
    return out;
  }

  function describeElement(el) {
    return {
      selector: cssPath(el),
      label: shortName(el),
      text: clip(textOf(el), 300),
      html: clip(el.outerHTML, 2000),
      styles: pickStyles(el),
    };
  }

  function pageElementAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el !== host && el !== document.documentElement) return el;
    }
    return null;
  }

  function commonAncestor(els) {
    let a = els[0];
    while (a && !els.every((e) => a.contains(e))) a = a.parentElement;
    return a;
  }

  // Welche Elemente liegen in einem aufgezogenen Bereich? (Stichproben auf einem Raster)
  function coveredElements(r) {
    const found = new Set();
    const N = 6;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const el = pageElementAt(r.left + (r.width * (i + 0.5)) / N, r.top + (r.height * (j + 0.5)) / N);
        if (el) found.add(el);
      }
    }
    const all = [...found];
    const anc = all.length ? commonAncestor(all) : null;
    // Innerste Elemente zuerst, umschließende Container danach, den gemeinsamen Container nicht doppelt.
    const isLeaf = (e) => !all.some((o) => o !== e && e.contains(o));
    const els = all.filter((e) => e !== anc);
    els.sort((a, b) => isLeaf(b) - isLeaf(a));
    return {
      commonAncestor: anc ? { selector: cssPath(anc), label: shortName(anc) } : null,
      elements: els.slice(0, 15).map((e) => ({ selector: cssPath(e), text: clip(textOf(e), 80) })),
    };
  }

  // ---------------------------------------------------------------- Screenshots

  function dataUrlToBlob(dataUrl) {
    const [meta, b64] = dataUrl.split(',');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: meta.slice(5).split(';')[0] });
  }

  // r: Ausschnitt in Viewport-Koordinaten; marker: optionaler Punkt (Viewport), der eingezeichnet wird.
  async function shoot(r, marker) {
    r = clipToViewport(r);
    if (!r) return null;
    host.style.visibility = 'hidden';
    let res;
    try {
      await frames();
      res = await chrome.runtime.sendMessage({ type: 'hf-capture' });
    } catch (err) {
      res = { error: err.message };
    } finally {
      host.style.visibility = '';
    }
    if (!res?.dataUrl) {
      toast('Screenshot nicht möglich: ' + (res?.error || 'keine Antwort') +
        '\nTipp: Seite neu laden und das Extension-Icon erneut klicken.', true);
      return null;
    }
    const img = await createImageBitmap(dataUrlToBlob(res.dataUrl));
    const s = img.width / innerWidth;                       // Gerätepixel pro CSS-Pixel
    const sw = r.width * s, sh = r.height * s;
    const k = Math.min(1, MAX_SHOT_PX / Math.max(sw, sh));  // ggf. verkleinern
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * k));
    canvas.height = Math.max(1, Math.round(sh * k));
    const g = canvas.getContext('2d');
    g.drawImage(img, r.left * s, r.top * s, sw, sh, 0, 0, canvas.width, canvas.height);
    if (marker) {
      const f = s * k, mx = (marker.x - r.left) * f, my = (marker.y - r.top) * f;
      g.lineWidth = 3 * f;
      g.strokeStyle = '#db2777';
      g.beginPath(); g.arc(mx, my, 12 * f, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#db2777';
      g.beginPath(); g.arc(mx, my, 3 * f, 0, Math.PI * 2); g.fill();
    }
    let data = canvas.toDataURL('image/webp', 0.85);
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.85);
    return { data, width: canvas.width, height: canvas.height };
  }

  // ---------------------------------------------------------------- Auswahl

  function showHighlight(el) {
    const r = el.getBoundingClientRect();
    placeBox(ui.hl, r);
    ui.hl.classList.toggle('inside', r.top < 22);
    ui.hlLabel.textContent = `${shortName(el)}  ${Math.round(r.width)}×${Math.round(r.height)}`;
    ui.hl.hidden = false;
  }

  function hideHighlight() {
    ui.hl.hidden = true;
  }

  function newItem(kind) {
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, comment: '', created: localIso() };
  }

  async function selectElement(el) {
    hideHighlight();
    const r = el.getBoundingClientRect();
    const item = newItem('element');
    item.element = describeElement(el);
    item.rect = toPageRect(r);
    item._el = el;
    item.screenshot = await shoot(new DOMRect(r.left - 8, r.top - 8, r.width + 16, r.height + 16));
    openPopup(item, true);
  }

  function startDrag(e) {
    hideHighlight();
    state.drag = { x0: e.clientX, y0: e.clientY };
    placeBox(ui.drag, new DOMRect(e.clientX, e.clientY, 0, 0));
    ui.drag.hidden = false;
  }

  async function finishDrag(e) {
    const { x0, y0 } = state.drag;
    state.drag = null;
    ui.drag.hidden = true;
    state.suppressClick = true;
    setTimeout(() => { state.suppressClick = false; }, 300);

    let r = rectFrom(x0, y0, e.clientX, e.clientY);
    let item;
    if (r.width < 6 && r.height < 6) {
      item = newItem('point');
      item.point = { x: Math.round(x0 + scrollX), y: Math.round(y0 + scrollY) };
      const el = pageElementAt(x0, y0);
      if (el) item.element = describeElement(el);
      r = clipToViewport(new DOMRect(x0 - 160, y0 - 100, 320, 200));
      item.rect = toPageRect(r);
      item.screenshot = await shoot(r, { x: x0, y: y0 });
    } else {
      item = newItem('region');
      item.rect = toPageRect(r);
      item.covered = coveredElements(r);
      item.screenshot = await shoot(r);
    }
    openPopup(item, true);
  }

  // ---------------------------------------------------------------- Event-Handler (Seite)

  const blocking = (e) => state.visible && !ownEvent(e) && (state.popup || state.mode !== 'off');

  function onPointerMove(e) {
    if (!state.visible) return;
    if (state.drag) { placeBox(ui.drag, rectFrom(state.drag.x0, state.drag.y0, e.clientX, e.clientY)); return; }
    if (state.mode !== 'element' || state.popup) return;
    if (ownEvent(e)) { hideHighlight(); state.rawTarget = state.candidate = null; return; }
    const t = e.target;
    if (!(t instanceof Element) || t === document.documentElement) return;
    if (t !== state.rawTarget) {
      state.rawTarget = state.candidate = t;
      state.downStack = [];
      showHighlight(t);
    }
  }

  function onPointerDown(e) {
    if (!blocking(e) || e.button !== 0) return;
    swallow(e);
    if (state.popup) { ui.textarea.focus(); return; }
    if (state.mode === 'region' || e.shiftKey) startDrag(e);
  }

  function onPointerUp(e) {
    if (state.drag) { swallow(e); finishDrag(e); return; }
    if (blocking(e)) swallow(e);
  }

  function onClick(e) {
    if (!state.visible || ownEvent(e)) return;
    if (state.suppressClick) { state.suppressClick = false; swallow(e); return; }
    if (!blocking(e)) return;
    swallow(e);
    if (state.mode === 'element' && !state.popup && state.candidate) selectElement(state.candidate);
  }

  function onMouseBlock(e) {
    if (blocking(e) || state.drag) swallow(e);
  }

  function onKeyDown(e) {
    if (!state.visible) return;
    if (ownEvent(e)) {
      // Tastendrücke in unserem Textfeld nicht an die Seite weiterreichen (Shortcuts der Seite).
      e.stopImmediatePropagation();
      if (state.popup && e.key === 'Escape') { e.preventDefault(); cancelPopup(); }
      else if (state.popup && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); savePopup(); }
      return;
    }
    if (e.key === 'Escape' && state.drag) {
      swallow(e); state.drag = null; ui.drag.hidden = true;
    } else if (e.key === 'Escape' && state.popup) {
      swallow(e); cancelPopup();
    } else if (state.mode === 'element' && !state.popup && state.candidate && e.altKey
               && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      swallow(e);
      if (e.key === 'ArrowUp') {
        const p = state.candidate.parentElement;
        if (p && p !== document.documentElement) { state.downStack.push(state.candidate); state.candidate = p; }
      } else if (state.downStack.length) {
        state.candidate = state.downStack.pop();
      }
      showHighlight(state.candidate);
    }
  }

  function onKeyOther(e) {
    if (state.visible && ownEvent(e)) e.stopImmediatePropagation();
  }

  let scheduled = false;
  function onViewportChange() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (!state.visible) return;
      positionPins();
      if (state.candidate && !ui.hl.hidden) showHighlight(state.candidate);
      if (state.markItem) placeBox(ui.mark, itemViewRect(state.markItem));
    });
  }

  const listeners = [
    ['pointermove', onPointerMove], ['pointerdown', onPointerDown], ['pointerup', onPointerUp],
    ['click', onClick], ['mousedown', onMouseBlock], ['mouseup', onMouseBlock], ['dblclick', onMouseBlock],
    ['auxclick', onMouseBlock], ['selectstart', onMouseBlock], ['dragstart', onMouseBlock],
    ['keydown', onKeyDown], ['keyup', onKeyOther], ['keypress', onKeyOther],
    ['scroll', onViewportChange], ['resize', onViewportChange],
  ];
  for (const [type, fn] of listeners) window.addEventListener(type, fn, true);

  // ---------------------------------------------------------------- Popup (Kommentar)

  function itemLabel(it) {
    if (it.kind === 'element') return it.element.label;
    if (it.kind === 'region') return `Bereich ${it.rect.w}×${it.rect.h}`;
    return 'Punkt' + (it.element ? ' auf ' + it.element.label : '');
  }

  function resolveEl(it) {
    if (it._el?.isConnected) return it._el;
    if (!it.element) return null;
    try { it._el = document.querySelector(it.element.selector); } catch { it._el = null; }
    return it._el;
  }

  function itemViewRect(it) {
    if (it.kind === 'element') {
      const el = resolveEl(it);
      const r = el?.getBoundingClientRect();
      if (r && (r.width || r.height)) return r;
    }
    return new DOMRect(it.rect.x - scrollX, it.rect.y - scrollY, it.rect.w, it.rect.h);
  }

  function showMark(it) {
    state.markItem = it;
    if (!it) { ui.mark.hidden = true; return; }
    placeBox(ui.mark, itemViewRect(it));
    ui.mark.hidden = false;
  }

  function openPopup(item, isNew) {
    state.popup = { item, isNew };
    updateRootClass();
    showMark(item);
    ui.popupBadge.textContent = isNew ? state.items.length + 1 : item.n;
    ui.popupTitle.textContent = itemLabel(item);
    ui.popupImg.hidden = !item.screenshot;
    if (item.screenshot) ui.popupImg.src = item.screenshot.data;
    ui.textarea.value = item.comment || '';
    ui.textarea.classList.remove('invalid');
    ui.popupDelete.hidden = isNew;
    ui.popup.hidden = false;

    const r = itemViewRect(item);
    const pw = ui.popup.offsetWidth, ph = ui.popup.offsetHeight;
    let y = r.bottom + 10;
    if (y + ph > innerHeight - 12) y = r.top - ph - 10;
    if (y < 12) y = (innerHeight - ph) / 2;
    ui.popup.style.left = `${clamp(r.left, 12, innerWidth - pw - 12)}px`;
    ui.popup.style.top = `${clamp(y, 12, Math.max(12, innerHeight - ph - 12))}px`;
    ui.textarea.focus();
  }

  function closePopup() {
    state.popup = null;
    state.rawTarget = null;   // nächste Mausbewegung hebt wieder hervor
    ui.popup.hidden = true;
    showMark(null);
    updateRootClass();
  }

  function savePopup() {
    const text = ui.textarea.value.trim();
    if (!text) { ui.textarea.classList.add('invalid'); ui.textarea.focus(); return; }
    const { item, isNew } = state.popup;
    item.comment = text;
    if (isNew) state.items.push(item);
    closePopup();
    changed();
  }

  function cancelPopup() {
    if (state.popup.isNew && ui.textarea.value.trim() && !confirm('Kommentar verwerfen?')) return;
    closePopup();
  }

  function deleteItem(it) {
    state.items = state.items.filter((x) => x !== it);
    if (state.popup?.item === it) closePopup();
    changed();
  }

  function editItem(it) {
    const el = it.kind === 'element' ? resolveEl(it) : null;
    if (el) el.scrollIntoView({ block: 'center' });
    else scrollTo({ top: it.rect.y - innerHeight / 3 });
    requestAnimationFrame(() => openPopup(it, false));
  }

  // ---------------------------------------------------------------- Panel

  function render() {
    state.items.forEach((it, i) => { it.n = i + 1; });
    const n = state.items.length;
    ui.count.textContent = n ? ` · ${n}` : '';
    ui.empty.hidden = n > 0;

    ui.list.replaceChildren(...state.items.map((it) => {
      const li = h('li', 'item');
      const head = h('div', 'item-head');
      const edit = h('button', 'icon', '✎'); edit.title = 'Bearbeiten';
      const del = h('button', 'icon', '🗑'); del.title = 'Löschen';
      head.append(h('span', 'badge', String(it.n)), h('span', 'item-label mono', itemLabel(it)), edit, del);
      li.append(head, h('div', 'item-comment', it.comment));
      if (it.screenshot) { const img = h('img'); img.src = it.screenshot.data; li.append(img); }
      li.addEventListener('mouseenter', () => { if (!state.popup) showMark(it); });
      li.addEventListener('mouseleave', () => { if (!state.popup) showMark(null); });
      li.addEventListener('click', () => editItem(it));
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteItem(it); });
      return li;
    }));

    const imageBound = hasImageItems();
    ui.copy.disabled = !n || imageBound;
    ui.export.disabled = !n;
    ui.clear.disabled = !n;
    ui.copy.title = imageBound
      ? 'Gesperrt: Bereichs-/Punkt-Kommentare brauchen ihren Screenshot – bitte exportieren.'
      : 'Feedback als JSON ohne Screenshots in die Zwischenablage';
    ui.note.textContent = !n ? ''
      : imageBound ? 'Enthält Bereichs-/Punkt-Screenshots – Kopieren ist gesperrt, bitte exportieren.'
      : 'Kopieren = nur Text (ohne Screenshots). Exportieren = komplettes Paket.';

    renderPins();
  }

  function renderPins() {
    ui.pins.replaceChildren(...state.items.map((it) => {
      const pin = h('button', 'pin', String(it.n));
      pin.title = it.comment;
      pin.addEventListener('click', () => openPopup(it, false));
      pin.addEventListener('mouseenter', () => { if (!state.popup) showMark(it); });
      pin.addEventListener('mouseleave', () => { if (!state.popup) showMark(null); });
      it._pin = pin;
      return pin;
    }));
    positionPins();
  }

  function positionPins() {
    for (const it of state.items) {
      if (!it._pin) continue;
      const p = it.kind === 'point'
        ? { x: it.point.x - scrollX, y: it.point.y - scrollY }
        : (({ left, top }) => ({ x: left, y: top }))(itemViewRect(it));
      it._pin.style.transform = `translate(${clamp(p.x - 11, 2, innerWidth - 24)}px, ${clamp(p.y - 11, 2, innerHeight - 24)}px)`;
    }
  }

  function setMode(mode) {
    state.mode = mode;
    for (const b of root.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    ui.hint.textContent = HINTS[mode];
    if (mode !== 'element') { hideHighlight(); state.candidate = state.rawTarget = null; }
    updateRootClass();
  }

  function updateRootClass() {
    document.documentElement.classList.toggle('hf-region-mode', state.visible && state.mode === 'region' && !state.popup);
  }

  function applyPrefs() {
    ui.panel.classList.toggle('left', state.prefs.side === 'left');
    ui.panel.classList.toggle('collapsed', state.prefs.collapsed);
  }

  function setVisible(v) {
    state.visible = v;
    host.style.display = v ? 'block' : 'none';
    if (!v) { hideHighlight(); state.drag = null; ui.drag.hidden = true; }
    else positionPins();
    updateRootClass();
  }

  let toastTimer;
  function toast(text, isError = false, ms = 3500) {
    ui.toast.textContent = text;
    ui.toast.classList.toggle('error', isError);
    ui.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, isError ? Math.max(ms, 6000) : ms);
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.mode) return setMode(btn.dataset.mode);
    switch (btn.dataset.act) {
      case 'close': return setVisible(false);
      case 'side': state.prefs.side = state.prefs.side === 'left' ? 'right' : 'left'; applyPrefs(); return savePrefs();
      case 'collapse': state.prefs.collapsed = !state.prefs.collapsed; applyPrefs(); return savePrefs();
      case 'copy': return copyTextPackage();
      case 'export': return exportPackage(e.altKey);
      case 'clear': return clearAll();
      case 'save': return savePopup();
      case 'cancel': return cancelPopup();
      case 'delete': return deleteItem(state.popup.item);
    }
  });

  // ---------------------------------------------------------------- Speichern / Export

  const hasImageItems = () => state.items.some((it) => it.kind !== 'element');
  const withoutPrivate = (items) => JSON.parse(JSON.stringify(items, (k, v) => (k.startsWith('_') ? undefined : v)));

  function changed() {
    render();
    chrome.storage.local.set({ [PAGE_KEY]: { url: location.href, items: withoutPrivate(state.items) } })
      .catch((err) => toast('Zwischenspeichern fehlgeschlagen: ' + err.message, true));
  }

  function savePrefs() {
    chrome.storage.local.set({ [PREFS_KEY]: state.prefs }).catch(() => {});
  }

  async function restore() {
    try {
      const got = await chrome.storage.local.get([PAGE_KEY, PREFS_KEY]);
      if (got[PREFS_KEY]) { Object.assign(state.prefs, got[PREFS_KEY]); applyPrefs(); }
      const items = got[PAGE_KEY]?.items;
      if (items?.length) {
        state.items = items;
        render();
        toast(`${items.length} gespeicherte${items.length === 1 ? 'r Kommentar' : ' Kommentare'} wiederhergestellt.`);
      }
    } catch (err) {
      toast('Gespeicherte Kommentare konnten nicht geladen werden: ' + err.message, true);
    }
  }

  function buildPackage(withImages) {
    return {
      format: 'html-feedback/1',
      page: {
        url: location.href,
        title: document.title,
        viewport: { width: innerWidth, height: innerHeight },
        devicePixelRatio,
        documentSize: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      },
      created: localIso(),
      ...(withImages ? {} : { note: 'Text-Export ohne Screenshots.' }),
      items: withoutPrivate(state.items).map((it) => ({
        n: it.n,
        kind: it.kind,
        comment: it.comment,
        ...(it.element && { element: it.element }),
        ...(it.point && { point: it.point }),
        rect: it.rect,
        ...(it.covered && { covered: it.covered }),
        ...(withImages && it.screenshot && { screenshot: it.screenshot }),
        created: it.created,
      })),
    };
  }

  function slug() {
    const last = location.pathname.split('/').filter(Boolean).pop();
    const base = (last ? decodeURIComponent(last) : location.hostname || document.title || 'seite').replace(/\.[a-z0-9]+$/i, '');
    return base.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'seite';
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('style', 'position:fixed;top:-1000px;opacity:0;');
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  async function copyTextPackage() {
    if (!state.items.length) return;
    if (hasImageItems()) return toast('Enthält Bereichs-/Punkt-Screenshots – bitte exportieren.', true);
    const ok = await copyText(JSON.stringify(buildPackage(false), null, 2));
    toast(ok ? 'Feedback (Text, ohne Screenshots) kopiert.' : 'Kopieren fehlgeschlagen.', !ok);
  }

  async function exportPackage(saveAs) {
    if (!state.items.length) return;
    const json = JSON.stringify(buildPackage(true), null, 2);
    const stamp = localIso().replace(/:\d\d$/, '').replace(/[-:]/g, '').replace('T', '-');
    toast('Exportiere …');
    let res;
    try {
      res = await chrome.runtime.sendMessage({
        type: 'hf-download', json, saveAs, filename: `html-feedback/feedback-${slug()}-${stamp}.json`,
      });
    } catch (err) {
      res = { error: err.message };
    }
    if (res?.cancelled) return toast('Export abgebrochen.');
    if (!res?.path) return toast('Export fehlgeschlagen: ' + (res?.error || 'keine Antwort'), true);
    const copied = await copyText(res.path);
    toast(`Gespeichert (${Math.round(json.length / 1024)} KB):\n${res.path}` +
      (copied ? '\nDer Pfad ist in der Zwischenablage.' : ''), false, 8000);
  }

  function clearAll() {
    if (!state.items.length || !confirm(`Alle ${state.items.length} Kommentare zu dieser Seite löschen?`)) return;
    state.items = [];
    closePopup();
    render();
    chrome.storage.local.remove(PAGE_KEY).catch(() => {});
  }

  // ---------------------------------------------------------------- Start

  window.__htmlFeedback = { toggle: () => setVisible(!state.visible) };
  setMode('element');
  applyPrefs();
  render();
  restore();
})();
