export const FIELD_SITES = [
  { id: "huslia", label: "Huslia, Alaska", latitude: 65.7, longitude: -156.4, years: "2024, 2026" },
  { id: "beaver", label: "Beaver, Alaska", latitude: 66.4, longitude: -147.4, years: "2022, 2023" },
  { id: "alakanuk", label: "Alakanuk, Alaska", latitude: 62.7, longitude: -164.6, years: "2023" },
  { id: "fuyuan", label: "Fuyuan, China", latitude: 48.4, longitude: 134.3, years: "2018" },
  { id: "pingliang", label: "Pingliang, China", latitude: 35.5, longitude: 106.7, years: "2014, 2016" },
  { id: "baiyin-jingtai", label: "Baiyin and Jingtai, China", latitude: 37.2, longitude: 104.1, years: "2015" },
  { id: "linxia", label: "Linxia, China", latitude: 35.6, longitude: 103.2, years: "2015" },
];

export const DEFAULT_ROTATION = -0.75;
const DEFAULT_STATUS = "Seven field locations are marked on the globe.";
const FULL_TURN = Math.PI * 2;
const HYDRO_SOURCE_WIDTH = 1000;
const HYDRO_SOURCE_HEIGHT = 540;   // basin + land layers are authored 1000x540

export function normalizeAngle(angle) {
  return ((angle + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
}

export function projectFieldSite(site, rotation, radius) {
  const latitude = (site.latitude * Math.PI) / 180;
  const longitude = (site.longitude * Math.PI) / 180 + rotation;
  const depth = Math.cos(latitude) * Math.cos(longitude);

  return {
    x: radius + radius * Math.cos(latitude) * Math.sin(longitude),
    y: radius - radius * Math.sin(latitude),
    depth,
    visible: depth > 0.04,
  };
}

export function shouldAnimate(state) {
  return !state.manualPause && !state.hovering && !state.focused && !state.selected;
}

function getToggleState(state) {
  if (state.selected) {
    return {
      action: "clear-selection",
      label: shouldAnimate({ ...state, selected: false }) ? "Play globe" : "Clear selection",
    };
  }

  return {
    action: "toggle-manual-pause",
    label: state.manualPause ? "Play globe" : "Pause globe",
  };
}

function getAnimationStatusText(state) {
  return shouldAnimate(state) ? "Globe animation is running." : "Globe animation is paused.";
}

// The basin geometry ships as M/L/Z polygons in a 1000x500 equirectangular
// source. Drawing that through a flat translate/scale and clipping it to a
// circle is not a globe: latitude ends up linear while the field markers use a
// true orthographic projection (r*sin(lat)), so basins and markers disagree by
// up to ~18% of the radius and the mask crops basins mid-shape. Parse the
// polygons once into lon/lat, then project every vertex the same way the
// markers are projected.
let hydroGeometryCache = null;

function parseHydroRings(paths) {
  return paths.flatMap((path) => {
    const rings = [];
    let ring = null;
    const token = /([MLZ])([-\d.]+)?[ ,]?([-\d.]+)?/g;
    let match;
    while ((match = token.exec(path)) !== null) {
      const [, command, rawX, rawY] = match;
      if (command === "Z") {
        if (ring && ring.length > 2) rings.push(ring);
        ring = null;
        continue;
      }
      if (command === "M") {
        if (ring && ring.length > 2) rings.push(ring);
        ring = [];
      }
      if (!ring || rawX === undefined || rawY === undefined) continue;
      ring.push([
        (Number(rawX) / HYDRO_SOURCE_WIDTH) * 360 - 180,
        90 - (Number(rawY) / HYDRO_SOURCE_HEIGHT) * 180,
      ]);
    }
    if (ring && ring.length > 2) rings.push(ring);
    return rings;
  });
}

function getHydroGeometry(hydro) {
  if (hydroGeometryCache?.source === hydro) return hydroGeometryCache;
  hydroGeometryCache = {
    source: hydro,
    background: parseHydroRings(hydro.background ?? []),
    visited: (hydro.visited ?? []).flatMap((basin) => parseHydroRings(basin.paths ?? [])),
  };
  return hydroGeometryCache;
}

// Same projection as projectFieldSite, so basins and markers finally agree.
function traceRing(context, ring, centerX, centerY, radius, rotation) {
  let drawing = false;
  let drawn = 0;
  for (const [lon, lat] of ring) {
    const longitude = (lon * Math.PI) / 180 + rotation;
    const latitude = (lat * Math.PI) / 180;
    if (Math.cos(latitude) * Math.cos(longitude) <= 0) {
      drawing = false;   // vertex is on the far side of the globe
      continue;
    }
    const x = centerX + radius * Math.cos(latitude) * Math.sin(longitude);
    const y = centerY - radius * Math.sin(latitude);
    if (drawing) {
      context.lineTo(x, y);
    } else {
      context.moveTo(x, y);
      drawing = true;
    }
    drawn += 1;
  }
  return drawn > 2;
}

function drawEarth(context, centerX, centerY, radius) {
  const ocean = context.createRadialGradient(
    centerX - radius * 0.3,
    centerY - radius * 0.35,
    radius * 0.08,
    centerX,
    centerY,
    radius,
  );
  ocean.addColorStop(0, "#2a8794");
  ocean.addColorStop(0.68, "#0b3d46");
  ocean.addColorStop(1, "#061c23");
  context.fillStyle = ocean;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, FULL_TURN);
  context.fill();

  context.strokeStyle = "rgba(214,244,241,.42)";
  context.lineWidth = Math.max(1, radius * 0.008);
  context.stroke();

  const night = context.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
  night.addColorStop(0, "rgba(3,18,24,.04)");
  night.addColorStop(0.58, "rgba(3,18,24,.08)");
  night.addColorStop(1, "rgba(3,18,24,.68)");
  context.fillStyle = night;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, FULL_TURN);
  context.fill();
}

let landGeometryCache = null;

function getLandGeometry(land) {
  if (landGeometryCache?.source === land) return landGeometryCache;
  landGeometryCache = { source: land, rings: parseHydroRings(land) };
  return landGeometryCache;
}

// A complete land layer behind the basins: the basin set alone covers only the
// largest catchments, which reads as a patchy globe rather than an Earth.
export function drawLandSurface(context, centerX, centerY, radius, rotation, land) {
  if (!land?.length) return;
  const geometry = getLandGeometry(land);
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, FULL_TURN);
  context.clip();
  context.fillStyle = "rgba(226,229,209,.88)";
  context.beginPath();
  geometry.rings.forEach((ring) => traceRing(context, ring, centerX, centerY, radius, rotation));
  context.fill("evenodd");
  context.restore();
}

export function drawHydroSurface(context, centerX, centerY, radius, rotation, hydro) {
  if (!hydro?.background?.length) {
    return;
  }
  const geometry = getHydroGeometry(hydro);

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, FULL_TURN);
  context.clip();

  context.fillStyle = "rgba(42,135,148,.30)";
  context.beginPath();
  geometry.background.forEach((ring) => traceRing(context, ring, centerX, centerY, radius, rotation));
  context.fill();

  context.strokeStyle = "rgba(215,112,75,.95)";
  context.lineWidth = Math.max(1, radius * 0.006);
  context.lineJoin = "round";
  context.beginPath();
  geometry.visited.forEach((ring) => traceRing(context, ring, centerX, centerY, radius, rotation));
  context.stroke();

  context.restore();
}

function drawFieldMarkers(context, centerX, centerY, radius, rotation, activeId) {
  return FIELD_SITES.flatMap((site) => {
    const point = projectFieldSite(site, rotation, radius);
    if (!point.visible) {
      return [];
    }

    const x = centerX + point.x - radius;
    const y = centerY + point.y - radius;
    const active = site.id === activeId;

    context.fillStyle = active ? "#f2c17b" : "#d7704b";
    context.beginPath();
    context.arc(x, y, active ? 6 : 4.5, 0, FULL_TURN);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.86)";
    context.lineWidth = 1.4;
    context.stroke();

    return [{ site, x, y, radius: active ? 10 : 9 }];
  });
}

export function createFieldGlobe(root) {
  const canvas = root?.querySelector?.("[data-field-globe-canvas]");
  const toggle = root?.querySelector?.("[data-field-globe-toggle]");
  const status = root?.querySelector?.("[data-field-globe-status]");
  if (!canvas || !toggle || !status) {
    return { destroy() {} };
  }

  const context = canvas.getContext?.("2d");
  if (!context) {
    return { destroy() {} };
  }

  const runtimeWindow = typeof window === "object" ? window : globalThis;
  const mediaQuery = runtimeWindow?.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  const requestFrame = globalThis.requestAnimationFrame?.bind(globalThis)
    ?? ((callback) => setTimeout(() => callback(Date.now()), 16));
  const cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
  const state = {
    rotation: DEFAULT_ROTATION,
    manualPause: Boolean(mediaQuery?.matches),
    manualPauseOverride: false,
    hovering: false,
    focused: false,
    selected: false,
    activeId: "",
    markers: [],
    reducedMotion: Boolean(mediaQuery?.matches),
  };
  let frame = 0;
  let lastTime = 0;

  const setStatus = () => {
    const animationStatus = getAnimationStatusText(state);
    const site = FIELD_SITES.find((entry) => entry.id === state.activeId);
    if (site) {
      status.textContent = `${site.label}: field campaigns in ${site.years}. ${animationStatus}`;
      return;
    }

    status.textContent = `${animationStatus} ${DEFAULT_STATUS}`;
  };

  const syncToggle = () => {
    const toggleState = getToggleState(state);
    toggle.removeAttribute?.("aria-pressed");
    toggle.textContent = toggleState.label;
  };

  const syncControls = () => {
    syncToggle();
    setStatus();
  };

  const clearSelection = () => {
    state.selected = false;
    state.activeId = "";
    setStatus();
  };

  const updateReducedMotion = (event) => {
    state.reducedMotion = Boolean(event?.matches ?? mediaQuery?.matches);
    if (!state.manualPauseOverride) {
      state.manualPause = state.reducedMotion;
    }
    syncControls();
  };

  const render = (time) => {
    const size = Math.max(220, Math.floor(Math.min(canvas.clientWidth || 420, 500)));
    const scale = runtimeWindow?.devicePixelRatio || 1;
    canvas.width = size * scale;
    canvas.height = size * scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);

    const radius = size * 0.42;
    const delta = Math.min(40, time - lastTime || 16);
    lastTime = time;

    if (shouldAnimate(state)) {
      state.rotation = normalizeAngle(state.rotation + delta * 0.00012);
    }

    context.clearRect(0, 0, size, size);
    drawEarth(context, size / 2, size / 2, radius);
    drawLandSurface(context, size / 2, size / 2, radius, state.rotation, runtimeWindow?.WORLD_LAND);
    drawHydroSurface(context, size / 2, size / 2, radius, state.rotation, runtimeWindow?.HYDROBASINS_MAP);
    state.markers = drawFieldMarkers(context, size / 2, size / 2, radius, state.rotation, state.activeId);
    frame = requestFrame(render);
  };

  const selectMarker = (event) => {
    const rect = canvas.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) {
      return;
    }

    const x = ((event.clientX - rect.left) * (canvas.clientWidth || rect.width)) / rect.width;
    const y = ((event.clientY - rect.top) * (canvas.clientHeight || rect.height)) / rect.height;
    const marker = state.markers.find((item) => Math.hypot(item.x - x, item.y - y) <= item.radius);
    if (!marker) {
      return;
    }

    state.activeId = marker.site.id;
    state.selected = true;
    syncControls();
  };

  const listeners = [
    [root, "pointerenter", () => {
      state.hovering = true;
      syncControls();
    }],
    [root, "pointerleave", () => {
      state.hovering = false;
      syncControls();
    }],
    [root, "focusin", () => {
      state.focused = true;
      syncControls();
    }],
    [root, "focusout", () => {
      state.focused = false;
      syncControls();
    }],
    [canvas, "click", selectMarker],
    [toggle, "click", () => {
      const toggleState = getToggleState(state);
      if (toggleState.action === "clear-selection") {
        clearSelection();
      } else {
        state.manualPause = !state.manualPause;
        state.manualPauseOverride = state.manualPause !== state.reducedMotion;
        setStatus();
      }

      syncToggle();
    }],
  ];

  listeners.forEach(([target, name, listener]) => target.addEventListener(name, listener));

  if (typeof mediaQuery?.addEventListener === "function") {
    mediaQuery.addEventListener("change", updateReducedMotion);
  } else if (typeof mediaQuery?.addListener === "function") {
    mediaQuery.addListener(updateReducedMotion);
  }

  syncControls();
  frame = requestFrame(render);

  return {
    destroy() {
      cancelFrame(frame);
      listeners.forEach(([target, name, listener]) => target.removeEventListener(name, listener));

      if (typeof mediaQuery?.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateReducedMotion);
      } else if (typeof mediaQuery?.removeListener === "function") {
        mediaQuery.removeListener(updateReducedMotion);
      }
    },
  };
}

function initializeFieldGlobes(doc) {
  doc.querySelectorAll("[data-field-globe]").forEach((root) => createFieldGlobe(root));
}

if (typeof document === "object" && document?.querySelectorAll) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeFieldGlobes(document), { once: true });
  } else {
    initializeFieldGlobes(document);
  }
}
