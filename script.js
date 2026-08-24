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

function categoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  if (cat.includes('noble gas')) return 'var(--c-noble)';
  if (cat.includes('metalloid')) return 'var(--c-metalloid)';
  if (cat.includes('post-transition')) return 'var(--c-post)';
  if (cat.includes('transition')) return 'var(--c-transition)';
  return 'var(--c-unknown)';
}

function categoryLabel(cat) {
  if (cat.startsWith('unknown')) return 'unconfirmed';
  return cat;
}

let ELEMENTS = [];

async function init() {
  const res = await fetch('elements.json');
  ELEMENTS = await res.json();
  renderTable();
  renderLegend();
  wireSearch();
  wirePanel();
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
    cell.addEventListener('click', () => openPanel(el));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(el); }
    });
    table.appendChild(cell);
  });
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

let activeCategoryFilter = null;

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

function openPanel(el) {
  const content = document.getElementById('panelContent');
  content.innerHTML = `
    <div class="panel-number">Element ${el.number}</div>
    <div class="panel-symbol" style="color:${categoryColor(el.category)}">${el.symbol}</div>
    <div class="panel-name">${el.name}</div>
    <span class="panel-category">${categoryLabel(el.category)}</span>

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
  `;
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
