(() => {
  const atlas = document.querySelector("[data-field-atlas]");
  if (!atlas) return;

  atlas.querySelectorAll("[data-atlas-interpretation]").forEach((feature) => {
    const toggle = feature.querySelector("[data-atlas-toggle]");
    const annotations = feature.querySelector("[data-atlas-annotations]");
    const notes = feature.querySelector("[data-atlas-notes]");
    const markers = [...feature.querySelectorAll("[data-note]")];
    const noteItems = [...feature.querySelectorAll("[data-atlas-note]")];

    const select = (key) => {
      markers.forEach((marker) => marker.setAttribute("aria-pressed", String(marker.dataset.note === key)));
      noteItems.forEach((note) => { note.hidden = note.dataset.atlasNote !== key; });
    };

    toggle.addEventListener("click", () => {
      const visible = annotations.hidden;
      annotations.hidden = !visible;
      notes.hidden = !visible;
      toggle.setAttribute("aria-expanded", String(visible));
      toggle.textContent = visible ? "Hide interpretation" : "Read the landscape";
      if (visible) select(feature.dataset.atlasDefault);
    });

    markers.forEach((marker) => marker.addEventListener("click", () => select(marker.dataset.note)));
  });
})();
