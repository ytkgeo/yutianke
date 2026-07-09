# Field Work Globe Design

## Goal

Add an animated Earth panel at the bottom of the Field Work section on `latest-updates.html`. It should make the field archive easier to scan by showing river and basin patterns on a rotating globe and marking the places where Yutian Ke has worked.

## Scope

- Add one responsive field-site globe panel below the Field Work archive.
- Reuse the published `assets/hydrobasins-map.js` HydroATLAS display asset as the geographic surface layer.
- Use an HTML canvas for the animation. No external map, WebGL, or analytics dependency is introduced.
- Add an accessible play/pause control and a concise field-site legend.
- Do not change the conference, invited-talk, publication, About, or CV content.

## Experience

The panel is a dark, circular Earth viewed as an orthographic globe. A soft atmosphere, day/night edge shading, subtle graticule, and slowly moving HydroATLAS basin and river patterns make the globe feel dimensional rather than like a flat map.

The Earth rotates continuously at a quiet, readable pace. It pauses while the pointer is over the globe, when it has keyboard focus, and after a marker is selected. The play/pause control restores movement. `prefers-reduced-motion` starts the component paused.

Field markers use a warm clay color with a soft pulse. Selecting a marker reveals its site label and associated campaign years without opening a new page.

## Field Locations

The component keeps one coordinate record per site, with campaign years shown in the marker label:

- Huslia, Alaska: 2024 and 2026 Koyukuk River campaigns.
- Beaver, Alaska: 2022 and 2023 Yukon River campaigns.
- Alakanuk, Alaska: 2023 Yukon River and Yukon Delta campaigns.
- Fuyuan, China: 2018 Heilongjiang River campaign.
- Pingliang, China: 2014 landslide survey and 2016 Kongtong Mountain investigation.
- Baiyin/Jingtai, China: 2015 Stone Forest survey.
- Linxia, China: 2015 Loess Plateau landslide survey.

## Technical Design

`assets/field-globe.js` owns the component. It reads a small site-location array, draws the globe at device-pixel-ratio resolution, and uses `requestAnimationFrame` only while rotation is allowed.

The existing HydroATLAS map paths supply a thematic equirectangular basin surface. The canvas moves that surface under a circular Earth mask and layers it with river-like linework, graticules, atmospheric shading, and a terminator gradient. Field pins use latitude/longitude orthographic calculations. The result is an expressive field-site globe, not a quantitative map projection, and avoids downloading a large global dataset at page load.

Markers are projected from latitude/longitude into the circular view. Markers on the far side are hidden. Hit-testing uses each visible marker position, allowing pointer and keyboard activation. The active marker pauses rotation and updates an accessible live label.

The HTML adds a `data-field-globe` section with the canvas, controls, fallback text, and site legend. `latest-updates.html` loads `hydrobasins-map.js` before `field-globe.js`. New CSS in `assets/site-enhancements.css` handles the panel, canvas, labels, glow, controls, and responsive layout.

## Accessibility and Resilience

- Canvas has an adjacent text summary and a live region for the selected site.
- Play/pause is a real button with an accurate pressed state.
- Hover, focus, click, and touch all stop motion predictably.
- Reduced-motion visitors receive a still initial globe.
- If canvas or HydroATLAS data is unavailable, the field-site legend remains usable and visible.

## Verification

- Confirm the panel is present only below Field Work.
- Confirm all seven locations are represented and selectable.
- Confirm automatic rotation, hover/focus pause, marker-click pause, and play/pause behavior.
- Confirm reduced-motion behavior and a small-screen layout.
- Confirm the page remains valid HTML and no external network request is introduced.
