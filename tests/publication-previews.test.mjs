import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../assets/publication-previews.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/publication-previews/manifest.json', import.meta.url)));

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

function setup(response = { ok: true, json: async () => manifest }) {
  const items = Array.from({ length: 21 }, (_, i) => {
    const copy = new Element('div');
    copy.querySelector = () => ({ textContent: `Paper ${i + 1}` });
    return {
      copy,
      querySelector: (selector) => selector === '.pub-index'
        ? { textContent: String(i + 1).padStart(2, '0') } : copy,
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
