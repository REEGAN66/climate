/**
 * app.js — Climate Update
 * Entry point: orchestrates geolocation, search, unit toggling,
 * sidebar, charts, recent searches, favourites, and 7-day forecast.
 * All existing functionality is preserved; new features are additions.
 */

import {
  fetchWeather,
  searchCities,
  reverseGeocode,
} from './api.js';

import { initTheme } from './theme.js';

import {
  initModal,
  renderModal,
  updateModalUnit,
} from './modal.js';

import {
  els,
  showPermissionPrompt,
  showLoading,
  showError,
  showWeather,
  renderLocation,
  renderCurrent,
  renderForecast,
  renderForecast7,
  renderHourly,
  renderCharts,
  updateUnitToggle,
  renderSuggestions,
  hideSuggestions,
  applyTheme,
} from './ui.js';

import { initSidebar, updateSidebar } from './sidebar.js';

import {
  getRecentSearches,
  addRecentSearch,
  getFavourites,
  toggleFavourite,
  isFavourite,
} from './storage.js';

// ────────────────────────────────────────────────────────────
// App State
// ────────────────────────────────────────────────────────────
const state = {
  unit:           'C',    // 'C' or 'F'
  weatherData:    null,   // last fetched weather object
  geoData:        null,   // last known location { lat, lon, city, admin1, country }
  searchDebounce: null,   // timer for search debounce
  retryFn:        null,   // function to call on "Try Again"
};

// ────────────────────────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────────────────────────
function init() {
  initTheme();    // Apply saved/system theme & wire toggle button
  initModal();    // Wire existing premium weather details modal
  initSidebar();  // Wire collapsible sidebar + metric detail drawer
  bindEvents();
  checkGeolocationSupport();
}

/** Check if the browser supports Geolocation and decide first action */
function checkGeolocationSupport() {
  if (!('geolocation' in navigator)) {
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
        autoDetectLocation();
      } else if (result.state === 'denied') {
        showError(
          'Location Access Denied',
          'Location permission was blocked. Search for any city using the search bar above.',
        );
      } else {
        showPermissionPrompt();
      }
    }).catch(() => {
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

    // Render all existing sections (no changes to these calls)
    renderLocation(geo);
    renderCurrent(weather.current, state.unit);
    renderForecast(weather.daily, state.unit);         // original 3-day (hidden grid, kept for compat)
    renderForecast7(weather.daily, state.unit);        // new 7-day grid
    renderHourly(weather.hourly, state.unit);

    // Render weather charts (new)
    renderCharts(weather.hourly, state.unit);

    // Update sidebar (new)
    updateSidebar(weather, state.unit);

    // Populate existing modal with sunrise/sunset fix
    renderModal(
      { ...weather.current, sunrise: weather.daily[0]?.sunrise, sunset: weather.daily[0]?.sunset, precipChance: weather.daily[0]?.precipChance },
      state.unit,
    );

    // Store in recent searches
    if (geo.city) addRecentSearch({ ...geo, lat, lon });

    // Update favourite button
    updateFavouriteButton(geo);

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

/** Debounced autocomplete while typing — includes recent searches */
async function handleAutocomplete(query) {
  clearTimeout(state.searchDebounce);

  // Show recent searches when field is empty or has 1 char
  if (query.trim().length < 2) {
    showRecentSearches();
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

/** Show recent searches in the suggestions dropdown */
function showRecentSearches() {
  const recents = getRecentSearches();
  if (!recents.length) {
    hideSuggestions();
    return;
  }

  // Reuse renderSuggestions format but inject a divider
  const list = els.suggestions;
  list.innerHTML = '';

  const div = document.createElement('li');
  div.className = 'suggestions-divider';
  div.textContent = 'Recent Searches';
  div.setAttribute('aria-hidden', 'true');
  list.appendChild(div);

  recents.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'suggestion-item';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.setAttribute('tabindex', '0');
    li.id = `recent-${i}`;

    const sub = [r.admin1, r.country].filter(Boolean).join(', ');
    li.innerHTML = `
      <span class="suggestion-flag" aria-hidden="true">🕐</span>
      <span>
        <strong>${escHtml(r.city)}</strong>
        ${sub ? `<br><span class="suggestion-sub">${escHtml(sub)}</span>` : ''}
      </span>
    `;

    li.addEventListener('click', () => {
      els.cityInput.value = r.city;
      hideSuggestions();
      loadWeatherForCoords(r.lat, r.lon, r);
    });

    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        els.cityInput.value = r.city;
        hideSuggestions();
        loadWeatherForCoords(r.lat, r.lon, r);
      }
    });

    list.appendChild(li);
  });

  list.hidden = false;
}

// ────────────────────────────────────────────────────────────
// Favourites
// ────────────────────────────────────────────────────────────

/** Update the ⭐ button state based on current location */
function updateFavouriteButton(geo) {
  const btn = document.getElementById('btn-favourite');
  if (!btn || !geo?.city) return;
  btn.hidden = false;
  const fav = isFavourite(geo);
  btn.setAttribute('aria-pressed', String(fav));
  btn.classList.toggle('is-fav', fav);
  btn.title = fav ? 'Remove from favourites' : 'Add to favourites';
  btn.textContent = fav ? '⭐' : '☆';
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
    renderForecast7(state.weatherData.daily, unit);
    renderHourly(state.weatherData.hourly, unit);
    renderCharts(state.weatherData.hourly, unit);
    updateSidebar(state.weatherData, unit);
    updateModalUnit(
      { ...state.weatherData.current, sunrise: state.weatherData.daily[0]?.sunrise, sunset: state.weatherData.daily[0]?.sunset, precipChance: state.weatherData.daily[0]?.precipChance },
      unit,
    );
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

  // ─ Search input autocomplete + recent searches ─
  els.cityInput?.addEventListener('input', (e) => {
    handleAutocomplete(e.target.value);
  });

  // Show recents on focus (if field is empty)
  els.cityInput?.addEventListener('focus', () => {
    if (!els.cityInput.value.trim()) showRecentSearches();
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
  els.btnCelsius?.addEventListener('click',    () => setUnit('C'));
  els.btnFahrenheit?.addEventListener('click', () => setUnit('F'));

  // ─ Retry button ─
  els.btnRetry?.addEventListener('click', () => {
    if (state.retryFn) {
      state.retryFn();
    } else {
      autoDetectLocation();
    }
  });

  // ─ Favourite button ─
  document.getElementById('btn-favourite')?.addEventListener('click', () => {
    if (!state.geoData) return;
    const added = toggleFavourite(state.geoData);
    updateFavouriteButton(state.geoData);
    // Brief accessible announcement
    const msg = added ? 'Added to favourites' : 'Removed from favourites';
    const ann = document.createElement('div');
    ann.setAttribute('aria-live', 'polite');
    ann.setAttribute('aria-atomic', 'true');
    ann.className = 'sr-only';
    ann.textContent = msg;
    document.body.appendChild(ann);
    setTimeout(() => ann.remove(), 1500);
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
// Helpers
// ────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ────────────────────────────────────────────────────────────
// Start the app
// ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
