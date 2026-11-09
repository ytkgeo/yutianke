import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../tools.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../assets/tools/tools.js', import.meta.url), 'utf8');
const viewIds = ['overview', 'geochemistry', 'sediment', 'surveys', 'fluxes', 'sampling'];

test('Tools is discoverable in every primary site navigation', () => {
  for (const page of ['index', 'about', 'publications', 'latest-updates', 'cv', 'field-atlas', 'privacy', 'tools']) {
    const markup = fs.readFileSync(new URL(`../${page}.html`, import.meta.url), 'utf8');
    const nav = markup.match(/<nav[^>]+id="site-nav"[\s\S]*?<\/nav>/)[0];
    assert.equal((nav.match(/href="tools\.html"/g) || []).length, 1, page);
    assert.ok(nav.indexOf('href="tools.html"') < nav.indexOf('href="about.html"'), page);
  }
  assert.match(html, /href="tools\.html" aria-current="page"/);
});

test('the overview links show category names without summaries or technique counts', () => {
  const overviewList = html.match(/<ol class="methods-index">([\s\S]*?)<\/ol>/)[1];
  assert.equal((overviewList.match(/<li>/g) || []).length, 5);
  assert.doesNotMatch(overviewList, /<small>|techniques|Carbon sources, age|Grain size, sediment texture/);
});

test('sampling is first and category numbering and navigation stay consistent', () => {
  const categoryIds = ['sampling', 'geochemistry', 'sediment', 'surveys', 'fluxes'];
  const overviewList = html.match(/<ol class="methods-index">([\s\S]*?)<\/ol>/)[1];
  const overviewItems = Array.from(overviewList.matchAll(/<li>(.*?)<\/li>/g), match => match[1]);
  assert.deepEqual(overviewItems.map(item => item.match(/href="#([^"]+)"/)[1]), categoryIds);
  assert.deepEqual(overviewItems.map(item => item.match(/class="method-number">(\d+)</)[1]), ['01', '02', '03', '04', '05']);
  const categoryNavs = Array.from(html.matchAll(/<nav class="category-nav"[^>]*>(.*?)<\/nav>/g), match => match[1]);
  assert.equal(categoryNavs.length, 5);
  for (const nav of categoryNavs) {
    assert.deepEqual(Array.from(nav.matchAll(/href="#([^"]+)"/g), match => match[1]), categoryIds);
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
  }
  for (const [index, id] of categoryIds.entries()) {
    const category = html.split(`id="${id}" data-view="${id}"`)[1];
    assert.equal(category.match(/class="banner-kicker">(\d+) \/ Research tools/)[1], String(index + 1).padStart(2, '0'));
  }
});

test('method wording reflects the requested research purposes and laboratory experience', () => {
  const description = (id) => html.split(`id="method-${id}"`)[1].match(/<p class="method-description">(.*?)<\/p>/)[1];
  assert.match(html, /connect carbon composition to its transformation pathways and fate\./);
  assert.match(description('ea'), /constraints on organic carbon transport and composition\./);
  assert.doesNotMatch(description('ea'), /transport, storage/);
  assert.match(description('irms'), /organic matter composition and alteration during river transport and deposition/);
  assert.match(html, /<h2 id="title-ams">Mini Carbon Dating System \(MICADAS\)<\/h2>/);
  const ams = description('ams');
  assert.match(ams, /where I operated ECHoMICADAS/);
  assert.ok(ams.indexOf('LSCE') < ams.indexOf('millennial timescales') && ams.indexOf('millennial timescales') < ams.indexOf('additional experience at NOSAMS'));
  assert.match(description('rpo'), /I carried out ramped pyrolysis \(RP\) at NOSAMS\./);
  assert.match(description('rpo'), /Coupling these measurements with radiocarbon and stable isotope analyses provides stronger constraints/);
  assert.match(description('icp-ms'), /primarily.*inorganic elemental compositions/);
  assert.doesNotMatch(description('icp-ms'), /chemical weathering/);
  assert.match(description('laser-size'), /characterize suspended and bed sediments and floodplain deposits/);
  assert.doesNotMatch(description('ph'), /abrasion/);
  assert.equal(description('rhizon'), 'Rhizon samplers use suction to collect filtered porewater through a porous polymer membrane from sediments and soils with relatively little disturbance.');
});

test('the published page retains all 26 approved methods in six addressable reading views', () => {
  assert.deepEqual(Array.from(html.matchAll(/data-view="([^"]+)"/g), match => match[1]), viewIds);
  for (const id of viewIds) assert.match(html, new RegExp(`id="${id}" data-view="${id}"`));
  const methods = Array.from(html.matchAll(/id="method-([^"]+)"/g), match => match[1]);
  assert.equal(methods.length, 26);
  assert.equal(new Set(methods).size, 26);
  assert.equal((html.match(/class="method-description"/g) || []).length, 26);
  assert.match(html, /<noscript>.*\[data-view\]\[hidden\]/);
});

test('Tools is production-ready and contains no private preview notices or provenance', () => {
  assert.match(html, /rel="canonical" href="https:\/\/ytkgeo\.github\.io\/yutianke\/tools\.html"/);
  assert.doesNotMatch(html, /noindex|nofollow|Design Preview|Private design preview|Not published|Photo provided|Your Downloads|website collection|\/Users\//);
  assert.doesNotMatch(html, /data:(?:image|video)\//);
  assert.doesNotMatch(html, /photo-manifest|video-manifest|scientific-notes/);
  for (const filename of ['tools-content.json', 'photo-manifest.json', 'video-manifest.json', 'scientific-notes.md']) {
    assert.equal(fs.existsSync(new URL(`../assets/tools/${filename}`, import.meta.url)), false);
  }
});

test('every local Tools asset and site link resolves without duplicating large media', () => {
  const references = Array.from(html.matchAll(/(?:src|href|poster)="([^"]+)"/g), match => match[1]);
  for (const reference of references) {
    if (/^(https?:|#)/.test(reference)) continue;
    const filename = reference.split(/[?#]/)[0];
    assert.ok(filename, reference);
    assert.ok(fs.existsSync(new URL(`../${filename}`, import.meta.url)), reference);
  }
  assert.ok(Buffer.byteLength(html) < 100_000);
  const clips = references.filter(reference => reference.endsWith('.mp4'));
  assert.equal(clips.length, 5);
  assert.equal(new Set(clips).size, 4);
  for (const clip of new Set(clips)) assert.ok(fs.statSync(new URL(`../${clip}`, import.meta.url)).size < 10_000_000);
});

test('only the approved personal photos appear and text-only methods stay photo-free', () => {
  const withoutPhotos = ['ea', 'irms', 'di-irms', 'xrf', 'icp-ms', 'sem-eds', 'raman', 'bet', 'adcp', 'ph', 'van-dorn', 'ponar', 'rhizon'];
  for (const id of withoutPhotos) {
    const section = html.split(`id="method-${id}"`)[1].split('</section>')[0];
    assert.doesNotMatch(section, /<img\b|method-figure/);
  }
  assert.match(html, /ECHoMICADAS at LSCE, CEA, Université Paris-Saclay/);
  assert.match(html, /Coulter LS particle-size analysis at ENS Paris, France/);
  assert.match(html, /LiCOR-floating chamber/);
  assert.match(html, /<figcaption>LISST-CTD<\/figcaption>/);
});

test('videos stay click-to-play and the revised placements and captions are preserved', () => {
  const videos = Array.from(html.matchAll(/<video\b[^>]*>/g), match => match[0]);
  assert.equal(videos.length, 5);
  for (const video of videos) {
    assert.match(video, /controls/);
    assert.match(video, /playsinline/);
    assert.match(video, /preload="none"/);
    assert.doesNotMatch(video, /autoplay|loop/);
  }
  assert.ok(html.indexOf('id="method-adcp"') < html.indexOf('aria-label="Field survey videos"'));
  const sampling = html.split('data-view="sampling"')[1];
  assert.match(sampling, /Sampling from the river/);
  assert.match(sampling, /data-video-id="boat-survey"/);
  assert.doesNotMatch(html, /data-video-id="deposits-overview"/);
  assert.match(html, /An aerial view of the Yukon delta\./);
  assert.match(script, /video\.pause\(\)/);
  assert.match(script, /if \(other!==video\) other\.pause\(\)/);
});
