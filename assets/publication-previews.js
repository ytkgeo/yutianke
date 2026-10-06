async function addPublicationPreviews() {
  const list = document.querySelector('#peer-reviewed-articles .full-publication-list');
  if (!list) return;
  try {
    const response = await fetch('assets/publication-previews/manifest.json');
    if (!response.ok) throw new Error('Preview manifest unavailable');
    const entries = await response.json();
    const previews = new Map(entries.map((entry) => [entry.number, entry]));
    list.querySelectorAll(':scope > li').forEach((item) => {
      const number = item.querySelector('.pub-index').textContent.trim();
      const entry = previews.get(number);
      if (!entry) return;
      const copy = item.querySelector(':scope > div');
      const title = copy.querySelector('a[href^="https://doi.org/"]')?.textContent.trim()
        || `publication ${number}`;
      const details = document.createElement('details');
      details.className = 'publication-preview';
      const summary = document.createElement('summary');
      summary.className = 'publication-preview-toggle';
      summary.setAttribute('aria-label', `Show first-page preview: ${title}`);
      summary.title = 'Show first-page preview';
      const symbol = document.createElement('span');
      symbol.className = 'publication-preview-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      summary.append(symbol);

      const figure = document.createElement('figure');
      figure.className = 'publication-preview-figure';
      const link = document.createElement('a');
      link.href = entry.src;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `Open larger first-page preview: ${title} (new tab)`);
      const image = document.createElement('img');
      image.alt = `First page through the end of the abstract: ${title}`;
      image.width = entry.width;
      image.height = entry.height;
      image.decoding = 'async';
      link.append(image);
      const caption = document.createElement('figcaption');
      caption.textContent = `First page through abstract${entry.version === 'Accepted manuscript' ? ' (accepted manuscript)' : ''}. Select the image to enlarge.`;
      const error = document.createElement('p');
      error.className = 'publication-preview-error';
      error.textContent = 'The preview could not load. Please use the paper link above.';
      error.hidden = true;
      image.addEventListener('error', () => {
        link.hidden = true;
        error.hidden = false;
      });
      figure.append(link, caption, error);
      details.append(summary, figure);
      details.addEventListener('toggle', () => {
        const action = details.open ? 'Hide' : 'Show';
        summary.setAttribute('aria-label', `${action} first-page preview: ${title}`);
        summary.title = `${action} first-page preview`;
        if (details.open && !image.hasAttribute('src')) image.src = entry.src;
      });
      copy.append(details);
    });
  } catch (error) {
    console.warn('Publication previews unavailable:', error);
  }
}

addPublicationPreviews();
