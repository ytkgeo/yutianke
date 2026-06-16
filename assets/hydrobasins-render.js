(() => {
  const data = window.HYDROBASINS_MAP;
  const root = document.querySelector("[data-morepoc-map]");
  if (!data || !root) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = root.querySelector(".morepoc-map");
  const mapCard = root.querySelector(".morepoc-map-card");
  const riverLayer = root.querySelector("[data-morepoc-rivers]");
  const visitedLayer = root.querySelector("[data-morepoc-visited]");
  const readout = root.querySelector("[data-morepoc-readout]");
  if (!svg || !visitedLayer) return;

  const createSvg = (name, attrs = {}) => {
    const element = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };

  const escapeHTML = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const updateBasinReadout = (basin) => {
    if (!readout) return;
    readout.innerHTML = `
      <p class="section-kicker">Visited catchment</p>
      <h3>${escapeHTML(basin.name)}</h3>
      <p>${escapeHTML(basin.description)}</p>
    `;
  };

  mapCard?.classList.add("has-hydrobasins");
  riverLayer?.replaceChildren();
  visitedLayer.replaceChildren();

  let backgroundLayer = root.querySelector("[data-hydrobasins-background]");
  if (!backgroundLayer) {
    backgroundLayer = createSvg("g", {
      class: "hydrobasins-background",
      "data-hydrobasins-background": "",
      "aria-hidden": "true",
    });
    svg.insertBefore(backgroundLayer, riverLayer || visitedLayer);
  }
  backgroundLayer.replaceChildren();

  data.background?.forEach((pathData) => {
    backgroundLayer.appendChild(createSvg("path", {
      class: "hydrobasin-bg",
      d: pathData,
      "fill-rule": "evenodd",
      vectorEffect: "non-scaling-stroke",
    }));
  });

  data.visited?.forEach((basin) => {
    const group = createSvg("g", {
      class: "visited-basin-group hydrobasin-visited-group",
      tabindex: "0",
      role: "button",
      "aria-label": basin.name,
    });

    basin.paths?.forEach((pathData) => {
      group.appendChild(createSvg("path", {
        class: "visited-basin hydrobasin-visited-basin",
        d: pathData,
        "fill-rule": "evenodd",
        vectorEffect: "non-scaling-stroke",
      }));
    });

    const label = createSvg("text", {
      class: "visited-label hydrobasin-label",
      x: basin.labelPoint?.[0] ?? 0,
      y: basin.labelPoint?.[1] ?? 0,
    });
    label.textContent = basin.label;
    group.appendChild(label);

    group.addEventListener("mouseenter", () => updateBasinReadout(basin));
    group.addEventListener("focus", () => updateBasinReadout(basin));
    group.addEventListener("click", () => updateBasinReadout(basin));
    visitedLayer.appendChild(group);
  });
})();
