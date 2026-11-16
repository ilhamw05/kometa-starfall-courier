# KOMETA: Starfall Courier

## Pitch

You are the last courier of the Starfall route, and your ship is a comet. With nothing but a slingshot launch and the gravity of the planets themselves, you bend impossible arcs through deep space — scooping up lost star shards and diving through the exit gate before the suns, and the void, take your hull apart. Five handcrafted sectors, pure physics, no two flights ever quite the same.

## How to play

1. **Aim** — press and hold the mouse on (or near) the comet and drag back, like pulling a slingshot. A dotted line previews your flight path *including planetary gravity*, and a power meter shows launch strength.
2. **Launch** — release the mouse. The comet flies, and every planet along the way bends its path with gravity. Planets are solid: you will bounce off them (gently — it costs nothing).
3. **Collect** — fly through every golden **star shard** in the level (+100 points each). When the last shard is collected, the exit gate lights up green.
4. **Exit** — fly through the glowing **exit gate** to clear the level and earn bonuses.
5. **Survive** — touching a **red sun**, or drifting off the edge of space into the void, costs **1 hull**. You have 3 hull for the whole run. Lose them all and the run ends.

## Controls

| Input | Action |
|---|---|
| Mouse drag on the comet | Aim (slingshot) |
| Mouse release | Launch |
| Mouse click | Buttons (Play / Next Level / Play Again / mute) |
| `P` or `Esc` | Pause / resume |
| `R` | Restart current level (on end screens: restart the run) |
| `M` | Mute / unmute sound |
| `Enter` / `Space` | Confirm on title and end screens |

## Level, win & lose structure

- **5 handcrafted levels** of rising difficulty: *First Flight* (one planet, learn the slingshot) → *Twin Pull* (two planets, first sun) → *Sun Alley* (three planets, two suns) → *The Drift* (shards that orbit and drift) → *Starfall Run* (four planets, three suns, moving shards **and a moving exit gate**).
- **Win:** clear level 5 to reach the "Delivery Complete" screen with your final score, launches used, and hull remaining.
- **Lose:** hull reaches 0 (sun hits and void drifts) → "Comet Down" game-over screen with your score and a retry button.
- **Level-clear screen** after each of levels 1–4, showing the bonus breakdown.

## Scoring

- Star shard: **+100**
- Level clear — hull bonus: **+150 per remaining hull**
- Level clear — speed bonus: **+600, minus 12 per second** spent in the level (floor 0). Fast, clean runs score highest.

## Features

- Slingshot aiming with a **gravity-aware dotted trajectory preview** and power meter
- Custom gravity simulation (softened inverse falloff, sub-stepped physics) — slingshot around planets, bounce off their surfaces
- Particle comet trail, explosion bursts, floating score text, screen shake
- Parallax 3-layer twinkling starfield with nebula gradients
- Glowing gradient planets (some ringed), pulsing suns, rotating star shards, animated exit gate
- Procedural WebAudio sound: launch, pickup, bounce, hit, gate-open, level-clear, win and lose jingles — **zero audio files**
- Full screen flow: title → play → level clear → win / game over, plus pause and mute
- Retina-crisp rendering via `devicePixelRatio` scaling; runs fully offline

## Tech notes

- Plain HTML5 canvas + vanilla JavaScript. **No frameworks, no CDNs, no external fonts, images, or network requests** — all art is drawn in code, all sound is synthesized.
- Fixed logical resolution of 960×540, scaled by CSS; internal resolution scales with `devicePixelRatio` (capped at 2.5) for crisp lines on retina displays.
- Desktop keyboard + mouse required (per the bounty spec).
- `main.ts` is a minimal Node 22 build helper (only `node:fs` / `node:path`) that copies `game/` into `out/`; the game itself needs no build step.

## File layout

```
.
├── main.ts            # build helper: copies game/ → out/
├── LICENSE            # MIT
├── README.md          # this dossier
├── screenshots/       # screenshots added at submission time
└── game/
    ├── index.html     # page shell — open this to play
    ├── style.css      # page chrome (the game renders on canvas)
    └── game.js        # all game logic, art, and sound
```

## Running it

Open `game/index.html` in a desktop browser (Chrome recommended). That's it — no server, no install, no network.
