const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
function closeMenu() {
  toggle.setAttribute('aria-expanded', 'false');
  nav.classList.remove('open');
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
});
for (const link of nav.querySelectorAll('a')) {
  link.addEventListener('click', closeMenu);
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    toggle.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.nav-wrap')) closeMenu();
});
const views = [...document.querySelectorAll('[data-view]')];
function route(event) {
  for (const video of document.querySelectorAll('video')) video.pause();
  const key = location.hash.slice(1) || 'overview';
  const view = views.find((section) => section.dataset.view === key) || views[0];
  for (const section of views) section.hidden = section !== view;
  const previewSuffix = document.querySelector('.preview-note') ? ' | Design Preview' : '';
  document.title = `${view.dataset.title} | Tools | Yutian Ke${previewSuffix}`;
  closeMenu();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (event?.type === 'hashchange' || event?.focusContent) {
    const heading = view.querySelector('h1');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}
window.addEventListener('hashchange', route);
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-route]');
  if (link && link.hash === location.hash) {
    event.preventDefault();
    route({ focusContent: true });
  }
});
for (const player of document.querySelectorAll('.field-player')) {
  const video=player.querySelector('video');
  const button=player.querySelector('.video-play');
  button.addEventListener('click', () => {
    video.play().catch(() => { button.hidden=false; });
  });
  video.addEventListener('play', () => {
    button.hidden=true;
    for (const other of document.querySelectorAll('video')) {
      if (other!==video) other.pause();
    }
  });
  video.addEventListener('pause', () => { button.hidden=false; });
  video.addEventListener('ended', () => { button.hidden=false; });
}
route();
