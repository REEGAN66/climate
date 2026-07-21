/**
 * sidebar.js — Climate Update
 * Collapsible left sidebar displaying 14 weather metrics.
 * Clicking any metric opens a premium detail drawer.
 *
 * Dependencies: api.js (formatTemp, degToCompass, toMph)
 */

import { formatTemp, degToCompass, toMph } from './api.js';

// ────────────────────────────────────────────────────────────
// Module state
// ────────────────────────────────────────────────────────────
let _data        = null;   // { current, daily, hourly }
let _unit        = 'C';
let _drawerOpen  = false;
let _prevFocus   = null;

// ────────────────────────────────────────────────────────────
// Metric definitions
// ────────────────────────────────────────────────────────────
const METRICS = [
  { id: 'sb-humidity',    icon: '💧', label: 'Humidity',       key: 'humidity'    },
  { id: 'sb-feels',       icon: '🤔', label: 'Feels Like',     key: 'feelsLike'   },
  { id: 'sb-wind-speed',  icon: '💨', label: 'Wind Speed',     key: 'windSpeed'   },
  { id: 'sb-wind-dir',    icon: '🧭', label: 'Wind Direction', key: 'windDir'     },
  { id: 'sb-pressure',    icon: '🔽', label: 'Pressure',       key: 'pressure'    },
  { id: 'sb-visibility',  icon: '👁️', label: 'Visibility',     key: 'visibility'  },
  { id: 'sb-uv',          icon: '☀️', label: 'UV Index',       key: 'uvIndex'     },
  { id: 'sb-dew',         icon: '❄️', label: 'Dew Point',      key: 'dewPoint'    },
  { id: 'sb-cloud',       icon: '☁️', label: 'Cloud Cover',    key: 'cloudCover'  },
  { id: 'sb-rain',        icon: '🌧️', label: 'Rain Chance',    key: 'precipChance'},
  { id: 'sb-sunrise',     icon: '🌅', label: 'Sunrise',        key: 'sunrise'     },
  { id: 'sb-sunset',      icon: '🌇', label: 'Sunset',         key: 'sunset'      },
  { id: 'sb-moon',        icon: '🌙', label: 'Moon Phase',     key: 'moon'        },
  { id: 'sb-aqi',         icon: '🌬️', label: 'Air Quality',    key: 'aqi'         },
];

// Health/tip content per metric
const METRIC_INFO = {
  humidity: {
    title: 'Relative Humidity',
    desc: 'Relative humidity is the ratio of current water vapour in the air to the maximum it can hold at that temperature.',
    tips: [
      '40–60% is the ideal indoor comfort range.',
      'Above 70% promotes mould growth and bacterial spread.',
      'Below 30% causes dry skin, irritated airways, and static.',
      'High humidity slows sweat evaporation, making heat feel more intense.',
    ],
    health: 'Stay hydrated. In high humidity, your body cools less efficiently — watch for heat exhaustion signs.',
  },
  feelsLike: {
    title: 'Feels Like Temperature',
    desc: 'Apparent temperature accounts for wind chill (cold weather) and the heat index (warm/humid conditions) to represent how temperature actually feels on exposed skin.',
    tips: [
      'Wind chill can make temperatures feel 10°C+ colder.',
      'High humidity can make temperatures feel 5–8°C warmer.',
      'Dress for feels-like temperature, not the thermometer.',
    ],
    health: 'Plan outdoor activity around feels-like temperature. Frostbite and heat stroke risk depends on perceived temperature, not air temperature.',
  },
  windSpeed: {
    title: 'Wind Speed',
    desc: 'Wind speed is measured at 10 metres above ground level using a cup anemometer or ultrasonic sensor. The Beaufort scale classifies wind force from 0 (calm) to 12 (hurricane).',
    tips: [
      'Winds > 50 km/h make cycling very difficult.',
      'Winds > 70 km/h can topple light structures.',
      'Gusts can be 40–50% stronger than sustained speed.',
      'Wind from cold directions lowers apparent temperature significantly.',
    ],
    health: 'In strong wind, avoid tall trees and power lines. Cyclists and motorcyclists should take extra care.',
  },
  windDir: {
    title: 'Wind Direction',
    desc: 'Wind direction indicates where the wind is coming FROM, not where it\'s going. North wind comes from north and blows south. Measured in degrees (0° = N, 90° = E, 180° = S, 270° = W).',
    tips: [
      'North/East winds often bring cooler air in the Northern Hemisphere.',
      'South/West winds often bring warmer, moister air.',
      'Offshore winds (away from sea) are typically drier.',
      'Onshore winds bring marine moisture and moderated temperatures.',
    ],
    health: 'Wind direction determines what air masses affect your area — pollutants, pollen, and temperature all follow the wind.',
  },
  pressure: {
    title: 'Atmospheric Pressure',
    desc: 'Atmospheric pressure is the weight of the air column above a point. Standard sea-level pressure is 1013.25 hPa. Higher pressure generally brings fair weather; lower pressure signals storms.',
    tips: [
      'Rapidly falling pressure (> 5 hPa in 3h) signals approaching storms.',
      'Stable high pressure (> 1020 hPa) means settled, clear weather.',
      'Pressure drops before rain and rises after it passes.',
      'Altitude reduces pressure: every 8.5 m drop = ~1 hPa decrease.',
    ],
    health: 'Some people feel pressure changes in their joints or sinuses. Headache sufferers may experience symptoms when pressure drops sharply.',
  },
  visibility: {
    title: 'Visibility',
    desc: 'Visibility is the greatest horizontal distance at which objects can be clearly seen. Reduced visibility is caused by fog, mist, haze, rain, snow, or dust.',
    tips: [
      '> 10 km: Excellent — no restrictions',
      '5–10 km: Good — distant objects hazy',
      '1–5 km: Moderate — fog or haze reduces clarity',
      '< 1 km: Poor — thick fog, driving hazardous',
      '< 200 m: Dense fog — traffic disruption likely',
    ],
    health: 'In low visibility, use car fog lights (NOT high beams). Pedestrians should wear reflective clothing.',
  },
  uvIndex: {
    title: 'UV Index',
    desc: 'The UV Index (UVI) quantifies the intensity of ultraviolet radiation from the sun reaching the Earth\'s surface. It ranges from 0 (no UV) to 11+ (extreme). UV causes sunburn, eye damage, and increases skin cancer risk.',
    tips: [
      '0–2: Low — no protection needed for most',
      '3–5: Moderate — apply SPF 15-30 for 1+ hours outdoor',
      '6–7: High — SPF 30+ and protective clothing',
      '8–10: Very High — limit 10am–4pm exposure',
      '11+: Extreme — unprotected skin burns in minutes',
    ],
    health: 'Apply SPF 30+ broad-spectrum sunscreen 15 minutes before going outdoors. Reapply every 2 hours. Wear UV-blocking sunglasses (400nm UV protection).',
  },
  dewPoint: {
    title: 'Dew Point',
    desc: 'The dew point is the temperature at which air becomes saturated and water vapour starts to condense. High dew points signal muggy, uncomfortable air. Unlike humidity %, dew point is an absolute measure of moisture.',
    tips: [
      '< 10°C: Comfortable, crisp air',
      '10–16°C: Comfortable for most people',
      '16–18°C: Slightly sticky feeling begins',
      '18–21°C: Humid and uncomfortable for many',
      '> 21°C: Oppressive — heat exhaustion risk',
    ],
    health: 'Dew points above 20°C significantly impair your body\'s cooling via sweating. Limit physical exertion and stay hydrated.',
  },
  cloudCover: {
    title: 'Cloud Cover',
    desc: 'Cloud cover is the fraction of the sky obscured by clouds, measured in oktas (eighths) or percentage. It affects solar radiation reaching the surface, temperatures, and precipitation likelihood.',
    tips: [
      '0%: Clear skies — maximum solar heating',
      '25%: Few clouds — mostly sunny',
      '50%: Partly cloudy — mix of sun and shade',
      '75%: Mostly cloudy — diffused light',
      '100%: Overcast — no direct sunshine',
    ],
    health: 'Full cloud cover reduces UV by 50–90% but doesn\'t eliminate it. You can still get sunburned on cloudy days.',
  },
  precipChance: {
    title: 'Chance of Rain',
    desc: 'Precipitation probability is the likelihood (%) that measurable precipitation (≥0.2 mm) will occur at a specific point during a given period. This is a probabilistic forecast, not a binary yes/no.',
    tips: [
      '< 20%: Unlikely — safe to leave umbrella at home',
      '20–40%: Slight chance — carry a light rain jacket',
      '40–60%: Moderate — umbrella advisable',
      '60–80%: Likely — prepare for rain',
      '> 80%: Very likely — expect precipitation',
    ],
    health: 'Wet surfaces cause 75% of weather-related accidents. Slow down while driving and wear non-slip footwear.',
  },
  sunrise: {
    title: 'Sunrise',
    desc: 'The moment the upper edge of the Sun appears above the eastern horizon. Sunrise time shifts daily due to Earth\'s axial tilt and elliptical orbit — faster changes near equinoxes, slower near solstices.',
    tips: [
      'Golden hour (30 min after sunrise) offers warm, diffused light.',
      'Temperature is typically at its lowest around sunrise.',
      'Morning UV can still be significant in summer at high UV zones.',
      'Sunrise varies by up to 2 hours between summer and winter.',
    ],
    health: 'Morning sunlight helps regulate your circadian rhythm and boosts serotonin production. Even 10 minutes of morning sun exposure improves sleep quality.',
  },
  sunset: {
    title: 'Sunset',
    desc: 'The moment the upper edge of the Sun disappears below the western horizon. The sky\'s colours during sunset are caused by Rayleigh scattering — shorter wavelengths (blue) scatter away while longer ones (red/orange) reach us.',
    tips: [
      'Temperature starts dropping faster after sunset.',
      'Evening fog and dew form as the surface cools below dew point.',
      'Twilight (Civil, Nautical, Astronomical) extends useful light 30–90 min past sunset.',
      'Golden hour before sunset is ideal for photography and outdoor activity.',
    ],
    health: 'Avoid looking directly at the sun even during sunset — it can still cause retinal damage. Use UV-rated sunglasses.',
  },
  moon: {
    title: 'Moon Phase',
    desc: 'The Moon phase is determined by its position relative to Earth and the Sun. The complete cycle (lunar month) takes about 29.5 days. Moon phases can affect tides, and some evidence suggests influences on wildlife behaviour.',
    tips: [
      '🌑 New Moon: Darkest nights — best stargazing',
      '🌒 Waxing Crescent: Thin crescent visible in west after sunset',
      '🌓 First Quarter: Half moon — sets around midnight',
      '🌕 Full Moon: Brightest nights — highest tides',
      '🌗 Last Quarter: Rises around midnight, half lit on left',
    ],
    health: 'The Full Moon\'s brightness can affect sleep quality for some people. Consider blackout curtains around the full moon.',
  },
  aqi: {
    title: 'Air Quality Index',
    desc: 'The Air Quality Index (AQI) measures how clean or polluted outdoor air is. It combines measurements of PM2.5, PM10, NO₂, O₃, SO₂, and CO. AQI affects respiratory health, especially for sensitive groups.',
    tips: [
      '0–50 (Good): Air quality is satisfactory',
      '51–100 (Moderate): Acceptable for most',
      '101–150 (Unhealthy for sensitive groups): Reduce prolonged outdoor exertion',
      '151–200 (Unhealthy): Everyone may begin to experience effects',
      '> 200 (Very Unhealthy): Health alerts — stay indoors',
    ],
    health: 'People with asthma, heart disease, or lung conditions should monitor AQI daily. Wear N95 masks outdoors when AQI > 150.',
  },
};

// ────────────────────────────────────────────────────────────
// Initialise
// ────────────────────────────────────────────────────────────

export function initSidebar() {
  // Wire sidebar toggle button
  document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);

  // Wire metric item clicks (event delegation on the sidebar)
  document.getElementById('sidebar')?.addEventListener('click', onMetricClick);

  // Wire drawer close
  document.getElementById('metric-drawer-close')?.addEventListener('click', closeDrawer);
  document.getElementById('metric-drawer-backdrop')?.addEventListener('click', closeDrawer);

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (_drawerOpen) closeDrawer();
      else closeSidebar();
    }
  });
}

/** Update sidebar with new weather data. Call after every weather load. */
export function updateSidebar(data, unit) {
  _data = data;
  _unit = unit;
  renderSidebarValues();
}

// ────────────────────────────────────────────────────────────
// Sidebar visibility
// ────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const open = sb.classList.toggle('sidebar--open');
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', String(open));
  document.getElementById('sidebar-backdrop')?.classList.toggle('visible', open);
  // On mobile block scroll when sidebar is open
  document.body.classList.toggle('sidebar-body-lock', open && window.innerWidth < 900);
}

function closeSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  sb.classList.remove('sidebar--open');
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', 'false');
  document.getElementById('sidebar-backdrop')?.classList.remove('visible');
  document.body.classList.remove('sidebar-body-lock');
}

// ────────────────────────────────────────────────────────────
// Render sidebar metric values
// ────────────────────────────────────────────────────────────
function renderSidebarValues() {
  if (!_data) return;
  const c     = _data.current;
  const today = _data.daily?.[0];
  const unit  = _unit;
  const uS    = unit === 'F' ? '°F' : '°C';

  const values = {
    humidity:    `${c.humidity}%`,
    feelsLike:   `${formatTemp(c.feelsLike, unit)}${uS}`,
    windSpeed:   unit === 'F' ? `${toMph(c.windSpeed)} mph` : `${c.windSpeed} km/h`,
    windDir:     degToCompass(c.windDir ?? 0),
    pressure:    c.pressure ? `${Math.round(c.pressure)} hPa` : '—',
    visibility:  c.visibility ? `${Math.round(c.visibility)} km` : '—',
    uvIndex:     uvLabel(c.uvIndex ?? 0),
    dewPoint:    c.dewPoint != null ? `${formatTemp(c.dewPoint, unit)}${uS}` : '—',
    cloudCover:  c.cloudCover != null ? `${c.cloudCover}%` : '—',
    precipChance: today ? `${today.precipChance}%` : '—',
    sunrise:     today?.sunrise ? fmtTime(today.sunrise) : '—',
    sunset:      today?.sunset  ? fmtTime(today.sunset)  : '—',
    moon:        getMoonPhaseName(new Date()),
    aqi:         '—',  // would need AQI API
  };

  METRICS.forEach(m => {
    const el = document.getElementById(m.id);
    if (el) {
      const valEl = el.querySelector('.sb-value');
      if (valEl) valEl.textContent = values[m.key] ?? '—';
    }
  });
}

// ────────────────────────────────────────────────────────────
// Metric click → open drawer
// ────────────────────────────────────────────────────────────
function onMetricClick(e) {
  const item = e.target.closest('.sidebar-item[data-metric]');
  if (!item) return;
  const metricKey = item.dataset.metric;
  openDrawer(metricKey);
}

function openDrawer(metricKey) {
  if (!_data) return;
  const info = METRIC_INFO[metricKey];
  if (!info) return;

  _drawerOpen = true;
  _prevFocus  = document.activeElement;

  const drawer    = document.getElementById('metric-drawer');
  const titleEl   = document.getElementById('drawer-title');
  const bodyEl    = document.getElementById('drawer-body');
  const backdrop  = document.getElementById('metric-drawer-backdrop');

  if (!drawer || !bodyEl) return;

  titleEl.textContent = info.title;
  bodyEl.innerHTML = buildDrawerBody(metricKey, info);

  drawer.classList.add('drawer--open');
  backdrop?.classList.add('visible');
  document.body.classList.add('drawer-lock');

  requestAnimationFrame(() =>
    document.getElementById('metric-drawer-close')?.focus()
  );
}

function closeDrawer() {
  _drawerOpen = false;
  document.getElementById('metric-drawer')?.classList.remove('drawer--open');
  document.getElementById('metric-drawer-backdrop')?.classList.remove('visible');
  document.body.classList.remove('drawer-lock');
  if (_prevFocus && document.contains(_prevFocus)) _prevFocus.focus({ preventScroll: true });
}

// ────────────────────────────────────────────────────────────
// Drawer content builder
// ────────────────────────────────────────────────────────────
function buildDrawerBody(key, info) {
  const c     = _data?.current ?? {};
  const today = _data?.daily?.[0] ?? {};
  const unit  = _unit;
  const uS    = unit === 'F' ? '°F' : '°C';

  // Current value hero
  const heroValue = getHeroValue(key, c, today, unit, uS);

  // Visual indicator
  const visual = getVisualIndicator(key, c, today);

  // Tips HTML
  const tipsHTML = info.tips.map(t =>
    `<li class="drawer-tip"><span class="drawer-tip-dot">✦</span>${escHtml(t)}</li>`
  ).join('');

  // Unit conversions
  const conversions = getUnitConversions(key, c, unit);

  return `
    <!-- Hero value -->
    <div class="drawer-hero">
      <div class="drawer-hero-value">${heroValue}</div>
    </div>

    <!-- Visual indicator (gauge/bar/compass) -->
    ${visual ? `<div class="drawer-visual">${visual}</div>` : ''}

    <!-- Description -->
    <div class="drawer-section">
      <h3 class="drawer-section-title">What is it?</h3>
      <p class="drawer-desc">${escHtml(info.desc)}</p>
    </div>

    <!-- Tips -->
    <div class="drawer-section">
      <h3 class="drawer-section-title">Quick Reference</h3>
      <ul class="drawer-tips">${tipsHTML}</ul>
    </div>

    <!-- Health advice -->
    <div class="drawer-section drawer-health">
      <h3 class="drawer-section-title">💊 Health Advice</h3>
      <p class="drawer-desc">${escHtml(info.health)}</p>
    </div>

    <!-- Unit conversions -->
    ${conversions ? `
    <div class="drawer-section">
      <h3 class="drawer-section-title">Unit Conversions</h3>
      <div class="drawer-conversions">${conversions}</div>
    </div>` : ''}
  `;
}

// ────────────────────────────────────────────────────────────
// Hero value per metric
// ────────────────────────────────────────────────────────────
function getHeroValue(key, c, today, unit, uS) {
  const map = {
    humidity:     `${c.humidity ?? '—'}%`,
    feelsLike:    `${formatTemp(c.feelsLike ?? 0, unit)}${uS}`,
    windSpeed:    unit === 'F' ? `${toMph(c.windSpeed ?? 0)} mph` : `${c.windSpeed ?? 0} km/h`,
    windDir:      `${degToCompass(c.windDir ?? 0)} (${c.windDir ?? 0}°)`,
    pressure:     `${Math.round(c.pressure ?? 1013)} hPa`,
    visibility:   `${Math.round(c.visibility ?? 10)} km`,
    uvIndex:      `${Math.round(c.uvIndex ?? 0)} — ${uvLabel(c.uvIndex ?? 0)}`,
    dewPoint:     `${formatTemp(c.dewPoint ?? 14, unit)}${uS}`,
    cloudCover:   `${c.cloudCover ?? 0}%`,
    precipChance: `${today.precipChance ?? 0}%`,
    sunrise:      today.sunrise ? fmtTime(today.sunrise) : '—',
    sunset:       today.sunset  ? fmtTime(today.sunset)  : '—',
    moon:         getMoonPhaseFull(new Date()),
    aqi:          'N/A (API not connected)',
  };
  return map[key] ?? '—';
}

// ────────────────────────────────────────────────────────────
// Visual indicators (SVG gauges/compasses/progress)
// ────────────────────────────────────────────────────────────
function getVisualIndicator(key, c, today) {
  switch (key) {
    case 'humidity':
      return buildArcGauge(c.humidity ?? 0, 100, '#60a5fa', '%');
    case 'uvIndex':
      return buildLinearGauge(c.uvIndex ?? 0, 12, getUvColor(c.uvIndex ?? 0), '');
    case 'cloudCover':
      return buildArcGauge(c.cloudCover ?? 0, 100, '#9ca3af', '%');
    case 'precipChance':
      return buildLinearGauge(today.precipChance ?? 0, 100, '#38bdf8', '%');
    case 'windDir':
      return buildCompass(c.windDir ?? 0);
    case 'sunrise': case 'sunset':
      return buildSunProgress(today);
    default:
      return '';
  }
}

/** Donut-style SVG arc gauge */
function buildArcGauge(value, max, color, unit) {
  const pct  = value / max;
  const r    = 50, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;
  const fill = arc * pct;

  return `<svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="var(--glass-border)" stroke-width="12"
      stroke-dasharray="${arc} ${circ - arc}"
      stroke-linecap="round" transform="rotate(-225 ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${color}" stroke-width="12"
      stroke-dasharray="${fill} ${circ - fill}"
      stroke-linecap="round" transform="rotate(-225 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle"
      font-size="22" font-weight="700" fill="var(--text-primary)"
      font-family="var(--font-primary,sans-serif)">${value}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle"
      font-size="12" fill="var(--text-muted)"
      font-family="var(--font-body,sans-serif)">${unit}</text>
  </svg>`;
}

/** Horizontal linear gauge bar */
function buildLinearGauge(value, max, color, unit) {
  const pct = Math.min(100, (value / max) * 100);
  return `<div class="linear-gauge">
    <div class="linear-gauge-track">
      <div class="linear-gauge-fill" style="width:${pct}%;background:${color}"></div>
      <div class="linear-gauge-dot" style="left:${pct}%;background:${color}"></div>
    </div>
    <div class="linear-gauge-labels">
      <span>0</span><span>${max / 2}</span><span>${max}${unit}</span>
    </div>
  </div>`;
}

/** Wind compass SVG */
function buildCompass(deg) {
  const cx = 70, cy = 70, r = 55;
  const rad = ((deg - 90) * Math.PI) / 180;
  const tx  = cx + (r * 0.65) * Math.cos(rad);
  const ty  = cy + (r * 0.65) * Math.sin(rad);
  const bx  = cx - (r * 0.35) * Math.cos(rad);
  const by  = cy - (r * 0.35) * Math.sin(rad);

  const cardinals = [
    {l:'N', a:-90}, {l:'E', a:0}, {l:'S', a:90}, {l:'W', a:180}
  ].map(({l, a}) => {
    const ar = (a * Math.PI) / 180;
    return `<text x="${cx + (r + 10) * Math.cos(ar)}" y="${cy + (r + 10) * Math.sin(ar) + 4}"
      text-anchor="middle" font-size="11" font-weight="700"
      fill="var(--text-secondary)" font-family="var(--font-primary,sans-serif)">${l}</text>`;
  });

  return `<svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.04)"
      stroke="var(--glass-border)" stroke-width="1"/>
    ${cardinals.join('')}
    <line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}"
      stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
    <polygon points="${tx},${ty}
      ${tx - 8 * Math.cos(rad - 0.4)},${ty - 8 * Math.sin(rad - 0.4)}
      ${tx - 8 * Math.cos(rad + 0.4)},${ty - 8 * Math.sin(rad + 0.4)}"
      fill="var(--accent)"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--accent)"/>
    <circle cx="${cx}" cy="${cy}" r="2" fill="#fff"/>
  </svg>`;
}

/** Sun progress bar (sunrise → now → sunset) */
function buildSunProgress(today) {
  if (!today?.sunrise || !today?.sunset) return '';
  const now     = new Date();
  const total   = today.sunset - today.sunrise;
  const elapsed = Math.min(Math.max(now - today.sunrise, 0), total);
  const pct     = Math.round((elapsed / total) * 100);

  return `<div class="sun-progress-wrap">
    <div class="sun-progress-bar">
      <div class="sun-progress-fill" style="width:${pct}%"></div>
      <div class="sun-progress-dot" style="left:${pct}%">☀️</div>
    </div>
    <div class="sun-progress-labels">
      <span>🌅 ${fmtTime(today.sunrise)}</span>
      <span>🌇 ${fmtTime(today.sunset)}</span>
    </div>
  </div>`;
}

// ────────────────────────────────────────────────────────────
// Unit conversions
// ────────────────────────────────────────────────────────────
function getUnitConversions(key, c, unit) {
  switch (key) {
    case 'feelsLike':
    case 'dewPoint': {
      const raw = key === 'feelsLike' ? (c.feelsLike ?? 0) : (c.dewPoint ?? 14);
      return `
        <div class="conv-row"><span>Celsius</span><strong>${Math.round(raw)}°C</strong></div>
        <div class="conv-row"><span>Fahrenheit</span><strong>${Math.round(raw * 9/5 + 32)}°F</strong></div>
        <div class="conv-row"><span>Kelvin</span><strong>${Math.round(raw + 273.15)} K</strong></div>`;
    }
    case 'windSpeed': {
      const kmh = c.windSpeed ?? 0;
      return `
        <div class="conv-row"><span>km/h</span><strong>${kmh}</strong></div>
        <div class="conv-row"><span>mph</span><strong>${toMph(kmh)}</strong></div>
        <div class="conv-row"><span>m/s</span><strong>${(kmh / 3.6).toFixed(1)}</strong></div>
        <div class="conv-row"><span>knots</span><strong>${(kmh * 0.539957).toFixed(1)}</strong></div>`;
    }
    case 'pressure': {
      const hPa = c.pressure ?? 1013;
      return `
        <div class="conv-row"><span>hPa / mbar</span><strong>${hPa}</strong></div>
        <div class="conv-row"><span>inHg</span><strong>${(hPa * 0.02953).toFixed(2)}</strong></div>
        <div class="conv-row"><span>mmHg</span><strong>${(hPa * 0.750062).toFixed(1)}</strong></div>
        <div class="conv-row"><span>atm</span><strong>${(hPa / 1013.25).toFixed(4)}</strong></div>`;
    }
    case 'visibility': {
      const km = c.visibility ?? 10;
      return `
        <div class="conv-row"><span>km</span><strong>${km}</strong></div>
        <div class="conv-row"><span>miles</span><strong>${(km * 0.621371).toFixed(1)}</strong></div>
        <div class="conv-row"><span>metres</span><strong>${Math.round(km * 1000)}</strong></div>`;
    }
    default:
      return '';
  }
}

// ────────────────────────────────────────────────────────────
// Utility helpers
// ────────────────────────────────────────────────────────────
function uvLabel(uv) {
  const n = Math.round(uv);
  if (n <= 2)  return 'Low';
  if (n <= 5)  return 'Moderate';
  if (n <= 7)  return 'High';
  if (n <= 10) return 'Very High';
  return 'Extreme';
}

function getUvColor(uv) {
  const n = Math.round(uv);
  if (n <= 2)  return '#22c55e';
  if (n <= 5)  return '#fbbf24';
  if (n <= 7)  return '#f97316';
  if (n <= 10) return '#ef4444';
  return '#7c3aed';
}

function fmtTime(date) {
  if (!(date instanceof Date)) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMoonPhaseName(date) {
  const known = new Date('2000-01-06T18:14:00Z');
  const days  = (date - known) / 86400000;
  const phase = ((days % 29.53058) + 29.53058) % 29.53058;
  const names = ['🌑 New Moon','🌒 Waxing Crescent','🌓 First Quarter','🌔 Waxing Gibbous',
                  '🌕 Full Moon','🌖 Waning Gibbous','🌗 Last Quarter','🌘 Waning Crescent'];
  return names[Math.round(phase / 29.53058 * 8) % 8];
}

function getMoonPhaseFull(date) {
  const known = new Date('2000-01-06T18:14:00Z');
  const days  = (date - known) / 86400000;
  const phase = ((days % 29.53058) + 29.53058) % 29.53058;
  const illum = Math.round(Math.abs(4 - phase / 29.53058 * 8) / 4 * 100);
  return `${getMoonPhaseName(date)} · ${illum}% illuminated`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
