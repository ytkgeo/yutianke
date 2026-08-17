document.querySelectorAll('a[href*="DrM4zxoAAAAAJ"]').forEach((link) => {
  link.href = link.href.replace("DrM4zxoAAAAAJ", "DrM4zxoAAAAJ");
});

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const year = document.querySelector("#year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

(() => {
  const root = document.querySelector("[data-morepoc-map]");
  if (!root) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const fields = window.MOREPOC_FIELDS || [];
  const rawSites = window.MOREPOC_SITES || [];
  const sites = rawSites
    .map((row) => {
      if (!Array.isArray(row)) return row;
      return fields.reduce((site, field, index) => {
        site[field] = row[index];
        return site;
      }, {});
    })
    .filter((site) => Number.isFinite(site.lat) && Number.isFinite(site.lon));

  const riverLayer = root.querySelector("[data-morepoc-rivers]");
  const visitedLayer = root.querySelector("[data-morepoc-visited]");
  const pointsLayer = root.querySelector("[data-morepoc-points]");
  const mapCard = root.querySelector(".morepoc-map-card");
  const readout = root.querySelector("[data-morepoc-readout]");
  const basinToggle = root.querySelector("[data-morepoc-basins]");
  const pointsToggle = root.querySelector("[data-morepoc-points-toggle]");

  const project = ([lon, lat]) => ({
    x: ((lon + 180) / 360) * 1000,
    y: 20 + ((90 - lat) / 180) * 500,
  });

  const pathFromCoords = (coords, close = false) => {
    const projected = coords.map(project);
    const path = projected
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");
    return close ? `${path} Z` : path;
  };

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

  const formatValue = (value, suffix = "") => {
    if (!Number.isFinite(value)) return "not reported";
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
  };

  const updateReadout = (site) => {
    if (!readout) return;
    readout.innerHTML = `
      <p class="section-kicker">MOREPOC site</p>
      <h3>${escapeHTML(site.river || site.basin || "River site")}</h3>
      <p>${escapeHTML(site.basin || "Unspecified basin")} basin, ${escapeHTML(site.country || site.continent || "global dataset")}</p>
      <dl>
        <div><dt>Samples</dt><dd>${formatValue(site.n)}</dd></div>
        <div><dt>SPM</dt><dd>${formatValue(site.spm, " mg L-1")}</dd></div>
        <div><dt>POC</dt><dd>${formatValue(site.poc, " mg C L-1")}</dd></div>
        <div><dt>POC content</dt><dd>${formatValue(site.pct, "%")}</dd></div>
        <div><dt>d13C</dt><dd>${formatValue(site.d13c, " per mil")}</dd></div>
        <div><dt>F14C</dt><dd>${formatValue(site.f14c)}</dd></div>
      </dl>
    `;
  };

  const updateBasinReadout = (basin) => {
    if (!readout) return;
    readout.innerHTML = `
      <p class="section-kicker">Visited catchment</p>
      <h3>${escapeHTML(basin.name)}</h3>
      <p>${escapeHTML(basin.description)}</p>
    `;
  };

  const rivers = [
    [[-74, -4], [-70, -5], [-64, -4], [-58, -3], [-51, -1]],
    [[12, -6], [16, -4], [20, -2], [24, 0], [29, 2]],
    [[31, -1], [32, 8], [31, 18], [31, 26], [32, 31]],
    [[-111, 47], [-103, 45], [-95, 42], [-91, 36], [-90, 30]],
    [[77, 31], [82, 28], [88, 25], [91, 23]],
    [[98, 32], [104, 31], [110, 30], [116, 31], [121, 31]],
    [[96, 36], [103, 38], [110, 38], [116, 37], [119, 38]],
    [[104, 25], [108, 24], [111, 23], [114, 22]],
    [[122, 50], [128, 51], [134, 50], [140, 49]],
    [[-143, 64], [-151, 64], [-158, 62], [-163, 61]],
    [[122, 61], [128, 65], [126, 71], [123, 73]],
    [[-124, 56], [-128, 61], [-134, 68]],
  ];

  const visitedBasins = [
    {
      name: "Pearl River Basin",
      label: "Pearl",
      polygon: [[103, 27], [108, 28], [114, 25.5], [114.5, 22], [108, 21.5], [103, 24]],
      river: [[104.5, 25.8], [107, 24.5], [110, 23.3], [113.5, 22.7]],
      labelPoint: [110.5, 24],
      description: "South China field basin linking subtropical weathering, suspended sediment, and particulate organic carbon export.",
    },
    {
      name: "Yellow River Basin",
      label: "Yellow",
      polygon: [[95, 36], [101, 40.5], [110, 40.8], [119, 38.5], [118, 35.5], [108, 34], [99, 34.2]],
      river: [[96, 36.8], [102, 38.8], [109, 38.5], [115, 36.8], [119, 37.8]],
      labelPoint: [108, 39.8],
      description: "A high-sediment river system where channel-scale heterogeneity controls particulate organic carbon measurements.",
    },
    {
      name: "Changjiang River Basin",
      label: "Changjiang",
      polygon: [[90, 33], [99, 35], [110, 33.2], [122, 31.8], [121, 28], [108, 27], [95, 28.3]],
      river: [[91.5, 32.6], [99, 31.8], [106, 30.6], [114, 30.5], [121, 31.2]],
      labelPoint: [107, 30.7],
      description: "A large regulated basin for studying how cascade reservoirs reshape riverine particulate organic carbon fluxes.",
    },
    {
      name: "Heilongjiang-Amur Basin",
      label: "Heilongjiang",
      polygon: [[120, 49], [125, 53.2], [134, 53.5], [141, 49.2], [137, 46.2], [128, 45.2], [121, 46.2]],
      river: [[121, 49.8], [127, 50.8], [134, 50.2], [140, 49.1]],
      labelPoint: [132, 51.8],
      description: "A northern Asia basin connecting cold-region river dynamics, sediment transport, and carbon cycling.",
    },
    {
      name: "Yukon River Basin",
      label: "Yukon",
      polygon: [[-165, 60], [-159, 66], [-148, 67.5], [-139, 65], [-140, 61], [-153, 59.2], [-162, 58.8]],
      river: [[-140, 64.7], [-148, 64.1], [-155, 62.3], [-163, 61.2]],
      labelPoint: [-152, 65.7],
      description: "The Arctic field basin central to floodplain carbon storage, migration, mercury, sediment, and biomass datasets.",
    },
  ];

  rivers.forEach((coords) => {
    riverLayer?.appendChild(createSvg("path", { d: pathFromCoords(coords), vectorEffect: "non-scaling-stroke" }));
  });

  visitedBasins.forEach((basin) => {
    const group = createSvg("g", { class: "visited-basin-group", tabindex: "0", role: "button" });
    group.setAttribute("aria-label", basin.name);
    group.appendChild(createSvg("path", { class: "visited-basin", d: pathFromCoords(basin.polygon, true) }));
    group.appendChild(createSvg("path", { class: "visited-river", d: pathFromCoords(basin.river), vectorEffect: "non-scaling-stroke" }));
    const labelPoint = project(basin.labelPoint);
    const label = createSvg("text", { class: "visited-label", x: labelPoint.x.toFixed(1), y: labelPoint.y.toFixed(1) });
    label.textContent = basin.label;
    group.appendChild(label);
    group.addEventListener("mouseenter", () => updateBasinReadout(basin));
    group.addEventListener("focus", () => updateBasinReadout(basin));
    group.addEventListener("click", () => updateBasinReadout(basin));
    visitedLayer?.appendChild(group);
  });

  const pointClass = (site) => {
    if (!Number.isFinite(site.pct)) return "point-unknown";
    if (site.pct < 1.5) return "point-low";
    if (site.pct < 5) return "point-mid";
    return "point-high";
  };

  sites
    .slice()
    .sort((a, b) => (a.pct || 0) - (b.pct || 0))
    .forEach((site) => {
      const point = project([site.lon, site.lat]);
      const radius = Math.min(5.8, 1.8 + Math.sqrt(site.n || 1) * 0.38);
      const circle = createSvg("circle", {
        class: `morepoc-point ${pointClass(site)}`,
        cx: point.x.toFixed(1),
        cy: point.y.toFixed(1),
        r: radius.toFixed(2),
        tabindex: "0",
        role: "button",
        "aria-label": `${site.river || site.basin || "MOREPOC site"}: ${formatValue(site.pct, "% POC")}`,
      });
      const title = createSvg("title");
      title.textContent = `${site.river || site.basin || "MOREPOC site"}; POC content ${formatValue(site.pct, "%")}`;
      circle.appendChild(title);
      circle.addEventListener("mouseenter", () => updateReadout(site));
      circle.addEventListener("focus", () => updateReadout(site));
      circle.addEventListener("click", () => updateReadout(site));
      pointsLayer?.appendChild(circle);
    });

  basinToggle?.addEventListener("click", () => {
    const hidden = mapCard.classList.toggle("is-basins-hidden");
    basinToggle.classList.toggle("is-active", !hidden);
    basinToggle.setAttribute("aria-pressed", String(!hidden));
    basinToggle.textContent = hidden ? "Visited catchments off" : "Visited catchments on";
  });

  pointsToggle?.addEventListener("click", () => {
    const visible = mapCard.classList.toggle("is-points-visible");
    pointsToggle.classList.toggle("is-active", visible);
    pointsToggle.setAttribute("aria-pressed", String(visible));
    pointsToggle.textContent = visible ? "Hide MOREPOC data" : "Show MOREPOC data";
  });

  if (sites.length) {
    const yukonSite = sites.find((site) => site.basin === "Yukon") || sites[0];
    updateReadout(yukonSite);
  }
})();
// Archive sections are held at one shared height so the three read as equal
// blocks; anything below the fold is reached with the toggle. The control is
// hidden where a section already fits, so it never promises hidden content.
document.querySelectorAll(".update-list-toggle").forEach((toggle) => {
  const section = toggle.closest(".updates-list");
  const list = section && section.querySelector(".update-entry-list");
  if (!list) return;

  const overflows = () => list.scrollHeight > list.clientHeight + 2;

  const sync = () => {
    if (section.classList.contains("is-expanded")) return;
    toggle.hidden = !overflows();
  };

  toggle.addEventListener("click", () => {
    const open = section.classList.toggle("is-expanded");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open
      ? "Show fewer " + toggle.dataset.label
      : "Show all " + toggle.dataset.count + " " + toggle.dataset.label;
  });

  sync();
  window.addEventListener("resize", sync);
});

// Wall photos are cropped to a uniform grid, so clicking one opens the full
// frame uncropped. Keyboard reachable, and returns focus where it started.
(() => {
  const items = [...document.querySelectorAll(".photo-wall-item")];
  if (!items.length) return;

  const box = document.createElement("div");
  box.className = "lightbox";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="Close">&times;</button>' +
    '<figure><img alt=""><figcaption></figcaption></figure>';
  document.body.appendChild(box);

  const img = box.querySelector("img");
  const cap = box.querySelector("figcaption");
  const closeBtn = box.querySelector(".lightbox-close");
  let opener = null;

  const open = (figure) => {
    const source = figure.querySelector("img");
    if (!source) return;
    opener = figure;
    img.src = source.currentSrc || source.src;
    img.alt = source.alt || "";
    cap.textContent = figure.querySelector("figcaption")?.textContent || "";
    box.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };

  const close = () => {
    box.hidden = true;
    img.removeAttribute("src");
    document.body.style.overflow = "";
    opener?.focus();
    opener = null;
  };

  items.forEach((figure) => {
    figure.tabIndex = 0;
    figure.setAttribute("role", "button");
    figure.addEventListener("click", () => open(figure));
    figure.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(figure);
      }
    });
  });

  closeBtn.addEventListener("click", close);
  box.addEventListener("click", (event) => {
    if (event.target === box || event.target.tagName === "FIGURE") close();
  });
  document.addEventListener("keydown", (event) => {
    if (!box.hidden && event.key === "Escape") close();
  });
})();
