export const LAND_SOURCE_FRAME = { width: 1000, height: 540, top: 0 };
export const BASIN_SOURCE_FRAME = { width: 1000, height: 500, top: 20 };

// Decode each source frame before geographic clipping at the dateline or horizon.
export function pathsToGeoJSON(paths, geo = globalThis.d3, source = LAND_SOURCE_FRAME) {
  const geometries = [];
  for (const path of paths) {
    const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
    let ring = [];
    const finish = () => {
      if (ring.length < 3) { ring = []; return; }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push([...ring[0]]);
      const polygon = { type: "Polygon", coordinates: [ring] };
      if (geo.geoArea(polygon) > 2 * Math.PI) ring.reverse();
      geometries.push(polygon);
      ring = [];
    };
    for (let i = 0; i < tokens.length;) {
      const token = tokens[i++];
      if (token === "Z") finish();
      else if (token === "M" || token === "L") {
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

export function createFlatProjection(geo = globalThis.d3) {
  return geo.geoEquirectangular().scale(1000 / (2 * Math.PI))
    .translate([500, 270]).precision(0.1).clipExtent([[0, 20], [1000, 520]]);
}

export function morepocLocations(fields, rows) {
  return rows.map((row) => Array.isArray(row)
    ? Object.fromEntries(fields.map((field, i) => [field, row[i]])) : row)
    .filter((site) => Number.isFinite(site.lat) && Number.isFinite(site.lon)
      && Math.abs(site.lat) <= 90 && Math.abs(site.lon) <= 180);
}
