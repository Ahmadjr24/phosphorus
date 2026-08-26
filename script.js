const CATEGORY_COLORS = {
  'alkali metal': 'var(--c-alkali)',
  'alkaline earth metal': 'var(--c-alkaline)',
  'lanthanide': 'var(--c-lanthanide)',
  'actinide': 'var(--c-actinide)',
  'transition metal': 'var(--c-transition)',
  'post-transition metal': 'var(--c-post)',
  'metalloid': 'var(--c-metalloid)',
  'diatomic nonmetal': 'var(--c-nonmetal)',
  'polyatomic nonmetal': 'var(--c-nonmetal)',
  'noble gas': 'var(--c-noble)',
};

const TREND_PROPERTIES = {
  mass: { label: 'Atomic mass', unit: ' u', get: e => e.mass },
  density: { label: 'Density', unit: ' g/cm³', get: e => e.density },
  melt: { label: 'Melting point', unit: ' K', get: e => e.melt },
  boil: { label: 'Boiling point', unit: ' K', get: e => e.boil },
  electronegativity: { label: 'Electronegativity', unit: '', get: e => e.electronegativity },
};

const PHASE_COLORS = {
  solid: '#4dabf7',
  liquid: '#22b8cf',
  gas: '#ff8787',
};

function categoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  if (cat.includes('noble gas')) return 'var(--c-noble)';
  if (cat.includes('metalloid')) return 'var(--c-metalloid)';
  if (cat.includes('post-transition')) return 'var(--c-post)';
  if (cat.includes('transition')) return 'var(--c-transition)';
  return 'var(--c-unknown)';
}

function resolveColor(colorExpr) {
  if (colorExpr.startsWith('var(')) {
    return getComputedStyle(document.documentElement).getPropertyValue(colorExpr.slice(4, -1)).trim();
  }
  return colorExpr;
}

function categoryLabel(cat) {
  if (cat.startsWith('unknown')) return 'unconfirmed';
  return cat;
}

function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function trendColor(t) {
  if (t < 0.5) return lerpColor('#2b3a67', '#20c997', t / 0.5);
  return lerpColor('#20c997', '#ff9500', (t - 0.5) / 0.5);
}

function phaseAt(el, tempC) {
  const k = tempC + 273.15;
  const melt = el.melt, boil = el.boil;
  if (melt == null && boil == null) return null;
  if (melt != null && k < melt) return 'solid';
  if (boil != null && k >= boil) return 'gas';
  return 'liquid';
}

let ELEMENTS = [];
let viewMode = 'category';
let trendProperty = 'mass';
let currentTempC = 25;
let activeCategoryFilter = null;
let ABUNDANCE_RANGES = {};
let compareMode = false;
let compareSelection = [];
const COMPARE_MAX = 3;

async function init() {
  const res = await fetch('elements.json');
  ELEMENTS = await res.json();
  computeAbundanceRanges();
  renderTable();
  wireViewModes();
  renderModePanel();
  wireSearch();
  wirePanel();
  wireCompare();
}

function computeAbundanceRanges() {
  ['crust', 'universe', 'human'].forEach(key => {
    const vals = ELEMENTS
      .map(e => e.abundance && e.abundance[key])
      .filter(v => v != null && v > 0)
      .map(v => Math.log10(v));
    ABUNDANCE_RANGES[key] = vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null;
  });
}

function renderTable() {
  const table = document.getElementById('ptable');
  table.innerHTML = '';
  ELEMENTS.forEach(el => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.setProperty('--cat-color', categoryColor(el.category));
    cell.style.gridColumn = el.xpos;
    cell.style.gridRow = el.ypos;
    cell.tabIndex = 0;
    cell.dataset.number = el.number;
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', `${el.name}, element ${el.number}`);
    cell.innerHTML = `
      <span class="num">${el.number}</span>
      <span class="sym">${el.symbol}</span>
      <span class="name">${el.name}</span>
    `;
    cell.addEventListener('click', () => cellClicked(el));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cellClicked(el); }
    });
    table.appendChild(cell);
  });
}

function cellClicked(el) {
  if (compareMode) {
    toggleCompareSelection(el);
  } else {
    openPanel(el);
  }
}

function wireCompare() {
  document.getElementById('compareToggle').addEventListener('click', () => {
    compareMode = !compareMode;
    document.getElementById('compareToggle').classList.toggle('active', compareMode);
    document.getElementById('ptable').classList.toggle('compare-active', compareMode);
    if (!compareMode) {
      compareSelection = [];
      renderCompareTray();
      document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
    }
  });
  document.getElementById('compareClear').addEventListener('click', () => {
    compareSelection = [];
    renderCompareTray();
    document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
  });
  document.getElementById('compareGo').addEventListener('click', openCompareModal);
  document.getElementById('compareModalClose').addEventListener('click', closeCompareModal);
  document.getElementById('compareOverlay').addEventListener('click', closeCompareModal);
}

function toggleCompareSelection(el) {
  const idx = compareSelection.indexOf(el.number);
  const cell = document.querySelector(`.cell[data-number="${el.number}"]`);
  if (idx > -1) {
    compareSelection.splice(idx, 1);
    if (cell) cell.classList.remove('selected');
  } else {
    if (compareSelection.length >= COMPARE_MAX) {
      const tray = document.getElementById('compareChips');
      tray.classList.add('shake');
      setTimeout(() => tray.classList.remove('shake'), 400);
      return;
    }
    compareSelection.push(el.number);
    if (cell) cell.classList.add('selected');
  }
  renderCompareTray();
}

function renderCompareTray() {
  const tray = document.getElementById('compareTray');
  const chips = document.getElementById('compareChips');
  const go = document.getElementById('compareGo');
  tray.classList.toggle('visible', compareMode && compareSelection.length > 0);
  tray.setAttribute('aria-hidden', String(!(compareMode && compareSelection.length > 0)));
  chips.innerHTML = compareSelection.map(num => {
    const el = ELEMENTS.find(e => e.number === num);
    return `<span class="compare-chip" style="border-color:${resolveColor(categoryColor(el.category))}">
      ${el.symbol}
      <button class="compare-chip-remove" data-number="${num}" aria-label="Remove ${el.name}">&times;</button>
    </span>`;
  }).join('');
  chips.querySelectorAll('.compare-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = Number(btn.dataset.number);
      const el = ELEMENTS.find(e => e.number === num);
      toggleCompareSelection(el);
    });
  });
  go.disabled = compareSelection.length < 2;
}

function compareRows() {
  return [
    { label: 'Category', get: e => categoryLabel(e.category) },
    { label: 'Atomic mass', get: e => fmt(e.mass, ' u') },
    { label: 'Phase (room temp)', get: e => fmt(e.phase) },
    { label: 'Period / Group', get: e => `${fmt(e.period)} / ${fmt(e.group)}` },
    { label: 'Block', get: e => fmt(e.block) },
    { label: 'Density', get: e => fmt(e.density, ' g/cm³') },
    { label: 'Electronegativity', get: e => fmt(e.electronegativity) },
    { label: 'Melting point', get: e => fmt(e.melt, ' K') },
    { label: 'Boiling point', get: e => fmt(e.boil, ' K') },
    { label: 'Electron configuration', get: e => fmt(e.electron_configuration) },
    { label: 'Discovered by', get: e => fmt(e.discovered_by) },
  ];
}

function openCompareModal() {
  const els = compareSelection.map(num => ELEMENTS.find(e => e.number === num));
  const content = document.getElementById('compareModalContent');
  const rows = compareRows();

  content.innerHTML = `
    <div class="compare-wrap" style="--compare-cols:${els.length}">
      <div class="compare-grid">
        ${els.map(el => `
          <div class="compare-col">
            <div class="compare-col-bohr">${bohrSVG(el)}</div>
            <div class="compare-col-symbol" style="color:${categoryColor(el.category)}">${el.symbol}</div>
            <div class="compare-col-name">${el.name}</div>
            <div class="compare-col-number">Element ${el.number}</div>
          </div>
        `).join('')}
      </div>
      <div class="compare-table">
        ${rows.map(row => `
          <div class="compare-table-row">
            <div class="compare-table-label">${row.label}</div>
            ${els.map(el => `<div class="compare-table-cell">${row.get(el)}</div>`).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('compareOverlay').classList.add('open');
  document.getElementById('compareModal').classList.add('open');
  document.getElementById('compareModal').setAttribute('aria-hidden', 'false');
}

function closeCompareModal() {
  document.getElementById('compareOverlay').classList.remove('open');
  document.getElementById('compareModal').classList.remove('open');
  document.getElementById('compareModal').setAttribute('aria-hidden', 'true');
}

function wireViewModes() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderModePanel();
    });
  });
}

function renderModePanel() {
  const table = document.getElementById('ptable');
  table.classList.remove('mode-category', 'mode-phase', 'mode-trend');
  table.classList.add(`mode-${viewMode}`);
  const panel = document.getElementById('modePanel');

  if (viewMode === 'category') {
    panel.innerHTML = `<div class="legend" id="legend"></div>`;
    renderLegend();
    applyCategoryStyling();
  } else if (viewMode === 'phase') {
    panel.innerHTML = `
      <div class="phase-controls">
        <input type="range" id="tempSlider" min="-260" max="6000" step="10" value="${currentTempC}">
        <div class="phase-readout">
          <span id="tempLabel">${currentTempC}°C</span>
          <span class="temp-sub" id="tempLabelK">(${(currentTempC + 273.15).toFixed(0)} K)</span>
        </div>
      </div>
      <div class="phase-legend">
        <span class="legend-item"><span class="legend-swatch" style="background:${PHASE_COLORS.solid}"></span>Solid</span>
        <span class="legend-item"><span class="legend-swatch" style="background:${PHASE_COLORS.liquid}"></span>Liquid</span>
        <span class="legend-item"><span class="legend-swatch" style="background:${PHASE_COLORS.gas}"></span>Gas</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--c-unknown)"></span>Unknown</span>
      </div>
    `;
    document.getElementById('tempSlider').addEventListener('input', e => {
      currentTempC = Number(e.target.value);
      document.getElementById('tempLabel').textContent = `${currentTempC}°C`;
      document.getElementById('tempLabelK').textContent = `(${(currentTempC + 273.15).toFixed(0)} K)`;
      applyPhaseStyling();
    });
    applyPhaseStyling();
  } else if (viewMode === 'trend') {
    panel.innerHTML = `
      <div class="trend-controls">
        <select id="trendSelect">
          ${Object.entries(TREND_PROPERTIES).map(([key, p]) => `<option value="${key}" ${key === trendProperty ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
        <div class="trend-gradient-wrap">
          <span class="trend-min" id="trendMin"></span>
          <div class="trend-gradient-bar"></div>
          <span class="trend-max" id="trendMax"></span>
        </div>
      </div>
    `;
    document.getElementById('trendSelect').addEventListener('change', e => {
      trendProperty = e.target.value;
      applyTrendStyling();
    });
    applyTrendStyling();
  }
}

function renderLegend() {
  const seen = new Map();
  ELEMENTS.forEach(el => {
    const key = categoryLabel(el.category).split(',')[0].trim();
    if (!seen.has(key)) seen.set(key, categoryColor(el.category));
  });
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  seen.forEach((color, label) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    item.dataset.label = label;
    item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${label}`;
    item.addEventListener('click', () => toggleCategoryFilter(label));
    legend.appendChild(item);
  });
}

function toggleCategoryFilter(label) {
  activeCategoryFilter = activeCategoryFilter === label ? null : label;
  document.querySelectorAll('.legend-item').forEach(item => {
    item.classList.toggle('dimmed', activeCategoryFilter && item.dataset.label !== activeCategoryFilter);
  });
  document.querySelectorAll('.cell').forEach(cell => {
    const el = ELEMENTS.find(e => String(e.number) === cell.dataset.number);
    const label2 = categoryLabel(el.category).split(',')[0].trim();
    cell.classList.toggle('dimmed', activeCategoryFilter && label2 !== activeCategoryFilter);
  });
  document.getElementById('search').value = '';
}

function applyCategoryStyling() {
  document.querySelectorAll('.cell').forEach(cell => {
    cell.style.removeProperty('--cell-fill');
    cell.classList.remove('no-data');
  });
}

function applyPhaseStyling() {
  document.querySelectorAll('.cell').forEach(cell => {
    const el = ELEMENTS.find(e => String(e.number) === cell.dataset.number);
    const phase = phaseAt(el, currentTempC);
    if (phase) {
      cell.style.setProperty('--cell-fill', PHASE_COLORS[phase]);
      cell.classList.remove('no-data');
    } else {
      cell.style.removeProperty('--cell-fill');
      cell.classList.add('no-data');
    }
  });
}

function applyTrendStyling() {
  const prop = TREND_PROPERTIES[trendProperty];
  const values = ELEMENTS.map(e => prop.get(e)).filter(v => v != null);
  const min = Math.min(...values), max = Math.max(...values);
  document.getElementById('trendMin').textContent = `${min}${prop.unit}`;
  document.getElementById('trendMax').textContent = `${max}${prop.unit}`;

  document.querySelectorAll('.cell').forEach(cell => {
    const el = ELEMENTS.find(e => String(e.number) === cell.dataset.number);
    const v = prop.get(el);
    if (v == null || max === min) {
      cell.style.removeProperty('--cell-fill');
      cell.classList.toggle('no-data', v == null);
      return;
    }
    const t = (v - min) / (max - min);
    cell.style.setProperty('--cell-fill', trendColor(t));
    cell.classList.remove('no-data');
  });
}

function wireSearch() {
  const input = document.getElementById('search');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll('.cell').forEach(cell => {
      const el = ELEMENTS.find(e => String(e.number) === cell.dataset.number);
      const hit = q.length > 0 && (
        el.name.toLowerCase().includes(q) ||
        el.symbol.toLowerCase().includes(q) ||
        String(el.number) === q
      );
      cell.classList.toggle('match', hit);
      cell.classList.toggle('dimmed', q.length > 0 && !hit);
    });
  });
}

function fmt(value, unit) {
  if (value === null || value === undefined) return '—';
  return `${value}${unit || ''}`;
}

function fmtAbundance(v) {
  if (v == null) return null;
  const pct = v * 100;
  if (pct >= 0.1) return `${pct.toFixed(pct >= 1 ? 1 : 2)}%`;
  const ppm = v * 1e6;
  if (ppm >= 0.1) return `${ppm.toPrecision(2)} ppm`;
  const ppb = v * 1e9;
  if (ppb >= 0.1) return `${ppb.toPrecision(2)} ppb`;
  return `${(v * 1e12).toPrecision(2)} ppt`;
}

function abundancePct(key, value) {
  const range = ABUNDANCE_RANGES[key];
  if (value == null || value <= 0 || !range || range.max === range.min) return 0;
  const logv = Math.log10(value);
  return Math.max(3, ((logv - range.min) / (range.max - range.min)) * 100);
}

function abundanceBarsHTML(el) {
  const rows = [
    { key: 'crust', label: "Earth's crust" },
    { key: 'universe', label: 'Universe (relative)' },
    { key: 'human', label: 'Human body' },
  ];
  const bars = rows.map(({ key, label }) => {
    const v = el.abundance ? el.abundance[key] : null;
    if (v == null) {
      return `<div class="abundance-row">
        <span class="abundance-label">${label}</span>
        <div class="abundance-bar-track"><div class="abundance-bar-fill none"></div></div>
        <span class="abundance-value">not detected</span>
      </div>`;
    }
    const pct = abundancePct(key, v);
    const display = key === 'universe' ? v.toExponential(1) : fmtAbundance(v);
    return `<div class="abundance-row">
      <span class="abundance-label">${label}</span>
      <div class="abundance-bar-track"><div class="abundance-bar-fill" style="width:${pct}%"></div></div>
      <span class="abundance-value">${display}</span>
    </div>`;
  }).join('');
  return `<div class="abundance-block">
    <div class="label">Abundance (log scale, relative to most abundant element)</div>
    ${bars}
  </div>`;
}

function bohrSVG(el) {
  const shells = el.shells || [];
  const size = 340;
  const c = size / 2;
  const color = resolveColor(categoryColor(el.category));
  const innerR = 32;
  const outerR = 150;
  const step = shells.length > 1 ? (outerR - innerR) / (shells.length - 1) : 0;

  let rings = '';
  let electrons = '';
  shells.forEach((count, i) => {
    const r = shells.length === 1 ? outerR * 0.7 : innerR + step * i;
    rings += `<circle cx="${c}" cy="${c}" r="${r}" class="bohr-ring" />`;
    const dur = (5 + i * 3.2).toFixed(1);
    let dots = '';
    for (let k = 0; k < count; k++) {
      const angle = (360 / count) * k;
      const rad = (angle * Math.PI) / 180;
      const ex = c + r * Math.cos(rad);
      const ey = c + r * Math.sin(rad);
      dots += `<circle cx="${ex.toFixed(2)}" cy="${ey.toFixed(2)}" r="4.5" class="bohr-electron" />`;
    }
    electrons += `<g>
      <animateTransform attributeName="transform" type="rotate" from="0 ${c} ${c}" to="360 ${c} ${c}" dur="${dur}s" repeatCount="indefinite" />
      ${dots}
    </g>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" class="bohr-svg" role="img" aria-label="Bohr diagram of ${el.name}">
    ${rings}
    ${electrons}
    <circle cx="${c}" cy="${c}" r="20" fill="${color}" class="bohr-nucleus" />
    <text x="${c}" y="${c + 5}" text-anchor="middle" class="bohr-nucleus-label">${el.symbol}</text>
  </svg>`;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
}

function load3DModel(el) {
  const holder = document.getElementById('model3dHolder');
  if (!el.bohr_3d) {
    holder.innerHTML = `<p class="model-unavailable">No 3D model available for this element.</p>`;
    return;
  }
  holder.innerHTML = `<model-viewer
      src="${el.bohr_3d}"
      alt="3D atomic model of ${el.name}"
      loading="eager"
      reveal="auto"
      camera-controls
      auto-rotate
      auto-rotate-delay="0"
      rotation-per-second="18deg"
      exposure="1.1"
      shadow-intensity="0.6"
      interaction-prompt="none"
      class="model-viewer-el">
    </model-viewer>`;
}

function openPanel(el) {
  const content = document.getElementById('panelContent');
  content.innerHTML = `
    <div class="panel-number">Element ${el.number}</div>
    <div class="panel-symbol" style="color:${categoryColor(el.category)}">${el.symbol}</div>
    <div class="panel-name">${el.name}</div>
    <span class="panel-category">${categoryLabel(el.category)}</span>

    <div class="tabs">
      <button class="tab-btn active" data-tab="overview">Overview</button>
      <button class="tab-btn" data-tab="atom">Atom model</button>
    </div>

    <div class="tab-pane active" data-pane="overview">
      <div class="panel-grid">
        <div class="stat"><div class="label">Atomic mass</div><div class="value">${fmt(el.mass, ' u')}</div></div>
        <div class="stat"><div class="label">Phase</div><div class="value">${fmt(el.phase)}</div></div>
        <div class="stat"><div class="label">Period / Group</div><div class="value">${fmt(el.period)} / ${fmt(el.group)}</div></div>
        <div class="stat"><div class="label">Block</div><div class="value">${fmt(el.block)}</div></div>
        <div class="stat"><div class="label">Density</div><div class="value">${fmt(el.density, ' g/cm³')}</div></div>
        <div class="stat"><div class="label">Electronegativity</div><div class="value">${fmt(el.electronegativity)}</div></div>
        <div class="stat"><div class="label">Melting point</div><div class="value">${fmt(el.melt, ' K')}</div></div>
        <div class="stat"><div class="label">Boiling point</div><div class="value">${fmt(el.boil, ' K')}</div></div>
      </div>

      <div class="stat" style="border-top:none; padding-top:0;">
        <div class="label">Electron configuration</div>
        <div class="value">${fmt(el.electron_configuration)}</div>
      </div>

      ${el.shells ? `<div class="panel-shells">${el.shells.map(s => `<span class="shell-badge">${s}e⁻</span>`).join('')}</div>` : ''}

      <div class="stat" style="border-top:none; padding-top:16px;">
        <div class="label">Discovered by</div>
        <div class="value" style="font-family:inherit;">${fmt(el.discovered_by)}</div>
      </div>

      ${el.appearance ? `<div class="stat" style="border-top:none; padding-top:12px;">
        <div class="label">Appearance</div>
        <div class="value" style="font-family:inherit;">${el.appearance}</div>
      </div>` : ''}

      <p class="panel-summary">${el.summary || 'No summary available for this element yet.'}</p>

      ${abundanceBarsHTML(el)}
    </div>

    <div class="tab-pane" data-pane="atom">
      <p class="atom-caption">Bohr model — ${el.shells ? el.shells.length : 0} shell${el.shells && el.shells.length === 1 ? '' : 's'}, ${el.number} electrons.</p>
      <div class="bohr-wrap">${bohrSVG(el)}</div>
      <button class="btn-3d" id="btn3d">View real 3D model ↗</button>
      <div id="model3dHolder" class="model3d-holder"></div>
    </div>
  `;

  content.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('btn3d').addEventListener('click', (e) => {
    e.target.remove();
    load3DModel(el);
  });

  document.getElementById('overlay').classList.add('open');
  document.getElementById('panel').classList.add('open');
  document.getElementById('panel').setAttribute('aria-hidden', 'false');
}

function closePanel() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('panel').classList.remove('open');
  document.getElementById('panel').setAttribute('aria-hidden', 'true');
}

function wirePanel() {
  document.getElementById('panelClose').addEventListener('click', closePanel);
  document.getElementById('overlay').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
}

init();
