/**
 * weather-bg.js — Climate Update
 * Animated weather backgrounds: rain, snow, sun rays, and star fields.
 *
 * Architecture:
 *  - Canvas (requestAnimationFrame) for particle systems (rain, snow)
 *  - CSS class toggling on #weather-bg-layer for glow/ray/star effects
 *  - Respects prefers-reduced-motion
 *  - Reduces particle count on mobile for performance
 */

// ────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────
let animFrameId = null;
let activeTheme = null;
let resizeTimer = null;

// ────────────────────────────────────────────────────────────
// Utility helpers
// ────────────────────────────────────────────────────────────
const isMobile = () => window.innerWidth < 768;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getLayer  = () => document.getElementById('weather-bg-layer');
const getCanvas = () => document.getElementById('weather-canvas');
const getRand   = (min, max) => min + Math.random() * (max - min);

function sizeCanvas(canvas) {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ────────────────────────────────────────────────────────────
// Stop / clear
// ────────────────────────────────────────────────────────────
function stopCanvas() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  const canvas = getCanvas();
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function clearLayer() {
  const layer = getLayer();
  if (layer) layer.className = 'weather-bg-layer';

  const stars = document.getElementById('stars-container');
  if (stars) stars.innerHTML = '';
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Switch to the weather-appropriate animated background.
 * Safe to call repeatedly — skips if theme is unchanged.
 * @param {string} theme  'rainy' | 'stormy' | 'snowy' | 'sunny' | 'night' | 'foggy' | *
 */
export function startWeatherBg(theme) {
  if (theme === activeTheme) return;
  activeTheme = theme;

  stopCanvas();
  clearLayer();

  if (prefersReducedMotion()) return;   // respect user preference

  switch (theme) {
    case 'rainy':  startRain(false); break;
    case 'stormy': startRain(true);  break;
    case 'snowy':  startSnow();      break;
    case 'sunny':  startSun();       break;
    case 'night':  startNight();     break;
    case 'foggy':  startFog();       break;
    default:       break;            // cloudy / default → gradient only
  }
}

// ────────────────────────────────────────────────────────────
// Rain / Stormy
// ────────────────────────────────────────────────────────────
function makeRaindrop(cw, ch, baseAngle, heavy, scatter) {
  return {
    x:       getRand(-50, cw + 50),
    y:       scatter ? getRand(0, ch) : getRand(-60, -5),
    len:     heavy ? getRand(14, 30) : getRand(10, 18),
    speed:   heavy ? getRand(9, 16)  : getRand(6, 11),
    opacity: getRand(0.15, heavy ? 0.45 : 0.35),
    angle:   baseAngle + getRand(-0.06, 0.06),
  };
}

function startRain(heavy) {
  const layer = getLayer();
  if (layer) layer.classList.add(heavy ? 'bg-storm' : 'bg-rain');

  const canvas = getCanvas();
  if (!canvas) return;
  sizeCanvas(canvas);

  const ctx   = canvas.getContext('2d');
  const mobile = isMobile();
  const count  = mobile ? (heavy ? 55 : 38) : (heavy ? 130 : 75);
  const angle  = heavy ? 0.38 : 0.14;

  const drops = Array.from({ length: count }, () =>
    makeRaindrop(canvas.width, canvas.height, angle, heavy, true));

  let last = 0;

  function frame(ts) {
    const dt = Math.min((ts - last) / 16, 3);
    last = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const d of drops) {
      ctx.save();
      // Rain drops: thin blue-white streaks
      const grd = ctx.createLinearGradient(d.x, d.y, d.x + d.len * Math.sin(d.angle), d.y + d.len);
      grd.addColorStop(0, `rgba(174,214,241,0)`);
      grd.addColorStop(1, `rgba(174,214,241,${d.opacity})`);
      ctx.strokeStyle = grd;
      ctx.lineWidth   = heavy ? 1.8 : 1.1;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * Math.sin(d.angle), d.y + d.len);
      ctx.stroke();
      ctx.restore();

      d.y += d.speed * dt;
      d.x += d.speed * Math.sin(d.angle) * dt;

      if (d.y > canvas.height + 50) {
        Object.assign(d, makeRaindrop(canvas.width, canvas.height, angle, heavy, false));
      }
    }
    animFrameId = requestAnimationFrame(frame);
  }

  animFrameId = requestAnimationFrame(frame);

  // Handle resize
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => sizeCanvas(canvas), 200);
  };
  window.addEventListener('resize', onResize, { passive: true });
}

// ────────────────────────────────────────────────────────────
// Snow
// ────────────────────────────────────────────────────────────
function makeFlake(cw, ch, scatter) {
  return {
    x:           getRand(0, cw),
    y:           scatter ? getRand(0, ch) : getRand(-15, -2),
    r:           getRand(0.8, 3.2),
    speed:       getRand(0.35, 1.4),
    drift:       getRand(-0.25, 0.25),
    opacity:     getRand(0.22, 0.72),
    wobble:      getRand(0, Math.PI * 2),
    wobbleSpeed: getRand(0.007, 0.018),
  };
}

function startSnow() {
  const layer = getLayer();
  if (layer) layer.classList.add('bg-snow');

  const canvas = getCanvas();
  if (!canvas) return;
  sizeCanvas(canvas);

  const ctx   = canvas.getContext('2d');
  const count = isMobile() ? 38 : 80;
  const flakes = Array.from({ length: count }, () =>
    makeFlake(canvas.width, canvas.height, true));

  let last = 0;

  function frame(ts) {
    const dt = Math.min((ts - last) / 16, 3);
    last = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const f of flakes) {
      ctx.save();
      // Snow flakes: soft white discs
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2);
      grd.addColorStop(0, `rgba(255,255,255,${f.opacity})`);
      grd.addColorStop(1, `rgba(220,235,255,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      f.wobble += f.wobbleSpeed;
      f.y += f.speed * dt;
      f.x += (Math.sin(f.wobble) * 0.45 + f.drift) * dt;

      if (f.y > canvas.height + 15) {
        Object.assign(f, makeFlake(canvas.width, canvas.height, false));
      }
    }
    animFrameId = requestAnimationFrame(frame);
  }

  animFrameId = requestAnimationFrame(frame);

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => sizeCanvas(canvas), 200);
  }, { passive: true });
}

// ────────────────────────────────────────────────────────────
// Sunny
// ────────────────────────────────────────────────────────────
function startSun() {
  const layer = getLayer();
  if (layer) layer.classList.add('bg-sunny');
  // Sun glow + rays are pure CSS via .bg-sunny on the layer
}

// ────────────────────────────────────────────────────────────
// Night / Stars
// ────────────────────────────────────────────────────────────
function startNight() {
  const layer = getLayer();
  if (layer) layer.classList.add('bg-night');

  const container = document.getElementById('stars-container');
  if (!container) return;

  const count = isMobile() ? 55 : 115;
  const frag  = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const size  = getRand(0.5, 2.2);
    const s     = document.createElement('div');
    s.className = 'star';
    s.style.cssText = [
      `left:${getRand(0, 100).toFixed(1)}%`,
      `top:${getRand(0, 88).toFixed(1)}%`,
      `width:${size.toFixed(1)}px`,
      `height:${size.toFixed(1)}px`,
      `animation-delay:${getRand(0, 5).toFixed(2)}s`,
      `animation-duration:${getRand(2.5, 5.5).toFixed(2)}s`,
      `opacity:${getRand(0.25, 0.9).toFixed(2)}`,
    ].join(';');
    frag.appendChild(s);
  }
  container.appendChild(frag);
}

// ────────────────────────────────────────────────────────────
// Foggy
// ────────────────────────────────────────────────────────────
function startFog() {
  const layer = getLayer();
  if (layer) layer.classList.add('bg-foggy-anim');
  // Fog drift is handled purely in CSS
}
