import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../assets/publication-previews.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/publication-previews/manifest.json', import.meta.url)));
const html = fs.readFileSync(new URL('../publications.html', import.meta.url), 'utf8');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.events = {};
    this.open = false;
  }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attrs[name] = value; }
  hasAttribute(name) { return name in this.attrs; }
  addEventListener(name, callback) { this.events[name] = callback; }
  set src(value) { this.attrs.src = value; }
}

function setup(response = { ok: true, json: async () => manifest }, { stableIds = true, descending = true } = {}) {
  const items = Array.from({ length: 21 }, (_, i) => {
    const copy = new Element('div');
    copy.querySelector = () => ({ textContent: `Paper ${i + 1}` });
    return {
      copy,
      querySelector: (selector) => selector === '.pub-index'
        ? {
          textContent: String(descending ? 21 - i : i + 1).padStart(2, '0'),
          getAttribute: (name) => stableIds && name === 'data-preview-number'
            ? String(i + 1).padStart(2, '0') : null,
        } : copy,
    };
  });
  const document = {
    querySelector: () => ({ querySelectorAll: () => items }),
    createElement: (tag) => new Element(tag),
  };
  const context = vm.createContext({ document, fetch: async () => response, console: { warn() {} } });
  vm.runInContext(source.replace(/\naddPublicationPreviews\(\);\s*$/, ''), context);
  return { items, context };
}

test('manifest has 19 unique verified preview assets', () => {
  assert.equal(manifest.length, 19);
  assert.equal(new Set(manifest.map((entry) => entry.number)).size, 19);
  for (const entry of manifest) {
    assert.ok(fs.existsSync(new URL(`../${entry.src}`, import.meta.url)));
    assert.equal(entry.width, 1600);
    assert.ok(entry.height > 600);
    assert.equal(entry.page, 1);
  }
});

test('previews start closed and fetch the image only when opened', async () => {
  const { items, context } = setup();
  await vm.runInContext('addPublicationPreviews()', context);
  assert.equal(items.filter((item) => item.copy.children.length > 0).length, 19);
  assert.equal(items[0].copy.children.length, 1);
  assert.equal(items[18].copy.children.length, 0);
  assert.equal(items[20].copy.children.length, 0);
  const details = items[0].copy.children[0];
  const [summary, figure] = details.children;
  const image = figure.children[0].children[0];
  assert.equal(details.open, false);
  assert.equal(image.hasAttribute('src'), false);
  assert.match(summary.attrs['aria-label'], /^Show first-page preview/);
  details.open = true;
  details.events.toggle();
  assert.equal(image.attrs.src, manifest[0].src);
  assert.match(summary.attrs['aria-label'], /^Hide first-page preview/);
  details.open = false;
  details.events.toggle();
  assert.match(summary.attrs['aria-label'], /^Show first-page preview/);
  image.events.error();
  assert.equal(figure.children[0].hidden, true);
  assert.equal(figure.children[2].hidden, false);
});

test('failed manifest leaves citations untouched', async () => {
  const { items, context } = setup({ ok: false });
  await vm.runInContext('addPublicationPreviews()', context);
  assert.equal(items.every((item) => item.copy.children.length === 0), true);
});

test('descending display labels preserve every paper-to-preview association', async () => {
  const { items, context } = setup();
  await vm.runInContext('addPublicationPreviews()', context);
  for (const entry of manifest) {
    const item = items[Number(entry.number) - 1];
    const details = item.copy.children[0];
    details.open = true;
    details.events.toggle();
    assert.equal(details.children[1].children[0].children[0].attrs.src, entry.src);
  }
});

test('legacy ascending markup still resolves previews', async () => {
  const { items, context } = setup(undefined, { stableIds: false, descending: false });
  await vm.runInContext('addPublicationPreviews()', context);
  assert.equal(items.filter((item) => item.copy.children.length > 0).length, 19);
});

test('paper and dataset labels count down while submitted manuscripts are unchanged', () => {
  const paperSection = html.split('id="peer-reviewed-articles"')[1].split('</section>')[0];
  const papers = Array.from(paperSection.matchAll(/<span class="pub-index" data-preview-number="(\d+)">(\d+)<\/span>/g));
  assert.equal(papers.length, 21);
  assert.deepEqual(papers.map((match) => match[1]), Array.from({ length: 21 }, (_, i) => String(i + 1).padStart(2, '0')));
  assert.deepEqual(papers.map((match) => match[2]), Array.from({ length: 21 }, (_, i) => String(21 - i).padStart(2, '0')));
  assert.match(paperSection, /<ol class="full-publication-list" reversed start="21">/);
  const datasets = html.split('id="published-datasets"')[1].split('</section>')[0];
  assert.deepEqual(Array.from(datasets.matchAll(/<span class="pub-index">(D\d+)<\/span>/g), (match) => match[1]),
    Array.from({ length: 9 }, (_, i) => `D${9 - i}`));
  assert.match(datasets, /<ol class="full-publication-list dataset-list" reversed start="9">/);
  const submitted = html.split('id="submitted-manuscripts"')[1].split('</section>')[0];
  assert.deepEqual(Array.from(submitted.matchAll(/<span class="pub-index">(S\d+)<\/span>/g), (match) => match[1]),
    ['S1', 'S2', 'S3', 'S4']);
});
