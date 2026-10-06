export const FIELD_SITES = [
  { id: "huslia", label: "Huslia, Alaska", latitude: 65.7, longitude: -156.4, years: "2024, 2026" },
  { id: "beaver", label: "Beaver, Alaska", latitude: 66.4, longitude: -147.4, years: "2022, 2023" },
  { id: "alakanuk", label: "Alakanuk, Alaska", latitude: 62.7, longitude: -164.6, years: "2023" },
  { id: "fuyuan", label: "Fuyuan, China", latitude: 48.4, longitude: 134.3, years: "2018" },
  { id: "pingliang", label: "Pingliang, China", latitude: 35.5, longitude: 106.7, years: "2014, 2016" },
  { id: "baiyin-jingtai", label: "Baiyin and Jingtai, China", latitude: 37.2, longitude: 104.1, years: "2015" },
  { id: "linxia", label: "Linxia, China", latitude: 35.6, longitude: 103.2, years: "2015" },
];

export const DEFAULT_ROTATION = [155, -38, 0];
export const FIELD_VIEWS = {
  pacific: { rotation: DEFAULT_ROTATION, label: "Across the Pacific", detail: "Alaska and eastern Asia" },
  alaska: { rotation: [156, -61, 0], label: "Alaska", detail: "Koyukuk River, Yukon River, and Yukon Delta" },
  china: { rotation: [-113, -42, 0], label: "China", detail: "Heilongjiang and the Loess Plateau" },
};

const RAD = Math.PI / 180;
const SPHERE = { type: "Sphere" };
const LAND_SOURCE_FRAME = { width: 1000, height: 540, top: 0 };
export const BASIN_SOURCE_FRAME = { width: 1000, height: 500, top: 20 };

export function normalizeAngle(angle) {
  return ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
}

// Decode the existing display paths once. D3 then clips and resamples complete
// spherical polygons, including at the horizon and the antimeridian.
export function pathsToGeoJSON(paths, geo = globalThis.d3, source = LAND_SOURCE_FRAME) {
  const geometries = [];
  for (const path of paths) {
    const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
    let ring = [];
    const finish = () => {
      if (ring.length < 3) { ring = []; return; }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push([...ring[0]]);
      const polygon = { type: "Polygon", coordinates: [ring] };
      // SVG winding is planar; an inverted spherical ring fills the whole Earth.
      if (geo.geoArea(polygon) > 2 * Math.PI) ring.reverse();
      geometries.push(polygon);
      ring = [];
    };
    for (let i = 0; i < tokens.length;) {
      const token = tokens[i++];
      if (token === "Z") {
        finish();
      } else if (token === "M" || token === "L") {
        if (token === "M") finish();
        const x = Number(tokens[i++]);
        const y = Number(tokens[i++]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          ring.push([x / source.width * 360 - 180, 90 - (y - source.top) / source.height * 180]);
        }
      }
    }
    finish();
  }
  return { type: "GeometryCollection", geometries };
}

export function projectFieldSite(site, rotation, radius, geo = globalThis.d3) {
  const angles = Array.isArray(rotation) ? rotation : [rotation / RAD, 0, 0];
  const coordinates = [site.longitude, site.latitude];
  const rotated = geo.geoRotation(angles)(coordinates);
  const depth = Math.cos(rotated[0] * RAD) * Math.cos(rotated[1] * RAD);
  const point = geo.geoOrthographic().rotate(angles).scale(radius).translate([radius, radius])(coordinates);
  return { x: point[0], y: point[1], depth, visible: depth > 0.02 };
}

export function shouldAnimate(state) {
  return !state.manualPause && !state.hovering && !state.focused && !state.dragging
    && state.inView && !state.documentHidden;
}

export function createFieldGlobe(root) {
  const canvas = root.querySelector("[data-field-globe-canvas]");
  const toggle = root.querySelector("[data-field-globe-toggle]");
  const status = root.querySelector("[data-field-globe-status]");
  const label = root.querySelector("[data-field-globe-label]");
  const detail = root.querySelector("[data-field-globe-detail]");
  const loading = root.querySelector("[data-field-globe-loading]");
  const siteButtons = [...root.querySelectorAll("[data-field-site]")];
  const viewButtons = [...root.querySelectorAll("[data-field-view]")];
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const geo = win.d3;
  const context = canvas.getContext("2d");
  if (!context || !geo?.geoOrthographic || !win.WORLD_LAND) {
    canvas.hidden = true;
    toggle.hidden = true;
    loading.hidden = true;
    [...siteButtons, ...viewButtons].forEach((button) => { button.disabled = true; });
    label.textContent = "Field locations";
    detail.textContent = "The seven sites and campaign years are listed alongside.";
    return { destroy() {} };
  }

  const land = pathsToGeoJSON(win.WORLD_LAND, geo);
  const basins = pathsToGeoJSON(win.HYDROBASINS_MAP?.background || [], geo, BASIN_SOURCE_FRAME);
  const visited = pathsToGeoJSON((win.HYDROBASINS_MAP?.visited || []).flatMap((basin) => basin.paths), geo, BASIN_SOURCE_FRAME);
  const graticule = geo.geoGraticule().step([30, 30])();
  const projection = geo.geoOrthographic().clipAngle(90).precision(0.4);
  const path = geo.geoPath(projection, context);
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    rotation: [...DEFAULT_ROTATION], manualPause: motion.matches, manualPauseOverride: false, hovering: false,
    focused: false, dragging: false, inView: true, documentHidden: doc.hidden,
    activeId: "", view: "", markers: [], tween: null,
  };
  let size = 0;
  let radius = 0;
  let frame = 0;
  let lastTime = 0;
  let destroyed = false;
  let drag = null;
  let dragged = false;
  let ocean;
  let shade;
  const listeners = [];
  const listen = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  };
  const invalidate = () => {
    if (!frame && !destroyed) frame = win.requestAnimationFrame(render);
  };

  const syncControls = () => {
    toggle.textContent = state.manualPause ? "Rotate" : "Pause";
    toggle.setAttribute("aria-label", state.manualPause ? "Start globe rotation" : "Pause globe rotation");
    root.dataset.globeState = shouldAnimate(state) ? "rotating" : "paused";
    siteButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.fieldSite === state.activeId)));
    viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.fieldView === state.view)));
    const site = FIELD_SITES.find((entry) => entry.id === state.activeId);
    const view = FIELD_VIEWS[state.view];
    label.textContent = site?.label || view?.label || "Seven places, one field record";
    detail.textContent = site ? "Field campaigns: " + site.years : view?.detail || "Choose a site, or drag the globe to explore.";
    const message = label.textContent + ". " + detail.textContent;
    if (status.textContent !== message) status.textContent = message;
    invalidate();
  };

  const flyTo = (rotation) => {
    const target = [...rotation];
    target[0] = state.rotation[0] + normalizeAngle((target[0] - state.rotation[0]) * RAD) / RAD;
    state.manualPause = true;
    state.manualPauseOverride = true;
    const instant = motion.matches || !state.inView || state.documentHidden;
    state.tween = instant ? null : { from: [...state.rotation], to: target, start: win.performance.now() };
    if (instant) state.rotation = target;
    syncControls();
  };
  const selectSite = (site) => {
    state.activeId = site.id;
    state.view = "";
    flyTo([-site.longitude, -site.latitude, 0]);
  };

  const resize = () => {
    const nextSize = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
    const ratio = Math.min(win.devicePixelRatio || 1, nextSize < 420 ? 1.5 : 2);
    const pixels = Math.round(nextSize * ratio);
    if (canvas.width === pixels && size === nextSize) return;
    size = nextSize;
    radius = size * 0.43;
    canvas.width = pixels;
    canvas.height = pixels;
    context.setTransform(pixels / size, 0, 0, pixels / size, 0, 0);
    projection.scale(radius).translate([size / 2, size / 2]);
    ocean = context.createRadialGradient(size * 0.35, size * 0.3, 0, size / 2, size / 2, radius);
    ocean.addColorStop(0, "#205e69");
    ocean.addColorStop(1, "#12333c");
    shade = context.createLinearGradient(size * 0.2, size * 0.3, size * 0.9, size * 0.65);
    shade.addColorStop(0, "rgba(255,255,255,.04)");
    shade.addColorStop(0.5, "rgba(4,19,25,0)");
    shade.addColorStop(1, "rgba(4,19,25,.6)");
    invalidate();
  };

  function render(time) {
    frame = 0;
    if (destroyed || !size) return;
    const delta = lastTime ? Math.min(64, time - lastTime) : 0;
    lastTime = time;
    if (state.tween && state.inView && !state.documentHidden) {
      const progress = Math.min(1, (time - state.tween.start) / 1000);
      const eased = progress * progress * (3 - 2 * progress);
      state.rotation = state.tween.from.map((angle, i) => angle + (state.tween.to[i] - angle) * eased);
      if (progress === 1) state.tween = null;
    } else if (shouldAnimate(state)) {
      state.rotation[0] = normalizeAngle((state.rotation[0] + delta * 0.0018) * RAD) / RAD;
    }
    projection.rotate(state.rotation);
    context.clearRect(0, 0, size, size);
    context.beginPath();
    path(SPHERE);
    context.fillStyle = ocean;
    context.fill();
    context.beginPath();
    path(land);
    context.fillStyle = "#c8d2c3";
    context.fill();
    context.strokeStyle = "rgba(227,239,226,.5)";
    context.lineWidth = 0.6;
    context.stroke();
    for (const [geometry, color, width] of [
      [graticule, "rgba(225,239,238,.13)", 0.6],
      [basins, "rgba(23,66,60,.16)", 0.5],
      [visited, "rgba(222,153,100,.9)", 1.1],
    ]) {
      context.beginPath();
      path(geometry);
      context.strokeStyle = color;
      context.lineWidth = width;
      context.stroke();
    }
    context.beginPath();
    path(SPHERE);
    context.fillStyle = shade;
    context.fill();
    context.strokeStyle = "rgba(208,233,231,.4)";
    context.lineWidth = 1;
    context.stroke();

    const rotate = geo.geoRotation(state.rotation);
    state.markers = FIELD_SITES.flatMap((site) => {
      const coordinates = [site.longitude, site.latitude];
      const rotated = rotate(coordinates);
      if (Math.cos(rotated[0] * RAD) * Math.cos(rotated[1] * RAD) <= 0.02) return [];
      const [x, y] = projection(coordinates);
      const active = state.activeId === site.id;
      context.beginPath();
      context.arc(x, y, active ? 11 : 7, 0, 2 * Math.PI);
      context.fillStyle = active ? "rgba(242,193,123,.2)" : "rgba(215,112,75,.13)";
      context.fill();
      context.beginPath();
      context.arc(x, y, active ? 5 : 3.7, 0, 2 * Math.PI);
      context.fillStyle = active ? "#f2c17b" : "#d7704b";
      context.fill();
      context.strokeStyle = "#f9f8f3";
      context.lineWidth = 1.2;
      context.stroke();
      return [{ site, x, y }];
    });
    loading.hidden = true;
    root.dataset.globeReady = "true";
    if ((state.tween || shouldAnimate(state)) && state.inView && !state.documentHidden) invalidate();
  }

  const nearestMarker = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * size / rect.width;
    const y = (event.clientY - rect.top) * size / rect.height;
    return state.markers.map((marker) => ({ ...marker, distance: Math.hypot(marker.x - x, marker.y - y) }))
      .filter((marker) => marker.distance < 14).sort((a, b) => a.distance - b.distance)[0];
  };
  siteButtons.forEach((button) => listen(button, "click", () => {
    const site = FIELD_SITES.find((entry) => entry.id === button.dataset.fieldSite);
    if (site) selectSite(site);
  }));
  viewButtons.forEach((button) => listen(button, "click", () => {
    state.activeId = "";
    state.view = button.dataset.fieldView;
    flyTo(FIELD_VIEWS[state.view].rotation);
  }));
  listen(toggle, "click", () => {
    state.manualPauseOverride = true;
    state.manualPause = !state.manualPause;
    if (!state.manualPause) {
      state.activeId = "";
      state.view = "";
      state.tween = null;
    }
    lastTime = 0;
    syncControls();
  });
  listen(canvas, "pointerenter", () => { state.hovering = true; syncControls(); });
  listen(canvas, "pointerleave", () => { state.hovering = false; canvas.title = ""; syncControls(); });
  listen(canvas, "focus", () => { state.focused = true; syncControls(); });
  listen(canvas, "blur", () => { state.focused = false; syncControls(); });
  listen(canvas, "pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, yaw: state.rotation[0] };
    dragged = false;
    state.dragging = true;
    state.manualPause = true;
    state.manualPauseOverride = true;
    state.tween = null;
    canvas.setPointerCapture(event.pointerId);
    syncControls();
  });
  listen(canvas, "pointermove", (event) => {
    if (!drag) {
      canvas.title = nearestMarker(event)?.site.label || "";
      return;
    }
    const movement = event.clientX - drag.x;
    if (Math.abs(movement) > 4) {
      dragged = true;
      state.activeId = "";
      state.view = "";
      state.rotation[0] = drag.yaw + movement / radius * 50;
      syncControls();
    }
  });
  const endDrag = () => { drag = null; state.dragging = false; syncControls(); };
  listen(canvas, "pointerup", endDrag);
  listen(canvas, "pointercancel", endDrag);
  listen(canvas, "click", (event) => {
    if (dragged) { dragged = false; return; }
    const marker = nearestMarker(event);
    if (marker) selectSite(marker.site);
  });
  listen(canvas, "keydown", (event) => {
    const adjustments = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] };
    if (!adjustments[event.key]) return;
    event.preventDefault();
    state.manualPause = true;
    state.manualPauseOverride = true;
    state.tween = null;
    state.activeId = "";
    state.view = "";
    state.rotation[0] += adjustments[event.key][0];
    state.rotation[1] = Math.max(-75, Math.min(75, state.rotation[1] + adjustments[event.key][1]));
    syncControls();
  });
  listen(doc, "visibilitychange", () => { state.documentHidden = doc.hidden; lastTime = 0; syncControls(); });
  listen(motion, "change", () => {
    if (motion.matches || !state.manualPauseOverride) state.manualPause = motion.matches;
    if (motion.matches && state.tween) {
      state.rotation = state.tween.to;
      state.tween = null;
    }
    syncControls();
  });
  const resizeObserver = new win.ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibilityObserver = new win.IntersectionObserver(([entry]) => {
    state.inView = entry.isIntersecting;
    lastTime = 0;
    syncControls();
  }, { threshold: 0.05 });
  visibilityObserver.observe(canvas);
  resize();
  syncControls();
  return {
    destroy() {
      destroyed = true;
      win.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      listeners.forEach((remove) => remove());
    },
  };
}

if (typeof document === "object") {
  const initialize = () => document.querySelectorAll("[data-field-globe]").forEach(createFieldGlobe);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
}
