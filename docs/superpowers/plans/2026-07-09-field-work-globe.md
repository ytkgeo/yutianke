# Field Work Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible, continuously rotating field-site globe below the Field Work archive on `latest-updates.html`.

**Architecture:** A dependency-free ES module draws a canvas Earth and site markers from a latitude/longitude data array. The page supplies semantic controls and fallback text; CSS supplies the panel layout. The module pauses for hover, focus, marker selection, explicit pause, and reduced-motion preference.

**Tech Stack:** HTML5 canvas, native ES modules, CSS custom properties and media queries, Node built-in test runner.

## Global Constraints

- Reuse the published `assets/hydrobasins-map.js` asset; do not add a third-party map or WebGL library.
- Add the panel only to the Field Work section of `latest-updates.html`.
- Use ASCII source text.
- Default behavior is continuous rotation; hover, focus, or marker activation pauses it.
- Preserve usable controls, site names, and campaign years without canvas support.
- Honor `prefers-reduced-motion` by starting paused.
- Do not alter conference, invited-talk, publication, About, or CV content.

---

## File Structure

- Create: `assets/field-globe.js` - field-site data, geographic projection helpers, canvas rendering, input handling, and lifecycle.
- Create: `tests/field-globe.test.mjs` - unit tests for site data and geographic helpers.
- Modify: `latest-updates.html` - globe panel markup and module/data script order after the Field Work list.
- Modify: `assets/site-enhancements.css` - scoped panel, controls, labels, responsive layout, and reduced-motion styles.

### Task 1: Field-Site Data and Projection Helpers

**Files:**
- Create: `assets/field-globe.js`
- Create: `tests/field-globe.test.mjs`

**Interfaces:**
- Produces: `FIELD_SITES`, `projectFieldSite(site, rotation, radius)`, and `normalizeAngle(angle)`.
- Consumes: no DOM, network, or external dependency.

- [ ] **Step 1: Write the failing projection tests**

```js
// tests/field-globe.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FIELD_SITES, normalizeAngle, projectFieldSite } from "../assets/field-globe.js";

test("the globe has all seven field locations", () => {
  assert.equal(FIELD_SITES.length, 7);
  assert.deepEqual(FIELD_SITES.map((site) => site.id), [
    "huslia", "beaver", "alakanuk", "fuyuan", "pingliang", "baiyin-jingtai", "linxia",
  ]);
});

test("projection keeps a front-facing point visible and hides its far side", () => {
  const site = { latitude: 0, longitude: 0 };
  assert.equal(projectFieldSite(site, 0, 100).visible, true);
  assert.equal(projectFieldSite(site, Math.PI, 100).visible, false);
});

test("normalizeAngle keeps rotation within one full turn", () => {
  assert.equal(normalizeAngle(Math.PI * 3), -Math.PI);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `node --test tests/field-globe.test.mjs`

Expected: FAIL because `assets/field-globe.js` does not exist.

- [ ] **Step 3: Add the exported data and pure helpers**

```js
// assets/field-globe.js
export const FIELD_SITES = [
  { id: "huslia", label: "Huslia, Alaska", latitude: 65.7, longitude: -156.4, years: "2024, 2026" },
  { id: "beaver", label: "Beaver, Alaska", latitude: 66.4, longitude: -147.4, years: "2022, 2023" },
  { id: "alakanuk", label: "Alakanuk, Alaska", latitude: 62.7, longitude: -164.6, years: "2023" },
  { id: "fuyuan", label: "Fuyuan, China", latitude: 48.4, longitude: 134.3, years: "2018" },
  { id: "pingliang", label: "Pingliang, China", latitude: 35.5, longitude: 106.7, years: "2014, 2016" },
  { id: "baiyin-jingtai", label: "Baiyin and Jingtai, China", latitude: 37.2, longitude: 104.1, years: "2015" },
  { id: "linxia", label: "Linxia, China", latitude: 35.6, longitude: 103.2, years: "2015" },
];

export function normalizeAngle(angle) {
  return ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

export function projectFieldSite(site, rotation, radius) {
  const latitude = site.latitude * Math.PI / 180;
  const longitude = site.longitude * Math.PI / 180 + rotation;
  const depth = Math.cos(latitude) * Math.cos(longitude);
  return {
    x: radius + radius * Math.cos(latitude) * Math.sin(longitude),
    y: radius - radius * Math.sin(latitude),
    depth,
    visible: depth > 0.04,
  };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test tests/field-globe.test.mjs`

Expected: PASS with three passing subtests.

- [ ] **Step 5: Commit the data layer**

```bash
git add assets/field-globe.js tests/field-globe.test.mjs
git commit -m "feat: add field globe site data"
```

### Task 2: Canvas Renderer and Interaction Controller

**Files:**
- Modify: `assets/field-globe.js`
- Modify: `tests/field-globe.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports plus a root with `[data-field-globe-canvas]`, `[data-field-globe-toggle]`, and `[data-field-globe-status]`.
- Produces: `shouldAnimate(state)` and `createFieldGlobe(root)`, which returns `{ destroy() }`.

- [ ] **Step 1: Add a failing pause-state test**

```js
import { shouldAnimate } from "../assets/field-globe.js";

test("animation stops for every active pause condition", () => {
  assert.equal(shouldAnimate({ manualPause: false, hovering: false, focused: false, selected: false, reducedMotion: false }), true);
  assert.equal(shouldAnimate({ manualPause: false, hovering: true, focused: false, selected: false, reducedMotion: false }), false);
  assert.equal(shouldAnimate({ manualPause: false, hovering: false, focused: false, selected: true, reducedMotion: false }), false);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/field-globe.test.mjs`

Expected: FAIL because `shouldAnimate` is not exported.

- [ ] **Step 3: Implement the renderer contract**

```js
export function shouldAnimate(state) {
  return !state.manualPause && !state.hovering && !state.focused && !state.selected && !state.reducedMotion;
}

function drawEarth(context, centerX, centerY, radius) {
  const ocean = context.createRadialGradient(centerX - radius * .3, centerY - radius * .35, radius * .08, centerX, centerY, radius);
  ocean.addColorStop(0, "#2a8794");
  ocean.addColorStop(.68, "#0b3d46");
  ocean.addColorStop(1, "#061c23");
  context.fillStyle = ocean;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(214,244,241,.42)";
  context.lineWidth = Math.max(1, radius * .008);
  context.stroke();
  const night = context.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
  night.addColorStop(0, "rgba(3,18,24,.04)");
  night.addColorStop(.58, "rgba(3,18,24,.08)");
  night.addColorStop(1, "rgba(3,18,24,.68)");
  context.fillStyle = night;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
}

function drawHydroSurface(context, centerX, centerY, radius, rotation, hydro) {
  if (!hydro?.background?.length) return;
  const sourceOffset = ((rotation / (Math.PI * 2)) * 1000 + 1000) % 1000;
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.clip();
  context.translate(centerX - radius * 2 - sourceOffset, centerY - radius);
  context.scale((radius * 4) / 1000, (radius * 2) / 500);
  context.fillStyle = "rgba(232,240,222,.28)";
  hydro.background.forEach((path) => context.fill(new Path2D(path)));
  context.strokeStyle = "rgba(130,221,219,.48)";
  context.lineWidth = 1.4;
  hydro.visited?.forEach((basin) => basin.paths.forEach((path) => context.stroke(new Path2D(path))));
  context.restore();
}

function drawFieldMarkers(context, centerX, centerY, radius, rotation, activeId) {
  return FIELD_SITES.flatMap((site) => {
    const point = projectFieldSite(site, rotation, radius);
    if (!point.visible) return [];
    const x = centerX + point.x - radius;
    const y = centerY + point.y - radius;
    const active = site.id === activeId;
    context.fillStyle = active ? "#f2c17b" : "#d7704b";
    context.beginPath();
    context.arc(x, y, active ? 6 : 4.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.86)";
    context.lineWidth = 1.4;
    context.stroke();
    return [{ site, x, y, radius: active ? 10 : 9 }];
  });
}

export function createFieldGlobe(root) {
  const canvas = root.querySelector("[data-field-globe-canvas]");
  const toggle = root.querySelector("[data-field-globe-toggle]");
  const status = root.querySelector("[data-field-globe-status]");
  if (!canvas || !toggle || !status) return { destroy() {} };

  const context = canvas.getContext("2d");
  const state = { rotation: -0.75, manualPause: false, hovering: false, focused: false, selected: false, activeId: "", markers: [], reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
  let frame = 0;
  let lastTime = 0;
  const setStatus = (site) => { status.textContent = site ? `${site.label}: field campaigns in ${site.years}.` : "Seven field locations are marked on the globe."; };
  const render = (time) => {
    const size = Math.max(220, Math.floor(Math.min(canvas.clientWidth || 420, 500)));
    const scale = window.devicePixelRatio || 1;
    canvas.width = size * scale;
    canvas.height = size * scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const radius = size * .42;
    const delta = Math.min(40, time - lastTime || 16);
    lastTime = time;
    if (shouldAnimate(state)) state.rotation = normalizeAngle(state.rotation + delta * .00012);
    context.clearRect(0, 0, size, size);
    drawEarth(context, size / 2, size / 2, radius);
    drawHydroSurface(context, size / 2, size / 2, radius, state.rotation, window.HYDROBASINS_MAP);
    state.markers = drawFieldMarkers(context, size / 2, size / 2, radius, state.rotation, state.activeId);
    frame = requestAnimationFrame(render);
  };
  const selectMarker = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.clientWidth / rect.width;
    const y = (event.clientY - rect.top) * canvas.clientHeight / rect.height;
    const marker = state.markers.find((item) => Math.hypot(item.x - x, item.y - y) <= item.radius);
    if (!marker) return;
    state.activeId = marker.site.id;
    state.selected = true;
    setStatus(marker.site);
  };
  const listeners = [
    [root, "pointerenter", () => { state.hovering = true; }], [root, "pointerleave", () => { state.hovering = false; }],
    [root, "focusin", () => { state.focused = true; }], [root, "focusout", () => { state.focused = false; }],
    [canvas, "click", selectMarker], [toggle, "click", () => { if (state.selected) { state.selected = false; state.manualPause = false; } else { state.manualPause = !state.manualPause; } toggle.setAttribute("aria-pressed", String(state.manualPause)); toggle.textContent = state.manualPause ? "Play globe" : "Pause globe"; }],
  ];
  listeners.forEach(([target, name, listener]) => target.addEventListener(name, listener));
  setStatus();
  frame = requestAnimationFrame(render);
  return { destroy() { cancelAnimationFrame(frame); listeners.forEach(([target, name, listener]) => target.removeEventListener(name, listener)); } };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test tests/field-globe.test.mjs`

Expected: PASS with four passing subtests.

- [ ] **Step 5: Commit the renderer**

```bash
git add assets/field-globe.js tests/field-globe.test.mjs
git commit -m "feat: render interactive field globe"
```

### Task 3: Page Markup and Scoped Styling

**Files:**
- Modify: `latest-updates.html`
- Modify: `assets/site-enhancements.css`
- Modify: `assets/field-globe.js`

**Interfaces:**
- Consumes: `createFieldGlobe(root)` and `window.HYDROBASINS_MAP`.
- Produces: one `data-field-globe` region with canvas, button, live status, and fallback legend.

- [ ] **Step 1: Add failing static-page assertions**

```bash
python3 - <<'PY'
from pathlib import Path
page = Path("latest-updates.html").read_text()
assert "data-field-globe" in page
assert "assets/hydrobasins-map.js" in page
assert "assets/field-globe.js" in page
assert "data-field-globe-toggle" in page
print("Field globe markup present")
PY
```

Expected: FAIL before adding the panel.

- [ ] **Step 2: Add markup after the Field Work section**

```html
<section class="field-globe-section reveal" data-field-globe aria-labelledby="field-globe-heading">
  <div class="field-globe-copy">
    <p class="section-kicker">Field sites</p>
    <h2 id="field-globe-heading">Rivers that connect the field record</h2>
    <p>Seven field locations across Alaska and China are marked on this rotating river-and-basin globe.</p>
    <button class="field-globe-toggle" type="button" data-field-globe-toggle aria-pressed="false">Pause globe</button>
    <p class="sr-only" data-field-globe-status aria-live="polite">Seven field locations are marked on the globe.</p>
    <ul class="field-globe-legend" aria-label="Field locations">
      <li>Huslia, Beaver, and Alakanuk, Alaska</li>
      <li>Fuyuan, Pingliang, Baiyin/Jingtai, and Linxia, China</li>
    </ul>
  </div>
  <div class="field-globe-stage" tabindex="0" aria-label="Animated globe showing river basins and field locations">
    <canvas data-field-globe-canvas></canvas>
  </div>
</section>
```

Load the data script before the module:

```html
<script src="assets/hydrobasins-map.js" defer></script>
<script type="module" src="assets/field-globe.js"></script>
```

Finish the module with:

```js
document.querySelectorAll("[data-field-globe]").forEach((root) => createFieldGlobe(root));
```

- [ ] **Step 3: Add scoped styles**

```css
.field-globe-section{display:grid;grid-template-columns:minmax(0,.82fr) minmax(320px,1.18fr);gap:1.5rem;align-items:center;margin-top:1.4rem;padding:1.5rem;border:1px solid rgba(11,61,70,.12);border-radius:1.6rem;background:linear-gradient(135deg,#f7f2e8,#e6f0ed);box-shadow:0 18px 45px rgba(8,47,55,.08)}
.field-globe-stage{display:grid;min-height:390px;place-items:center;border-radius:1.35rem;outline:none;background:radial-gradient(circle at 50% 45%,#174d5a 0,#082f37 58%,#061c23 100%);overflow:hidden}
.field-globe-stage:focus-visible{box-shadow:0 0 0 3px rgba(215,112,75,.65)}
.field-globe-stage canvas{display:block;width:min(100%,500px);height:auto;aspect-ratio:1}
.field-globe-toggle{border:1px solid rgba(11,61,70,.18);border-radius:999px;padding:.6rem .9rem;color:#fff;background:var(--deep);font:inherit;font-size:.82rem;font-weight:900;cursor:pointer}
.field-globe-legend{display:grid;gap:.42rem;margin:1rem 0 0;padding:0;list-style:none;color:var(--muted);font-size:.86rem;line-height:1.45}
@media (max-width:800px){.field-globe-section{grid-template-columns:1fr}.field-globe-stage{min-height:300px}}
@media (prefers-reduced-motion:reduce){.field-globe-stage canvas{animation:none}}
```

- [ ] **Step 4: Run static checks**

Run:

```bash
python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
HTMLParser().feed(Path("latest-updates.html").read_text())
print("HTML OK")
PY
node --test tests/field-globe.test.mjs
```

Expected: `HTML OK` and all Node tests pass.

- [ ] **Step 5: Commit page integration**

```bash
git add latest-updates.html assets/site-enhancements.css assets/field-globe.js tests/field-globe.test.mjs
git commit -m "feat: add rotating field work globe"
```

### Task 4: Browser Verification and Publication

**Files:**
- Verify: `latest-updates.html`
- Verify: `assets/field-globe.js`

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: verified public GitHub Pages globe.

- [ ] **Step 1: Start a local server**

Run: `python3 -m http.server 8031 --directory .`

Expected: `200` for the page, `assets/field-globe.js`, and `assets/hydrobasins-map.js`.

- [ ] **Step 2: Verify in a browser**

```text
1. The Earth rotates after loading.
2. Pointer hover stops rotation; leaving resumes it.
3. Keyboard focus stops rotation.
4. Clicking a visible field marker stops rotation and changes the live site text.
5. Play/pause changes its label and aria-pressed value.
6. A narrow viewport stacks the text above the globe.
```

- [ ] **Step 3: Verify no external map dependency**

Run:

```bash
rg -n 'mapbox|leaflet|three\\.js|googleapis|http://' latest-updates.html assets/field-globe.js assets/site-enhancements.css
```

Expected: no output.

- [ ] **Step 4: Publish and verify GitHub Pages**

Run:

```bash
git diff --check
git push origin master
curl -sSL -o /tmp/field-globe-page.html -w '%{http_code}\\n' https://ytkgeo.github.io/yutianke/latest-updates.html
```

Expected: `git diff --check` is silent and Pages returns `200`. Confirm public HTML contains `data-field-globe` and loads `assets/field-globe.js`.
