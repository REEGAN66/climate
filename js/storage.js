/**
 * storage.js — Climate Update
 * LocalStorage helpers for recent searches and favourite locations.
 * All data is serialised as JSON; keys are namespaced to avoid collisions.
 */

const KEYS = {
  recent:    'cu-recent-searches',
  favourites: 'cu-favourites',
};
const MAX_RECENT = 6;
const MAX_FAVS   = 8;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); }
  catch { return []; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* quota exceeded — silently skip */ }
}

/** Build a stable unique key for a geo object */
function geoKey(geo) {
  return `${geo.city}|${geo.admin1 ?? ''}|${geo.country ?? ''}`.toLowerCase();
}

// ────────────────────────────────────────────────────────────
// Recent Searches
// ────────────────────────────────────────────────────────────

/** @returns {{ city, admin1, country, lat, lon }[]} */
export function getRecentSearches() {
  return readJSON(KEYS.recent);
}

/**
 * Add a geo to recents (dedupes by city/admin1/country, most-recent first).
 * @param {{ city: string, admin1?: string, country?: string, lat: number, lon: number }} geo
 */
export function addRecentSearch(geo) {
  const key  = geoKey(geo);
  const list = readJSON(KEYS.recent).filter(r => geoKey(r) !== key);
  list.unshift({ city: geo.city, admin1: geo.admin1 ?? '', country: geo.country ?? '', lat: geo.lat, lon: geo.lon });
  writeJSON(KEYS.recent, list.slice(0, MAX_RECENT));
}

/** Remove one recent search by matching geo key */
export function removeRecentSearch(geo) {
  const key  = geoKey(geo);
  const list = readJSON(KEYS.recent).filter(r => geoKey(r) !== key);
  writeJSON(KEYS.recent, list);
}

/** Wipe all recent searches */
export function clearRecentSearches() {
  writeJSON(KEYS.recent, []);
}

// ────────────────────────────────────────────────────────────
// Favourites
// ────────────────────────────────────────────────────────────

/** @returns {{ city, admin1, country, lat, lon }[]} */
export function getFavourites() {
  return readJSON(KEYS.favourites);
}

/**
 * Toggle a geo in/out of favourites.
 * @returns {boolean} true if added, false if removed
 */
export function toggleFavourite(geo) {
  const key  = geoKey(geo);
  const list = readJSON(KEYS.favourites);
  const idx  = list.findIndex(f => geoKey(f) === key);

  if (idx >= 0) {
    list.splice(idx, 1);
    writeJSON(KEYS.favourites, list);
    return false;
  } else {
    list.unshift({ city: geo.city, admin1: geo.admin1 ?? '', country: geo.country ?? '', lat: geo.lat, lon: geo.lon });
    writeJSON(KEYS.favourites, list.slice(0, MAX_FAVS));
    return true;
  }
}

/** @param {{ city, admin1, country }} geo @returns {boolean} */
export function isFavourite(geo) {
  const key = geoKey(geo);
  return readJSON(KEYS.favourites).some(f => geoKey(f) === key);
}
