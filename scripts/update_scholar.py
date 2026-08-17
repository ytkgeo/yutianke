#!/usr/bin/env python3
"""Refresh the Google Scholar citation count embedded in the site.

Google Scholar has no public API and sends no CORS headers, so the browser
cannot read it directly -- a page-load-time "live" number is not possible for
a static site. This script runs server-side (see
.github/workflows/update-citations.yml) and rewrites the number in the HTML,
so the published figure tracks Scholar automatically instead of being a
hand-edited constant.

Exits non-zero if the profile cannot be read, so a silently stale number
surfaces as a failed workflow run rather than going unnoticed.
"""
from __future__ import annotations

import datetime as dt
import pathlib
import re
import sys
import urllib.error
import urllib.request

PROFILE = "https://scholar.google.com/citations?user=DrM4zxoAAAAJ&hl=en"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
PAGES = ("index.html", "publications.html")


def fetch_citations() -> int:
    req = urllib.request.Request(PROFILE, headers={
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", "replace")

    if "not a robot" in html or "unusual traffic" in html.lower():
        raise RuntimeError("Google Scholar served a bot challenge instead of the profile")

    # The stats table lists citations, h-index and i10 as .gsc_rsb_std cells;
    # the first is total citations (all time).
    values = re.findall(r'gsc_rsb_std[^>]*>([\d,]+)<', html)
    if not values:
        raise RuntimeError("citation table not found in the Scholar response")

    total = int(values[0].replace(",", ""))
    if total <= 0:
        raise RuntimeError(f"implausible citation total: {total}")
    return total


def update_pages(total: int) -> list[str]:
    pretty = f"{total:,}"
    today = dt.date.today().strftime("%-d %B %Y")
    changed = []

    for name in PAGES:
        path = pathlib.Path(name)
        text = path.read_text()
        before = text

        text = re.sub(r'(<strong data-scholar-citations>)[^<]*(</strong>)',
                      rf'\g<1>{pretty}\g<2>', text)
        text = re.sub(r'(<span data-scholar-checked>)[^<]*(</span>)',
                      rf'\g<1>{today}\g<2>', text)

        if text != before:
            path.write_text(text)
            changed.append(name)

    return changed


def main() -> int:
    try:
        total = fetch_citations()
    except (urllib.error.URLError, RuntimeError, ValueError) as exc:
        print(f"error: could not read the Scholar profile: {exc}", file=sys.stderr)
        return 1

    changed = update_pages(total)
    if changed:
        print(f"citations={total}; updated {', '.join(changed)}")
    else:
        print(f"citations={total}; already current")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
