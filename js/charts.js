/**
 * charts.js — Climate Update
 * Pure SVG/Canvas weather chart components. Zero external dependencies.
 *
 * Exports:
 *   renderAllCharts(hourly, unit)  — renders all 5 charts into their containers
 *   destroyCharts()                — clears all chart containers
 */

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const CONTAINERS = {
  temp:     'chart-temp',
  humidity: 'chart-humidity',
  wind:     'chart-wind',
  precip:   'chart-precip',
  pressure: 'chart-pressure',
};

const PAD = { top: 20, right: 12, bottom: 32, left: 40 };

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Render all 5 weather charts.
 * @param {Array}   hourly   Parsed hourly array from api.js (24 items)
 * @param {'C'|'F'} unit
 */
export function renderAllCharts(hourly, unit) {
  if (!hourly?.length) return;

  // Convert temperature if needed
  const temps = hourly.map(h => unit === 'F' ? Math.round(h.temp * 9 / 5 + 32) : h.temp);
  const labels = hourly.map(h => fmtHour(h.time));

  renderAreaChart({
    id:       CONTAINERS.temp,
    data:     temps,
    labels,
    unit:     unit === 'F' ? '°F' : '°C',
    title:    'Temperature',
    color:    '#f97316',
    gradTop:  'rgba(249,115,22,0.35)',
    gradBot:  'rgba(249,115,22,0)',
    yMin:     Math.min(...temps) - 3,
    yMax:     Math.max(...temps) + 3,
  });

  renderAreaChart({
    id:      CONTAINERS.humidity,
    data:    hourly.map(h => h.humidity ?? 50),
    labels,
    unit:    '%',
    title:   'Humidity',
    color:   '#60a5fa',
    gradTop: 'rgba(96,165,250,0.35)',
    gradBot: 'rgba(96,165,250,0)',
    yMin:    0,
    yMax:    100,
  });

  renderBarChart({
    id:     CONTAINERS.wind,
    data:   hourly.map(h => unit === 'F' ? Math.round((h.windSpeed ?? 0) * 0.621371) : (h.windSpeed ?? 0)),
    labels,
    unit:   unit === 'F' ? 'mph' : 'km/h',
    title:  'Wind Speed',
    color:  '#a78bfa',
  });

  renderBarChart({
    id:     CONTAINERS.precip,
    data:   hourly.map(h => h.precipP ?? 0),
    labels,
    unit:   '%',
    title:  'Rain Chance',
    color:  '#38bdf8',
  });

  renderAreaChart({
    id:      CONTAINERS.pressure,
    data:    hourly.map(h => h.pressure ?? 1013),
    labels,
    unit:    'hPa',
    title:   'Pressure',
    color:   '#34d399',
    gradTop: 'rgba(52,211,153,0.30)',
    gradBot: 'rgba(52,211,153,0)',
    yMin:    Math.min(...hourly.map(h => h.pressure ?? 1013)) - 3,
    yMax:    Math.max(...hourly.map(h => h.pressure ?? 1013)) + 3,
  });
}

/** Clear all chart containers. */
export function destroyCharts() {
  Object.values(CONTAINERS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

// ────────────────────────────────────────────────────────────
// Area Chart (temperature, humidity, pressure)
// ────────────────────────────────────────────────────────────
function renderAreaChart({ id, data, labels, unit, title, color, gradTop, gradBot, yMin, yMax }) {
  const el = document.getElementById(id);
  if (!el) return;

  const W   = el.clientWidth  || 320;
  const H   = 140;
  const cW  = W - PAD.left - PAD.right;
  const cH  = H - PAD.top  - PAD.bottom;
  const range = yMax - yMin || 1;

  // Map data → SVG coords
  const pts = data.map((v, i) => ({
    x: PAD.left + (i / (data.length - 1)) * cW,
    y: PAD.top  + cH - ((v - yMin) / range) * cH,
    v,
  }));

  const gradId   = `ag-${id}`;
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M ${pts[0].x},${PAD.top + cH} ` +
    pts.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x},${PAD.top + cH} Z`;

  // Y-axis labels (3 ticks)
  const yTicks = [yMin, yMin + (yMax - yMin) / 2, yMax].map(v => ({
    y:   PAD.top + cH - ((v - yMin) / range) * cH,
    val: Number.isInteger(v) ? v : v.toFixed(0),
  }));

  // X-axis labels (every 4h)
  const xLabels = pts.filter((_, i) => i % 4 === 0);

  // Dots at every 4h
  const dots = pts.filter((_, i) => i % 4 === 0);

  const svg = `
<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${title} chart" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${gradTop}"/>
      <stop offset="100%" stop-color="${gradBot}"/>
    </linearGradient>
    <clipPath id="clip-${id}">
      <rect x="${PAD.left}" y="${PAD.top}" width="${cW}" height="${cH}"/>
    </clipPath>
  </defs>

  <!-- Grid lines -->
  ${yTicks.map(t =>
    `<line x1="${PAD.left}" y1="${t.y}" x2="${PAD.left + cW}" y2="${t.y}"
      stroke="var(--glass-border)" stroke-width="1" stroke-dasharray="4 4"/>`
  ).join('')}

  <!-- Area fill -->
  <path d="${areaPath}" fill="url(#${gradId})" clip-path="url(#clip-${id})"/>

  <!-- Line -->
  <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" clip-path="url(#clip-${id})"/>

  <!-- Dots -->
  ${dots.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}" stroke="var(--surface-bg,#0f172a)" stroke-width="1.5"/>`
  ).join('')}

  <!-- Y-axis labels -->
  ${yTicks.map(t =>
    `<text x="${PAD.left - 6}" y="${t.y + 4}" text-anchor="end"
      font-size="9" fill="var(--text-muted)" font-family="var(--font-body,sans-serif)">${t.val}${unit}</text>`
  ).join('')}

  <!-- X-axis labels -->
  ${xLabels.map(p =>
    `<text x="${p.x}" y="${H - 6}" text-anchor="middle"
      font-size="9" fill="var(--text-muted)" font-family="var(--font-body,sans-serif)">${labels[pts.indexOf(p)]}</text>`
  ).join('')}

  <!-- Axis lines -->
  <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + cH}"
    stroke="var(--glass-border)" stroke-width="1"/>
  <line x1="${PAD.left}" y1="${PAD.top + cH}" x2="${PAD.left + cW}" y2="${PAD.top + cH}"
    stroke="var(--glass-border)" stroke-width="1"/>
</svg>`;

  el.innerHTML = `
    <div class="chart-title">${title}</div>
    <div class="chart-svg-wrap">${svg}</div>
  `;
}

// ────────────────────────────────────────────────────────────
// Bar Chart (wind, precip)
// ────────────────────────────────────────────────────────────
function renderBarChart({ id, data, labels, unit, title, color }) {
  const el = document.getElementById(id);
  if (!el) return;

  const W   = el.clientWidth || 320;
  const H   = 140;
  const cW  = W - PAD.left - PAD.right;
  const cH  = H - PAD.top  - PAD.bottom;
  const yMax = Math.max(...data, 1);
  const barW = Math.max(3, cW / data.length - 2);

  // Y ticks
  const yTicks = [0, Math.round(yMax / 2), yMax];

  // X labels every 4
  const step = Math.max(1, Math.floor(data.length / 6));

  const bars = data.map((v, i) => {
    const bH = (v / yMax) * cH;
    return {
      x:  PAD.left + (i / data.length) * cW + 1,
      y:  PAD.top + cH - bH,
      w:  barW,
      h:  Math.max(2, bH),
      v,
      label: i % step === 0 ? labels[i] : null,
    };
  });

  const gradId = `bg-${id}`;

  const svg = `
<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${title} chart" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${color}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>

  <!-- Grid lines -->
  ${yTicks.map(v => {
    const y = PAD.top + cH - (v / yMax) * cH;
    return `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + cW}" y2="${y}"
      stroke="var(--glass-border)" stroke-width="1" stroke-dasharray="4 4"/>
    <text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end"
      font-size="9" fill="var(--text-muted)" font-family="var(--font-body,sans-serif)">${v}${unit}</text>`;
  }).join('')}

  <!-- Bars -->
  ${bars.map(b =>
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"
      fill="url(#${gradId})" rx="2"/>`
  ).join('')}

  <!-- X labels -->
  ${bars.filter(b => b.label).map(b =>
    `<text x="${b.x + b.w / 2}" y="${H - 6}" text-anchor="middle"
      font-size="9" fill="var(--text-muted)" font-family="var(--font-body,sans-serif)">${b.label}</text>`
  ).join('')}

  <!-- Axis lines -->
  <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + cH}"
    stroke="var(--glass-border)" stroke-width="1"/>
  <line x1="${PAD.left}" y1="${PAD.top + cH}" x2="${PAD.left + cW}" y2="${PAD.top + cH}"
    stroke="var(--glass-border)" stroke-width="1"/>
</svg>`;

  el.innerHTML = `
    <div class="chart-title">${title}</div>
    <div class="chart-svg-wrap">${svg}</div>
  `;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function fmtHour(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
}
