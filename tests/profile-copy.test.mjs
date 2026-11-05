import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const home = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const about = fs.readFileSync(new URL('../about.html', import.meta.url), 'utf8');
const cv = fs.readFileSync(new URL('../cv.html', import.meta.url), 'utf8');
const summary = 'I study organic carbon degradation, storage, and remobilization from source to sink across river-floodplain corridors from the past to present, and how environmental changes alters the fate of carbon.';

test('Home and About use the same supplied carbon-centered summary', () => {
  for (const html of [home, about]) {
    assert.equal(html.split(`<p>${summary}</p>`).length - 1, 1);
    assert.ok(!html.includes('I study how sediment transport and landscape evolution regulate'));
  }
});

test('the introduction identifies geochemistry and the five research bullets match the supplied copy', () => {
  assert.ok(home.includes('<p>I am a geochemist studying sources, degradation, and fate of organic carbon in river corridors. My current work focuses on carbon in river water, fluvial muds, permafrost floodplains, and deltas.</p>'));
  const expertise = home.split('<div class="expertise-card">')[1].split('</ul>')[0];
  const bullets = Array.from(expertise.matchAll(/<li>(.*?)<\/li>/g), (match) => match[1]);
  assert.deepEqual(bullets, [
    'Critical zone processes and carbon cycling.',
    'Organic carbon preservation, degradation kinetics, and burial in water, soils, and sediments.',
    'Mud transport and flocculation interactions with biogeochemical cycling.',
    'Carbon cycling and climate feedback of a changing cryosphere.',
    'Carbon cycling under anthropogenic forcing.',
  ]);
  assert.ok(about.includes('<h1>The fate of carbon in changing landscapes</h1>'));
  assert.ok(home.includes("<h2>Earth's carbon cycle</h2>"));
});

test('CV teaching and mentoring reflect the supplied course and field details', () => {
  const teaching = cv.split('<p class="section-kicker">Teaching</p>')[1].split('</ul>')[0];
  const courses = Array.from(teaching.matchAll(/<li>(.*?)<\/li>/g), (match) => match[1]);
  assert.equal(courses.length, 5);
  assert.equal(courses[0], '<strong>2026:</strong> Ge125: Weathering and soil production, California Institute of Technology, with Prof. Michael Lamb.');
  assert.equal(courses[1], '<strong>2023:</strong> Ge125 Global Carbon Cycles, California Institute of Technology, with Prof. Michael Lamb.');
  assert.ok(!teaching.includes('GE121'));
  const mentoring = cv.split('<p class="section-kicker">Mentoring</p>')[1].split('</ul>')[0];
  assert.ok(mentoring.includes('<li><strong>2026:</strong> Benjamin Reynolds, Caltech graduate student, Field: lake breach and organic carbon export.</li>'));
});
