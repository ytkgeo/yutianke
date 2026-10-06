import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { FIELD_SITES, BASIN_SOURCE_FRAME, pathsToGeoJSON, projectFieldSite, createFieldGlobe } from "../assets/field-globe.js";

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["vendor/d3-array-3.2.4.min.js", "vendor/d3-geo-3.1.1.min.js", "world-land.js", "hydrobasins-map.js"]) {
  vm.runInContext(readFileSync(new URL("../assets/" + file, import.meta.url), "utf8"), sandbox);
}
const geo = sandbox.d3;

test("the padded basin frame and full-height coastline frame decode to the same location", () => {
  // The same 60 N, 144 W point in the two existing source coordinate systems.
  const land = pathsToGeoJSON(["M100 90L110 90L110 100Z"], geo);
  const basin = pathsToGeoJSON(["M100 103.33333333333333L110 103.33333333333333L110 112.5925925925926Z"], geo, BASIN_SOURCE_FRAME);
  const findPoint = (geometry) => geometry.geometries[0].coordinates[0].find(([lon]) => Math.abs(lon + 144) < 1e-10);
  const landPoint = findPoint(land);
  const basinPoint = findPoint(basin);
  assert.ok(Math.abs(landPoint[1] - 60) < 1e-10);
  assert.ok(Math.abs(basinPoint[1] - landPoint[1]) < 1e-10);
  for (const rotation of [[155, -38, 0], [-113, -42, 0]]) {
    const project = geo.geoOrthographic().rotate(rotation);
    const a = project(landPoint);
    const b = project(basinPoint);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8);
  }
});

test("coastline polygons cover land, rather than their spherical complements", () => {
  const land = pathsToGeoJSON(sandbox.window.WORLD_LAND, geo);
  assert.equal(land.geometries.length, 126);
  assert.ok(geo.geoArea(land) > 3 && geo.geoArea(land) < 4);
  for (const polygon of land.geometries) assert.ok(geo.geoArea(polygon) < 2 * Math.PI);
});

test("interior field sites align with the decoded Yukon, Amur, and Yellow River catchments", () => {
  const associations = [
    ["Yukon River Basin", ["huslia", "beaver"]],
    ["Heilongjiang-Amur Basin", ["fuyuan"]],
    ["Yellow River Basin", ["pingliang", "baiyin-jingtai", "linxia"]],
  ];
  // Coastal delta markers need not lie inside the simplified display polygons.
  for (const [name, ids] of associations) {
    const basin = sandbox.window.HYDROBASINS_MAP.visited.find((entry) => entry.name === name);
    const geometry = pathsToGeoJSON(basin.paths, geo, BASIN_SOURCE_FRAME);
    for (const id of ids) {
      const site = FIELD_SITES.find((entry) => entry.id === id);
      assert.ok(geo.geoContains(geometry, [site.longitude, site.latitude]), id + " must lie in " + name);
    }
  }
});

test("a dateline-crossing polygon stays small and disappears on the far side", () => {
  const polygon = pathsToGeoJSON(["M995 210L5 210L5 270L995 270Z"], geo);
  assert.ok(geo.geoArea(polygon) < 0.03);
  const projection = geo.geoOrthographic().scale(200).rotate([180, -10, 0]);
  const path = geo.geoPath(projection);
  assert.ok(path.area(polygon) > 100 && path.area(polygon) < 2000);
  projection.rotate([0, 0, 0]);
  assert.equal(path.area(polygon), 0);
});

test("each site can be centered on the tilted globe and its antipode is hidden", () => {
  for (const site of FIELD_SITES) {
    const rotation = [-site.longitude, -site.latitude, 0];
    const point = projectFieldSite(site, rotation, 200, geo);
    assert.ok(point.visible);
    assert.ok(Math.abs(point.x - 200) < 1e-8 && Math.abs(point.y - 200) < 1e-8);
    const opposite = { longitude: site.longitude + 180, latitude: -site.latitude };
    assert.equal(projectFieldSite(opposite, rotation, 200, geo).visible, false);
  }
});

test("paused and hidden globes stop scheduling frames; rotation does not resize the canvas", () => {
  const element = () => ({
    dataset: {}, hidden: false, listeners: new Map(),
    addEventListener(event, handler) { this.listeners.set(event, handler); },
    removeEventListener(event) { this.listeners.delete(event); },
    setAttribute() {},
  });
  const context = new Proxy({}, { get(target, name) {
    if (name.startsWith("create")) return () => ({ addColorStop() {} });
    return target[name] ?? (() => {});
  } });
  let width = 400;
  let backingWrites = 0;
  const canvas = Object.assign(element(), {
    getContext: () => context,
    getBoundingClientRect: () => ({ width, height: width, left: 0, top: 0 }),
  });
  for (const name of ["width", "height"]) {
    let value = 0;
    Object.defineProperty(canvas, name, { get: () => value, set(next) { value = next; backingWrites++; } });
  }
  const frames = new Map();
  let nextFrame = 0;
  let time = 0;
  let resize;
  let visibilityTarget;
  const motion = Object.assign(element(), { matches: true });
  const doc = Object.assign(element(), { hidden: false });
  const win = {
    d3: geo, WORLD_LAND: sandbox.window.WORLD_LAND, devicePixelRatio: 3,
    matchMedia: () => motion, performance: { now: () => time },
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} disconnect() {} },
    IntersectionObserver: class { observe(target) { visibilityTarget = target; } disconnect() {} },
  };
  doc.defaultView = win;
  const toggle = element();
  const nodes = {
    "[data-field-globe-canvas]": canvas, "[data-field-globe-toggle]": toggle,
    "[data-field-globe-status]": element(), "[data-field-globe-label]": element(),
    "[data-field-globe-detail]": element(), "[data-field-globe-loading]": element(),
  };
  const root = Object.assign(element(), { ownerDocument: doc, querySelector: (key) => nodes[key], querySelectorAll: () => [] });
  const globe = createFieldGlobe(root);
  assert.equal(visibilityTarget, canvas);
  const advance = () => {
    time += 16;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(time));
  };
  advance();
  assert.equal(frames.size, 0);
  assert.equal(backingWrites, 2);
  toggle.listeners.get("click")();
  for (let i = 0; i < 5; i++) advance();
  assert.equal(frames.size, 1);
  assert.equal(backingWrites, 2);
  width = 450;
  resize();
  advance();
  assert.equal(backingWrites, 4);
  doc.hidden = true;
  doc.listeners.get("visibilitychange")();
  advance();
  assert.equal(frames.size, 0);
  toggle.listeners.get("click")();
  motion.matches = false;
  motion.listeners.get("change")();
  assert.equal(toggle.textContent, "Rotate");
  doc.hidden = false;
  doc.listeners.get("visibilitychange")();
  advance();
  assert.equal(frames.size, 0);
  globe.destroy();
  assert.equal(toggle.listeners.size, 0);
});
