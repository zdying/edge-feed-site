
const I18N = {
  'quant.chart.error.title': '图表数据解析失败',
  'quant.chart.error.sub': '请检查 JSON 格式是否正确',
  'quant.chart.market': '市场',
  'quant.chart.back': '返回',
  'quant.chart.fall': '跌',
  'quant.chart.rise': '涨',
  'quant.chart.noData': '暂无数据',
  'quant.chart.treemap.defaultTitle': '市场热力图',
};

function tRaw(key) {
  return I18N[key] || key;
}

const _WM = (() => {
  const img = new Image();
  img.src = '/assets/logo.png';
  function drawOnCanvas(ctx, w, h) {
    if (!img.complete || !img.naturalWidth) return;
    const WM_H = 42;
    const WM_W = WM_H * (img.naturalWidth / img.naturalHeight);
    const x = (w - WM_W) / 2;
    const y = (h - WM_H) / 2;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.drawImage(img, x, y, WM_W, WM_H);
    ctx.restore();
  }
  function addOverlay(container) {
    container.style.position = 'relative';
    const el = document.createElement('img');
    el.src = img.src;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:48px;width:auto;' +
      'opacity:0.12;pointer-events:none;user-select:none;';
    container.appendChild(el);
  }

  return { drawOnCanvas, addOverlay };
})();
function _errorHTML(typeLabel) {
  return `<div style="display:flex;flex-direction:column;height:220px;padding:14px 16px;box-sizing:border-box;">` +
    `<div style="font-size:10.5px;font-weight:700;color:#fb7185;letter-spacing:0.6px;text-transform:uppercase;line-height:1;">${typeLabel}</div>` +
    `<div style="flex:1;display:flex;align-items:center;justify-content:center;">` +
    `<div style="text-align:center;">` +
    `<div style="font-size:13px;font-weight:600;color:#f97316;">${tRaw('quant.chart.error.title')}</div>` +
    `<div style="font-size:11px;color:rgba(249,115,22,0.60);margin-top:5px;">${tRaw('quant.chart.error.sub')}</div>` +
    `</div>` +
    `</div>` +
    `</div>`;
}


export const QuantTreemap = (() => {
  const _c2d = (() => {
    try { return document.createElement('canvas').getContext('2d'); } catch (_) { return null; }
  })();

  function _bestFit(text, maxW, prefMax, minF) {
    if (!text || maxW <= 0 || !_c2d) return null;
    let sz = prefMax;
    while (sz >= minF) {
      _c2d.font = `700 ${sz}px -apple-system,BlinkMacSystemFont,sans-serif`;
      if (_c2d.measureText(text).width <= maxW) return sz;
      sz -= 0.5;
    }
    return null;
  }

  function _heatColor(move, redUp) {
    if (move == null || Math.abs(move) < 0.04) return 'rgb(26,30,41)';
    const up = redUp ? [251, 113, 133] : [16, 185, 129];
    const down = redUp ? [16, 185, 129] : [251, 113, 133];
    const [r, g, b] = move >= 0 ? up : down;
    const ratio = Math.min(Math.abs(move) / 4.0, 1.0);
    let alpha = 0.44;
    if (ratio >= 0.80) alpha = 0.98;
    else if (ratio >= 0.50) alpha = 0.78;
    else if (ratio >= 0.20) alpha = 0.56;
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  function _effectiveChange(node) {
    if (node.change_pct != null) return node.change_pct;
    if (!node.children || !node.children.length) return null;
    let wSum = 0, total = 0;
    for (const c of node.children) {
      const ch = _effectiveChange(c);
      if (ch == null || (c.marketcap || 0) <= 0) continue;
      wSum += ch * c.marketcap;
      total += c.marketcap;
    }
    return total > 0 ? wSum / total : null;
  }

  function _layout(nodes, cw, ch) {
    const items = (nodes || [])
      .filter(n => (n.marketcap || 0) > 0)
      .sort((a, b) => b.marketcap - a.marketcap);

    function split(arr, box, splitH) {
      if (!arr.length || box.w <= 0 || box.h <= 0) return [];
      if (arr.length === 1) return [{ node: arr[0], rect: box }];
      const total = arr.reduce((s, n) => s + n.marketcap, 0);
      let acc = 0, cut = 1;
      for (let i = 0; i < arr.length; i++) {
        if (acc >= total / 2) break;
        acc += arr[i].marketcap;
        cut = i + 1;
      }
      cut = Math.max(1, Math.min(cut, arr.length - 1));
      const left = arr.slice(0, cut);
      const right = arr.slice(cut);
      const leftTotal = left.reduce((s, n) => s + n.marketcap, 0);
      const ratio = Math.max(0.05, Math.min(leftTotal / total, 0.95));
      let a, b;
      if (splitH) {
        const sw = box.w * ratio;
        a = { x: box.x, y: box.y, w: sw, h: box.h };
        b = { x: box.x + sw, y: box.y, w: box.w - sw, h: box.h };
      } else {
        const sh = box.h * ratio;
        a = { x: box.x, y: box.y, w: box.w, h: sh };
        b = { x: box.x, y: box.y + sh, w: box.w, h: box.h - sh };
      }
      return [...split(left, a, !splitH), ...split(right, b, !splitH)];
    }
    return split(items, { x: 0, y: 0, w: cw, h: ch }, cw >= 250);
  }

  function _logoHTML(node, sz) {
    sz = Math.max(4, Math.min(sz, 40));
    const label = String(node.label || '?').trim().toUpperCase();
    const logoUrl = label ? `/logos/${encodeURIComponent(label)}.svg` : '';
    const fallback = label.slice(0, 2) || '?';
    const fSz = Math.max(7, Math.min(sz * 0.38, 13)).toFixed(1);
    const img = logoUrl
      ? `<img src="${_attr(logoUrl)}" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" />`
      : '';
    return `<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;` +
      `width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;border-radius:50%;` +
      `background:rgba(255,255,255,0.16);border:0.8px solid rgba(255,255,255,0.32);` +
      `font-size:${fSz}px;font-weight:800;color:#fff;line-height:1;flex-shrink:0;overflow:hidden;">` +
      `<span style="position:relative;z-index:0;">${_e(fallback)}</span>${img}</span>`;
  }

  function _tileContent(node, w, h, options = {}) {
    if (w <= 5 || h <= 5) return '';
    const isSector = !!(node.children && node.children.length);
    const showChangeValue = options.showChange !== false;

    if (!isSector) {
      const logoOnly = () => {
        const sz = Math.max(4, Math.min(w * 0.86, h * 0.86, 31));
        return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${_logoHTML(node, sz)}</div>`;
      };

      if (w < 18 || h < 16) return logoOnly();
    }

    const maxTW = Math.max(0, w - 4);
    if (maxTW < 14) {
      if (!isSector) {
        const sz = Math.max(4, Math.min(w * 0.86, h * 0.86, 31));
        return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${_logoHTML(node, sz)}</div>`;
      }
      return '';
    }
    const minSide = Math.min(w, h);
    const labelMax = Math.max(6.0, Math.min(minSide * 0.30, 14.5));
    const labelFont = _bestFit(node.label || '', maxTW, labelMax, 6.0);

    const canLogoOnly = !isSector && w > 5 && h > 5;
    const logoOnly = () => {
      const sz = Math.max(4, Math.min(w * 0.86, h * 0.86, 31));
      return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${_logoHTML(node, sz)}</div>`;
    };
    if (labelFont == null) {
      if (canLogoOnly) return logoOnly();
      return '';
    }

    const labelH = labelFont * 1.1;
    const change = _effectiveChange(node);
    const chTxt = change == null ? null : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    let changeFont = showChangeValue && chTxt ? _bestFit(chTxt, maxTW, Math.max(6, Math.min(labelFont - 1, 13)), 6.0) : null;

    const labelPart = `<span style="display:block;font-size:${labelFont.toFixed(1)}px;font-weight:700;` +
      `line-height:1.0;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_e(node.label || '')}</span>`;
    const chPart = (changeFont && chTxt)
      ? `<span style="display:block;margin-top:2px;font-size:${changeFont.toFixed(1)}px;font-weight:700;` +
      `line-height:1.0;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_e(chTxt)}</span>`
      : '';

    function wrap(inner) {
      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;overflow:hidden;">${inner}</div>`;
    }

    if (isSector) {
      const showChange = !!changeFont && labelH + 2 + changeFont * 1.1 <= h - 2;
      if (labelH <= h - 2) return wrap(labelPart + (showChange ? chPart : ''));
      return '';
    }

    const canLogo = w >= 28 && h >= 24;
    const logoSz = Math.max(10, Math.min(w * 0.56, h * 0.42, 34));
    const logoPart = `${_logoHTML(node, logoSz)}<div style="height:2px;"></div>`;
    const withLogoLabelH = logoSz + 2 + labelH;
    const withLogoFullH = withLogoLabelH + (changeFont ? 2 + changeFont * 1.1 : 0);

    if (canLogo && changeFont && withLogoFullH <= h - 2) {
      return wrap(logoPart + labelPart + chPart);
    }
    if (canLogo && withLogoLabelH <= h - 2) {
      return wrap(logoPart + labelPart);
    }
    if (canLogoOnly) return logoOnly();
    if (labelH <= h - 2) return wrap(labelPart);
    return '';
  }

  function _e(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _attr(s) {
    return _e(s).replace(/"/g, '&quot;');
  }

  function _fmtMoney(value) {
    const n = Number(value || 0);
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  function mount(container, spec) {
    const state = { path: [], selected: null, redUp: spec.redUp !== false };
    const showTitle = spec.title !== '';
    const titleText = spec.title == null ? tRaw('quant.chart.treemap.defaultTitle') : spec.title;
    const rootLabel = spec.rootLabel || tRaw('quant.chart.market');
    const chartH = Math.max(180, Number(spec.height || 320));
    const showChange = spec.showChange !== false;
    const valueFormat = spec.valueFormat || 'suffix';
    const valueSuffix = spec.valueSuffix == null ? 'B' : String(spec.valueSuffix);
    const legendLeft = spec.legendLeft || tRaw('quant.chart.fall');
    const legendRight = spec.legendRight || tRaw('quant.chart.rise');

    function formatNodeValue(node) {
      if (valueFormat === 'money') return _fmtMoney(node.marketcap);
      return `${Number(node.marketcap || 0).toFixed(0)}${valueSuffix}`;
    }

    function tooltipHTML(node) {
      if (!node) return '';
      return `<span style="font-size:10.5px;font-weight:700;color:#fff;white-space:nowrap;">` +
        `${_e(node.label)}\u00a0\u00a0\u00b7\u00a0\u00a0${_e(formatNodeValue(node))}` +
        `</span>`;
    }

    function currentNodes() {
      return state.path.length
        ? (state.path[state.path.length - 1].children || [])
        : (spec.nodes || []);
    }

    function breadcrumb() {
      if (!state.path.length) return rootLabel;
      return [rootLabel, ...state.path.map(n => n.label)].join(' / ');
    }

    function ldot(move, sz) {
      sz = sz || 7;
      const col = _heatColor(move, state.redUp);
      return `<span style="display:inline-block;width:${sz}px;height:${sz}px;border-radius:1.6px;` +
        `background:${col};border:0.4px solid rgba(255,255,255,0.14);"></span>`;
    }

    function render() {
      const nodes = currentNodes();
      const cw = Math.max(80, (container.offsetWidth || 340) - 24);
      const ch = chartH;
      const tiles = _layout(nodes, cw, ch);

      const backBtn = state.path.length
        ? `<button data-tm-action="back"
               style="width:44px;height:24px;flex-shrink:0;border:none;cursor:pointer;
                      background:rgba(255,255,255,0.08);border-radius:10px;
                      font-size:11px;font-weight:600;color:#a0a0a0;padding:0;
                      display:flex;align-items:center;justify-content:center;">${tRaw('quant.chart.back')}</button>`
        : '';

      const legend = `<span style="display:inline-flex;align-items:center;flex-shrink:0;">
        <span style="font-size:9px;font-weight:600;color:rgba(160,160,160,0.8);">${_e(legendLeft)}</span>
        <span style="display:inline-flex;gap:2px;margin:0 3px;">${ldot(-0.6)}${ldot(-2.0)}${ldot(-5.0)}</span>
        <span style="display:inline-block;width:6px;height:6px;border-radius:1.6px;
               background:#1A1E29;border:0.4px solid rgba(255,255,255,0.14);"></span>
        <span style="display:inline-flex;gap:2px;margin:0 3px;">${ldot(0.6)}${ldot(2.0)}${ldot(5.0)}</span>
        <span style="font-size:9px;font-weight:600;color:rgba(160,160,160,0.8);">${_e(legendRight)}</span>
      </span>`;

      let tilesHTML = '';
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const pad = t.rect.w < 14 || t.rect.h < 14 ? 0.25 : (t.rect.w < 28 || t.rect.h < 28 ? 0.6 : (t.rect.w < 48 || t.rect.h < 42 ? 3 : 6));
        const inset = t.rect.w < 14 || t.rect.h < 14 ? 0.35 : (t.rect.w < 18 || t.rect.h < 18 ? 0.6 : 1.3);
        const radius = t.rect.w < 18 || t.rect.h < 18 ? 3 : (t.rect.w < 42 || t.rect.h < 36 ? 4 : 6);
        const contentW = t.rect.w - inset * 2 - pad * 2;
        const contentH = t.rect.h - inset * 2 - pad * 2;
        const isSel = state.selected === t.node;
        const color = _heatColor(_effectiveChange(t.node), state.redUp);
        const bdrCol = isSel ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.12)';
        const bdrW = isSel ? '1.2' : '0.8';
        const inner = _tileContent(t.node, contentW, contentH, { showChange });

        tilesHTML +=
          `<div data-tm-action="tile" data-tm-idx="${i}"
               style="position:absolute;left:${t.rect.x.toFixed(2)}px;top:${t.rect.y.toFixed(2)}px;
                      width:${t.rect.w.toFixed(2)}px;height:${t.rect.h.toFixed(2)}px;
                      cursor:pointer;box-sizing:border-box;">
            <div data-tm-inner style="position:absolute;inset:${inset}px;padding:${pad}px;border-radius:${radius}px;
                        background:${color};border:${bdrW}px solid ${bdrCol};
                        overflow:hidden;box-sizing:border-box;">${inner}</div>
          </div>`;
      }

      const titleRow = showTitle || state.path.length
        ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            ${showTitle ? `<span style="flex:1;font-size:13px;font-weight:700;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${_e(titleText)}</span>` : '<span style="flex:1;"></span>'}
            ${backBtn}
          </div>`
        : '';

      container.innerHTML =
        `<div style="padding:12px 12px 10px;border-radius:14px;position:relative;">
          ${titleRow}
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="flex:1;font-size:10.5px;font-weight:600;color:rgba(160,160,160,0.85);
                         overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${_e(breadcrumb())}</span>
            ${legend}
          </div>
          <div style="position:relative;height:${chartH}px;overflow:hidden;">
            ${tilesHTML}
            <div data-tm-tooltip style="position:absolute;right:6px;top:6px;pointer-events:none;
                 padding:6px 8px;background:rgba(0,0,0,0.56);border-radius:8px;display:none;"></div>
          </div>
          <img src="/assets/logo.png" aria-hidden="true" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:38px;width:auto;opacity:0.08;pointer-events:none;user-select:none;"/>
        </div>`;

      function updateSelection() {
        container.querySelectorAll('[data-tm-action="tile"]').forEach(el => {
          const idx = parseInt(el.dataset.tmIdx, 10);
          const tile = tiles[idx];
          const inner = el.querySelector('[data-tm-inner]');
          if (!tile || !inner) return;
          const selected = state.selected === tile.node;
          inner.style.borderColor = selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.12)';
          inner.style.borderWidth = selected ? '1.2px' : '0.8px';
        });

        const tooltipEl = container.querySelector('[data-tm-tooltip]');
        if (!tooltipEl) return;
        if (!state.selected) {
          tooltipEl.style.display = 'none';
          tooltipEl.innerHTML = '';
          return;
        }
        tooltipEl.innerHTML = tooltipHTML(state.selected);
        tooltipEl.style.display = '';
      }

      container.querySelector('[data-tm-action="back"]')
        ?.addEventListener('click', () => { state.path.pop(); state.selected = null; render(); });

      container.querySelectorAll('[data-tm-action="tile"]').forEach(el => {
        const node = tiles[parseInt(el.dataset.tmIdx, 10)]?.node;
        if (!node) return;
        el.addEventListener('click', () => {
          if (node.children && node.children.length) {
            state.path.push(node); state.selected = null;
            render();
          } else {
            state.selected = state.selected === node ? null : node;
            updateSelection();
          }
        });
      });
      updateSelection();
    }

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      let lastW = 0;
      ro = new ResizeObserver(entries => {
        const w = Math.round(entries[0]?.contentRect.width || 0);
        if (Math.abs(w - lastW) > 2) { lastW = w; render(); }
      });
      ro.observe(container);
    }
    render();
    return () => ro?.disconnect();
  }

  function hydrateAll(root) {
    (root || document).querySelectorAll('[data-chart-pending="treemap"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('Treemap');
      }
    });
  }

  return { mount, hydrateAll };
})();


export const QuantLineChart = (() => {
  const CHART_H = 190;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 22;
  const PAD_B = 26;
  const DRAW_H = CHART_H - PAD_T - PAD_B;
  function _mTimeToMins(hhmm) {
    const p = String(hhmm ?? '').split(':');
    const hour = Number(p[0]);
    const minute = Number(p[1]);
    return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
  }

  function _resolveMarkerIndex(labelStr, xLabels) {
    const exact = xLabels.indexOf(labelStr);
    if (exact >= 0) return exact;
    const mins = _mTimeToMins(labelStr);
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < xLabels.length; i++) {
      const d = Math.abs(_mTimeToMins(xLabels[i]) - mins);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return xLabels.length ? best : -1;
  }
  const _PATH_BELL = new Path2D(
    'M19.2311 18H4.76887C3.79195 18 3 17.208 3 16.2311C3 15.762 3.18636 15.3121 ' +
    '3.51809 14.9803L4.12132 14.3771C4.68393 13.8145 5 13.0514 5 12.2558V9.5C5 ' +
    '5.63401 8.13401 2.5 12 2.5C15.866 2.5 19 5.634 19 9.5V12.2558C19 13.0514 ' +
    '19.3161 13.8145 19.8787 14.3771L20.4819 14.9803C20.8136 15.3121 21 15.762 ' +
    '21 16.2311C21 17.208 20.208 18 19.2311 18Z'
  );
  const _PATH_FLAG_BODY = new Path2D(
    'M15.8785 3L10.2827 3C7.32099 3 5.84015 3 4.92007 3.87868C4 4.75736 4 ' +
    '6.17157 4 9L4.10619 15L15.8785 15C18.1016 15 19.2131 15 19.6847 14.4255C' +
    '19.8152 14.2666 19.9108 14.0841 19.9656 13.889C20.1639 13.184 19.497 ' +
    '12.3348 18.1631 10.6364C17.6083 9.92985 17.3309 9.57659 17.2814 9.1751C' +
    '17.2671 9.05877 17.2671 8.94123 17.2814 8.8249C17.3309 8.42341 17.6083 ' +
    '8.07015 18.1631 7.36364C19.497 5.66521 20.1639 4.816 19.9656 4.11098C' +
    '19.9108 3.91591 19.8152 3.73342 19.6847 3.57447C19.2131 3 18.1016 3 15.8785 3Z'
  );
  const _PATH_STAR = new Path2D(
    'M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 ' +
    '8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L' +
    '18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 ' +
    '19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C' +
    '12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 ' +
    '22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 ' +
    '5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 ' +
    '8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 ' +
    '8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z'
  );


  function _drawMarkerIcon(ctx, type, cx, cy, r, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,14,32,0.88)';
    ctx.fill();
    const scale = r / 12;
    ctx.translate(cx - 12 * scale, cy - 12 * scale);
    ctx.scale(scale, scale);

    ctx.fillStyle = color;
    if (type === 'flag') {
      ctx.fill(_PATH_FLAG_BODY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(4, 21); ctx.lineTo(4, 8); ctx.stroke();
    } else if (type === 'star') {
      ctx.fill(_PATH_STAR);
    } else {
      ctx.fill(_PATH_BELL);
      ctx.beginPath(); ctx.arc(12, 19.75, 1.75, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function _e(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function mount(container, spec) {
    const title = spec.title || '';
    const xLabels = spec.x || spec.labels || [];
    const showLegend = spec.legend !== false;
    const lineWidth = spec.lineWidth ?? 2.1;
    const xLabelStep = spec.xLabelStep ?? 0;
    const rawSeries = spec.series || spec.datasets || [];
    const series = rawSeries.map(s => ({
      name: String(s.name || s.label || ''),
      color: String(s.color || '#2dd4bf'),
      values: Array.isArray(s.values) ? s.values.map(Number) : Array.isArray(s.data) ? s.data.map(Number) : [],
      prevClose: typeof s.prevClose === 'number' ? s.prevClose : null,
    }));
    const markers = (Array.isArray(spec.markers) ? spec.markers : []).map(m => ({
      x: String(m.x || ''),
      icon: String(m.icon || 'bell'),
      color: String(m.color || '#F59E0B'),
      text: String(m.text || ''),
      _xIndex: -1,
    }));

    const count = xLabels.length;
    if (count === 0 || series.length === 0) return;
    markers.forEach(m => { m._xIndex = _resolveMarkerIndex(m.x, xLabels); });

    let minY = Infinity, maxY = -Infinity;
    series.forEach(s => s.values.forEach(v => { if (v < minY) minY = v; if (v > maxY) maxY = v; }));
    if (!isFinite(minY)) minY = 0;
    if (!isFinite(maxY)) maxY = 1;
    const range = Math.abs(maxY - minY) < 1e-6 ? 1.0 : maxY - minY;

    let activeIndex = null;

    container.innerHTML = '';
    container.style.cssText = `padding:12px 12px 10px;background:${spec.background || 'rgba(255,255,255,0.05)'};border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;`;

    if (title) {
      const t = document.createElement('div');
      t.style.cssText = 'font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;';
      t.textContent = title;
      container.appendChild(t);
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;height:' + CHART_H + 'px;touch-action:none;cursor:crosshair;';
    container.appendChild(wrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:' + CHART_H + 'px;';
    wrap.appendChild(canvas);

    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'position:absolute;top:8px;left:8px;padding:5px 8px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.05);border-radius:6px;pointer-events:none;display:none;backdrop-filter:blur(4px);';
    wrap.appendChild(tooltip);

    if (showLegend) {
      const legend = document.createElement('div');
      legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:6px;';
      series.forEach(s => {
        const item = document.createElement('div');
        item.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';
        item.innerHTML =
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>` +
          `<span style="font-size:11px;font-weight:600;color:#a0a0a0;">${_e(s.name)}</span>`;
        legend.appendChild(item);
      });
      container.appendChild(legend);
    }

    let cw = 0;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      cw = canvas.getBoundingClientRect().width || container.offsetWidth || 320;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(CHART_H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, CHART_H);

      const drawW = cw - PAD_L - PAD_R;
      const step = count > 1 ? drawW / (count - 1) : drawW;

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        const y = PAD_T + DRAW_H * (i / 3);
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(cw, y); ctx.stroke();
      }

      series.forEach(s => {
        if (!s.values.length) return;
        const pts = [];
        for (let i = 0; i < s.values.length && i < count; i++) {
          pts.push({
            x: PAD_L + step * i,
            y: PAD_T + (1 - (s.values[i] - minY) / range) * DRAW_H,
          });
        }

        ctx.strokeStyle = s.color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        if (pts.length === 2) {
          ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
        } else if (pts.length > 2) {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = i > 0 ? pts[i - 1] : pts[i];
            const p1 = pts[i], p2 = pts[i + 1];
            const p3 = i + 2 < pts.length ? pts[i + 2] : pts[i + 1];
            ctx.bezierCurveTo(
              p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
              p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
              p2.x, p2.y
            );
          }
          ctx.stroke();
        }
        if (activeIndex !== null && activeIndex >= 0 && activeIndex < pts.length) {
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(pts[activeIndex].x, pts[activeIndex].y, 3.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (activeIndex !== null && activeIndex >= 0 && activeIndex < count) {
        const x = PAD_L + step * activeIndex;
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + DRAW_H); ctx.stroke();
      }
      const ICON_R = 7.5;
      const ICON_CY = PAD_T * 0.5;
      markers.forEach(m => {
        const idx = m._xIndex;
        if (idx < 0 || idx >= count) return;
        const mx = PAD_L + step * idx;
        const s0 = series[0];
        const ptY = (s0 && idx < s0.values.length)
          ? PAD_T + (1 - (s0.values[idx] - minY) / range) * DRAW_H
          : PAD_T + DRAW_H;

        ctx.save();
        ctx.setLineDash([3.5, 2.5]);
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.80;
        ctx.beginPath();
        ctx.moveTo(mx, ptY);
        ctx.lineTo(mx, PAD_T);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
        _drawMarkerIcon(ctx, m.icon, mx, ICON_CY, ICON_R, m.color);
      });

      ctx.font = '500 9.5px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillStyle = 'rgba(160,160,160,0.75)';
      ctx.textBaseline = 'top';
      const labelPxW = 50;
      const autoStep = count > 1 ? Math.max(1, Math.round((count * labelPxW) / drawW)) : 1;
      const lblStep = xLabelStep > 0 ? xLabelStep : autoStep;
      const labelY = CHART_H - 16;
      const lblIndices = [];
      for (let i = 0; i < count; i++) {
        if (i % lblStep === 0 || i === count - 1) lblIndices.push(i);
      }
      let lastRight = -Infinity;
      const labelLayout = [];
      for (let k = 0; k < lblIndices.length; k++) {
        const i = lblIndices[k];
        const isLast = i === count - 1;
        const lbl = String(xLabels[i] || '');
        if (!lbl) continue;
        const tw = ctx.measureText(lbl).width;
        const cx = PAD_L + step * i;
        let drawX = cx - tw / 2;
        drawX = Math.max(PAD_L, drawX);
        drawX = Math.min(cw - PAD_R - tw, drawX);
        if (!isLast) {
          if (drawX < lastRight + 3) continue;
        } else {
          drawX = Math.max(drawX, lastRight + 3);
          drawX = Math.min(cw - PAD_R - tw, drawX);
        }
        labelLayout.push({ lbl, drawX });
        lastRight = drawX + tw;
      }
      labelLayout.forEach(({ lbl, drawX }) => ctx.fillText(lbl, drawX, labelY));

      _WM.drawOnCanvas(ctx, cw, CHART_H);
      _updateTooltip();
    }

    function _updateTooltip() {
      if (activeIndex === null) { tooltip.style.display = 'none'; return; }
      const lbl = String(xLabels[activeIndex] || '');
      let html = `<div style="font-size:10.5px;font-weight:600;color:#a0a0a0;margin-bottom:3px;">${_e(lbl)}</div>`;
      series.forEach(s => {
        const v = activeIndex < s.values.length ? s.values[activeIndex] : 0;
        let pctHtml = '';
        if (typeof s.prevClose === 'number' && s.prevClose !== 0) {
          const pct = ((v - s.prevClose) / s.prevClose) * 100;
          const isUp = pct > 0;
          const isDown = pct < 0;
          const pctColor = isUp ? '#10B981' : (isDown ? '#FB7185' : '#888');
          const sign = isUp ? '+' : '';
          pctHtml = `<span style="color:${pctColor};margin-left:6px;font-weight:600;">${sign}${pct.toFixed(2)}%</span>`;
        } else {
          pctHtml = '';
        }
        html += `<div style="font-size:10.5px;font-weight:700;color:${s.color};margin-bottom:1px;display:flex;align-items:center;">
          <span>${_e(s.name)}: ${v.toFixed(2)}</span>${pctHtml}
        </div>`;
      });
      markers.forEach(m => {
        if (m._xIndex === activeIndex && m.text) {
          html += `<div style="font-size:10px;font-weight:700;color:${m.color};margin-top:3px;padding-top:3px;border-top:1px solid rgba(255,255,255,0.1);">${_e(m.text)}</div>`;
        }
      });
      tooltip.innerHTML = html;
      tooltip.style.display = '';
    }

    function onMove(clientX) {
      const rect = canvas.getBoundingClientRect();
      const dx = clientX - rect.left;
      const s = count > 1 ? cw / (count - 1) : cw;
      if (s <= 0) return;
      const idx = Math.max(0, Math.min(Math.round(dx / s), count - 1));
      if (idx !== activeIndex) { activeIndex = idx; draw(); }
    }
    let _hideTimer = null;
    function _scheduleHide() {
      clearTimeout(_hideTimer);
      _hideTimer = setTimeout(() => { activeIndex = null; draw(); }, 1500);
    }
    wrap.addEventListener('pointerdown', e => { e.preventDefault(); clearTimeout(_hideTimer); onMove(e.clientX); });
    wrap.addEventListener('pointermove', e => { if (e.buttons) { clearTimeout(_hideTimer); onMove(e.clientX); } });
    wrap.addEventListener('pointerup', _scheduleHide);
    wrap.addEventListener('pointercancel', _scheduleHide);
    wrap.addEventListener('pointerleave', _scheduleHide);

    if (typeof ResizeObserver !== 'undefined') {
      let lastW = 0;
      const ro = new ResizeObserver(entries => {
        const w = Math.round(entries[0]?.contentRect.width || 0);
        if (Math.abs(w - lastW) > 2) { lastW = w; draw(); }
      });
      ro.observe(container);
    }
    requestAnimationFrame(draw);
  }

  function hydrateAll(root) {
    (root || document).querySelectorAll('[data-chart-pending="line"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('Line');
      }
    });
    (root || document).querySelectorAll('[data-chart-pending="min-line"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        if (spec.prevClose != null && Array.isArray(spec.series)) {
          spec.series.forEach(s => {
            if (s.prevClose == null) {
              s.prevClose = spec.prevClose;
            }
          });
        }

        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('MinLine');
      }
    });
  }

  return { mount, hydrateAll };
})();


export const QuantAreaChart = (() => {
  const CHART_H = 190;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 10;
  const PAD_B = 26;
  const DRAW_H = CHART_H - PAD_T - PAD_B;

  function mount(container, spec) {
    const title = spec.title || '';
    const xLabels = spec.x || [];
    const rawVals = Array.isArray(spec.values) ? spec.values.map(Number) : [];
    const color = String(spec.color || '#2dd4bf');
    const lineWidth = spec.lineWidth ?? 2.0;
    const xLabelStep = spec.xLabelStep ?? 0;

    const count = Math.min(xLabels.length, rawVals.length);
    if (count === 0) return;
    const values = rawVals.slice(0, count);
    const labels = xLabels.slice(0, count);

    const minRaw = Math.min(...values);
    const maxRaw = Math.max(...values);
    const yMin = Math.min(minRaw, 0);
    const yMax = Math.max(maxRaw, 0);
    const range = Math.abs(yMax - yMin) < 1e-6 ? 1.0 : yMax - yMin;

    let activeIndex = null;

    container.innerHTML = '';
    container.style.cssText = `padding:12px 12px 10px;background:${spec.background || 'rgba(255,255,255,0.05)'};border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;`;

    if (title) {
      const t = document.createElement('div');
      t.style.cssText = 'font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;';
      t.textContent = title;
      container.appendChild(t);
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;height:' + CHART_H + 'px;touch-action:none;cursor:crosshair;';
    container.appendChild(wrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:' + CHART_H + 'px;';
    wrap.appendChild(canvas);

    let cw = 0;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      cw = canvas.getBoundingClientRect().width || container.offsetWidth || 320;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(CHART_H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, CHART_H);

      const drawW = cw - PAD_L - PAD_R;
      const step = count > 1 ? drawW / (count - 1) : drawW;

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        const y = PAD_T + DRAW_H * (i / 3);
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(cw, y); ctx.stroke();
      }

      const pts = values.map((v, i) => ({
        x: PAD_L + i * step,
        y: PAD_T + (1 - (v - yMin) / range) * DRAW_H,
      }));
      const zeroY = PAD_T + (1 - (0 - yMin) / range) * DRAW_H;

      function buildCurve(ctx) {
        if (!pts.length) return;
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 1) return;
        if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = i > 0 ? pts[i - 1] : pts[i];
          const p1 = pts[i], p2 = pts[i + 1];
          const p3 = i + 2 < pts.length ? pts[i + 2] : pts[i + 1];
          ctx.bezierCurveTo(
            p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
            p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
            p2.x, p2.y
          );
        }
      }

      function hexToRgb(hex) {
        const h = hex.replace('#', '');
        return h.length === 3
          ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
          : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      const [rv, gv, bv] = hexToRgb(color);
      const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + DRAW_H);
      grad.addColorStop(0, `rgba(${rv},${gv},${bv},0.36)`);
      grad.addColorStop(1, `rgba(${rv},${gv},${bv},0.02)`);

      ctx.beginPath();
      buildCurve(ctx);
      ctx.lineTo(pts[pts.length - 1].x, zeroY);
      ctx.lineTo(pts[0].x, zeroY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD_L, zeroY); ctx.lineTo(cw, zeroY); ctx.stroke();

      ctx.beginPath();
      buildCurve(ctx);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      if (activeIndex !== null && activeIndex >= 0 && activeIndex < pts.length) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pts[activeIndex].x, pts[activeIndex].y, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (activeIndex !== null && activeIndex >= 0 && activeIndex < count) {
        const x = pts[activeIndex].x;
        ctx.strokeStyle = 'rgba(255,255,255,0.20)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + DRAW_H); ctx.stroke();
      }

      ctx.font = '500 9.5px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillStyle = 'rgba(160,160,160,0.75)';
      ctx.textBaseline = 'top';
      const labelPxW2 = 50;
      const autoStep2 = count > 1 ? Math.max(1, Math.round((count * labelPxW2) / drawW)) : 1;
      const lblStep2 = xLabelStep > 0 ? xLabelStep : autoStep2;
      const lblIndices2 = [];
      for (let i = 0; i < count; i++) {
        if (i % lblStep2 === 0 || i === count - 1) lblIndices2.push(i);
      }
      let lastRight2 = -Infinity;
      lblIndices2.forEach((i, k) => {
        const isLast = i === count - 1;
        const lbl = String(labels[i] || '');
        if (!lbl) return;
        const tw = ctx.measureText(lbl).width;
        const cx = PAD_L + step * i;
        let drawX = cx - tw / 2;
        drawX = Math.max(PAD_L, drawX);
        drawX = Math.min(cw - PAD_R - tw, drawX);
        if (!isLast) {
          if (drawX < lastRight2 + 3) return;
        } else {
          drawX = Math.max(drawX, lastRight2 + 3);
          drawX = Math.min(cw - PAD_R - tw, drawX);
        }
        ctx.fillText(lbl, drawX, CHART_H - 16);
        lastRight2 = drawX + tw;
      });

      _WM.drawOnCanvas(ctx, cw, CHART_H);
    }

    function onMove(clientX) {
      const rect = canvas.getBoundingClientRect();
      const dx = clientX - rect.left;
      const s = count > 1 ? cw / (count - 1) : cw;
      if (s <= 0) return;
      const idx = Math.max(0, Math.min(Math.round(dx / s), count - 1));
      if (idx !== activeIndex) { activeIndex = idx; draw(); }
    }
    let _hideTimer = null;
    function _scheduleHide() {
      clearTimeout(_hideTimer);
      _hideTimer = setTimeout(() => { activeIndex = null; draw(); }, 1500);
    }
    wrap.addEventListener('pointerdown', e => { e.preventDefault(); clearTimeout(_hideTimer); onMove(e.clientX); });
    wrap.addEventListener('pointermove', e => { if (e.buttons) { clearTimeout(_hideTimer); onMove(e.clientX); } });
    wrap.addEventListener('pointerup', _scheduleHide);
    wrap.addEventListener('pointercancel', _scheduleHide);
    wrap.addEventListener('pointerleave', _scheduleHide);

    if (typeof ResizeObserver !== 'undefined') {
      let lastW = 0;
      const ro = new ResizeObserver(entries => {
        const w = Math.round(entries[0]?.contentRect.width || 0);
        if (Math.abs(w - lastW) > 2) { lastW = w; draw(); }
      });
      ro.observe(container);
    }
    requestAnimationFrame(draw);
  }

  function hydrateAll(root) {
    (root || document).querySelectorAll('[data-chart-pending="area"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('Area');
      }
    });
  }

  return { mount, hydrateAll };
})();


export const QuantBarChart = (() => {
  const CHART_H = 210;
  const PAD_TOP = 32;
  const PAD_BOT = 24;
  const DRAW_H = CHART_H - PAD_TOP - PAD_BOT;
  const BASELINE_Y = PAD_TOP + DRAW_H * 0.55;

  function _colorAlpha(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.length === 3 ? c[0] + c[0] : c.slice(0, 2), 16);
    const g = parseInt(c.length === 3 ? c[1] + c[1] : c.slice(2, 4), 16);
    const b = parseInt(c.length === 3 ? c[2] + c[2] : c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function _barPath(ctx, x, y, w, h, r, isPositive) {
    if (h <= 0) return;
    const ar = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    if (isPositive) {
      ctx.moveTo(x + ar, y);
      ctx.lineTo(x + w - ar, y);
      ctx.arcTo(x + w, y, x + w, y + ar, ar);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + ar);
      ctx.arcTo(x, y, x + ar, y, ar);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - ar);
      ctx.arcTo(x + w, y + h, x + w - ar, y + h, ar);
      ctx.lineTo(x + ar, y + h);
      ctx.arcTo(x, y + h, x, y + h - ar, ar);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function _fmtMoney(value) {
    const n = Number(value || 0);
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  function mount(container, spec) {
    const title = spec.title || '';
    const valueFormat = spec.valueFormat || '';
    const isCallPut = spec.mode === 'callPut' || (spec.bars || []).some(b => b.call != null || b.put != null);
    const bars = (spec.bars || []).map(b => ({
      label: String(b.label || ''),
      value: Number(b.value || 0),
      color: String(b.color || '#2dd4bf'),
      call: Number(b.call || 0),
      put: Number(b.put || 0),
      callColor: String(b.callColor || '#F04C4C'),
      putColor: String(b.putColor || '#00C853'),
    }));
    if (bars.length === 0) return;

    const splitMax = Math.max(1.0, ...bars.flatMap(b => [b.call > 0 ? b.call : 0, b.put > 0 ? b.put : 0]));
    const maxPos = isCallPut
      ? splitMax
      : Math.max(1.0, ...bars.map(b => b.value > 0 ? b.value : 0));
    const maxNeg = isCallPut
      ? splitMax
      : Math.max(1.0, ...bars.map(b => b.value < 0 ? Math.abs(b.value) : 0));
    const baselineFrac = Math.min(0.82, Math.max(0.18, maxPos / (maxPos + maxNeg)));
    const baselineY = isCallPut ? PAD_TOP + DRAW_H * 0.50 : PAD_TOP + DRAW_H * baselineFrac;
    const posHeight = DRAW_H * baselineFrac * 0.92;
    const negHeight = DRAW_H * (1 - baselineFrac) * 0.92;
    const splitPosHeight = (baselineY - PAD_TOP) * 0.92;
    const splitNegHeight = (CHART_H - PAD_BOT - baselineY) * 0.92;
    let activeIndex = null;

    container.innerHTML = '';
    container.style.cssText = `padding:12px 12px 10px;background:${spec.background || 'rgba(255,255,255,0.05)'};border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;`;

    if (title) {
      const t = document.createElement('div');
      t.style.cssText = 'font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;';
      t.textContent = title;
      container.appendChild(t);
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;height:' + CHART_H + 'px;touch-action:none;cursor:pointer;';
    container.appendChild(wrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:' + CHART_H + 'px;';
    wrap.appendChild(canvas);

    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'position:absolute;padding:4px 6px;background:rgba(0,0,0,0.52);border-radius:8px;pointer-events:none;display:none;white-space:nowrap;';
    wrap.appendChild(tooltip);

    let cw = 0;

    function _barH(i) {
      const bar = bars[i];
      return bar.value >= 0
        ? (bar.value / maxPos) * posHeight
        : (Math.abs(bar.value) / maxNeg) * negHeight;
    }
    function _barY(i) {
      const h = _barH(i);
      return bars[i].value >= 0 ? baselineY - h : baselineY;
    }
    function _fmtValue(value) {
      if (valueFormat !== 'money') return Number(value || 0).toFixed(2);
      return _fmtMoney(value);
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      cw = canvas.getBoundingClientRect().width || container.offsetWidth || 320;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(CHART_H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, CHART_H);

      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, baselineY); ctx.lineTo(cw, baselineY); ctx.stroke();

      const slot = cw / bars.length;
      const barW = slot * 0.56;
      const labelStep = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor(cw / 52))));
      const barRadius = Math.min(3, barW * 0.35);

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const bx = slot * i + (slot - barW) / 2;
        if (isCallPut) {
          const callH = (bar.call / maxPos) * splitPosHeight;
          const putH = (bar.put / maxNeg) * splitNegHeight;
          const callY = baselineY - callH;
          const putY = baselineY;

          ctx.fillStyle = _colorAlpha(bar.callColor, activeIndex === i ? 0.96 : 0.80);
          _barPath(ctx, bx, callY, barW, callH, barRadius, true);
          ctx.fill();

          ctx.fillStyle = _colorAlpha(bar.putColor, activeIndex === i ? 0.96 : 0.80);
          _barPath(ctx, bx, putY, barW, putH, barRadius, false);
          ctx.fill();

          if (activeIndex === i) {
            ctx.strokeStyle = 'rgba(255,255,255,0.65)';
            ctx.lineWidth = 1;
            _barPath(ctx, bx, callY, barW, callH, barRadius, true);
            ctx.stroke();
            _barPath(ctx, bx, putY, barW, putH, barRadius, false);
            ctx.stroke();
          }
        } else {
          const bh = _barH(i);
          const by = _barY(i);
          const isPos = bar.value >= 0;

          ctx.fillStyle = _colorAlpha(bar.color, activeIndex === i ? 0.95 : 0.78);
          _barPath(ctx, bx, by, barW, bh, barRadius, isPos);
          ctx.fill();

          if (activeIndex === i) {
            ctx.strokeStyle = 'rgba(255,255,255,0.65)';
            ctx.lineWidth = 1;
            _barPath(ctx, bx, by, barW, bh, barRadius, isPos);
            ctx.stroke();
          }
        }

        if (i === 0 || i === bars.length - 1 || i % labelStep === 0) {
          ctx.fillStyle = 'rgba(160,160,160,0.78)';
          ctx.font = '500 9.5px -apple-system,BlinkMacSystemFont,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(bar.label, slot * i + slot / 2, CHART_H - 16, Math.max(30, slot * labelStep - 4));
        }
      }

      _WM.drawOnCanvas(ctx, cw, CHART_H);

      if (activeIndex !== null && activeIndex < bars.length) {
        const bar = bars[activeIndex];
        ctx.font = '700 11px -apple-system,BlinkMacSystemFont,sans-serif';
        const tooltipText = isCallPut
          ? `${bar.label}  Call ${_fmtValue(bar.call)}  Put ${_fmtValue(bar.put)}`
          : _fmtValue(bar.value);
        const bubbleW = Math.min(cw, ctx.measureText(tooltipText).width + 18);
        const centerX = slot * activeIndex + slot / 2;
        const left = Math.max(0, Math.min(cw - bubbleW, centerX - bubbleW / 2));
        const top = isCallPut
          ? Math.max(2, Math.min(CHART_H - 54, baselineY - splitPosHeight - 8))
          : Math.max(2, Math.min(CHART_H - 40, _barY(activeIndex) - 26));
        tooltip.style.display = '';
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        if (isCallPut) {
          const total = bar.call + bar.put;
          const callPct = total > 0 ? (bar.call / total) * 100 : 0;
          const putPct = total > 0 ? (bar.put / total) * 100 : 0;
          tooltip.innerHTML =
            `<div style="font-size:10px;font-weight:700;color:#fff;margin-bottom:2px;">${bar.label}</div>` +
            `<div style="font-size:10.5px;font-weight:700;color:${bar.callColor};">Call ${_fmtValue(bar.call)} (${callPct.toFixed(0)}%)</div>` +
            `<div style="font-size:10.5px;font-weight:700;color:${bar.putColor};">Put ${_fmtValue(bar.put)} (${putPct.toFixed(0)}%)</div>`;
        } else {
          tooltip.innerHTML = `<span style="font-size:11px;font-weight:700;color:${bar.color};">${_fmtValue(bar.value)}</span>`;
        }
      } else {
        tooltip.style.display = 'none';
      }
    }

    function hitTest(clientX) {
      const rect = canvas.getBoundingClientRect();
      const dx = clientX - rect.left;
      return Math.max(0, Math.min(bars.length - 1, Math.floor(dx / (cw / bars.length))));
    }

    function setActive(idx) {
      if (activeIndex !== idx) { activeIndex = idx; draw(); }
    }

    let _hideTimer = null;
    function _scheduleHide() {
      clearTimeout(_hideTimer);
      _hideTimer = setTimeout(() => { setActive(null); }, 1500);
    }
    canvas.addEventListener('pointerdown', e => { clearTimeout(_hideTimer); setActive(hitTest(e.clientX)); });
    canvas.addEventListener('pointermove', e => { if (e.buttons) { clearTimeout(_hideTimer); setActive(hitTest(e.clientX)); } });
    canvas.addEventListener('pointerup', _scheduleHide);
    canvas.addEventListener('pointercancel', _scheduleHide);
    canvas.addEventListener('pointerleave', _scheduleHide);

    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
    ro?.observe(canvas);
    return () => ro?.disconnect();
  }

  function hydrateAll(root) {
    (root || document).querySelectorAll('[data-chart-pending="bar"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('Bar');
      }
    });
  }

  return { mount, hydrateAll };
})();


export const QuantDonutChart = (() => {
  const RING_H = 220;

  function _hexAlpha(hex, a) {
    const c = hex.replace('#', '');
    const r = parseInt(c.length === 3 ? c[0] + c[0] : c.slice(0, 2), 16);
    const g = parseInt(c.length === 3 ? c[1] + c[1] : c.slice(2, 4), 16);
    const b = parseInt(c.length === 3 ? c[2] + c[2] : c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function mount(container, spec) {
    const title = spec.title || '';
    const slices = (spec.slices || []).map(s => ({
      label: String(s.label || ''),
      value: Number(s.value || 0),
      color: String(s.color || '#2dd4bf'),
    })).filter(s => s.value > 0);
    if (slices.length === 0) return;

    const total = slices.reduce((a, s) => a + s.value, 0);
    let activeIndex = null;

    container.innerHTML = '';
    container.style.cssText = `padding:12px 12px 10px;background:${spec.background || 'rgba(255,255,255,0.05)'};border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;`;

    if (title) {
      const t = document.createElement('div');
      t.style.cssText = 'font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;';
      t.textContent = title;
      container.appendChild(t);
    }

    const row = document.createElement('div');
    row.style.cssText = `display:flex;flex-direction:row;align-items:stretch;height:${RING_H}px;`;
    container.appendChild(row);

    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'flex:1;min-width:0;';
    row.appendChild(canvasWrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `display:block;width:100%;height:${RING_H}px;`;
    canvasWrap.appendChild(canvas);

    const gapDiv = document.createElement('div');
    gapDiv.style.cssText = 'width:8px;flex-shrink:0;';
    row.appendChild(gapDiv);

    const legend = document.createElement('div');
    legend.style.cssText = 'width:130px;flex-shrink:0;overflow:hidden;display:flex;flex-direction:column;justify-content:center;';
    row.appendChild(legend);

    function buildLegend() {
      legend.innerHTML = '';
      slices.forEach((s, i) => {
        const pct = (s.value / total * 100).toFixed(1);
        const sel = activeIndex === i;
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;flex-direction:row;align-items:center;gap:6px;padding-bottom:6px;cursor:pointer;';
        item.innerHTML =
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>` +
          `<span style="font-size:${sel ? '11.5' : '11'}px;font-weight:600;color:${sel ? '#fff' : '#a0a0a0'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.label} ${pct}%</span>`;
        item.addEventListener('pointerdown', e => { e.stopPropagation(); setActive(i); });
        legend.appendChild(item);
      });
    }

    let cw = 0;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      cw = canvasWrap.getBoundingClientRect().width || canvasWrap.offsetWidth || 160;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(RING_H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, RING_H);

      const cx = cw / 2;
      const cy = RING_H / 2;
      const outer = Math.min(cw, RING_H) * 0.36;
      const stroke = outer * 0.42;

      let start = -Math.PI / 2;
      slices.forEach((s, i) => {
        const sweep = (s.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, outer, start, start + sweep);
        ctx.strokeStyle = _hexAlpha(s.color, activeIndex === i ? 1.0 : 0.86);
        ctx.lineWidth = activeIndex === i ? stroke + 2 : stroke;
        ctx.lineCap = 'butt';
        ctx.stroke();
        start += sweep;
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px -apple-system,BlinkMacSystemFont,sans-serif';
      if (activeIndex !== null && activeIndex < slices.length) {
        const s = slices[activeIndex];
        ctx.fillText(s.label, cx, cy - 8);
        ctx.fillText(s.value.toFixed(0), cx, cy + 8);
      } else {
        ctx.fillText('Total', cx, cy - 8);
        ctx.fillText(total.toFixed(0), cx, cy + 8);
      }

      _WM.drawOnCanvas(ctx, cw, RING_H);
    }

    function hitTest(e) {
      const rect = canvas.getBoundingClientRect();
      const cx = cw / 2;
      const cy = RING_H / 2;
      const outer = Math.min(cw, RING_H) * 0.36;
      const inner = outer * 0.58;
      const dx = (e.clientX - rect.left) - cx;
      const dy = (e.clientY - rect.top) - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < inner || r > outer + 8) return null;
      let theta = Math.atan2(dy, dx) + Math.PI / 2;
      if (theta < 0) theta += Math.PI * 2;
      let acc = 0;
      for (let i = 0; i < slices.length; i++) {
        const sweep = (slices[i].value / total) * Math.PI * 2;
        if (theta >= acc && theta < acc + sweep) return i;
        acc += sweep;
      }
      return null;
    }

    function setActive(idx) {
      if (activeIndex !== idx) { activeIndex = idx; draw(); buildLegend(); }
    }

    canvas.addEventListener('pointerdown', e => {
      const idx = hitTest(e);
      if (idx !== null) setActive(idx);
    });

    buildLegend();
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvasWrap);
  }

  function hydrateAll(root) {
    (root || document).querySelectorAll('[data-chart-pending="donut"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('Donut');
      }
    });
  }

  return { mount, hydrateAll };
})();


export const QuantScatterChart = (() => {
  const CHART_H = 210;
  const PAD_L = 22;
  const PAD_T = 8;
  const PAD_R = 8;
  const PAD_B = 22;
  const DEF_COLOR = '#2dd4bf';

  function mount(container, spec) {
    const title = spec.title || '';
    const xTitle = spec.x_title || '';
    const yTitle = spec.y_title || '';
    const points = (spec.points || []).map(p => ({
      x: Number(p.x || 0),
      y: Number(p.y || 0),
      label: String(p.label || ''),
      size: Number(p.size || 4),
      color: String(p.color || DEF_COLOR),
    }));
    if (points.length === 0) return;

    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const yMin = Math.min(...points.map(p => p.y));
    const yMax = Math.max(...points.map(p => p.y));
    const xr = Math.abs(xMax - xMin) < 1e-6 ? 1.0 : xMax - xMin;
    const yr = Math.abs(yMax - yMin) < 1e-6 ? 1.0 : yMax - yMin;

    let activeIndex = null;
    let cw = 0;

    container.innerHTML = '';
    container.style.cssText = `padding:12px 12px 10px;background:${spec.background || 'rgba(255,255,255,0.05)'};border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;`;

    if (title) {
      const t = document.createElement('div');
      t.style.cssText = 'font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;';
      t.textContent = title;
      container.appendChild(t);
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = `position:relative;height:${CHART_H}px;touch-action:none;cursor:crosshair;`;
    container.appendChild(wrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `display:block;width:100%;height:${CHART_H}px;`;
    wrap.appendChild(canvas);

    function _hexA(hex, a) {
      const c = hex.replace('#', '');
      const r = parseInt(c.length === 3 ? c[0] + c[0] : c.slice(0, 2), 16);
      const g = parseInt(c.length === 3 ? c[1] + c[1] : c.slice(2, 4), 16);
      const b = parseInt(c.length === 3 ? c[2] + c[2] : c.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }

    function ptX(p) { return PAD_L + ((p.x - xMin) / xr) * (cw - PAD_L - PAD_R); }
    function ptY(p) { return PAD_T + (1 - (p.y - yMin) / yr) * (CHART_H - PAD_T - PAD_B); }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      cw = canvas.getBoundingClientRect().width || container.offsetWidth || 320;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(CHART_H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, CHART_H);

      const dw = cw - PAD_L - PAD_R;
      const dh = CHART_H - PAD_T - PAD_B;

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = PAD_T + dh * (i / 4);
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + dw, y); ctx.stroke();
        const x = PAD_L + dw * (i / 4);
        ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + dh); ctx.stroke();
      }

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const px = ptX(p);
        const py = ptY(p);
        const r = activeIndex === i ? p.size + 2 : p.size;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = _hexA(p.color, activeIndex === i ? 0.95 : 0.72);
        ctx.fill();

        if (activeIndex === i && p.label) {
          ctx.font = '700 10.5px -apple-system,BlinkMacSystemFont,sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(p.label, px + 6, py - 4, 76);
        }
      }

      if (xTitle) {
        ctx.font = '600 10px -apple-system,BlinkMacSystemFont,sans-serif';
        ctx.fillStyle = 'rgba(160,160,160,0.82)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(xTitle, PAD_L + dw, CHART_H - 16);
      }

      if (yTitle) {
        ctx.font = '600 10px -apple-system,BlinkMacSystemFont,sans-serif';
        ctx.fillStyle = 'rgba(160,160,160,0.82)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(yTitle, 0, PAD_T);
      }

      _WM.drawOnCanvas(ctx, cw, CHART_H);
    }

    function hitTest(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const lx = clientX - rect.left;
      const ly = clientY - rect.top;
      let bestIdx = null;
      let bestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const px = ptX(points[i]);
        const py = ptY(points[i]);
        const d = Math.sqrt((lx - px) ** 2 + (ly - py) ** 2);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      return bestDist <= 24 ? bestIdx : null;
    }

    function setActive(idx) {
      if (activeIndex !== idx) { activeIndex = idx; draw(); }
    }

    let _hideTimer = null;
    function _scheduleHide() {
      clearTimeout(_hideTimer);
      _hideTimer = setTimeout(() => { setActive(null); }, 1500);
    }
    canvas.addEventListener('pointerdown', e => { clearTimeout(_hideTimer); setActive(hitTest(e.clientX, e.clientY)); });
    canvas.addEventListener('pointermove', e => { if (e.buttons) { clearTimeout(_hideTimer); setActive(hitTest(e.clientX, e.clientY)); } });
    canvas.addEventListener('pointerup', _scheduleHide);
    canvas.addEventListener('pointercancel', _scheduleHide);
    canvas.addEventListener('pointerleave', _scheduleHide);

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
  }

  function hydrateAll(root) {
    (root || document).querySelectorAll('[data-chart-pending="scatter"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('Scatter');
      }
    });
  }

  return { mount, hydrateAll };
})();


export const QuantCandlestickChart = (() => {
  'use strict';

  const CHART_H = 340;
  const PAD_R_OUTSIDE = 54;
  const MA_H = 28;
  const XLAB_H = 22;
  const TOTAL_DH = CHART_H - MA_H - XLAB_H;
  const MAIN_H = Math.round(TOTAL_DH * 0.74);
  const VOL_GAP = 6;
  const VOL_H = TOTAL_DH - MAIN_H - VOL_GAP;
  const MAIN_TOP = MA_H;
  const MAIN_BOT = MAIN_TOP + MAIN_H;
  const VOL_TOP = MAIN_BOT + VOL_GAP;
  const VOL_BOT = VOL_TOP + VOL_H;
  const XLAB_Y = CHART_H - 8;
  const DEFAULT_VIS = 40;
  const MIN_VIS = 3;
  const MAX_VIS = 300;

  const C_UP = '#10b981';
  const C_DOWN = '#fb7185';
  const C_FLAT = 'rgba(160,160,160,0.7)';
  const C_GRID = 'rgba(255,255,255,0.07)';
  const C_XLAB = 'rgba(160,160,160,0.72)';
  const C_YLAB = 'rgba(160,160,160,0.72)';
  const C_CROSS_V = 'rgba(255,255,255,0.30)';
  const C_CROSS_H = 'rgba(255,255,255,0.22)';
  const C_MA5 = '#f59e0b';
  const C_MA10 = '#60a5fa';
  const C_MA20 = '#c084fc';

  function _ma(candles, n) {
    return candles.map((_, i) => {
      if (i < n - 1) return null;
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += candles[j].close;
      return s / n;
    });
  }

  function _color(o, c) { return c > o ? C_UP : c < o ? C_DOWN : C_FLAT; }

  function _fmtP(v) {
    return v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v.toFixed(2);
  }

  function _fmtV(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return String(Math.round(v));
  }

  function _rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function mount(container, spec) {
    const candles = spec.candles || [];
    const total = candles.length;
    if (total === 0) {
      container.innerHTML = `<div style="color:rgba(160,160,160,0.5);font-size:12px;padding:16px;text-align:center;">${tRaw('quant.chart.noData')}</div>`;
      return;
    }

    const ma5 = _ma(candles, 5);
    const ma10 = _ma(candles, 10);
    const ma20 = _ma(candles, 20);

    // Build label → marker lookup for O(1) access in draw()
    const markerMap = Object.fromEntries(
      (spec.markers || []).map(m => [String(m.x), m]),
    );

    let vis = Math.min(DEFAULT_VIS, total);
    let scroll = Math.max(0, total - vis);
    let crossI = null;
    let vel = 0;
    let rafId = null;

    const ylabOverlay = spec.ylabOverlay !== false;
    const padR = ylabOverlay ? 0 : PAD_R_OUTSIDE;

    container.style.cssText = `padding:12px 12px 10px;background:${spec.background || 'rgba(255,255,255,0.05)'};border-radius:14px;`;
    if (spec.title) {
      const ttl = document.createElement('div');
      ttl.style.cssText = 'font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;letter-spacing:.3px;';
      ttl.textContent = spec.title;
      container.appendChild(ttl);
    }
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;height:' + CHART_H + 'px;';
    container.appendChild(wrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:' + CHART_H + 'px;touch-action:none;cursor:crosshair;';
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let cw = 0;

    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'position:absolute;padding:5px 8px;background:rgba(0,0,0,0.48);border-radius:8px;pointer-events:none;display:none;white-space:nowrap;z-index:10;';
    wrap.appendChild(tooltip);

    const dw = () => cw - padR;
    const sw = () => dw() / vis;
    const cx_ = i => (i - scroll + 0.5) * sw();
    const clamp = off => Math.max(0, Math.min(total - vis, off));

    function pToY(price, yMin, yRange) {
      return MAIN_TOP + (1 - (price - yMin) / yRange) * MAIN_H;
    }
    function vToY(vol, maxV) {
      return maxV < 1e-9 ? VOL_BOT : VOL_BOT - (vol / maxV) * VOL_H;
    }
    function visRange() {
      const s = Math.max(0, Math.floor(scroll));
      const e = Math.min(total, s + vis + 2);
      let lo = Infinity, hi = -Infinity, mv = 0;
      for (let i = s; i < e; i++) {
        if (candles[i].high > hi) hi = candles[i].high;
        if (candles[i].low < lo) lo = candles[i].low;
        if (candles[i].volume > mv) mv = candles[i].volume;
      }
      const pad = (hi - lo) * 0.08 || 1;
      return { yMin: lo - pad, yMax: hi + pad, maxV: mv };
    }

    function hitX(px) {
      const rect = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(total - 1, Math.round(scroll + (px - rect.left) / sw() - 0.5)));
    }

    function startInertia() {
      if (rafId) cancelAnimationFrame(rafId);
      function tick() {
        if (Math.abs(vel) < 0.3) { vel = 0; return; }
        scroll = clamp(scroll + vel / sw());
        vel *= 0.92;
        draw();
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
    }

    function draw() {
      cw = canvas.offsetWidth;
      const ch = CHART_H;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        canvas.style.height = ch + 'px';
        ctx.scale(dpr, dpr);
      }
      ctx.clearRect(0, 0, cw, ch);

      const { yMin, yMax, maxV } = visRange();
      const yRange = yMax - yMin || 1;
      const S = sw();
      const s0 = Math.max(0, Math.floor(scroll));
      const end = Math.min(total, s0 + vis + 2);
      const bodyW = Math.max(1.5, S * 0.65);

      ctx.strokeStyle = C_GRID;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (let r = 0; r <= 3; r++) {
        const y = MAIN_TOP + (r / 3) * MAIN_H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dw(), y); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, VOL_TOP); ctx.lineTo(dw(), VOL_TOP); ctx.stroke();

      ctx.font = '500 9px system-ui,sans-serif'; ctx.textBaseline = 'middle';
      if (ylabOverlay) {
        for (let r = 0; r <= 4; r++) {
          const lbl = _fmtP(yMax - (r / 4) * yRange);
          const y = MAIN_TOP + (r / 4) * MAIN_H;
          const lw = ctx.measureText(lbl).width;
          const ph = 13, ppad = 4;
          ctx.fillStyle = 'rgba(0,0,0,0.38)';
          _rrect(ctx, cw - lw - ppad * 2 - 3, y - ph / 2, lw + ppad * 2, ph, 2.5); ctx.fill();
          ctx.fillStyle = C_YLAB; ctx.textAlign = 'right';
          ctx.fillText(lbl, cw - ppad - 3, y);
        }
      } else {
        ctx.fillStyle = C_YLAB; ctx.textAlign = 'left';
        for (let r = 0; r <= 4; r++) {
          ctx.fillText(_fmtP(yMax - (r / 4) * yRange), dw() + 4, MAIN_TOP + (r / 4) * MAIN_H);
        }
      }

      function drawMA(arr, color) {
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath();
        let started = false;
        for (let i = s0; i < end; i++) {
          const v = arr[i];
          if (v == null) continue;
          const x = cx_(i), y = pToY(v, yMin, yRange);
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        if (started) ctx.stroke();
      }
      drawMA(ma5, C_MA5); drawMA(ma10, C_MA10); drawMA(ma20, C_MA20);

      const legI = crossI != null ? crossI : Math.min(total - 1, s0 + Math.floor(vis / 2));
      const legData = [
        { lbl: 'MA5', v: ma5[legI], col: C_MA5 },
        { lbl: 'MA10', v: ma10[legI], col: C_MA10 },
        { lbl: 'MA20', v: ma20[legI], col: C_MA20 },
      ];
      ctx.font = '500 9px system-ui,sans-serif'; ctx.textBaseline = 'middle';
      let lx = 4;
      legData.forEach(({ lbl, v, col }) => {
        const txt = v != null ? `${lbl}:${_fmtP(v)}` : lbl;
        ctx.fillStyle = col; ctx.fillText(txt, lx, 14); lx += ctx.measureText(txt).width + 10;
      });

      for (let i = s0; i < end; i++) {
        const c = candles[i], col = _color(c.open, c.close), x = cx_(i), isActive = (i === crossI);
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, S * 0.1); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x, pToY(c.high, yMin, yRange)); ctx.lineTo(x, pToY(c.low, yMin, yRange)); ctx.stroke();
        const bodyY1 = pToY(Math.max(c.open, c.close), yMin, yRange);
        const bodyH = Math.max(1.5, pToY(Math.min(c.open, c.close), yMin, yRange) - bodyY1);
        ctx.fillStyle = col;
        _rrect(ctx, x - bodyW / 2, bodyY1, bodyW, bodyH, 1.5); ctx.fill();
        if (isActive) { ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1; ctx.stroke(); }
        const vy = vToY(c.volume, maxV);
        const alpha = isActive ? 0.80 : 0.50;
        const rgb = col === C_UP ? '16,185,129' : col === C_DOWN ? '251,113,133' : '160,160,160';
        ctx.fillStyle = `rgba(${rgb},${alpha})`;
        _rrect(ctx, x - Math.max(1.5, S * 0.65) / 2, vy, Math.max(1.5, S * 0.65), VOL_BOT - vy, 1); ctx.fill();
      }

      // ── Draw markers ────────────────────────────────────────────────────────
      for (let i = s0; i < end; i++) {
        const mk = markerMap[candles[i].label];
        if (!mk) continue;
        const mx = cx_(i);
        const hy = pToY(candles[i].high, yMin, yRange);
        const dotY = hy - 14;
        const stemY = hy - 5;
        const mcol = mk.color || '#F59E0B';
        ctx.save();
        ctx.strokeStyle = mcol; ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(mx, stemY); ctx.lineTo(mx, dotY + 4); ctx.stroke();
        ctx.fillStyle = mcol;
        ctx.beginPath(); ctx.arc(mx, dotY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = C_XLAB; ctx.font = '500 9.5px system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const step = Math.max(1, Math.round(vis / 7));
      for (let i = s0; i < end; i++) {
        if ((i - s0) % step === 0) ctx.fillText(candles[i].label, cx_(i), XLAB_Y);
      }

      if (crossI != null && crossI >= s0 && crossI < end) {
        const ci = candles[crossI], cx = cx_(crossI);
        const midP = (ci.open + ci.close) / 2, cy = pToY(midP, yMin, yRange);
        ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.strokeStyle = C_CROSS_V;
        ctx.beginPath(); ctx.moveTo(cx, MAIN_TOP); ctx.lineTo(cx, VOL_BOT); ctx.stroke();
        ctx.strokeStyle = C_CROSS_H;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(dw(), cy); ctx.stroke();
        ctx.setLineDash([]);

        const pLabel = _fmtP(midP), pTagCol = _color(ci.open, ci.close);
        ctx.font = '600 9px system-ui,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        if (ylabOverlay) {
          const pw = ctx.measureText(pLabel).width + 8;
          ctx.fillStyle = pTagCol;
          _rrect(ctx, cw - pw - 3, cy - 9, pw, 18, 3); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(pLabel, cw - pw / 2 - 3, cy);
        } else {
          const pw = ctx.measureText(pLabel).width + 8;
          ctx.fillStyle = pTagCol;
          _rrect(ctx, dw() + 2, cy - 9, pw, 18, 3); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(pLabel, dw() + 2 + pw / 2, cy);
        }

        ctx.font = '600 9px system-ui,sans-serif';
        const tw = ctx.measureText(ci.label).width + 8;
        const tx = Math.max(tw / 2, Math.min(dw() - tw / 2, cx));
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        _rrect(ctx, tx - tw / 2, XLAB_Y - 13, tw, 16, 3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ci.label, tx, XLAB_Y - 5);
      }

      _WM.drawOnCanvas(ctx, cw, CHART_H);
      _updateTooltip();
    }

    function _updateTooltip() {
      if (crossI === null) { tooltip.style.display = 'none'; return; }
      const ci = candles[crossI];
      const col = _color(ci.open, ci.close);
      const cx = cx_(crossI);
      const tipW = 108;
      const left = cx > cw / 2
        ? Math.max(4, cx - tipW - 12)
        : Math.min(dw() - tipW - 4, cx + 12);
      tooltip.style.left = left + 'px';
      tooltip.style.top = (MAIN_TOP + 4) + 'px';
      tooltip.innerHTML =
        `<div style="font-size:10.5px;font-weight:600;color:#a0a0a0;margin-bottom:3px;">${ci.label}</div>` +
        `<div style="font-size:10.5px;font-weight:700;color:#fff;margin-bottom:1px;">O: ${_fmtP(ci.open)}</div>` +
        `<div style="font-size:10.5px;font-weight:700;color:#fff;margin-bottom:1px;">H: ${_fmtP(ci.high)}</div>` +
        `<div style="font-size:10.5px;font-weight:700;color:#fff;margin-bottom:1px;">L: ${_fmtP(ci.low)}</div>` +
        `<div style="font-size:10.5px;font-weight:700;color:${col};margin-bottom:1px;">C: ${_fmtP(ci.close)}</div>` +
        `<div style="font-size:10.5px;font-weight:700;color:rgba(160,160,160,0.72);">Vol: ${_fmtV(ci.volume)}</div>` +
        (markerMap[ci.label]?.text
          ? `<div style="font-size:10.5px;font-weight:700;color:${markerMap[ci.label].color || '#F59E0B'};margin-top:3px;padding-top:3px;border-top:1px solid rgba(255,255,255,.1);">${markerMap[ci.label].text}</div>`
          : '');
      tooltip.style.display = '';
    }

    let dragStartX = null, dragStartScroll = null, dragLastX = null, dragLastT = null;
    canvas.addEventListener('pointerdown', e => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      vel = 0; dragStartX = e.clientX; dragStartScroll = scroll; dragLastX = e.clientX; dragLastT = performance.now();
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (e.buttons) {
        scroll = clamp(dragStartScroll + (dragStartX - e.clientX) / sw());
        const now = performance.now(), dt = now - dragLastT;
        if (dt > 0) vel = (dragLastX - e.clientX) / dt * 16;
        dragLastX = e.clientX; dragLastT = now;
      }
      crossI = hitX(e.clientX); draw();
    });
    canvas.addEventListener('pointerup', () => { dragStartX = null; startInertia(); });
    canvas.addEventListener('pointerleave', () => { crossI = null; dragStartX = null; draw(); });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const anchor = hitX(e.clientX), frac = (anchor - scroll) / vis;
      vis = Math.round(Math.max(MIN_VIS, Math.min(MAX_VIS, vis * (e.deltaY > 0 ? 1.12 : 0.89))));
      scroll = clamp(anchor - frac * vis);
      draw();
    }, { passive: false });

    let t0 = null, tScrollRef = null, tVel = 0, tLastX = null, tLastT = null;
    let pinchDist0 = null, pinchVis0 = null, pinchScroll0 = null, pinchMid0 = null;
    canvas.addEventListener('touchstart', e => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      tVel = 0;
      if (e.touches.length === 2) {
        pinchDist0 = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        pinchVis0 = vis; pinchScroll0 = scroll; pinchMid0 = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      } else {
        t0 = e.touches[0].clientX; tScrollRef = scroll; tLastX = t0; tLastT = performance.now(); pinchDist0 = null;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && pinchDist0 != null) {
        const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        const anchor = hitX(pinchMid0), frac = (anchor - pinchScroll0) / pinchVis0;
        vis = Math.round(Math.max(MIN_VIS, Math.min(MAX_VIS, pinchVis0 * (pinchDist0 / dist))));
        scroll = clamp(anchor - frac * vis); draw();
      } else if (e.touches.length === 1 && t0 != null) {
        const x = e.touches[0].clientX;
        scroll = clamp(tScrollRef + (t0 - x) / sw());
        const now = performance.now(), dt = now - tLastT;
        if (dt > 0) tVel = (tLastX - x) / dt * 16;
        tLastX = x; tLastT = now; crossI = hitX(x); draw();
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { t0 = null; pinchDist0 = null; vel = tVel; startInertia(); });

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
  }

  function hydrateAll(root) {
    (root || document).querySelectorAll('[data-chart-pending="candles"],[data-chart-pending="candlestick"]').forEach(div => {
      try {
        const spec = JSON.parse(div.dataset.spec || '{}');
        div.removeAttribute('data-chart-pending');
        div.removeAttribute('data-chart-pending');
        mount(div, spec);
      } catch (err) {
        div.innerHTML = _errorHTML('Candles');
      }
    });
  }

  return { mount, hydrateAll };
})();

export function hydrateQuantCharts(root) {
  QuantTreemap.hydrateAll(root);
  QuantLineChart.hydrateAll(root);
  QuantAreaChart.hydrateAll(root);
  QuantBarChart.hydrateAll(root);
  QuantDonutChart.hydrateAll(root);
  QuantScatterChart.hydrateAll(root);
  QuantCandlestickChart.hydrateAll(root);
}

function hydrateWhenReady() {
  hydrateQuantCharts(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateWhenReady, { once: true });
} else {
  hydrateWhenReady();
}
