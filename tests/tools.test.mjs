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
  }
  assert.match(html, /href="tools\.html" aria-current="page"/);
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
