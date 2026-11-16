"use strict";
/* =====================================================================
   KOMETA: Starfall Courier
   An original slingshot-physics space game.
   Drag the comet, bend its flight around planets, gather every star
   shard, then dive through the exit gate. All art is drawn in code,
   all sound is synthesized with WebAudio. No external assets.
   ===================================================================== */

// ---------- Canvas setup (crisp on retina via devicePixelRatio) ----------
const W = 960, H = 540;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function fitCanvas() {
  const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvas();
window.addEventListener("resize", fitCanvas);

// ---------- Tiny WebAudio synth (no audio files) ----------
const Sound = {
  ac: null,
  muted: false,
  ensure() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ac = new AC();
    }
    if (this.ac && this.ac.state === "suspended") this.ac.resume();
  },
  tone(freqA, freqB, dur, type, vol, delay) {
    if (this.muted || !this.ac) return;
    const t0 = this.ac.currentTime + (delay || 0);
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },
  noise(dur, vol, delay) {
    if (this.muted || !this.ac) return;
    const t0 = this.ac.currentTime + (delay || 0);
    const len = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const gain = this.ac.createGain();
    gain.gain.value = vol || 0.2;
    const filter = this.ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    src.connect(filter).connect(gain).connect(this.ac.destination);
    src.start(t0);
  },
  launch()  { this.tone(320, 90, 0.28, "sawtooth", 0.10); this.noise(0.18, 0.06); },
  pickup()  { this.tone(880, 880, 0.09, "sine", 0.16); this.tone(1318, 1318, 0.14, "sine", 0.14, 0.07); },
  bounce()  { this.tone(180, 120, 0.08, "triangle", 0.08); },
  hit()     { this.noise(0.35, 0.25); this.tone(140, 40, 0.4, "square", 0.16); },
  gateOpen(){ this.tone(523, 523, 0.1, "sine", 0.12); this.tone(784, 784, 0.16, "sine", 0.12, 0.09); },
  clear()   { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.16, "triangle", 0.15, i * 0.09)); },
  win()     { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, f, 0.22, "triangle", 0.16, i * 0.12)); },
  lose()    { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.26, "sawtooth", 0.10, i * 0.16)); },
  click()   { this.tone(660, 660, 0.06, "sine", 0.10); }
};

// ---------- Level designs (handcrafted) ----------
// planet: x, y, r (radius), g (gravity strength), hue pair, optional ring
// sun:    x, y, r  — touching one costs 1 hull
// shard:  x, y, optional orbit {cx, cy, rad, speed, phase} or drift {axis, amp, speed, phase}
// gate:   x, y, optional drift
const LEVELS = [
  {
    name: "First Flight",
    tip: "Drag the comet and let go. Gravity bends your path!",
    start: { x: 110, y: 440 },
    planets: [
      { x: 480, y: 250, r: 48, g: 30000, c1: "#3fd9c0", c2: "#0d5f8a", ring: false }
    ],
    suns: [],
    shards: [ { x: 330, y: 150 }, { x: 640, y: 140 }, { x: 770, y: 330 } ],
    gate: { x: 872, y: 110 }
  },
  {
    name: "Twin Pull",
    tip: "Two planets, two pulls. Thread the needle.",
    start: { x: 100, y: 120 },
    planets: [
      { x: 350, y: 380, r: 44, g: 28000, c1: "#ffb35c", c2: "#a83e12", ring: false },
      { x: 640, y: 150, r: 52, g: 34000, c1: "#b78cff", c2: "#43257e", ring: true }
    ],
    suns: [ { x: 500, y: 470, r: 22 } ],
    shards: [ { x: 250, y: 230 }, { x: 500, y: 270 }, { x: 800, y: 300 }, { x: 870, y: 90 } ],
    gate: { x: 880, y: 460 }
  },
  {
    name: "Sun Alley",
    tip: "Red suns burn. Give them a wide berth.",
    start: { x: 100, y: 270 },
    planets: [
      { x: 300, y: 130, r: 38, g: 24000, c1: "#6ee7a0", c2: "#14663c", ring: false },
      { x: 560, y: 400, r: 46, g: 30000, c1: "#5cc8ff", c2: "#144a8a", ring: false },
      { x: 760, y: 140, r: 34, g: 22000, c1: "#ffd76e", c2: "#8a5a14", ring: true }
    ],
    suns: [ { x: 430, y: 270, r: 24 }, { x: 660, y: 250, r: 20 } ],
    shards: [ { x: 200, y: 420 }, { x: 430, y: 110 }, { x: 620, y: 480 }, { x: 850, y: 320 } ],
    gate: { x: 880, y: 60 }
  },
  {
    name: "The Drift",
    tip: "The shards are on the move. Lead your shot.",
    start: { x: 110, y: 470 },
    planets: [
      { x: 260, y: 200, r: 40, g: 26000, c1: "#ff8fb2", c2: "#7e2450", ring: false },
      { x: 520, y: 330, r: 56, g: 36000, c1: "#7ce7ff", c2: "#155e7a", ring: true },
      { x: 790, y: 170, r: 38, g: 25000, c1: "#c0ff7c", c2: "#4a7a15", ring: false }
    ],
    suns: [ { x: 520, y: 90, r: 21 }, { x: 130, y: 130, r: 18 } ],
    shards: [
      { x: 400, y: 120, orbit: { cx: 400, cy: 120, rad: 42, speed: 0.9, phase: 0 } },
      { x: 660, y: 440, drift: { axis: "x", amp: 55, speed: 1.1, phase: 1.3 } },
      { x: 880, y: 330, drift: { axis: "y", amp: 48, speed: 1.4, phase: 2.6 } },
      { x: 200, y: 380, orbit: { cx: 200, cy: 380, rad: 30, speed: 1.3, phase: 4.0 } },
      { x: 700, y: 90,  drift: { axis: "y", amp: 36, speed: 0.8, phase: 0.7 } }
    ],
    gate: { x: 890, y: 480 }
  },
  {
    name: "Starfall Run",
    tip: "Everything moves. Everything burns. Bring it home, courier.",
    start: { x: 90, y: 90 },
    planets: [
      { x: 240, y: 330, r: 42, g: 28000, c1: "#ffa25c", c2: "#8a3412", ring: true },
      { x: 470, y: 140, r: 36, g: 24000, c1: "#8c9eff", c2: "#2c357e", ring: false },
      { x: 620, y: 390, r: 50, g: 33000, c1: "#5cffd4", c2: "#0d6e5f", ring: false },
      { x: 830, y: 200, r: 34, g: 23000, c1: "#f78cff", c2: "#6e2472", ring: true }
    ],
    suns: [ { x: 380, y: 470, r: 22 }, { x: 560, y: 260, r: 20 }, { x: 880, y: 420, r: 19 } ],
    shards: [
      { x: 160, y: 200, drift: { axis: "y", amp: 44, speed: 1.2, phase: 0.4 } },
      { x: 360, y: 90,  orbit: { cx: 360, cy: 90, rad: 34, speed: 1.1, phase: 2.1 } },
      { x: 520, y: 480, drift: { axis: "x", amp: 50, speed: 1.0, phase: 3.4 } },
      { x: 730, y: 90,  drift: { axis: "y", amp: 40, speed: 1.5, phase: 1.0 } },
      { x: 770, y: 300, orbit: { cx: 770, cy: 300, rad: 36, speed: 1.25, phase: 5.2 } },
      { x: 120, y: 430, drift: { axis: "x", amp: 38, speed: 1.35, phase: 2.9 } }
    ],
    gate: { x: 890, y: 90, drift: { axis: "y", amp: 55, speed: 0.9, phase: 0 } }
  }
];

// ---------- Background starfield (3 parallax layers, generated once) ----------
const starLayers = [];
(function makeStars() {
  const defs = [ { n: 90, s: 1.0, p: 0.12, a: 0.45 }, { n: 60, s: 1.6, p: 0.3, a: 0.7 }, { n: 34, s: 2.4, p: 0.55, a: 1.0 } ];
  for (const d of defs) {
    const stars = [];
    for (let i = 0; i < d.n; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, tw: Math.random() * Math.PI * 2, ts: 0.6 + Math.random() * 1.8 });
    }
    starLayers.push({ stars, size: d.s, par: d.p, alpha: d.a });
  }
})();
// A few soft nebula blobs, fixed positions, drawn as radial gradients.
const NEBULAE = [
  { x: 200, y: 120, r: 260, c: "rgba(64,60,180,0.16)" },
  { x: 790, y: 420, r: 300, c: "rgba(14,110,130,0.14)" },
  { x: 560, y: 180, r: 200, c: "rgba(150,40,120,0.10)" }
];

// ---------- Game state ----------
const S = {
  screen: "title",        // title | play | clear | win | over
  paused: false,
  levelIdx: 0,
  score: 0,
  hull: 3,
  time: 0,                // total run time (for gentle star drift)
  levelTime: 0,
  shots: 0,
  lastBonus: { hull: 0, speed: 0, total: 0 },
  comet: { x: 0, y: 0, vx: 0, vy: 0, r: 9, flying: false },
  shards: [],             // live shard objects for current level
  gate: { x: 0, y: 0, baseX: 0, baseY: 0, drift: null, open: false, openPlayed: false },
  dragging: false,
  dragX: 0, dragY: 0,
  mouse: { x: 0, y: 0, down: false },
  particles: [],
  floaters: [],           // floating score text
  shake: 0,
  buttons: []             // clickable rects for the current screen
};

function shardPos(sh, t) {
  if (sh.orbit) {
    const a = sh.orbit.phase + t * sh.orbit.speed;
    return { x: sh.orbit.cx + Math.cos(a) * sh.orbit.rad, y: sh.orbit.cy + Math.sin(a) * sh.orbit.rad };
  }
  if (sh.drift) {
    const off = Math.sin(sh.drift.phase + t * sh.drift.speed) * sh.drift.amp;
    return sh.drift.axis === "x" ? { x: sh.x + off, y: sh.y } : { x: sh.x, y: sh.y + off };
  }
  return { x: sh.x, y: sh.y };
}

function loadLevel(idx) {
  const L = LEVELS[idx];
  S.levelIdx = idx;
  S.levelTime = 0;
  S.comet.x = L.start.x; S.comet.y = L.start.y;
  S.comet.vx = 0; S.comet.vy = 0; S.comet.flying = false;
  S.dragging = false;
  S.shards = L.shards.map(sh => ({ ...sh, taken: false, spin: Math.random() * Math.PI * 2 }));
  S.gate.baseX = L.gate.x; S.gate.baseY = L.gate.y;
  S.gate.drift = L.gate.drift || null;
  S.gate.x = L.gate.x; S.gate.y = L.gate.y;
  S.gate.open = false; S.gate.openPlayed = false;
  S.particles.length = 0;
  S.floaters.length = 0;
  S.paused = false;
}

function resetRun() {
  S.score = 0;
  S.hull = 3;
  S.shots = 0;
  loadLevel(0);
}

// ---------- Physics ----------
// Gravity uses an inverse-distance falloff with softening and a hard cap,
// which gives readable, forgiving bends around planets.
function gravityAt(x, y, planets) {
  let ax = 0, ay = 0;
  for (const p of planets) {
    const dx = p.x - x, dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2) || 1;
    let a = p.g / (d + p.r * 0.6);
    if (a > 950) a = 950;
    ax += (dx / d) * a;
    ay += (dy / d) * a;
  }
  return { ax, ay };
}

function burst(x, y, n, colors, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.3 + Math.random() * 0.7) * (speed || 120);
    S.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: (life || 0.7) * (0.5 + Math.random() * 0.8), maxLife: life || 0.7,
      color: colors[(Math.random() * colors.length) | 0],
      size: (size || 2.4) * (0.6 + Math.random() * 0.9)
    });
  }
}

function floater(x, y, text, color) {
  S.floaters.push({ x, y, text, color: color || "#ffe27a", life: 1.1 });
}

function damageComet(why) {
  Sound.hit();
  S.shake = 14;
  burst(S.comet.x, S.comet.y, 34, ["#ff9a5c", "#ffd76e", "#ff5c5c", "#ffffff"], 230, 0.8, 3);
  S.hull -= 1;
  if (S.hull <= 0) {
    S.screen = "over";
    Sound.lose();
    return;
  }
  floater(S.comet.x, S.comet.y - 18, why === "sun" ? "SUNBURN! -1 HULL" : "LOST IN THE VOID! -1 HULL", "#ff8f8f");
  const L = LEVELS[S.levelIdx];
  S.comet.x = L.start.x; S.comet.y = L.start.y;
  S.comet.vx = 0; S.comet.vy = 0; S.comet.flying = false;
  S.dragging = false;
}

function stepComet(dt) {
  const c = S.comet;
  const L = LEVELS[S.levelIdx];
  const g = gravityAt(c.x, c.y, L.planets);
  c.vx += g.ax * dt;
  c.vy += g.ay * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;

  // Trail particles
  S.particles.push({
    x: c.x + (Math.random() - 0.5) * 4, y: c.y + (Math.random() - 0.5) * 4,
    vx: -c.vx * 0.12 + (Math.random() - 0.5) * 22, vy: -c.vy * 0.12 + (Math.random() - 0.5) * 22,
    life: 0.55, maxLife: 0.55, color: Math.random() < 0.5 ? "#7ce7ff" : "#b78cff", size: 2.6
  });

  // Planet bounce (planets are solid but forgiving — no hull loss)
  for (const p of L.planets) {
    const dx = c.x - p.x, dy = c.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const min = p.r + c.r;
    if (d < min) {
      const nx = dx / d, ny = dy / d;
      c.x = p.x + nx * min; c.y = p.y + ny * min;
      const vn = c.vx * nx + c.vy * ny;
      if (vn < 0) {
        c.vx -= (1.55) * vn * nx;
        c.vy -= (1.55) * vn * ny;
        c.vx *= 0.92; c.vy *= 0.92;
        if (Math.abs(vn) > 90) { Sound.bounce(); burst(c.x, c.y, 6, ["#ffffff", p.c1], 90, 0.35, 1.8); }
      }
    }
  }

  // Suns burn
  for (const s of L.suns) {
    if (Math.hypot(c.x - s.x, c.y - s.y) < s.r + c.r - 3) { damageComet("sun"); return; }
  }

  // Drifting into the void
  if (c.x < -70 || c.x > W + 70 || c.y < -70 || c.y > H + 70) { damageComet("void"); return; }

  // Shard pickup
  for (const sh of S.shards) {
    if (sh.taken) continue;
    const pos = shardPos(sh, S.levelTime);
    if (Math.hypot(c.x - pos.x, c.y - pos.y) < 24) {
      sh.taken = true;
      S.score += 100;
      Sound.pickup();
      burst(pos.x, pos.y, 16, ["#ffe27a", "#fff6c9", "#ffb35c"], 150, 0.6, 2.4);
      floater(pos.x, pos.y - 16, "+100", "#ffe27a");
      if (S.shards.every(s2 => s2.taken) && !S.gate.openPlayed) {
        S.gate.open = true; S.gate.openPlayed = true;
        Sound.gateOpen();
        floater(S.gate.x, S.gate.y - 34, "GATE OPEN!", "#7dffb0");
      }
    }
  }

  // Exit gate
  if (S.gate.open && Math.hypot(c.x - S.gate.x, c.y - S.gate.y) < 30) {
    const hullBonus = S.hull * 150;
    const speedBonus = Math.max(0, 600 - Math.floor(S.levelTime) * 12);
    S.lastBonus = { hull: hullBonus, speed: speedBonus, total: hullBonus + speedBonus };
    S.score += S.lastBonus.total;
    burst(S.gate.x, S.gate.y, 46, ["#7dffb0", "#7ce7ff", "#ffffff"], 260, 0.9, 3);
    if (S.levelIdx >= LEVELS.length - 1) {
      S.screen = "win";
      Sound.win();
    } else {
      S.screen = "clear";
      Sound.clear();
    }
    c.flying = false;
  }
}

// Predicted trajectory for the slingshot aim (planets only, dotted line).
function predictPath(x, y, vx, vy) {
  const pts = [];
  const L = LEVELS[S.levelIdx];
  let px = x, py = y, pvx = vx, pvy = vy;
  const dt = 1 / 30;
  for (let i = 0; i < 110; i++) {
    const g = gravityAt(px, py, L.planets);
    pvx += g.ax * dt; pvy += g.ay * dt;
    px += pvx * dt; py += pvy * dt;
    if (i % 3 === 0) pts.push({ x: px, y: py });
    let stop = false;
    for (const p of L.planets) if (Math.hypot(px - p.x, py - p.y) < p.r + 6) stop = true;
    for (const s of L.suns) if (Math.hypot(px - s.x, py - s.y) < s.r + 4) stop = true;
    if (px < -20 || px > W + 20 || py < -20 || py > H + 20) stop = true;
    if (stop) break;
  }
  return pts;
}

// ---------- Update ----------
function update(dt) {
  S.time += dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30);

  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt;
    if (p.life <= 0) { S.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.985; p.vy *= 0.985;
  }
  for (let i = S.floaters.length - 1; i >= 0; i--) {
    const f = S.floaters[i];
    f.life -= dt; f.y -= 26 * dt;
    if (f.life <= 0) S.floaters.splice(i, 1);
  }

  if (S.screen !== "play" || S.paused) return;
  S.levelTime += dt;

  // Gate drift (final level)
  if (S.gate.drift) {
    const off = Math.sin(S.gate.drift.phase + S.levelTime * S.gate.drift.speed) * S.gate.drift.amp;
    S.gate.x = S.gate.baseX;
    S.gate.y = S.gate.baseY + off;
  }

  if (S.comet.flying) {
    // Sub-step for stable gravity at high speeds
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      stepComet(dt / steps);
      if (!S.comet.flying || S.screen !== "play") break;
    }
  }
}

// ---------- Drawing helpers ----------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(x, y, w, h, label, action, primary) {
  const hover = S.mouse.x >= x && S.mouse.x <= x + w && S.mouse.y >= y && S.mouse.y <= y + h;
  S.buttons.push({ x, y, w, h, action });
  ctx.save();
  ctx.shadowColor = primary ? "rgba(80,200,255,0.8)" : "rgba(120,140,255,0.5)";
  ctx.shadowBlur = hover ? 22 : 12;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  if (primary) { grad.addColorStop(0, hover ? "#3fd0ff" : "#2aa8e0"); grad.addColorStop(1, hover ? "#2a7fe0" : "#1c5fb8"); }
  else { grad.addColorStop(0, "rgba(40,52,96,0.95)"); grad.addColorStop(1, "rgba(22,30,62,0.95)"); }
  ctx.fillStyle = grad;
  roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(190,220,255,0.55)";
  ctx.lineWidth = 1.5;
  roundRect(x, y, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 19px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#070b24");
  grad.addColorStop(0.55, "#0a1030");
  grad.addColorStop(1, "#160b2e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  for (const n of NEBULAE) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, n.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }

  // Parallax: layers drift slowly with time and lean against comet velocity
  for (const layer of starLayers) {
    for (const st of layer.stars) {
      const driftX = (S.time * 2.2 * layer.par + (S.comet.flying ? -S.comet.vx * 0.03 * layer.par : 0)) % W;
      let x = st.x - driftX; if (x < 0) x += W;
      const tw = 0.55 + 0.45 * Math.sin(S.time * st.ts + st.tw);
      ctx.globalAlpha = layer.alpha * tw;
      ctx.fillStyle = "#dfeaff";
      ctx.beginPath();
      ctx.arc(x, st.y, layer.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(p) {
  ctx.save();
  // Soft outer glow
  ctx.shadowColor = p.c1;
  ctx.shadowBlur = 26;
  const g = ctx.createRadialGradient(p.x - p.r * 0.38, p.y - p.r * 0.38, p.r * 0.1, p.x, p.y, p.r * 1.05);
  g.addColorStop(0, p.c1);
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Craters / surface shading, clipped to the disc
  ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.13)";
  const craters = [[-0.3, 0.25, 0.22], [0.35, -0.1, 0.16], [0.05, 0.45, 0.13], [-0.45, -0.3, 0.12]];
  for (const [cx, cy, cr] of craters) {
    ctx.beginPath();
    ctx.arc(p.x + cx * p.r, p.y + cy * p.r, cr * p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const shade = ctx.createLinearGradient(p.x, p.y - p.r, p.x, p.y + p.r);
  shade.addColorStop(0, "rgba(255,255,255,0.20)");
  shade.addColorStop(0.5, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.30)");
  ctx.fillStyle = shade;
  ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  ctx.restore();

  if (p.ring) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.32);
    ctx.scale(1, 0.34);
    ctx.strokeStyle = "rgba(255,235,190,0.75)";
    ctx.lineWidth = 5;
    ctx.shadowColor = "rgba(255,220,150,0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 1.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 1.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSun(s) {
  const pulse = 1 + Math.sin(S.time * 3.1 + s.x) * 0.05;
  ctx.save();
  const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.6 * pulse);
  g.addColorStop(0, "rgba(255,240,200,0.95)");
  g.addColorStop(0.25, "rgba(255,140,60,0.75)");
  g.addColorStop(0.55, "rgba(255,60,40,0.30)");
  g.addColorStop(1, "rgba(255,40,30,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * 2.6 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "#ff6a3d";
  ctx.shadowBlur = 24;
  const core = ctx.createRadialGradient(s.x - s.r * 0.3, s.y - s.r * 0.3, 1, s.x, s.y, s.r);
  core.addColorStop(0, "#fff3c4");
  core.addColorStop(0.6, "#ffb35c");
  core.addColorStop(1, "#f0512a");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStarShape(x, y, r, rot, fill, glow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.shadowColor = glow || "#ffd94d";
  ctx.shadowBlur = 14;
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGate() {
  const gt = S.gate;
  const active = gt.open;
  const pulse = 1 + Math.sin(S.time * 2.6) * 0.06;
  ctx.save();
  ctx.translate(gt.x, gt.y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = active ? "#3dff8e" : "rgba(140,160,200,0.6)";
  ctx.shadowBlur = active ? 26 : 8;
  ctx.strokeStyle = active ? "#5cff9d" : "rgba(150,170,210,0.55)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = active ? "rgba(160,255,205,0.8)" : "rgba(150,170,210,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 17, S.time * (active ? 1.6 : 0.4), S.time * (active ? 1.6 : 0.4) + Math.PI * 1.4);
  ctx.stroke();
  if (active) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    g.addColorStop(0, "rgba(120,255,180,0.5)");
    g.addColorStop(1, "rgba(120,255,180,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.font = "600 11px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = active ? "#8fffbe" : "rgba(170,190,225,0.7)";
  ctx.fillText(active ? "EXIT" : "LOCKED", gt.x, gt.y + 42);
  ctx.restore();
}

function drawComet() {
  const c = S.comet;
  // Particles first (under everything else drawn later in entity pass order)
  for (const p of S.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Launch pad marker while aiming
  if (!c.flying && S.screen === "play") {
    ctx.save();
    ctx.strokeStyle = "rgba(140,200,255,0.5)";
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 17 + Math.sin(S.time * 3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = "#6ee7ff";
  ctx.shadowBlur = 22;
  const g = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, c.r + 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, "#aee9ff");
  g.addColorStop(1, "#3d8bff");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAim() {
  if (!S.dragging || S.comet.flying || S.screen !== "play") return;
  const c = S.comet;
  const dx = c.x - S.dragX, dy = c.y - S.dragY;
  const len = Math.hypot(dx, dy);
  if (len < 8) return;
  const cap = 165;
  const scale = Math.min(len, cap) / len;
  const vx = dx * scale * 3.6, vy = dy * scale * 3.6;

  // Slingshot band
  ctx.save();
  ctx.strokeStyle = "rgba(255,220,130,0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(S.dragX, S.dragY);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,220,130,0.9)";
  ctx.beginPath();
  ctx.arc(S.dragX, S.dragY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Dotted predicted trajectory (gravity-aware)
  const pts = predictPath(c.x, c.y, vx, vy);
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < pts.length; i++) {
    ctx.globalAlpha = Math.max(0.08, 0.85 - i / pts.length * 0.75);
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Power meter
  const power = Math.min(len, cap) / cap;
  ctx.fillStyle = "rgba(10,16,40,0.7)";
  roundRect(c.x - 32, c.y + 22, 64, 8, 4); ctx.fill();
  ctx.fillStyle = power > 0.75 ? "#ff7a5c" : power > 0.4 ? "#ffd76e" : "#7ce7ff";
  roundRect(c.x - 32, c.y + 22, 64 * power, 8, 4); ctx.fill();
  ctx.restore();
}

function drawHUD() {
  const L = LEVELS[S.levelIdx];
  ctx.save();
  // Top bar backdrop
  ctx.fillStyle = "rgba(6,10,28,0.55)";
  roundRect(10, 10, W - 20, 44, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(130,170,255,0.25)";
  ctx.lineWidth = 1;
  roundRect(10, 10, W - 20, 44, 12);
  ctx.stroke();

  ctx.textBaseline = "middle";
  // Hearts (hull)
  for (let i = 0; i < 3; i++) {
    const x = 34 + i * 26, y = 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.85, 0.85);
    ctx.fillStyle = i < S.hull ? "#ff5c7a" : "rgba(255,92,122,0.18)";
    if (i < S.hull) { ctx.shadowColor = "#ff5c7a"; ctx.shadowBlur = 8; }
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-13, -2, -8, -12, 0, -5);
    ctx.bezierCurveTo(8, -12, 13, -2, 0, 9);
    ctx.fill();
    ctx.restore();
  }
  // Score
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SCORE " + S.score, 128, 33);
  // Level
  ctx.textAlign = "center";
  ctx.fillStyle = "#aee9ff";
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("LEVEL " + (S.levelIdx + 1) + " / " + LEVELS.length + "  ·  " + L.name.toUpperCase(), W / 2 + 30, 33);
  // Shards remaining
  const left = S.shards.filter(s => !s.taken).length;
  drawStarShape(W - 118, 32, 9, S.time * 1.5, "#ffd94d");
  ctx.fillStyle = "#ffe9a3";
  ctx.font = "700 17px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("x " + left, W - 102, 33);
  // Mute button
  const mx = W - 52, my = 20, mw = 28, mh = 24;
  S.buttons.push({ x: mx, y: my, w: mw, h: mh, action: "mute" });
  ctx.fillStyle = "rgba(40,52,96,0.8)";
  roundRect(mx, my, mw, mh, 7); ctx.fill();
  ctx.fillStyle = "#cfe3ff";
  ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(Sound.muted ? "✕" : "♪", mx + mw / 2, my + mh / 2 + 1);
  ctx.restore();
}

// ---------- Screens ----------
function drawTitle() {
  ctx.save();
  ctx.textAlign = "center";
  // Decorative comet streak
  const cx = W / 2 + Math.sin(S.time * 0.7) * 8, cy = 118;
  ctx.shadowColor = "#6ee7ff"; ctx.shadowBlur = 30;
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 26);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#aee9ff"); g.addColorStop(1, "rgba(61,139,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 74px 'Segoe UI', system-ui, sans-serif";
  ctx.shadowColor = "rgba(90,160,255,0.9)"; ctx.shadowBlur = 26;
  ctx.fillText("K O M E T A", W / 2, 205);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd76e";
  ctx.font = "600 24px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("S T A R F A L L   C O U R I E R", W / 2, 244);

  ctx.fillStyle = "rgba(210,228,255,0.92)";
  ctx.font = "16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Drag the comet like a slingshot. Bend your flight around the planets,", W / 2, 300);
  ctx.fillText("collect every star shard, then dive through the glowing exit gate.", W / 2, 324);
  ctx.fillStyle = "rgba(255,150,130,0.9)";
  ctx.fillText("Red suns burn your hull — and the void is hungry. You have 3 hull. Good luck, courier.", W / 2, 348);

  drawButton(W / 2 - 105, 386, 210, 54, "▶  PLAY", "play", true);
  ctx.fillStyle = "rgba(160,185,230,0.6)";
  ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Mouse to aim & launch · P pause · R restart level · M mute", W / 2, 478);
  ctx.restore();
}

function panel(w, h) {
  const x = (W - w) / 2, y = (H - h) / 2;
  ctx.save();
  ctx.fillStyle = "rgba(5,8,24,0.78)";
  ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = "rgba(70,130,255,0.55)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "rgba(13,20,48,0.97)";
  roundRect(x, y, w, h, 18); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(140,180,255,0.5)";
  ctx.lineWidth = 1.5;
  roundRect(x, y, w, h, 18); ctx.stroke();
  ctx.restore();
  return { x, y };
}

function drawClear() {
  const { x, y } = panel(430, 300);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#7dffb0";
  ctx.font = "800 34px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("LEVEL CLEAR!", W / 2, y + 62);
  ctx.fillStyle = "#dfeaff";
  ctx.font = "17px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(LEVELS[S.levelIdx].name + " complete", W / 2, y + 96);
  ctx.font = "16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "rgba(210,228,255,0.9)";
  ctx.fillText("Hull bonus        +" + S.lastBonus.hull, W / 2, y + 140);
  ctx.fillText("Speed bonus      +" + S.lastBonus.speed, W / 2, y + 168);
  ctx.fillStyle = "#ffd76e";
  ctx.font = "700 20px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("SCORE  " + S.score, W / 2, y + 206);
  drawButton(W / 2 - 95, y + 226, 190, 48, "NEXT LEVEL ▶", "next", true);
  ctx.restore();
}

function drawWin() {
  const { y } = panel(470, 320);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd76e";
  ctx.font = "800 38px 'Segoe UI', system-ui, sans-serif";
  ctx.shadowColor = "rgba(255,200,60,0.8)"; ctx.shadowBlur = 22;
  ctx.fillText("DELIVERY COMPLETE!", W / 2, y + 70);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#dfeaff";
  ctx.font = "17px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Every shard delivered across all " + LEVELS.length + " sectors.", W / 2, y + 112);
  ctx.fillText("The Starfall route is yours, courier.", W / 2, y + 138);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("FINAL SCORE  " + S.score, W / 2, y + 192);
  ctx.fillStyle = "rgba(210,228,255,0.85)";
  ctx.font = "15px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Launches used: " + S.shots + "   ·   Hull remaining: " + S.hull, W / 2, y + 224);
  drawButton(W / 2 - 95, y + 246, 190, 48, "↻  PLAY AGAIN", "again", true);
  ctx.restore();
}

function drawOver() {
  const { y } = panel(440, 300);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff7a6e";
  ctx.font = "800 38px 'Segoe UI', system-ui, sans-serif";
  ctx.shadowColor = "rgba(255,80,60,0.8)"; ctx.shadowBlur = 22;
  ctx.fillText("COMET DOWN", W / 2, y + 70);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#dfeaff";
  ctx.font = "17px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Your hull gave out in " + LEVELS[S.levelIdx].name + ".", W / 2, y + 112);
  ctx.fillText("The shards scatter back into the dark…", W / 2, y + 138);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 26px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("SCORE  " + S.score, W / 2, y + 188);
  drawButton(W / 2 - 95, y + 216, 190, 48, "↻  TRY AGAIN", "again", true);
  ctx.restore();
}

function drawPaused() {
  ctx.save();
  ctx.fillStyle = "rgba(4,6,18,0.66)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("PAUSED", W / 2, H / 2 - 8);
  ctx.fillStyle = "rgba(210,228,255,0.85)";
  ctx.font = "16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Press P or Esc to resume", W / 2, H / 2 + 28);
  ctx.restore();
}

// ---------- Render ----------
function render() {
  S.buttons = []; // rebuilt every frame by whichever screen/HUD draws
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
  drawBackground();

  if (S.screen === "title") {
    drawTitle();
  } else {
    const L = LEVELS[S.levelIdx];
    for (const p of L.planets) drawPlanet(p);
    for (const s of L.suns) drawSun(s);
    drawGate();
    for (const sh of S.shards) {
      if (sh.taken) continue;
      const pos = shardPos(sh, S.levelTime);
      drawStarShape(pos.x, pos.y, 11, S.time * 2 + sh.spin, "#ffd94d");
      drawStarShape(pos.x, pos.y, 4.5, S.time * 2 + sh.spin, "#fff6c9", "rgba(0,0,0,0)");
    }
    drawAim();
    drawComet();
    // Floaters
    for (const f of S.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
    // Level tip (first seconds of a level, while aiming)
    if (!S.comet.flying && S.levelTime < 6 && S.screen === "play") {
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(220,235,255," + (S.levelTime > 5 ? (6 - S.levelTime) : 0.9) + ")";
      ctx.font = "italic 16px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(L.tip, W / 2, H - 22);
      ctx.restore();
    }
    drawHUD();
    if (S.screen === "clear") drawClear();
    if (S.screen === "win") drawWin();
    if (S.screen === "over") drawOver();
    if (S.paused && S.screen === "play") drawPaused();
  }
  ctx.restore();
}

// ---------- Input ----------
function toGamePos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (W / rect.width),
    y: (evt.clientY - rect.top) * (H / rect.height)
  };
}

canvas.addEventListener("mousemove", e => {
  const p = toGamePos(e);
  S.mouse.x = p.x; S.mouse.y = p.y;
  if (S.dragging) { S.dragX = p.x; S.dragY = p.y; }
});

canvas.addEventListener("mousedown", e => {
  Sound.ensure();
  const p = toGamePos(e);
  S.mouse.x = p.x; S.mouse.y = p.y; S.mouse.down = true;
  // Buttons take priority
  for (const b of S.buttons) {
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      handleAction(b.action);
      return;
    }
  }
  if (S.screen === "play" && !S.paused && !S.comet.flying) {
    if (Math.hypot(p.x - S.comet.x, p.y - S.comet.y) < 64) {
      S.dragging = true;
      S.dragX = p.x; S.dragY = p.y;
    }
  }
});

window.addEventListener("mouseup", () => {
  S.mouse.down = false;
  if (S.dragging) {
    S.dragging = false;
    const c = S.comet;
    const dx = c.x - S.dragX, dy = c.y - S.dragY;
    const len = Math.hypot(dx, dy);
    if (len >= 8 && S.screen === "play" && !S.comet.flying) {
      const cap = 165;
      const scale = Math.min(len, cap) / len;
      c.vx = dx * scale * 3.6;
      c.vy = dy * scale * 3.6;
      c.flying = true;
      S.shots += 1;
      Sound.launch();
      burst(c.x, c.y, 10, ["#aee9ff", "#ffffff"], 110, 0.4, 2);
    }
  }
});

canvas.addEventListener("mouseleave", () => { if (S.dragging) { S.dragging = false; } });

function handleAction(action) {
  Sound.ensure();
  if (action === "mute") { Sound.muted = !Sound.muted; return; }
  Sound.click();
  if (action === "play") { resetRun(); S.screen = "play"; }
  else if (action === "next") { loadLevel(S.levelIdx + 1); S.screen = "play"; }
  else if (action === "again") { resetRun(); S.screen = "play"; }
}

window.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k === "m") { Sound.ensure(); Sound.muted = !Sound.muted; }
  if (k === "p" || k === "escape") {
    if (S.screen === "play") S.paused = !S.paused;
  }
  if (k === "r") {
    if (S.screen === "play" || S.screen === "clear") {
      // Restart current level; a fresh attempt costs the run nothing but time.
      const keepScore = S.score, keepHull = S.hull;
      loadLevel(S.levelIdx);
      S.score = keepScore; S.hull = keepHull;
      S.screen = "play";
    } else if (S.screen === "over" || S.screen === "win") {
      resetRun(); S.screen = "play";
    }
  }
  if (k === "enter" || k === " ") {
    if (S.screen === "title") { Sound.ensure(); resetRun(); S.screen = "play"; }
    else if (S.screen === "clear") { loadLevel(S.levelIdx + 1); S.screen = "play"; }
    else if (S.screen === "win" || S.screen === "over") { resetRun(); S.screen = "play"; }
  }
});

// ---------- Main loop ----------
resetRun();
let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.033, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
