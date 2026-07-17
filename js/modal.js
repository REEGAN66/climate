/**
 * modal.js — Climate Update
 * Handles premium weather details modal functionality.
 * Opens when user clicks the hero card, displays detailed weather info.
 */

import { formatTemp, toMph } from './api.js';

const $ = id => document.getElementById(id);

// ────────────────────────────────────────────────────────────
// DOM References
// ────────────────────────────────────────────────────────────
const modalEls = {
  modal: $('weather-modal'),
  overlay: $('modal-overlay'),
  closeBtn: $('modal-close'),
  heroCard: $('hero-card'),
  
  // Detail fields
  temp: $('modal-temp'),
  feelsLike: $('modal-feels-like'),
  humidity: $('modal-humidity'),
  pressure: $('modal-pressure'),
  wind: $('modal-wind'),
  visibility: $('modal-visibility'),
  uv: $('modal-uv'),
  sunrise: $('modal-sunrise'),
  sunset: $('modal-sunset'),
  dewPoint: $('modal-dew-point'),
  precipChance: $('modal-precip-chance'),
  aqi: $('modal-aqi'),
};

// ────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────
let currentWeatherData = null;
let currentUnit = 'C';

// ────────────────────────────────────────────────────────────
// Initialize
// ────────────────────────────────────────────────────────────
export function initModal() {
  if (!modalEls.modal) return;
  
  // Hero card click to open
  modalEls.heroCard?.addEventListener('click', openModal);
  
  // Close button
  modalEls.closeBtn?.addEventListener('click', closeModal);
  
  // Overlay click to close
  modalEls.overlay?.addEventListener('click', closeModal);
  
  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEls.modal.hidden) {
      closeModal();
    }
  });
  
  // Prevent closing when clicking modal content
  const modalContainer = modalEls.modal?.querySelector('.modal-container');
  modalContainer?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// ────────────────────────────────────────────────────────────
// Modal Control
// ────────────────────────────────────────────────────────────

function openModal() {
  if (!modalEls.modal || !currentWeatherData) return;
  
  modalEls.modal.hidden = false;
  document.body.style.overflow = 'hidden';
  
  // Focus management
  modalEls.closeBtn?.focus();
  
  // Announce to screen readers
  const ariaLive = document.createElement('div');
  ariaLive.setAttribute('aria-live', 'polite');
  ariaLive.setAttribute('aria-atomic', 'true');
  ariaLive.textContent = 'Weather details modal opened';
  document.body.appendChild(ariaLive);
  setTimeout(() => ariaLive.remove(), 1000);
}

function closeModal() {
  if (!modalEls.modal) return;
  
  modalEls.modal.hidden = true;
  document.body.style.overflow = '';
  
  // Return focus to hero card
  modalEls.heroCard?.focus();
}

// ────────────────────────────────────────────────────────────
// Render Modal Data
// ────────────────────────────────────────────────────────────

/**
 * Populate modal with weather details.
 * @param {object} weather   Current weather object from API
 * @param {'C'|'F'} unit
 */
export function renderModal(weather, unit) {
  if (!modalEls.modal) return;
  
  currentWeatherData = weather;
  currentUnit = unit;
  
  const unitStr = unit === 'F' ? '°F' : '°C';
  const windUnit = unit === 'F' ? 'mph' : 'km/h';
  
  // Temperature
  const temp = formatTemp(weather.temp, unit);
  modalEls.temp.textContent = `${temp}${unitStr}`;
  
  // Feels Like
  const feels = formatTemp(weather.feelsLike, unit);
  modalEls.feelsLike.textContent = `${feels}${unitStr}`;
  
  // Humidity
  modalEls.humidity.textContent = `${weather.humidity}%`;
  
  // Pressure (convert hPa if available)
  const pressure = weather.pressure ?? 1013;
  modalEls.pressure.textContent = `${Math.round(pressure)} hPa`;
  
  // Wind Speed
  const windSpeed = unit === 'F' ? toMph(weather.windSpeed) : Math.round(weather.windSpeed);
  modalEls.wind.textContent = `${windSpeed} ${windUnit}`;
  
  // Visibility (default to 10 km if not available)
  const visibility = weather.visibility ?? 10;
  modalEls.visibility.textContent = `${Math.round(visibility)} km`;
  
  // UV Index
  const uv = formatUvIndex(weather.uvIndex ?? 0);
  modalEls.uv.textContent = uv;
  
  // Sunrise
  const sunrise = weather.sunrise ? formatTime(weather.sunrise) : '--';
  modalEls.sunrise.textContent = sunrise;
  
  // Sunset
  const sunset = weather.sunset ? formatTime(weather.sunset) : '--';
  modalEls.sunset.textContent = sunset;
  
  // Dew Point (calculate if not available)
  const dewPoint = calculateDewPoint(weather.temp, weather.humidity);
  const dewFormatted = formatTemp(dewPoint, unit);
  modalEls.dewPoint.textContent = `${dewFormatted}${unitStr}`;
  
  // Chance of Rain (from daily data or default)
  const precipChance = weather.precipChance ?? 0;
  modalEls.precipChance.textContent = `${precipChance}%`;
  
  // Air Quality Index (placeholder - would need separate API)
  modalEls.aqi.textContent = 'N/A';
}

// ────────────────────────────────────────────────────────────
// Utility Functions
// ────────────────────────────────────────────────────────────

/** Format UV Index with category label */
function formatUvIndex(uv) {
  const n = Math.round(uv);
  if (n <= 2) return `${n} Low`;
  if (n <= 5) return `${n} Moderate`;
  if (n <= 7) return `${n} High`;
  if (n <= 10) return `${n} Very High`;
  return `${n} Extreme`;
}

/** Format time from Date object */
function formatTime(date) {
  if (!date || !(date instanceof Date)) return '--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Calculate Dew Point using Magnus formula.
 * Dew Point ≈ T - (100 - RH) / 5
 * Simplified approximation for user display.
 * @param {number} temp      Temperature in Celsius
 * @param {number} humidity  Relative humidity %
 * @returns {number}         Dew point in Celsius
 */
function calculateDewPoint(temp, humidity) {
  const alpha = ((0.587 * Math.log(humidity / 100)) + ((17.27 * temp) / (237.7 + temp))) / (17.27 - ((0.587 * Math.log(humidity / 100)) + ((17.27 * temp) / (237.7 + temp))));
  return parseFloat((237.7 * alpha).toFixed(1));
}

/**
 * Update modal when unit changes.
 * Called from app.js when user toggles C/F.
 */
export function updateModalUnit(weather, unit) {
  renderModal(weather, unit);
}
