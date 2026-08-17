#!/usr/bin/env python3
"""Refresh the Google Scholar citation count embedded in the site.

Run from this machine to update the number on the home and publications pages:

    python3 scripts/update_scholar.py            # rewrite the HTML only
    python3 scripts/update_scholar.py --publish  # rewrite, commit and push

Why this is not automated: Google Scholar has no public API and sends no CORS
headers, so a browser cannot read it on page load. Running it from GitHub
Actions does not work either -- Scholar answers 403 Forbidden to datacenter
IPs (verified: run 31981607137). It does answer a normal residential
connection, so this runs locally instead.

If hands-off daily updates are wanted, the practical route is a Scholar API
provider such as SerpApi (free tier ~100 queries/month) with the key held as
a GitHub Actions secret; that request originates from the provider, not from
the runner, so it is not blocked.

Exits non-zero if the profile cannot be read, so a stale number is visible as
a failure rather than passing silently.
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


def publish(changed: list[str]) -> None:
    import subprocess
    subprocess.run(["git", "add", *changed], check=True)
    subprocess.run(["git", "commit", "-m",
                    "Update Google Scholar citation count"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("committed and pushed")


def main() -> int:
    try:
        total = fetch_citations()
    except (urllib.error.URLError, RuntimeError, ValueError) as exc:
        print(f"error: could not read the Scholar profile: {exc}", file=sys.stderr)
        return 1

    changed = update_pages(total)
    if not changed:
        print(f"citations={total}; already current")
        return 0

    print(f"citations={total}; updated {', '.join(changed)}")
    if "--publish" in sys.argv:
        publish(changed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
