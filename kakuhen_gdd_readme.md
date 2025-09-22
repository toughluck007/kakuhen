# Kakuhen (確変)

*A roguelite pachinko x procedural-pipes art toy*

> **Goal**: Deliver a spectacle-first prototype (p5.js WebGL + 2D physics) with a clear loop: Drop → Peg FX → Pipes Grow → Showcase → Compress → Slot Upgrades → Next Round. Keep systems modular for rapid iteration.

---

## 0) Tech & Packaging

**Language:** TypeScript (preferred) or JavaScript.

**Runtime/Libraries:**

- **p5.js** (rendering; WEBGL for pipes, 2D for board) + **p5.sound** (SFX)
- **Matter.js** (2D physics for Pachinko board; deterministic with seeded RNG)
- **seedrandom** (deterministic runs/seeds)
- (Optional) **gl-matrix** for math helpers in WEBGL pipes
- (Optional) **GSAP** for UI transitions (or homegrown tween utilities)

**Build/Tooling:**

- **Vite** (TS template) for fast dev + bundling
- **ESLint + Prettier**

**Desktop Packaging:**

- **Tauri** (fast, small) or **Electron** (wider ecosystem). Both wrap the Vite build without code changes.

**Repo Structure:**

```
/kakuhen
  /src
    main.ts        // bootstrap, scenes
    state.ts       // game state machines, RNG seeds
    ui.ts          // transitions, overlays, slot machine
    board/         // pachinko board (p5 2D + Matter.js)
      board.ts
      pegs.ts
      balls.ts
    pipes/         // pipes view (p5 WEBGL)
      pipes.ts
      materials.ts
      scoring.ts
    data/          // config tables (JSON/TS)
      pegs.ts
      balls.ts
      upgrades.ts
    assets/        // sfx, minimal sprites
  index.html
  vite.config.ts
```

---

## 1) High Concept & Pillars

- **Chance + Agency**: physics chaos, targeted upgrades.
- **Visual Spectacle**: chrome balls + glowing pipes.
- **Compression Dopamine**: collapse art into points/coins.
- **Replayability**: seeded boards, upgrade synergies, escalating targets.

---

## 2) Core Loop (Player-Facing)

1. **Drop Phase** (Split view):
   - Left/top: Pachinko board (2D). Right/bottom: Pipes (WEBGL).
   - Each peg hit triggers a **Pipe Effect** event.
2. **Showcase** (Pipes fullscreen):
   - Per-type breakdown → Total Points → Coin bonus.
3. **Compression**:
   - Pipes pulse → implode → crystal → particles → counters.
4. **Slot Upgrades**:
   - 3 upgrade cards roll; 1 free pick; rerolls cost **coins**.
5. **Next Round**:
   - New target threshold; board persists with upgrades.

---

## 3) Game Modes (v1)

- **Runs**: 6–10 rounds per run. Point target scales each round.
- **End**: Fail to meet target → run ends; earn meta tokens (future).
- **Seeded Daily** (later): same seed for all players, leaderboard.

---

## 4) Systems & Data

### 4.1 RNG & Determinism

- `seed = hash(date or user-seed)` → `seedrandom(seed)` for: peg layout, upgrade offers, ball spawns.
- Physics replays won’t be exact cross-device; keep *content* deterministic, not microscopic integrator steps.

### 4.2 Scoring & Currencies

- **Points (P)**: must beat round target to progress.
- **Coins (C)**: spend on rerolls/upgrades.
- **Pipe Value**: per pipe `Base(type) * Length^α * (1 + Σmultipliers)`.

**Defaults (tuneable):**

```
Base(type): Glass=20, Glow=18, Chrome=15, Standard=12
Length: total world-units grown (smoothed)
α (length exponent): 0.85 (sublinear to curb runaway)  
Global multipliers: e.g., Showcase bonus +X%, Streak +Y%
```

**Round Reward:**

```
Points = Σ pipes Value  
Coins  = floor(Points / 50) + CoinPegHits + OverkillBonus
Target(round r) = 400 * r^1.35  // sample curve
```

---

## 5) Pachinko Board (2D)

**Physics:** Matter.js world with gravity (y+). World bounds at sides/bottom.\
**Pegs:** Static circles with categories/tags; AABB triggers for hits.\
**Balls:** Dynamic circles; restitution, friction, density vary by ball type.

**Board Layouts:**

- v1: Hex/offset grid (quincunx).
- Later: moving pegs, random scatter, water barrier.

**Hit Pipeline:**

1. Matter collision → `onPegHit(pegId, ballId)`
2. Increment peg combo
3. Emit **PipeEffect** event with payload (peg tags, magnitudes)

**Baseline Peg Types:**

- *Multiplier*: +x% to next pipe valuation window.
- *Grow+*: add `growthImpulse` to active pipe(s).
- *Fork*: spawn new pipe head with material tag.
- *Banker*: +coins per hit.
- *Spring/Magnet*: physics-only (alter ball trajectory).
- *Cursed*: −% value until cleansed (upgrade).

---

## 6) Pipes View (p5 WEBGL)

**Representation:** list of **PipeHeads**, each with a polyline path; mesh is rebuilt incrementally (tube along path).

**Grid/Bounds:** cubic bounds (e.g., 40u). Directions constrained to axis-aligned; occasional turns based on bias table.

**Growth Tick (at \~60 Hz or throttled):**

```
for each PipeHead:
  vNext = turnBias(dir) ? chooseNewAxis(dir) : dir
  pNext = clamp(p + vNext * step, bounds)
  append pNext to path; if collision/clamp, rotate axis
  length += step; material effects apply (glow, glass, chrome)
```

**Materials (visual + scoring tags):**

- **Standard**: matte, base value.
- **Glow**: emissive + bloom style (post fx simulated via additive passes)
- **Glass**: transmission-like (fake via fresnel + env cube)
- **Chrome**: specular highlight (fake env reflect).

**Performance Notes:**

- Maintain **vertex budget**: cap segments per pipe; merge to single VBO per material when possible.
- Rebuild only the **last segment** each tick; keep previous meshes static.
- LOD: reduce radial segments at distance.
- Use `requestAnimationFrame` paced updates; decimate to 30 Hz on low FPS.

---

## 7) Events: Peg → Pipe Effects

**Event payload:**

```
PipeEffect {
  type: 'GROW'|'RETRACT'|'FORK'|'MATERIAL'|'MULT'|'COIN'|'BIAS'|'EXPLODE',
  magnitude: number,
  material?: 'glass'|'glow'|'chrome'|'standard',
  bias?: 'x'|'y'|'z'|'none',
  durationMs?: number,
  sourcePegId: string,
}
```

**Effect rules (v1):**

- **GROW**: +stepMultiplier for `durationMs`
- **RETRACT**: delete N tail segments (min length floor)
- **FORK**: spawn new PipeHead at last node (inherit dir or rotate 90°)
- **MATERIAL**: switch material, tag for scoring
- **MULT**: +global pipe multiplier stack (decays over time)
- **COIN**: +coins immediately
- **BIAS**: axis bias weight += magnitude
- **EXPLODE**: radial mini-pipes; capped by `maxChildren`.

---

## 8) UI/UX

**Views:**

- **Split** (Board | Pipes)
- **Showcase** (Pipes full) with breakdown list and animated tally
- **Compression** sequence (1–2s)
- **Slot Machine** (3 upgrade cards + reroll)

**Transitions:** slide board out, scale pipes up, fade overlays; tween with GSAP or custom lerp.

**HUD Minimal:**

- Top-left: Balls remaining
- Top-right: Score (Points)
- Bottom-right: Coins
- Toasts for peg hits (“Fork +1”, “Glass +x1.5”).

---

## 9) Upgrades (Slot Machine)

**Delivery:**

- 1 free selection; reroll costs `5 + 5*rerollCount` coins
- (Meta) Add 4th slot; cheaper rerolls; rarities.

**Card Schema:**

```
UpgradeCard {
  id: string,
  rarity: 'C'|'U'|'R'|'E',
  target: 'peg'|'ball'|'board'|'pipes'|'global',
  effect: EffectDescriptor,
  costCoins?: number,
  tags?: string[],
}
```

**Examples:**

- **Peg**: *Banker+* (+1 coin per hit), *Fork+* (spawn 2 heads), *Sanctify* (negatives become +10%).
- **Ball**: +1 ball; *Clusterball* (split after 6 hits); *Bouncy+*.
- **Board**: +10% width; +1 row of pegs; radial bumper at mid.
- **Pipes**: Glow value +25%; Glass value +15% but −10% growth; Bias to Y+.
- **Global**: Showcase bonus +10%; Compression yields +1 coin per 200 pts.

---

## 10) Round Targets & Difficulty

```
Round r: TargetP = base * r^curve
base=400, curve=1.35 (tune)
Fail window: if Points < TargetP → end run
Overkill: (Points-TargetP) → bonus coins
```

**Enemy/Curses (later):** pegs flip to negative for 1 round; gravity +15%; board tilt.

---

## 11) SFX/Music (stub)

- Peg hit: short metallic *tink*
- Grow tick: subtle *whirr*
- Showcase: pad swell
- Compression: *whoomph* + glassy crackle
- Slot: mechanical click/ka-chunk

---

## 12) MVP Slice (2–3 weeks)

**Week 1**

- Vite + p5 + Matter scaffold; split view layout
- Static peg grid; drop single ball; peg hit events
- Pipes: 1–3 heads growing with GROW/FORK/MATERIAL

**Week 2**

- Showcase breakdown + Compression fake
- Slot machine UI with 6–9 upgrades (data-driven)
- Points/Coins rudiments; round target ramp

**Week 3**

- Ball types (Extra/Bouncy/Heavy); coin economy balance
- Performance pass (mesh budgets, decimation)
- Packaging to Tauri/Electron for testers

---

## 13) Pseudocode (select snippets)

**Bootstrap:**

```ts
initSeed(seedStr)
initP5Canvas2D('#board')
initP5CanvasWEBGL('#pipes')
world = Matter.Engine.create({ gravity: { x: 0, y: 1 } })
pegs = createPegGrid(seed)
balls = []
pipeSystem = createPipesSystem({ bounds: 40 })
state = 'DROP'
```

**On Peg Hit → Pipe Effect:**

```ts
function onPegHit(peg, ball) {
  const effects = resolvePegEffects(peg, ball, runModifiers)
  for (const e of effects) pipeSystem.apply(e)
  hud.toast(effects.map(e => e.type).join(', '))
}
```

**Pipe Tick:**

```ts
function tickPipes(dt) {
  for (const head of pipeSystem.heads) {
    head.timer += dt
    if (head.timer < head.growInterval) continue
    head.timer = 0
    const dir = chooseAxis(head.dir, head.bias)
    const next = clamp(add(head.pos, scale(dir, step)), bounds)
    head.path.push(next)
    head.length += step
    meshBuilder.updateTail(head) // only rebuild last tube segment
  }
}
```

**Showcase → Compression:**

```ts
const breakdown = scorePipes(pipeSystem)
points += breakdown.total
coins  += floor(breakdown.total/50) + breakdown.coinBonus
animateCompression(pipeSystem)
```

**Slot Machine:**

```ts
function rollUpgrades(seed, pool, n=3) {
  const rng = makeRNG(seed + run.round + rerolls)
  return sampleWeighted(pool, n, rng)
}

function applyUpgrade(card) {
  switch(card.target) {
    case 'peg': augmentPeg(card); break
    case 'ball': unlockBall(card); break
    case 'board': mutateBoard(card); break
    case 'pipes': tunePipeValues(card); break
    case 'global': runMods.push(card.effect); break
  }
}
```

---

## 14) Data Tables (starter)

**Balls:**

```
Standard: { restitution: 0.5, radius: 8 }
Heavy:    { restitution: 0.2, radius:10, density:+20% }
Bouncy:   { restitution: 0.85, radius: 7 }
Cluster:  { splitHits: 6, shards:4, shardRadius:5 }
```

**Materials (Pipe):**

```
Standard: base=12, step=1.0, visual='matte'
Glow:     base=18, step=0.9, visual='emissive'
Glass:    base=20, step=0.8, visual='fresnel+alpha'
Chrome:   base=15, step=1.0, visual='specular'
```

**Peg Tags → Effects:**

```
MULT(+15%)
GROW(+30% for 3s)
FORK(1)
BANK(+1c)
BIAS(Y+, weight+2)
CURSED(-10% until Sanctify)
SPRING(force=+X)
MAGNET(radius=R, strength=S)
```

---

## 15) Performance Targets

- 60 FPS desktop, 45 FPS laptop iGPU, 30 FPS mobile
- \~6–10 pipes, ≤ 2k segments total; LOD at distance
- Physics step 60 Hz; render at VSync; decimate pipes tick if <45 FPS

---

## 16) Risks & Mitigations

- **WEBGL glass/chrome in p5**: fake via fresnel/spec highlights; avoid heavy refraction.
- **Physics determinism**: don’t rely on exact replay; only seed content.
- **Mobile perf**: cap segments; reduce radial resolution.

---

## 17) Nice-to-Haves (Post-MVP)

- Water level (damped gravity zone, shader ripples)
- Moving pegs; board tilt
- Save/export final sculptures (image/gif)
- Daily seed + leaderboard

---

## 18) Definition of Done (Prototype)

- Split view with working physics + pipe growth
- 6+ peg effects mapped to visible pipe changes
- Showcase + compression animation with tally
- Slot machine UI with 9–12 upgrades
- Round targets + points/coins gates
- Packaged desktop build (Tauri or Electron)

