/**
 * app.js — Climate Update
 * Entry point: orchestrates geolocation, search, unit toggling,
 * and wires all events to api.js + ui.js.
 */

import {
  fetchWeather,
  searchCities,
  reverseGeocode,
} from './api.js';

import { initTheme } from './theme.js';

import {
  els,
  showPermissionPrompt,
  showLoading,
  showError,
  showWeather,
  renderLocation,
  renderCurrent,
  renderForecast,
  renderHourly,
  updateUnitToggle,
  renderSuggestions,
  hideSuggestions,
  applyTheme,
} from './ui.js';

// ────────────────────────────────────────────────────────────
// App State
// ────────────────────────────────────────────────────────────
const state = {
  unit:         'C',         // 'C' or 'F'
  weatherData:  null,        // last fetched weather object
  geoData:      null,        // last known location { lat, lon, city, admin1, country }
  searchDebounce: null,      // timer for search debounce
  retryFn:      null,        // function to call on "Try Again"
};

// ────────────────────────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────────────────────────
function init() {
  initTheme();   // Apply saved/system theme & wire toggle button
  bindEvents();
  checkGeolocationSupport();
}

/** Check if the browser supports Geolocation and decide first action */
function checkGeolocationSupport() {
  if (!('geolocation' in navigator)) {
    // No geolocation — go straight to manual search mode
    showError(
      'Location Not Supported',
      'Your browser does not support Geolocation. Use the search bar above to find weather for any city.',
    );
    els.cityInput.focus();
    return;
  }

  // Check permission status (modern browsers) to skip prompt if already granted
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      if (result.state === 'granted') {
        // Silent auto-detect
        autoDetectLocation();
      } else if (result.state === 'denied') {
        showError(
          'Location Access Denied',
          'Location permission was blocked. Search for any city using the search bar above.',
        );
      } else {
        // 'prompt' — show our custom permission card
        showPermissionPrompt();
      }
    }).catch(() => {
      // Fallback if permissions API fails
      showPermissionPrompt();
    });
  } else {
    showPermissionPrompt();
  }
}

// ────────────────────────────────────────────────────────────
// Geolocation
// ────────────────────────────────────────────────────────────

/** Trigger browser geolocation, then load weather */
function autoDetectLocation() {
  showLoading();

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const { latitude: lat, longitude: lon } = coords;
        // Reverse geocode to get a city name
        const geo = await reverseGeocode(lat, lon);
        state.geoData = { lat, lon, ...geo };
        await loadWeatherForCoords(lat, lon, geo);
      } catch (err) {
        console.error('[auto-detect] error:', err);
        showError(
          'Could Not Load Weather',
          err.message || 'Unable to fetch weather. Check your connection and try again.',
        );
        state.retryFn = autoDetectLocation;
      }
    },
    (err) => {
      console.warn('[geolocation] denied:', err.message);
      showError(
        'Location Access Denied',
        'Location permission was blocked. You can still search for any city using the bar above.',
      );
      state.retryFn = null;
    },
    { timeout: 12000, maximumAge: 300_000 },
  );
}

// ────────────────────────────────────────────────────────────
// Weather Loading
// ────────────────────────────────────────────────────────────

/**
 * Fetch weather for coordinates and render everything.
 * @param {number} lat
 * @param {number} lon
 * @param {{ city: string, admin1?: string, country?: string }} geo
 */
async function loadWeatherForCoords(lat, lon, geo) {
  showLoading();
  try {
    const weather = await fetchWeather(lat, lon, 'auto');
    state.weatherData = weather;

    // Render all sections
    renderLocation(geo);
    renderCurrent(weather.current, state.unit);
    renderForecast(weather.daily, state.unit);
    renderHourly(weather.hourly, state.unit);

    showWeather();
  } catch (err) {
    console.error('[weather fetch] error:', err);
    const isNetwork = err.message.includes('fetch') || err.message.includes('network');
    showError(
      isNetwork ? 'No Internet Connection' : 'Weather Unavailable',
      isNetwork
        ? 'Check your internet connection and try again.'
        : `Could not load weather data: ${err.message}`,
    );
    state.retryFn = () => loadWeatherForCoords(lat, lon, geo);
  }
}

// ────────────────────────────────────────────────────────────
// City Search
// ────────────────────────────────────────────────────────────

/** Handle search form submission */
async function handleSearch(query) {
  if (!query.trim()) return;
  hideSuggestions();
  showLoading();

  try {
    const results = await searchCities(query);
    if (!results.length) {
      showError(
        'City Not Found',
        `No results for "${query}". Try a different spelling or nearby city.`,
      );
      state.retryFn = null;
      return;
    }

    // Use the top result
    const top = results[0];
    const geo = { city: top.name, admin1: top.admin1, country: top.country };
    state.geoData = { lat: top.lat, lon: top.lon, ...geo };

    await loadWeatherForCoords(top.lat, top.lon, geo);
  } catch (err) {
    console.error('[search] error:', err);
    showError('Search Failed', err.message || 'Unable to search. Try again.');
    state.retryFn = () => handleSearch(query);
  }
}

/** Debounced autocomplete while typing */
async function handleAutocomplete(query) {
  clearTimeout(state.searchDebounce);
  if (query.trim().length < 2) {
    hideSuggestions();
    return;
  }

  state.searchDebounce = setTimeout(async () => {
    try {
      const results = await searchCities(query);
      renderSuggestions(results, (selected) => {
        els.cityInput.value = selected.name;
        const geo = { city: selected.name, admin1: selected.admin1, country: selected.country };
        state.geoData = { lat: selected.lat, lon: selected.lon, ...geo };
        loadWeatherForCoords(selected.lat, selected.lon, geo);
      });
    } catch {
      hideSuggestions();
    }
  }, 350);
}

// ────────────────────────────────────────────────────────────
// Unit Toggle
// ────────────────────────────────────────────────────────────

/** Switch between Celsius and Fahrenheit, re-render if data exists */
function setUnit(unit) {
  if (state.unit === unit) return;
  state.unit = unit;
  updateUnitToggle(unit);

  if (state.weatherData) {
    renderCurrent(state.weatherData.current, unit);
    renderForecast(state.weatherData.daily, unit);
    renderHourly(state.weatherData.hourly, unit);
  }
}

// ────────────────────────────────────────────────────────────
// Event Binding
// ────────────────────────────────────────────────────────────
function bindEvents() {
  // ─ Permission prompt ─
  document.getElementById('btn-allow-location')?.addEventListener('click', () => {
    showLoading();
    autoDetectLocation();
  });

  document.getElementById('btn-deny-location')?.addEventListener('click', () => {
    // Just hide the prompt; search bar is always visible
    showError(
      'Ready to Search',
      'Enter any city name in the search bar above to get the weather.',
    );
    els.cityInput.focus();
  });

  // ─ Header locate button ─
  document.getElementById('btn-locate')?.addEventListener('click', autoDetectLocation);

  // ─ Search form submit ─
  els.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(els.cityInput.value);
  });

  // ─ Search input autocomplete ─
  els.cityInput?.addEventListener('input', (e) => {
    handleAutocomplete(e.target.value);
  });

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!els.cityInput?.contains(e.target) && !els.suggestions?.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Keyboard navigation in suggestions
  els.cityInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSuggestions();
    if (e.key === 'ArrowDown') {
      const first = els.suggestions.querySelector('.suggestion-item');
      first?.focus();
    }
  });

  // ─ Unit toggle ─
  els.btnCelsius?.addEventListener('click',     () => setUnit('C'));
  els.btnFahrenheit?.addEventListener('click',  () => setUnit('F'));

  // ─ Retry button ─
  els.btnRetry?.addEventListener('click', () => {
    if (state.retryFn) {
      state.retryFn();
    } else {
      // Default: re-run geolocation
      autoDetectLocation();
    }
  });

  // ─ Keyboard shortcut: / to focus search ─
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== els.cityInput) {
      e.preventDefault();
      els.cityInput?.focus();
    }
  });
}

// ────────────────────────────────────────────────────────────
// Start the app
// ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
