import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../latest-updates.html', import.meta.url), 'utf8');
const sections = new Map([
  ['conferences', { count: 15, label: 'presentations' }],
  ['invited-talks', { count: 7, label: 'talks' }],
  ['field-work', { count: 10, label: 'campaigns' }],
]);

function section(id) {
  return html.split(`id="${id}"`)[1].split('</section>')[0];
}

test('all three update lists count down and retain matching expansion counts', () => {
  for (const [id, { count, label }] of sections) {
    const markup = section(id);
    const labels = Array.from(markup.matchAll(/<span class="update-number">(\d+)<\/span>/g), (match) => match[1]);
    assert.deepEqual(labels, Array.from({ length: count }, (_, i) => String(count - i).padStart(2, '0')), id);
    assert.ok(markup.includes(`aria-controls="${id}-list" data-count="${count}" data-label="${label}">Show all ${count} ${label}</button>`));
  }
});

test('the 2026 USC P/E seminar is first and existing invited talks remain in order', () => {
  const markup = section('invited-talks');
  const titles = Array.from(markup.matchAll(/<strong>(.*?)<\/strong>/g), (match) => match[1]);
  assert.deepEqual(titles, [
    'Following organic carbon through Arctic river corridors',
    'Organic carbon degradation in Arctic floodplains over millennia',
    'Organic carbon transport and fate in large rivers',
    'Anthropogenic regulation on organic carbon transport and preservation in the Yangtze River',
    'A preliminary look into the composition of fluvial organic carbon in the Yukon River',
    'Landscape hazard chains in the Kongtong Mountain Geopark',
    'Loess failure induced by differential mudrock weathering due to agriculture irrigation',
  ]);
  assert.ok(markup.includes('<small>USC | P/E seminar | 2026</small>'));
});

test('field campaigns retain their expandable photo panels', () => {
  const markup = section('field-work');
  assert.equal((markup.match(/<details class="update-entry">/g) || []).length, 10);
  assert.equal((markup.match(/class="update-entry-panel"/g) || []).length, 10);
  assert.ok(markup.includes('src="assets/home-drone-river.jpg"'));
});
