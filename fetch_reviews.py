#!/usr/bin/env python3
"""Refresh yelp-reviews.json from the business's Yahoo Local page.

Yahoo Local syndicates Yelp review data (rating, count, 5 most recent review
excerpts with Yelp permalinks) and — unlike yelp.com — serves it to
datacenter IPs. This avoids both Elfsight and Yelp's paid Fusion API.

Usage:
    python3 fetch_reviews.py [--out yelp-reviews.json] [--html cached.html]

Notes:
  - Per-review star ratings are not exposed in the Yahoo markup; reviews
    default to 5 stars (this business is 30/31 five-star). Edit the JSON by
    hand if a non-5-star review ever surfaces in the excerpt list.
  - Best-effort parser; if Yahoo changes markup, edit the JSON manually.
"""
import argparse
import datetime
import html
import json
import re
import sys
import urllib.request

YAHOO_URL = "https://local.yahoo.com/info-239038745-pawfect-grooming-bellevue/"
BIZ = {
    "name": "Pawfect Grooming",
    "url": "https://www.yelp.com/biz/pawfect-grooming-bellevue-2",
    "write_review_url": "https://www.yelp.com/writeareview/biz/IDhGAtyq6X7eYqP5ThIDqQ",
}
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="ignore")


def parse(page: str) -> dict:
    # Overall rating + count: rendered near the Yelp attribution link.
    rating = None
    count = None
    m = re.search(r">(\d\.\d)<", page)
    if m:
        rating = float(m.group(1))
    m = re.search(r">(\d+)\s*reviews?<", page)
    if m:
        count = int(m.group(1))

    # Review blocks: <span ...>NAME</span><span ...>MM/DD/YY</span> ...
    # <p class="line-clamp-3">TEXT</p> ... hrid=XXXX
    rx = re.compile(
        r'text-muted">([^<]{2,40})</span>'
        r'<span[^>]*text-muted">(\d{2}/\d{2}/\d{2})</span>'
        r'.{0,400}?<p class="line-clamp-3">(.*?)</p>'
        r'.{0,2000}?hrid=([A-Za-z0-9_-]+)',
        re.S,
    )
    reviews = []
    seen = set()
    for name, date_us, text, hrid in rx.findall(page):
        if hrid in seen:
            continue
        seen.add(hrid)
        mm, dd, yy = date_us.split("/")
        iso = f"20{yy}-{mm}-{dd}"
        clean = html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
        reviews.append({
            "author": html.unescape(name).strip(),
            "rating": 5,  # not exposed by source; see module docstring
            "date": iso,
            "text": clean,
            "url": f"{BIZ['url']}?hrid={hrid}",
        })

    if not reviews:
        raise SystemExit("parser found no reviews — Yahoo markup changed; "
                         "update the regex or edit the JSON manually")

    reviews.sort(key=lambda r: r["date"], reverse=True)
    return {
        "business": {
            **BIZ,
            "rating": rating if rating is not None else 5.0,
            "review_count": count if count is not None else len(reviews),
        },
        "fetched_at": datetime.date.today().isoformat(),
        "source": "yelp via yahoo local syndication",
        "reviews": reviews,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="yelp-reviews.json")
    ap.add_argument("--html", help="parse a saved HTML file instead of fetching")
    ap.add_argument("--rating", type=float,
                    help="official yelp.com rating (canonical; syndication may round, "
                         "e.g. shows 5.0 when Yelp shows 4.9)")
    ap.add_argument("--trust-syndication", action="store_true",
                    help="accept the syndicated rating even if it differs from the existing file")
    args = ap.parse_args()

    prev = None
    try:
        with open(args.out) as f:
            prev = json.load(f)
    except (OSError, ValueError):
        pass

    page = open(args.html, errors="ignore").read() if args.html else fetch(YAHOO_URL)
    data = parse(page)

    # Rating honesty guard: never display a rating that overstates yelp.com.
    # Syndication rounds (Yahoo showed 5.0 while yelp.com showed 4.9), so the
    # official rating, once set, wins over the syndicated one.
    today = datetime.date.today().isoformat()
    if args.rating is not None:
        data["business"]["rating"] = args.rating
        data["business"]["rating_source"] = f"yelp.com official (manual, {today})"
    elif prev and not args.trust_syndication:
        pb = prev.get("business", {})
        old = pb.get("rating")
        new = data["business"]["rating"]
        if old is not None and abs(old - new) > 0.01:
            print(f"WARNING: syndication shows {new} but keeping existing {old} "
                  f"(official yelp.com rating wins; use --rating or --trust-syndication to change)")
            data["business"]["rating"] = old
            data["business"]["rating_source"] = pb.get("rating_source", "existing file (official)")

    with open(args.out, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    b = data["business"]
    print(f"wrote {args.out}: {b['rating']} stars, {b['review_count']} reviews, "
          f"{len(data['reviews'])} excerpts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
