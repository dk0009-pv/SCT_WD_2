/* ═══════════════════════════════════════
   SCT_WD_2 — Stopwatch  |  script.js
═══════════════════════════════════════ */

/* ── State ── */
let running     = false;
let startTime   = 0;       // Date.now() when last started
let elapsed     = 0;       // accumulated ms before last pause
let lapElapsed  = 0;       // accumulated ms for current lap
let lapStart    = 0;       // Date.now() when current lap started
let rafId       = null;    // requestAnimationFrame id
let laps        = [];      // array of {num, split, total}

/* ── DOM refs ── */
const minEl     = document.getElementById('minutes');
const secEl     = document.getElementById('seconds');
const msEl      = document.getElementById('milliseconds');
const colonEl   = document.getElementById('colonDot');
const statusEl  = document.getElementById('statusLabel');
const mainBtn   = document.getElementById('mainBtn');
const mainIcon  = document.getElementById('mainIcon');
const lapBtn    = document.getElementById('lapBtn');
const resetBtn  = document.getElementById('resetBtn');
const lapList   = document.getElementById('lapList');
const lapCount  = document.getElementById('lapCount');
const clearBtn  = document.getElementById('clearLapsBtn');
const ringFill  = document.getElementById('ringFill');

/* ── Inject SVG gradient (can't do inside external CSS for SVG fills) ── */
const svgEl = document.querySelector('.progress-ring');
const defs  = document.createElementNS('http://www.w3.org/2000/svg','defs');
defs.innerHTML = `
  <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="#7c6fff"/>
    <stop offset="100%" stop-color="#00d4ff"/>
  </linearGradient>`;
svgEl.prepend(defs);
// Fix ring fill to use the gradient
ringFill.setAttribute('stroke','url(#ringGradient)');

/* ── Ring constants ── */
const RING_CIRCUMFERENCE = 2 * Math.PI * 118; // ≈ 741.4
const RING_CYCLE_MS      = 60000;              // ring completes per 60s cycle

/* ── Format helpers ── */
/**
 * Format milliseconds into { min, sec, ms } strings (zero-padded)
 */
function fmtParts(ms) {
  const totalCs = Math.floor(ms / 10);          // centiseconds
  const min     = Math.floor(totalCs / 6000);
  const sec     = Math.floor((totalCs % 6000) / 100);
  const cs      = totalCs % 100;
  return {
    min: String(min).padStart(2,'0'),
    sec: String(sec).padStart(2,'0'),
    cs:  String(cs).padStart(2,'0'),
  };
}

/**
 * Return formatted string like "02:34.56"
 */
function fmtFull(ms) {
  const p = fmtParts(ms);
  return `${p.min}:${p.sec}.${p.cs}`;
}

/* ── Update the clock display ── */
function updateDisplay(ms) {
  const p = fmtParts(ms);
  minEl.textContent = p.min;
  secEl.textContent = p.sec;
  msEl.textContent  = p.cs;

  // Progress ring — cycles every 60 seconds
  const progress = (ms % RING_CYCLE_MS) / RING_CYCLE_MS;
  const offset   = RING_CIRCUMFERENCE * (1 - progress);
  ringFill.style.strokeDashoffset = offset;
}

/* ── Animation loop ── */
function tick() {
  const now     = Date.now();
  const totalMs = elapsed + (now - startTime);
  updateDisplay(totalMs);
  rafId = requestAnimationFrame(tick);
}

/* ── START / PAUSE ── */
function startStop() {
  if (!running) {
    // — Start —
    running   = true;
    startTime = Date.now();
    if (lapStart === 0) lapStart = startTime; // first start

    rafId = requestAnimationFrame(tick);

    mainIcon.className    = 'fa-solid fa-pause';
    mainBtn.title         = 'Pause';
    mainBtn.classList.remove('paused-state');
    statusEl.textContent  = 'Running';
    statusEl.className    = 'status-label running';
    colonEl.classList.remove('paused');

    lapBtn.disabled   = false;
    resetBtn.disabled = false;
  } else {
    // — Pause —
    running = false;
    elapsed += Date.now() - startTime;
    lapElapsed += Date.now() - lapStart;
    lapStart = 0;

    cancelAnimationFrame(rafId);

    mainIcon.className   = 'fa-solid fa-play';
    mainBtn.title        = 'Resume';
    mainBtn.classList.add('paused-state');
    statusEl.textContent = 'Paused';
    statusEl.className   = 'status-label paused';
    colonEl.classList.add('paused');
  }
}

/* ── LAP ── */
function recordLap() {
  if (!running) return;

  const now         = Date.now();
  const totalMs     = elapsed + (now - startTime);
  const splitMs     = lapElapsed + (now - lapStart);

  laps.unshift({ num: laps.length + 1, split: splitMs, total: totalMs });

  // Reset lap timer
  lapElapsed = 0;
  lapStart   = now;

  renderLaps();
}

/* ── RESET ── */
function reset() {
  running = false;
  cancelAnimationFrame(rafId);

  elapsed    = 0;
  lapElapsed = 0;
  lapStart   = 0;
  startTime  = 0;
  laps       = [];

  updateDisplay(0);
  ringFill.style.strokeDashoffset = RING_CIRCUMFERENCE;

  mainIcon.className    = 'fa-solid fa-play';
  mainBtn.title         = 'Start';
  mainBtn.classList.remove('paused-state');
  statusEl.textContent  = 'Ready';
  statusEl.className    = 'status-label';
  colonEl.classList.remove('paused');

  lapBtn.disabled   = true;
  resetBtn.disabled = true;

  renderLaps();
}

/* ── RENDER LAP LIST ── */
function renderLaps() {
  const count = laps.length;
  lapCount.textContent = `${count} lap${count !== 1 ? 's' : ''}`;
  clearBtn.style.display = count > 0 ? 'flex' : 'none';

  if (count === 0) {
    lapList.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-clock"></i>
        <p>No laps recorded yet.<br/>Hit <strong>Lap</strong> while running.</p>
      </div>`;
    return;
  }

  // Find best & worst split times (only meaningful with 2+ laps)
  const splits  = laps.map(l => l.split);
  const minSplit = Math.min(...splits);
  const maxSplit = Math.max(...splits);

  lapList.innerHTML = laps.map(lap => {
    let cls    = '';
    let badge  = '';

    if (count > 1) {
      if (lap.split === minSplit) { cls = 'best';  badge = '<span class="lap-badge badge-best">Best</span>'; }
      if (lap.split === maxSplit) { cls = 'worst'; badge = '<span class="lap-badge badge-worst">Worst</span>'; }
    }

    return `
      <div class="lap-row ${cls}">
        <div class="lap-num">
          LAP ${count - laps.indexOf(lap)}
          ${badge}
        </div>
        <div class="lap-split">${fmtFull(lap.split)}</div>
        <div class="lap-total">${fmtFull(lap.total)}</div>
      </div>`;
  }).join('');
}

/* ── CLEAR LAPS ── */
function clearLaps() {
  laps = [];
  renderLaps();
}

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
  // Ignore if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      startStop();
      break;
    case 'KeyL':
      if (!lapBtn.disabled) recordLap();
      break;
    case 'KeyR':
      if (!resetBtn.disabled) reset();
      break;
  }
});

/* ── Event listeners ── */
mainBtn.addEventListener('click', startStop);
lapBtn.addEventListener('click', recordLap);
resetBtn.addEventListener('click', reset);
clearBtn.addEventListener('click', clearLaps);

/* ── Init ── */
updateDisplay(0);
renderLaps();
