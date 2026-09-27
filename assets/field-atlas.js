(() => {
  const atlas = document.querySelector("[data-field-atlas]");
  if (!atlas) return;

  const toggle = atlas.querySelector("[data-atlas-toggle]");
  const annotations = atlas.querySelector("[data-atlas-annotations]");
  const notes = atlas.querySelector("[data-atlas-notes]");
  const markers = [...atlas.querySelectorAll("[data-note]")];
  const noteItems = [...atlas.querySelectorAll("[data-atlas-note]")];

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
    if (visible) select("scrolls");
  });

  markers.forEach((marker) => marker.addEventListener("click", () => select(marker.dataset.note)));
})();
