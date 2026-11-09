import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const home = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const about = fs.readFileSync(new URL('../about.html', import.meta.url), 'utf8');
const cv = fs.readFileSync(new URL('../cv.html', import.meta.url), 'utf8');
const summary = 'I study the composition and fate of organic carbon from source to sink across river-floodplain corridors from the past to present, and the response to environmental changes.';

test('the homepage browser and sharing titles use the supplied research identity', () => {
  const title = 'Yutian Ke | Organic Carbon Dynamics in Changing Landscapes';
  assert.ok(home.includes(`<title>${title}</title>`));
  assert.ok(home.includes(`<meta property="og:title" content="${title}">`));
  assert.doesNotMatch(home, /River Organic Carbon and Earth Surface Processes/);
});

test('the homepage contact invites conversations about carbon and geochemistry', () => {
  const contact = home.split('id="contact"')[1].split('</section>')[0];
  assert.ok(contact.includes("<h2>Let's talk about carbon in changing landscapes!</h2>"));
  assert.ok(contact.includes('<p>I welcome conversations about research collaborations, field projects, and Earth surface geochemistry.</p>'));
  assert.doesNotMatch(contact, /talk about rivers, mud|biogeochemistry/);
});

test('the About contact heading centers carbon in changing landscapes', () => {
  const contact = about.split('id="research-conversations"')[1].split('</section>')[0];
  assert.ok(contact.includes("<h2>Let's talk about carbon in changing landscapes.</h2>"));
});

test('Home and About use the same supplied carbon-centered summary', () => {
  for (const html of [home, about]) {
    assert.equal(html.split(`<p>${summary}</p>`).length - 1, 1);
    assert.ok(!html.includes('I study how sediment transport and landscape evolution regulate'));
  }
});

test('the introduction identifies geochemistry and the six research bullets match the supplied copy', () => {
  assert.doesNotMatch(home, /Brief introduction/i);
  assert.ok(home.includes('<p>I am a geochemist studying sources, degradation, and fate of organic carbon in river corridors. My current work focuses on carbon in river water, fluvial muds, permafrost floodplains, and deltas.</p>'));
  const expertise = home.split('<div class="expertise-card">')[1].split('</ul>')[0];
  const bullets = Array.from(expertise.matchAll(/<li>(.*?)<\/li>/g), (match) => match[1]);
  assert.deepEqual(bullets, [
    'Organic carbon composition distribution matrix: isotopes, age, activation energy, and molecules.',
    'Organic carbon preservation, degradation, and burial in water, soils, and sediments.',
    'Critical zone processes and carbon cycling.',
    'Mud and carbon flocculation interactions with biogeochemical cycling.',
    'Carbon cycling and climate feedback of a changing cryosphere.',
    'Carbon cycling under anthropogenic forcing.',
  ]);
  assert.ok(about.includes('<h1>The fate of carbon in changing landscapes</h1>'));
  assert.ok(home.includes("<h2>Earth's carbon cycle</h2>"));
});

test('the homepage research labels follow source, transport, and fate', () => {
  const labels = Array.from(home.matchAll(/<span class="card-tag">(.*?)<\/span>/g), match => match[1]);
  assert.deepEqual(labels, ['Source', 'Transport', 'Fate']);
});

test('the homepage has the supplied headline and concise carbon-centered research themes', () => {
  assert.ok(home.includes('<h1>The carbon cycle in changing and active river landscapes</h1>'));
  const research = home.split('<div class="research-grid research-grid-visual">')[1].split('</section>')[0];
  const descriptions = Array.from(research.matchAll(/<p>(.*?)<\/p>/g), (match) => match[1]);
  assert.deepEqual(descriptions, [
    'I study how carbon cycling responds to landscape changes driven by climate and human activities, including permafrost thaw and dam construction.',
    'I study mineral–organic carbon interactions during river transport and flocculation, linking the physical and biogeochemical behavior of organic carbon.',
    'I study the fate of deeply buried carbon re-exposed by rivers and redeposited in floodplains, where transient storage can last millennia.',
  ]);
  assert.ok(descriptions.every((description) => description.split(/\s+/).length <= 30));
  const css = fs.readFileSync(new URL('../assets/site-enhancements.css', import.meta.url), 'utf8');
  const cardCopyRule = css.match(/\.research-card-copy\{([^}]+)\}/)[1];
  assert.ok(cardCopyRule.includes('margin-top:0;'));
  assert.ok(!cardCopyRule.includes('margin-top:auto'));
});

test('selected publications omit figure-credit rows while preserving paper links and thumbnails', () => {
  const publications = home.split('<section class="section publications-preview">')[1].split('</section>')[0];
  assert.doesNotMatch(publications, /figure-credit|Original paper|CC BY/);
  assert.equal((publications.match(/<article class="publication reveal">/g) || []).length, 4);
  assert.equal((publications.match(/<h3><a href="https:\/\/doi\.org\//g) || []).length, 4);
  assert.equal((publications.match(/class="publication-figure"/g) || []).length, 4);
  assert.match(publications, /href="assets\/ke-2025-changjiang-research-highlight\.pdf"/);
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
