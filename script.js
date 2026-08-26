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

const CATEGORY_INFO = {
  'alkali metal': 'Group 1 elements (excluding hydrogen). Soft, shiny, and highly reactive — each atom has a single outer electron it readily gives up to form a +1 ion, which is why alkali metals react violently with water.',
  'alkaline earth metal': 'Group 2 elements. Reactive metals that lose two outer electrons to form +2 ions — less reactive than the alkali metals next to them on the table, but still far from inert.',
  'transition metal': 'Groups 3–12. Metals with partially filled d-orbitals, which lets them form ions with more than one possible charge, act as catalysts, and produce many brightly colored compounds.',
  'post-transition metal': 'Metals to the right of the transition metals. Softer and with lower melting points than transition metals, sometimes behaving more like their nonmetal neighbors on the table.',
  'lanthanide': 'The 15 elements from lanthanum to lutetium. Filling the inner 4f electron shell gives them nearly identical chemical properties, which historically made them very difficult to separate from one another.',
  'actinide': 'The 15 elements from actinium to lawrencium. Filling the inner 5f electron shell; all are radioactive, and most of the heavier actinides only exist because they were made in a lab.',
  'metalloid': 'Elements sitting on the border between metals and nonmetals, sharing properties of both. Several are semiconductors, which is why silicon and germanium anchor the electronics industry.',
  'diatomic nonmetal': 'Nonmetals that occur as two-atom molecules (like H₂, N₂, and O₂) in their pure, natural state rather than as single atoms or larger clusters.',
  'polyatomic nonmetal': 'Nonmetals that bond into larger multi-atom structures rather than simple two-atom molecules — sulfur forms S₈ rings, phosphorus forms P₄ clusters, and carbon builds extended networks like graphite and diamond.',
  'noble gas': 'Group 18 elements. Their outer electron shell is completely full, so they almost never react with anything — the most chemically "content" elements on the table.',
};

const CATEGORY_GUESS_ORDER = ['noble gas', 'metalloid', 'post-transition metal', 'transition metal', 'alkali metal', 'alkaline earth metal', 'lanthanide', 'actinide', 'diatomic nonmetal', 'polyatomic nonmetal'];

function categoryGuess(cat) {
  return CATEGORY_GUESS_ORDER.find(key => cat.includes(key)) || null;
}

function categoryLabel(cat) {
  if (cat.startsWith('unknown')) {
    const guess = categoryGuess(cat);
    return guess ? `predicted ${guess}` : 'unconfirmed category';
  }
  return cat;
}

function categoryInfo(cat) {
  if (CATEGORY_INFO[cat]) return CATEGORY_INFO[cat];
  if (cat.startsWith('unknown')) {
    const base = 'This element is synthetic and superheavy — too rare and short-lived (often existing for a fraction of a second) to test directly, so its category is a prediction based on periodic trends rather than a confirmed measurement.';
    const guess = categoryGuess(cat);
    return guess ? `${base} It's predicted to be a ${guess}. ${CATEGORY_INFO[guess]}` : base;
  }
  return 'No classification notes available for this category yet.';
}

function fmtDiscoveryYear(year) {
  if (year == null) return '—';
  if (year < 0) return `~${Math.abs(year).toLocaleString()} BCE (known since antiquity)`;
  return `${year}`;
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
let currentPanelElement = null;
const TIMELINE_MIN = 1600;
const TIMELINE_MAX = new Date().getFullYear();
let currentTimelineYear = 1750;
let REACTIONS = [];
let reactionMode = false;
let reactionSelection = [];

const GHS_LABELS = {
  GHS01: 'Explosive',
  GHS02: 'Flammable',
  GHS03: 'Oxidizer',
  GHS04: 'Compressed gas',
  GHS05: 'Corrosive',
  GHS06: 'Toxic',
  GHS07: 'Irritant',
  GHS08: 'Health hazard',
  GHS09: 'Environmental hazard',
};

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
  wireHashRouting();
  fetch('reactions.json').then(r => r.json()).then(data => { REACTIONS = data; });
  wireReactionLab();
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
  } else if (reactionMode) {
    toggleReactionSelection(el);
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

function wireReactionLab() {
  document.getElementById('reactionToggle').addEventListener('click', () => {
    reactionMode = !reactionMode;
    document.getElementById('reactionToggle').classList.toggle('active', reactionMode);
    document.getElementById('ptable').classList.toggle('reaction-active', reactionMode);
    if (!reactionMode) clearReactionSelection();
  });
  document.getElementById('reactionClear').addEventListener('click', clearReactionSelection);
  document.getElementById('reactionModalClose').addEventListener('click', closeReactionModal);
  document.getElementById('reactionOverlay').addEventListener('click', closeReactionModal);
}

function clearReactionSelection() {
  reactionSelection = [];
  renderReactionTray();
  document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
}

function formatFormula(formula) {
  return formula.replace(/(\d+)/g, '<sub>$1</sub>');
}

function displaySymbol(el) {
  return el.category === 'diatomic nonmetal' ? `${el.symbol}<sub>2</sub>` : el.symbol;
}

function coefStr(n) {
  return n === 1 ? '' : `${n} `;
}

function findReaction(numA, numB) {
  const a = ELEMENTS.find(e => e.number === numA);
  const b = ELEMENTS.find(e => e.number === numB);
  const symbols = new Set([a.symbol, b.symbol]);
  return REACTIONS.find(r => r.reactants.length === 2 &&
    symbols.has(r.reactants[0].symbol) && symbols.has(r.reactants[1].symbol) &&
    new Set(r.reactants.map(x => x.symbol)).size === symbols.size
  );
}

function toggleReactionSelection(el) {
  const idx = reactionSelection.indexOf(el.number);
  const cell = document.querySelector(`.cell[data-number="${el.number}"]`);
  if (idx > -1) {
    reactionSelection.splice(idx, 1);
    if (cell) cell.classList.remove('selected');
  } else {
    if (reactionSelection.length >= 2) {
      const tray = document.getElementById('reactionChips');
      tray.classList.add('shake');
      setTimeout(() => tray.classList.remove('shake'), 400);
      return;
    }
    reactionSelection.push(el.number);
    if (cell) cell.classList.add('selected');
  }
  renderReactionTray();
  if (reactionSelection.length === 2) {
    openReactionModal(reactionSelection[0], reactionSelection[1]);
  }
}

function renderReactionTray() {
  const tray = document.getElementById('reactionTray');
  const chips = document.getElementById('reactionChips');
  tray.classList.toggle('visible', reactionMode && reactionSelection.length > 0);
  tray.setAttribute('aria-hidden', String(!(reactionMode && reactionSelection.length > 0)));
  chips.innerHTML = reactionSelection.map(num => {
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
      toggleReactionSelection(el);
    });
  });
}

function ghsBadgesHTML(product) {
  if (!product.ghsPictograms || product.ghsPictograms.length === 0) {
    return `<span class="ghs-badge ghs-none">No GHS hazard classification on file</span>`;
  }
  return product.ghsPictograms.map(code =>
    `<span class="ghs-badge">${GHS_LABELS[code] || code}</span>`
  ).join('');
}

function openReactionModal(numA, numB) {
  const elA = ELEMENTS.find(e => e.number === numA);
  const elB = ELEMENTS.find(e => e.number === numB);
  const content = document.getElementById('reactionModalContent');
  const reaction = findReaction(numA, numB);

  if (!reaction) {
    content.innerHTML = `
      <div class="reaction-header">
        <span class="reaction-symbol">${elA.symbol}</span>
        <span class="reaction-plus">+</span>
        <span class="reaction-symbol">${elB.symbol}</span>
      </div>
      <p class="reaction-none">No known reaction between ${elA.name} and ${elB.name} in this lab (yet). This library covers a curated set of well-documented reactions rather than every possible combination — try another pair.</p>
    `;
  } else {
    const [rA, rB] = reaction.reactants[0].symbol === elA.symbol ? [reaction.reactants[0], reaction.reactants[1]] : [reaction.reactants[1], reaction.reactants[0]];
    const eA = ELEMENTS.find(e => e.symbol === rA.symbol);
    const eB = ELEMENTS.find(e => e.symbol === rB.symbol);
    const equation = `${coefStr(rA.coef)}${displaySymbol(eA)} + ${coefStr(rB.coef)}${displaySymbol(eB)} &rarr; ${coefStr(reaction.productCoef)}${formatFormula(reaction.product.formula)}`;
    content.innerHTML = `
      <div class="reaction-header">
        <span class="reaction-symbol" style="color:${categoryColor(eA.category)}">${elA.symbol}</span>
        <span class="reaction-plus">+</span>
        <span class="reaction-symbol" style="color:${categoryColor(eB.category)}">${elB.symbol}</span>
      </div>
      <div class="reaction-equation">${equation}</div>
      <div class="reaction-product-row">
        <img class="reaction-product-img" src="https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${reaction.product.cid}&width=160&height=160" alt="${reaction.product.name} structure" loading="eager">
        <div>
          <div class="reaction-product-name">${reaction.product.name}${reaction.product.commonName ? ` <span class="reaction-common">(${reaction.product.commonName})</span>` : ''}</div>
          <div class="reaction-energy ${reaction.exothermic ? 'exo' : 'endo'}">
            ${reaction.exothermic ? 'Exothermic' : 'Endothermic'} — &Delta;H = ${reaction.deltaH} kJ/mol
          </div>
        </div>
      </div>
      <p class="reaction-desc">${reaction.description}</p>

      ${reaction.product.has3D
        ? `<button class="btn-3d" id="btnReaction3d">View real 3D structure ↗</button>
           <div id="reaction3dHolder" class="model3d-holder"></div>`
        : `<p class="reaction-no3d">${reaction.product.name} is an ionic solid — a repeating crystal lattice, not a single discrete molecule — so there is no one "3D structure" to show it as. (Compare that to covalent molecules like water or CO₂, which do have one.)</p>`
      }

      <div class="reaction-hazards">
        <div class="label">GHS hazard classification (real PubChem data)</div>
        <div class="ghs-badges">${ghsBadgesHTML(reaction.product)}</div>
      </div>
    `;
    if (reaction.product.has3D) {
      document.getElementById('btnReaction3d').addEventListener('click', (e) => {
        e.target.remove();
        load3DMolecule(reaction.product.cid, 'reaction3dHolder', reaction.product.name);
      });
    }
  }

  document.getElementById('reactionOverlay').classList.add('open');
  document.getElementById('reactionModal').classList.add('open');
  document.getElementById('reactionModal').setAttribute('aria-hidden', 'false');
}

async function load3DMolecule(cid, holderId, name) {
  const holder = document.getElementById(holderId);
  holder.innerHTML = `<p class="model-loading">Loading 3D structure…</p>`;
  try {
    const res = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`);
    if (!res.ok) throw new Error('No 3D structure available');
    const sdf = await res.text();
    holder.innerHTML = '';
    holder.classList.add('molviewer');
    const viewer = window.$3Dmol.createViewer(holder, { backgroundColor: '0x14171b' });
    viewer.addModel(sdf, 'sdf');
    viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.28 } });
    viewer.zoomTo();
    viewer.render();
    viewer.spin('y', 0.6);
  } catch (err) {
    holder.innerHTML = `<p class="model-unavailable">Could not load the 3D structure for ${name} right now.</p>`;
  }
}

function closeReactionModal() {
  document.getElementById('reactionOverlay').classList.remove('open');
  document.getElementById('reactionModal').classList.remove('open');
  document.getElementById('reactionModal').setAttribute('aria-hidden', 'true');
  clearReactionSelection();
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

function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} BCE`;
  return `${year} CE`;
}

function renderModePanel() {
  const table = document.getElementById('ptable');
  table.classList.remove('mode-category', 'mode-phase', 'mode-trend', 'mode-timeline');
  table.classList.add(`mode-${viewMode}`);
  document.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('no-data', 'undiscovered');
    cell.style.removeProperty('--cell-fill');
  });
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
  } else if (viewMode === 'timeline') {
    panel.innerHTML = `
      <div class="phase-controls">
        <input type="range" id="yearSlider" min="${TIMELINE_MIN}" max="${TIMELINE_MAX}" step="1" value="${currentTimelineYear}">
        <div class="phase-readout">
          <span id="yearLabel">${currentTimelineYear}</span>
          <span class="temp-sub" id="yearCount"></span>
        </div>
      </div>
      <p class="timeline-caption" id="timelineCaption"></p>
    `;
    document.getElementById('yearSlider').addEventListener('input', e => {
      currentTimelineYear = Number(e.target.value);
      document.getElementById('yearLabel').textContent = currentTimelineYear;
      applyTimelineStyling();
    });
    applyTimelineStyling();
  }
}

function applyTimelineStyling() {
  let knownCount = 0;
  let latest = null;
  document.querySelectorAll('.cell').forEach(cell => {
    const el = ELEMENTS.find(e => String(e.number) === cell.dataset.number);
    const known = el.discovered_year <= currentTimelineYear;
    cell.classList.toggle('undiscovered', !known);
    if (known) {
      knownCount++;
      if (el.discovered_year >= 1600 && (!latest || el.discovered_year > latest.discovered_year)) {
        latest = el;
      }
    }
  });
  document.getElementById('yearCount').textContent = `(${knownCount}/118 known)`;
  const caption = document.getElementById('timelineCaption');
  if (latest) {
    caption.textContent = `Most recently discovered by ${currentTimelineYear}: ${latest.name} (${latest.discovered_year})`;
  } else {
    caption.textContent = `Only elements known since antiquity have been identified so far.`;
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
    <button type="button" class="panel-category" id="categoryTag" aria-expanded="false">
      ${categoryLabel(el.category)} <span class="info-icon">ⓘ</span>
    </button>
    <div class="category-info" id="categoryInfo" hidden>${categoryInfo(el.category)}</div>

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
        <div class="label">Discovered</div>
        <div class="value" style="font-family:inherit;">${fmtDiscoveryYear(el.discovered_year)}${el.discovered_by && !/^unknown/i.test(el.discovered_by) ? ` — ${el.discovered_by}` : ''}</div>
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
  document.getElementById('categoryTag').addEventListener('click', () => {
    const tag = document.getElementById('categoryTag');
    const info = document.getElementById('categoryInfo');
    const isHidden = info.hasAttribute('hidden');
    if (isHidden) info.removeAttribute('hidden'); else info.setAttribute('hidden', '');
    tag.setAttribute('aria-expanded', String(isHidden));
    tag.classList.toggle('expanded', isHidden);
  });

  document.getElementById('overlay').classList.add('open');
  document.getElementById('panel').classList.add('open');
  document.getElementById('panel').setAttribute('aria-hidden', 'false');

  currentPanelElement = el.number;
  history.pushState(null, '', `#element/${el.number}`);
  document.title = `${el.name} (${el.symbol}) — Phosphorus`;
}

function closePanel() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('panel').classList.remove('open');
  document.getElementById('panel').setAttribute('aria-hidden', 'true');

  if (currentPanelElement !== null) {
    currentPanelElement = null;
    history.pushState(null, '', location.pathname + location.search);
    document.title = 'Phosphorus — The Periodic Table, Fully Loaded';
  }
}

function wirePanel() {
  document.getElementById('panelClose').addEventListener('click', closePanel);
  document.getElementById('overlay').addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
}

function wireHashRouting() {
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

function handleHashChange() {
  const m = location.hash.match(/^#element\/(\d+)$/);
  if (m) {
    const num = Number(m[1]);
    if (currentPanelElement !== num) {
      const el = ELEMENTS.find(e => e.number === num);
      if (el) openPanel(el);
    }
  } else if (currentPanelElement !== null) {
    closePanel();
  }
}

init();
