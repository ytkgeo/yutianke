import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../assets/analytics-privacy.js', import.meta.url), 'utf8');

function filter({ hostname = 'ytkgeo.github.io', pathname = '/yutianke/about.html', ...navigator } = {}) {
  const window = {};
  vm.runInNewContext(source, { window, location: { hostname, pathname }, navigator, URL });
  return window.sanitizeSiteAnalytics;
}

test('records only the production site, not local previews or other projects', () => {
  assert.equal(filter({ hostname: 'localhost' })('event', {}), false);
  assert.equal(filter({ hostname: '127.0.0.1' })('event', {}), false);
  assert.equal(filter({ pathname: '/another-project/' })('event', {}), false);
  assert.equal(filter({ pathname: '/yutianke-other/' })('event', {}), false);
  assert.ok(filter({ pathname: '/yutianke/' })('event', {}));
});

test('honors Do Not Track and Global Privacy Control', () => {
  assert.equal(filter({ doNotTrack: '1' })('event', {}), false);
  assert.equal(filter({ globalPrivacyControl: true })('event', {}), false);
  assert.ok(filter({ doNotTrack: '0' })('event', {}));
});

test('strips referral query strings and fragments without mutating the payload', () => {
  const payload = { url: '/yutianke/about.html', referrer: 'https://example.org/search?email=private#token' };
  const clean = filter()('event', payload);
  assert.equal(clean.referrer, 'https://example.org/search');
  assert.equal(clean.url, payload.url);
  assert.equal(payload.referrer, 'https://example.org/search?email=private#token');
  assert.equal(filter()('event', { referrer: 'invalid url' }).referrer, '');
  assert.equal(filter()('event', { referrer: '' }).referrer, '');
});

test('every site page has exactly one tracker with privacy defaults and a disclosure link', () => {
  for (const name of ['index', 'about', 'publications', 'latest-updates', 'cv', 'field-atlas', 'privacy', 'tools']) {
    const html = fs.readFileSync(new URL(`../${name}.html`, import.meta.url), 'utf8');
    assert.equal((html.match(/src="https:\/\/cloud\.umami\.is\/script\.js"/g) || []).length, 1, name);
    assert.match(html, /data-website-id="ef0f36de-5029-474d-8e68-99545c7f9ebd"/);
    for (const attr of ['data-exclude-search', 'data-exclude-hash', 'data-do-not-track']) {
      assert.match(html, new RegExp(`${attr}="true"`));
    }
    assert.match(html, /data-domains="ytkgeo.github.io"/);
    assert.match(html, /data-before-send="sanitizeSiteAnalytics"/);
    assert.ok(html.indexOf('assets/analytics-privacy.js') < html.indexOf('https://cloud.umami.is/script.js'));
    assert.match(html, /href="privacy.html"/);
    assert.doesNotMatch(html, /data-(?:replay|distinct-id|performance|errors)=/);
  }
});
