/**
 * ui.js — Climate Update
 * Handles all DOM rendering and UI state management.
 * Pure functions that take data and update the DOM — no API calls here.
 */

import { formatTemp, toMph } from './api.js';
import { startWeatherBg }   from './weather-bg.js';

// ────────────────────────────────────────────────────────────
// DOM Element References (cached for performance)
// ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

export const els = {
  body:              document.getElementById('app-body'),
  permPrompt:        $('permission-prompt'),
  loadingState:      $('loading-state'),
  errorState:        $('error-state'),
  weatherContent:    $('weather-content'),
  errorTitle:        $('error-title'),
  errorMessage:      $('error-message'),
  btnRetry:          $('btn-retry'),

  // Location
  locationName:      $('location-name'),
  locationSub:       $('location-sub'),
  lastUpdated:       $('last-updated'),

  // Hero card
  currentTemp:       $('current-temp'),
  heroUnit:          $('hero-unit'),
  feelsLike:         $('feels-like'),
  currentCondition:  $('current-condition'),
  heroIcon:          $('hero-icon'),
  humidityVal:       $('humidity-val'),
  windVal:           $('wind-val'),
  precipVal:         $('precip-val'),
  uvVal:             $('uv-val'),

  // Sections
  forecastGrid:      $('forecast-grid'),
  hourlyScroll:      $('hourly-scroll'),

  // Unit buttons
  btnCelsius:        $('btn-celsius'),
  btnFahrenheit:     $('btn-fahrenheit'),

  // Search
  searchForm:        $('search-form'),
  cityInput:         $('city-input'),
  suggestions:       $('search-suggestions'),
};

// ────────────────────────────────────────────────────────────
// State Screens
// ────────────────────────────────────────────────────────────

/** Show the geolocation permission prompt */
export function showPermissionPrompt() {
  setVisible(els.permPrompt,     true);
  setVisible(els.loadingState,   false);
  setVisible(els.errorState,     false);
  setVisible(els.weatherContent, false);
}

/** Show loading skeleton */
export function showLoading() {
  setVisible(els.permPrompt,     false);
  setVisible(els.loadingState,   true);
  setVisible(els.errorState,     false);
  setVisible(els.weatherContent, false);
}

/** Show error card */
export function showError(title = 'Something went wrong', message = 'Please try again.') {
  els.errorTitle.textContent   = title;
  els.errorMessage.textContent = message;
  setVisible(els.permPrompt,     false);
  setVisible(els.loadingState,   false);
  setVisible(els.errorState,     true);
  setVisible(els.weatherContent, false);
}

/** Show weather content (hides all other panels) */
export function showWeather() {
  setVisible(els.permPrompt,     false);
  setVisible(els.loadingState,   false);
  setVisible(els.errorState,     false);
  setVisible(els.weatherContent, true);

  // Re-trigger animations
  els.weatherContent.style.animation = 'none';
  requestAnimationFrame(() => {
    els.weatherContent.style.animation = '';
  });
}

// ────────────────────────────────────────────────────────────
// Theme Application
// ────────────────────────────────────────────────────────────

const ALL_THEMES = ['theme-sunny', 'theme-cloudy', 'theme-rainy', 'theme-stormy',
                    'theme-snowy', 'theme-foggy', 'theme-night', 'theme-default'];

/**
 * Apply a weather theme class to the body element.
 * @param {'sunny'|'cloudy'|'rainy'|'stormy'|'snowy'|'foggy'|'night'|'default'} theme
 */
export function applyTheme(theme) {
  ALL_THEMES.forEach(t => els.body.classList.remove(t));
  const cls = `theme-${theme || 'default'}`;
  els.body.classList.add(cls);
}

// ────────────────────────────────────────────────────────────
// Location Rendering
// ────────────────────────────────────────────────────────────

/**
 * Render the location header.
 * @param {{ city: string, admin1?: string, country?: string }} geo
 */
export function renderLocation(geo) {
  els.locationName.textContent = geo.city || 'Unknown Location';
  const parts = [geo.admin1, geo.country].filter(Boolean);
  els.locationSub.textContent  = parts.join(', ');
  els.lastUpdated.textContent  = `Updated ${formatTime(new Date())}`;
}

// ────────────────────────────────────────────────────────────
// Current Weather Rendering
// ────────────────────────────────────────────────────────────

/**
 * Render the hero current weather card.
 * @param {object} current  Parsed current weather object
 * @param {'C'|'F'} unit
 */
export function renderCurrent(current, unit) {
  const temp     = formatTemp(current.temp, unit);
  const feelsLk  = formatTemp(current.feelsLike, unit);
  const unitStr  = unit === 'F' ? '°F' : '°C';

  els.currentTemp.textContent      = temp;
  els.heroUnit.textContent         = unitStr;
  els.feelsLike.textContent        = `Feels like ${feelsLk}${unitStr}`;
  els.currentCondition.textContent = current.label ?? 'Unknown';
  els.heroIcon.textContent         = current.emoji ?? '🌡️';
  els.heroIcon.setAttribute('aria-label', `${current.label} weather icon`);

  // Details
  els.humidityVal.textContent = `${current.humidity}%`;

  if (unit === 'F') {
    els.windVal.textContent = `${toMph(current.windSpeed)} mph`;
  } else {
    els.windVal.textContent = `${current.windSpeed} km/h`;
  }

  els.precipVal.textContent = `${current.precipitation} mm`;
  els.uvVal.textContent     = formatUvIndex(current.uvIndex ?? 0);

  // Apply weather theme (body class) AND animated background
  applyTheme(current.theme);
  startWeatherBg(current.theme);
}

/** Map UV index number → label */
function formatUvIndex(uv) {
  const n = Math.round(uv);
  if (n <= 2)  return `${n} Low`;
  if (n <= 5)  return `${n} Moderate`;
  if (n <= 7)  return `${n} High`;
  if (n <= 10) return `${n} Very High`;
  return `${n} Extreme`;
}

// ────────────────────────────────────────────────────────────
// 3-Day Forecast Rendering
// ────────────────────────────────────────────────────────────

const DAY_LABELS = ['Today', 'Tomorrow', 'Day After'];

/**
 * Render 3 forecast cards into the grid.
 * @param {Array} daily   Parsed daily weather array (3 items)
 * @param {'C'|'F'} unit
 */
export function renderForecast(daily, unit) {
  els.forecastGrid.innerHTML = '';

  daily.slice(0, 3).forEach((day, i) => {
    const card = document.createElement('article');
    card.className = `forecast-card${i === 0 ? ' today' : ''}`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${DAY_LABELS[i]} forecast`);
    card.style.setProperty('--i', i);

    const tempHigh = formatTemp(day.tempMax, unit);
    const tempLow  = formatTemp(day.tempMin, unit);
    const unitStr  = unit === 'F' ? '°F' : '°C';
    const dateStr  = formatShortDate(day.date);

    card.innerHTML = `
      <p class="forecast-day">${DAY_LABELS[i]}</p>
      <p class="forecast-date">${dateStr}</p>
      <span class="forecast-icon" aria-hidden="true" style="--i:${i}">${day.emoji}</span>
      <div class="forecast-temps">
        <span class="temp-high">${tempHigh}${unitStr}</span>
        <span class="temp-low">${tempLow}${unitStr}</span>
      </div>
      <p class="forecast-condition">${day.label}</p>
      ${day.precipChance > 0
        ? `<span class="precip-chance">
             <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
             ${day.precipChance}%
           </span>`
        : ''}
    `;

    els.forecastGrid.appendChild(card);
  });
}

// ────────────────────────────────────────────────────────────
// Hourly Forecast Rendering
// ────────────────────────────────────────────────────────────

/**
 * Render hourly slots (next 24 hours).
 * @param {Array}   hourly   Parsed hourly array
 * @param {'C'|'F'} unit
 */
export function renderHourly(hourly, unit) {
  els.hourlyScroll.innerHTML = '';

  const now = new Date();
  const currentHour = now.getHours();

  hourly.forEach((slot, i) => {
    const hour   = slot.time.getHours();
    const isCurr = i === 0;
    const temp   = formatTemp(slot.temp, unit);
    const unitS  = unit === 'F' ? '°F' : '°C';

    const div = document.createElement('div');
    div.className = `hourly-slot${isCurr ? ' current-hour' : ''}`;
    div.setAttribute('role', 'listitem');
    div.setAttribute('aria-label', `${formatHourLabel(slot.time)}: ${temp}${unitS}, ${slot.label}`);
    div.style.setProperty('--i', i);

    div.innerHTML = `
      <p class="hourly-time">${isCurr ? 'Now' : formatHourLabel(slot.time)}</p>
      <div class="hourly-icon" aria-hidden="true">${slot.emoji}</div>
      <p class="hourly-temp">${temp}${unitS}</p>
      ${slot.precipP > 0
        ? `<p class="hourly-precip">💧 ${slot.precipP}%</p>`
        : '<p class="hourly-precip"> </p>'}
    `;

    els.hourlyScroll.appendChild(div);
  });
}

// ────────────────────────────────────────────────────────────
// Unit Toggle UI
// ────────────────────────────────────────────────────────────

/**
 * Update the active state of the unit toggle buttons.
 * @param {'C'|'F'} unit
 */
export function updateUnitToggle(unit) {
  const isCelsius = unit === 'C';
  els.btnCelsius.classList.toggle('active', isCelsius);
  els.btnFahrenheit.classList.toggle('active', !isCelsius);
  els.btnCelsius.setAttribute('aria-pressed', String(isCelsius));
  els.btnFahrenheit.setAttribute('aria-pressed', String(!isCelsius));
}

// ────────────────────────────────────────────────────────────
// Search Suggestions Rendering
// ────────────────────────────────────────────────────────────

/**
 * Render autocomplete suggestion items.
 * @param {Array}    results   Array from searchCities()
 * @param {Function} onSelect  Callback(result) when user picks a city
 */
export function renderSuggestions(results, onSelect) {
  const list = els.suggestions;
  list.innerHTML = '';

  if (!results.length) {
    list.hidden = true;
    return;
  }

  results.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'suggestion-item';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.setAttribute('tabindex', '0');
    li.id = `suggestion-${i}`;

    const flag = countryCodeToFlag(r.countryCode);
    const sub  = [r.admin1, r.country].filter(Boolean).join(', ');

    li.innerHTML = `
      <span class="suggestion-flag" aria-hidden="true">${flag}</span>
      <span>
        <strong>${escapeHtml(r.name)}</strong>
        ${sub ? `<br><span class="suggestion-sub">${escapeHtml(sub)}</span>` : ''}
      </span>
    `;

    li.addEventListener('click', () => {
      onSelect(r);
      hideSuggestions();
    });

    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(r);
        hideSuggestions();
      }
    });

    list.appendChild(li);
  });

  list.hidden = false;
}

export function hideSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = '';
}

// ────────────────────────────────────────────────────────────
// Utility Helpers
// ────────────────────────────────────────────────────────────

function setVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatHourLabel(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
}

/** Convert ISO 3166-1 alpha-2 country code to flag emoji */
function countryCodeToFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  const base = 0x1F1E6 - 65;
  return String.fromCodePoint(
    base + code.toUpperCase().charCodeAt(0),
    base + code.toUpperCase().charCodeAt(1),
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
