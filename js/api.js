/**
 * api.js — Climate Update
 * Handles all external API calls:
 *  - Open-Meteo for weather data (no auth)
 *  - Nominatim (OpenStreetMap) for geocoding & reverse geocoding
 */

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const OPEN_METEO_BASE   = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_BASE      = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_GEO_BASE  = 'https://nominatim.openstreetmap.org/reverse';

/** Open-Meteo WMO weather codes → human-readable label + emoji */
export const WMO_CODES = {
  0:  { label: 'Clear Sky',         emoji: '☀️',  theme: 'sunny'   },
  1:  { label: 'Mainly Clear',      emoji: '🌤️',  theme: 'sunny'   },
  2:  { label: 'Partly Cloudy',     emoji: '⛅',  theme: 'cloudy'  },
  3:  { label: 'Overcast',          emoji: '☁️',  theme: 'cloudy'  },
  45: { label: 'Foggy',             emoji: '🌫️',  theme: 'foggy'   },
  48: { label: 'Rime Fog',          emoji: '🌫️',  theme: 'foggy'   },
  51: { label: 'Light Drizzle',     emoji: '🌦️',  theme: 'rainy'   },
  53: { label: 'Drizzle',           emoji: '🌧️',  theme: 'rainy'   },
  55: { label: 'Heavy Drizzle',     emoji: '🌧️',  theme: 'rainy'   },
  56: { label: 'Freezing Drizzle',  emoji: '🌨️',  theme: 'snowy'   },
  57: { label: 'Heavy Freezing Drizzle', emoji: '🌨️', theme: 'snowy' },
  61: { label: 'Light Rain',        emoji: '🌦️',  theme: 'rainy'   },
  63: { label: 'Rain',              emoji: '🌧️',  theme: 'rainy'   },
  65: { label: 'Heavy Rain',        emoji: '🌧️',  theme: 'rainy'   },
  66: { label: 'Light Freezing Rain', emoji: '🌨️', theme: 'snowy'  },
  67: { label: 'Freezing Rain',     emoji: '🌨️',  theme: 'snowy'   },
  71: { label: 'Light Snow',        emoji: '🌨️',  theme: 'snowy'   },
  73: { label: 'Snow',              emoji: '❄️',  theme: 'snowy'   },
  75: { label: 'Heavy Snow',        emoji: '❄️',  theme: 'snowy'   },
  77: { label: 'Snow Grains',       emoji: '🌨️',  theme: 'snowy'   },
  80: { label: 'Light Showers',     emoji: '🌦️',  theme: 'rainy'   },
  81: { label: 'Rain Showers',      emoji: '🌧️',  theme: 'rainy'   },
  82: { label: 'Heavy Showers',     emoji: '⛈️',  theme: 'stormy'  },
  85: { label: 'Snow Showers',      emoji: '🌨️',  theme: 'snowy'   },
  86: { label: 'Heavy Snow Showers',emoji: '❄️',  theme: 'snowy'   },
  95: { label: 'Thunderstorm',      emoji: '⛈️',  theme: 'stormy'  },
  96: { label: 'Thunderstorm w/ Hail', emoji: '⛈️', theme: 'stormy'},
  99: { label: 'Thunderstorm w/ Heavy Hail', emoji: '⛈️', theme: 'stormy'},
};

/**
 * Get WMO code info, with fallback for unknown codes.
 * @param {number} code
 */
export function getWmoInfo(code) {
  return WMO_CODES[code] ?? { label: 'Unknown', emoji: '🌡️', theme: 'default' };
}

// ────────────────────────────────────────────────────────────
// Geocoding
// ────────────────────────────────────────────────────────────

/**
 * Forward geocode: city name → { lat, lon, name, country, admin1 }[]
 * Uses Open-Meteo geocoding API.
 * @param {string} city
 * @returns {Promise<Array>}
 */
export async function searchCities(city) {
  const url = new URL(GEOCODE_BASE);
  url.searchParams.set('name', city.trim());
  url.searchParams.set('count', '6');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

  const data = await res.json();
  if (!data.results?.length) return [];

  return data.results.map(r => ({
    lat:      r.latitude,
    lon:      r.longitude,
    name:     r.name,
    country:  r.country      ?? '',
    admin1:   r.admin1       ?? '',
    countryCode: r.country_code ?? '',
    timezone: r.timezone     ?? 'auto',
  }));
}

/**
 * Reverse geocode: { lat, lon } → { city, country, admin1, displayName }
 * Uses Nominatim (OSM).
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ city: string, country: string, admin1: string, displayName: string }>}
 */
export async function reverseGeocode(lat, lon) {
  const url = new URL(REVERSE_GEO_BASE);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);
  url.searchParams.set('format', 'json');
  url.searchParams.set('accept-language', 'en');
  url.searchParams.set('zoom', '10');

  const res = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'ClimateUpdateApp/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`);

  const data = await res.json();
  const a = data.address ?? {};
  const city = a.city || a.town || a.village || a.county || a.state || 'Your Location';
  const admin1 = a.state ?? a.county ?? '';
  const country = a.country ?? '';

  return {
    city,
    admin1,
    country,
    displayName: [city, admin1, country].filter(Boolean).join(', '),
  };
}

// ────────────────────────────────────────────────────────────
// Weather Fetching
// ────────────────────────────────────────────────────────────

/**
 * Fetch complete weather data from Open-Meteo.
 * Returns current conditions + 7-day daily + 48h hourly.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} timezone  e.g. "auto" or "America/New_York"
 * @returns {Promise<object>}  Parsed weather object
 */
export async function fetchWeather(lat, lon, timezone = 'auto') {
  const url = new URL(OPEN_METEO_BASE);

  // Location
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('timezone', timezone);

  // Current weather variables — includes all sidebar metrics
  url.searchParams.set('current', [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m',
    'precipitation',
    'weather_code',
    'is_day',
    'uv_index',
    'surface_pressure',
    'visibility',
    'dew_point_2m',
    'cloud_cover',
  ].join(','));

  // Daily variables — 7-day forecast
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max',
    'precipitation_sum',
    'sunrise',
    'sunset',
    'uv_index_max',
    'wind_direction_10m_dominant',
    'wind_gusts_10m_max',
  ].join(','));

  // Hourly variables — extended for charts and sidebar
  url.searchParams.set('hourly', [
    'temperature_2m',
    'relative_humidity_2m',
    'wind_speed_10m',
    'wind_direction_10m',
    'surface_pressure',
    'visibility',
    'dew_point_2m',
    'cloud_cover',
    'weather_code',
    'precipitation_probability',
    'is_day',
  ].join(','));

  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('models', 'best_match');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Weather API error ${res.status}: ${errText}`);
  }

  const raw = await res.json();
  return parseWeatherResponse(raw);
}

// ────────────────────────────────────────────────────────────
// Response Parsing
// ────────────────────────────────────────────────────────────

/**
 * Transform raw Open-Meteo API response into a clean structured object.
 * @param {object} raw  Raw API JSON
 * @returns {object}
 */
function parseWeatherResponse(raw) {
  const { current, daily, hourly } = raw;

  // ─ Current — includes all sidebar + modal fields ─
  const currentParsed = {
    temp:         round(current.temperature_2m),
    feelsLike:    round(current.apparent_temperature),
    humidity:     current.relative_humidity_2m,
    windSpeed:    round(current.wind_speed_10m),
    windDir:      current.wind_direction_10m,
    windGusts:    round(current.wind_gusts_10m ?? 0),
    precipitation: current.precipitation,
    wmoCode:      current.weather_code,
    isDay:        Boolean(current.is_day),
    uvIndex:      current.uv_index ?? 0,
    pressure:     round(current.surface_pressure ?? 1013),
    visibility:   round((current.visibility ?? 10000) / 1000, 1), // m → km
    dewPoint:     round(current.dew_point_2m ?? 0),
    cloudCover:   current.cloud_cover ?? 0,
    fetchedAt:    new Date(),
    ...getWmoInfo(current.weather_code),
  };

  // Adjust theme for night
  if (!currentParsed.isDay && currentParsed.theme === 'sunny') {
    currentParsed.emoji = '🌙';
    currentParsed.theme = 'night';
    currentParsed.label = 'Clear Night';
  }

  // ─ Daily (up to 7 days) ─
  const numDays = Math.min(7, daily.time.length);
  const dailyParsed = Array.from({ length: numDays }, (_, i) => {
    const wmo = getWmoInfo(daily.weather_code[i]);
    return {
      date:            new Date(daily.time[i] + 'T12:00:00'),
      wmoCode:         daily.weather_code[i],
      tempMax:         round(daily.temperature_2m_max[i]),
      tempMin:         round(daily.temperature_2m_min[i]),
      precipChance:    daily.precipitation_probability_max[i] ?? 0,
      precipSum:       round(daily.precipitation_sum[i] ?? 0, 1),
      sunrise:         daily.sunrise?.[i]  ? new Date(daily.sunrise[i])  : null,
      sunset:          daily.sunset?.[i]   ? new Date(daily.sunset[i])   : null,
      uvMax:           daily.uv_index_max?.[i] ?? 0,
      windDir:         daily.wind_direction_10m_dominant?.[i] ?? 0,
      windGusts:       round(daily.wind_gusts_10m_max?.[i] ?? 0),
      ...wmo,
    };
  });

  // ─ Hourly (next 24 slots from now) — extended fields for charts ─
  const nowIdx = findCurrentHourIndex(hourly.time);
  const hourlyParsed = hourly.time
    .slice(nowIdx, nowIdx + 24)
    .map((t, idx) => {
      const i = nowIdx + idx;
      return {
        time:       new Date(t),
        temp:       round(hourly.temperature_2m[i]),
        humidity:   hourly.relative_humidity_2m?.[i] ?? null,
        windSpeed:  round(hourly.wind_speed_10m?.[i] ?? 0),
        windDir:    hourly.wind_direction_10m?.[i] ?? 0,
        pressure:   round(hourly.surface_pressure?.[i] ?? 1013),
        visibility: round((hourly.visibility?.[i] ?? 10000) / 1000, 1),
        dewPoint:   round(hourly.dew_point_2m?.[i] ?? 0),
        cloudCover: hourly.cloud_cover?.[i] ?? 0,
        wmoCode:    hourly.weather_code[i],
        precipP:    hourly.precipitation_probability[i] ?? 0,
        isDay:      Boolean(hourly.is_day?.[i]),
        ...getWmoInfo(hourly.weather_code[i]),
      };
    });

  return { current: currentParsed, daily: dailyParsed, hourly: hourlyParsed };
}

/** Find the index in the hourly array closest to current time */
function findCurrentHourIndex(times) {
  const now = new Date();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]) - now);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

/** Round number to given decimal places */
function round(val, dec = 0) {
  if (val == null || isNaN(val)) return 0;
  return parseFloat(val.toFixed(dec));
}

// ────────────────────────────────────────────────────────────
// Unit Conversions
// ────────────────────────────────────────────────────────────

/** Celsius → Fahrenheit */
export function toF(c) {
  return Math.round(c * 9 / 5 + 32);
}

/** km/h → mph */
export function toMph(kph) {
  return Math.round(kph * 0.621371);
}

/**
 * Format a temperature value with unit label.
 * @param {number} celsius   raw Celsius value
 * @param {'C'|'F'} unit
 */
export function formatTemp(celsius, unit = 'C') {
  return unit === 'F' ? toF(celsius) : Math.round(celsius);
}

/**
 * Wind direction degrees → compass label.
 * @param {number} deg
 */
export function degToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}
