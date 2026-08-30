#!/usr/bin/env python3
"""Refresh yelp-reviews.json for the self-hosted reviews widget.

Two data sources:

  --serpapi KEY   Full pull via SerpAPI's Yelp Reviews engine
                  (https://serpapi.com/yelp-reviews-api). Fetches ALL
                  recommended reviews (num=49 covers this business in one
                  call) plus Yelp's hidden "not recommended" reviews via
                  not_recommended=true. Full texts, real per-review ratings,
                  avatar URLs. ~3 searches per refresh (free plan is fine).

  (default)       Yahoo Local syndication — keyless fallback. Carries the
                  5 most-recent review excerpts + rating/count. Serves
                  datacenter IPs, unlike yelp.com.

Guards (both modes):
  - Rating honesty: the official yelp.com rating, once set in the JSON,
    wins over any source that disagrees (Yahoo rounds 4.9 -> 5.0).
    Override with --rating or --trust-syndication.
  - Merge: never downgrade existing data. Full texts, avatars, real
    ratings, and reviews absent from the current source window are kept.
  - Positivity filter: only reviews with rating >= --min-rating (default 4)
    are written for display; the site is a testimonial wall, not a mirror.
"""
import argparse
import datetime
import html
import json
import re
import sys
import urllib.parse
import urllib.request

PLACE_ID = "IDhGAtyq6X7eYqP5ThIDqQ"
YAHOO_URL = "https://local.yahoo.com/info-239038745-pawfect-grooming-bellevue/"
BIZ = {
    "name": "Pawfect Grooming",
    "url": "https://www.yelp.com/biz/pawfect-grooming-bellevue-2",
    "write_review_url": "https://www.yelp.com/writeareview/biz/" + PLACE_ID,
}
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def http_get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", errors="ignore")


# ---------------------------------------------------------------- serpapi

def parse_serpapi_date(raw: str) -> str:
    """Recommended reviews use ISO ('2024-01-08T01:49:24Z'); the
    not_recommended feed uses M/D/YYYY ('11/30/2024')."""
    if not raw:
        return ""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return raw


def map_serpapi_review(r: dict, hidden: bool) -> dict:
    user = r.get("user") or {}
    comment = r.get("comment") or {}
    thumb = user.get("thumbnail") or ""
    out = {
        "author": user.get("name", "Yelp user").strip(),
        "rating": r.get("rating", 5),
        "date": parse_serpapi_date(r.get("date", "")),
        "text": (comment.get("text") or "").strip(),
        "url": BIZ["url"],
    }
    # Yelp's gray default-avatar assets are not real photos; let the widget
    # render its silhouette instead.
    if thumb and "default_avatar" not in thumb and "/assets/" not in thumb:
        out["avatar"] = thumb
    if hidden:
        out["hidden_by_yelp"] = True
    return out


def fetch_serpapi(api_key: str) -> list:
    NO_RESULTS = "hasn't returned any results"

    def call(params: dict) -> dict:
        params = dict(params, engine="yelp_reviews", place_id=PLACE_ID,
                      api_key=api_key, output="json")
        url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(params)
        data = json.loads(http_get(url))
        err = data.get("error") or ""
        if NO_RESULTS in err:
            return data  # empty result set (e.g. no hidden reviews) — not fatal
        if data.get("search_metadata", {}).get("status") == "Error" or err:
            raise SystemExit("serpapi error: " + str(err or data))
        return data

    reviews = []
    # recommended — minimal params only: adding num/sortby made the API return
    # "no results" for this place (verified live 2026-08-29). One page carries
    # up to 49 reviews; paginate defensively in case the count grows.
    start = 0
    while True:
        page = call({} if start == 0 else {"start": start})
        batch = page.get("reviews", [])
        reviews += [map_serpapi_review(r, hidden=False) for r in batch]
        if not (page.get("serpapi_pagination") or {}).get("next") or not batch:
            break
        start += len(batch)
        if start > 300:  # sanity ceiling
            break
    total = None
    try:
        total = page["search_information"]["total_results"]
    except (KeyError, TypeError):
        pass

    # hidden ("not currently recommended"): 10 per page
    nr_start = 0
    while True:
        page = call({"not_recommended": "true", "not_recommended_start": nr_start})
        batch = page.get("reviews", [])
        reviews += [map_serpapi_review(r, hidden=True) for r in batch]
        if not (page.get("serpapi_pagination") or {}).get("next") or not batch:
            break
        nr_start += len(batch)
        if nr_start > 200:
            break

    print(f"serpapi: {len(reviews)} reviews fetched "
          f"(recommended total per yelp: {total})")
    return reviews, total


# ----------------------------------------------------------------- yahoo

def parse_yahoo(page: str):
    rating = None
    count = None
    m = re.search(r">(\d\.\d)<", page)
    if m:
        rating = float(m.group(1))
    m = re.search(r">(\d+)\s*reviews?<", page)
    if m:
        count = int(m.group(1))
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
        clean = html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
        reviews.append({
            "author": html.unescape(name).strip(),
            "rating": 5,  # yahoo hides per-review stars; business is 30/31 5-star
            "date": f"20{yy}-{mm}-{dd}",
            "text": clean,
            "url": f"{BIZ['url']}?hrid={hrid}",
        })
    if not reviews:
        raise SystemExit("yahoo parser found no reviews — markup changed; "
                         "update the regex or use --serpapi")
    return reviews, rating, count


# ----------------------------------------------------------------- merge

def review_key(r: dict):
    m = re.search(r"hrid=([A-Za-z0-9_-]+)", r.get("url", ""))
    if m:
        return ("hrid", m.group(1))
    return ("authdate", r.get("author", ""), r.get("date", ""))


def merge(prev_reviews: list, new_reviews: list) -> list:
    """New data wins on text-length and presence; nothing existing is lost."""
    by_key = {}
    by_authdate = {}
    for pr in prev_reviews:
        by_key[review_key(pr)] = pr
        by_authdate[(pr.get("author"), pr.get("date"))] = pr
    out = []
    matched = set()
    for r in new_reviews:
        old = by_key.get(review_key(r)) or by_authdate.get((r.get("author"), r.get("date")))
        if old:
            matched.add(id(old))
            keep = dict(old)
            if len(r.get("text", "")) > len(keep.get("text", "")):
                keep["text"] = r["text"]
            for k in ("avatar", "rating", "date", "hidden_by_yelp"):
                if r.get(k) is not None:
                    keep[k] = r[k]
            # a review-level permalink (hrid) is better than the biz url
            if "hrid=" in old.get("url", "") and "hrid=" not in r.get("url", ""):
                keep["url"] = old["url"]
            elif "hrid=" in r.get("url", ""):
                keep["url"] = r["url"]
            out.append(keep)
        else:
            out.append(r)
    for pr in prev_reviews:
        if id(pr) not in matched:
            out.append(pr)
    # de-dup in case a review matched twice
    seen, dedup = set(), []
    for r in out:
        k = review_key(r)
        if k in seen:
            continue
        seen.add(k)
        dedup.append(r)
    dedup.sort(key=lambda r: r.get("date", ""), reverse=True)
    return dedup


# ------------------------------------------------------------------ main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="yelp-reviews.json")
    ap.add_argument("--serpapi", metavar="API_KEY",
                    help="full pull (all recommended + hidden reviews) via SerpAPI")
    ap.add_argument("--html", help="parse a saved Yahoo Local HTML file")
    ap.add_argument("--min-rating", type=int, default=4,
                    help="only keep reviews rated >= this (default 4)")
    ap.add_argument("--rating", type=float,
                    help="official yelp.com overall rating (canonical)")
    ap.add_argument("--trust-syndication", action="store_true",
                    help="accept a syndicated overall rating that differs from the existing file")
    args = ap.parse_args()

    prev = {}
    try:
        with open(args.out) as f:
            prev = json.load(f)
    except (OSError, ValueError):
        pass
    prev_reviews = prev.get("reviews", [])
    prev_biz = prev.get("business", {})

    rating = count = None
    if args.serpapi:
        new_reviews, count = fetch_serpapi(args.serpapi)
        source = "serpapi yelp_reviews (full texts, real ratings, incl. hidden)"
    else:
        page = open(args.html, errors="ignore").read() if args.html else http_get(YAHOO_URL)
        new_reviews, rating, count = parse_yahoo(page)
        source = "yelp via yahoo local syndication"

    reviews = merge(prev_reviews, new_reviews)
    dropped = [r for r in reviews if r.get("rating", 5) < args.min_rating]
    reviews = [r for r in reviews if r.get("rating", 5) >= args.min_rating]
    if dropped:
        print(f"filtered {len(dropped)} review(s) below {args.min_rating} stars "
              f"({', '.join(d['author'] for d in dropped)})")

    biz = dict(BIZ)
    today = datetime.date.today().isoformat()
    # Overall-rating honesty guard: official yelp.com number wins.
    old_rating = prev_biz.get("rating")
    if args.rating is not None:
        biz["rating"] = args.rating
        biz["rating_source"] = f"yelp.com official (manual, {today})"
    elif old_rating is not None:
        if rating is not None and abs(old_rating - rating) > 0.01 and not args.trust_syndication:
            print(f"WARNING: source shows {rating} but keeping existing {old_rating} "
                  f"(official yelp.com rating wins; use --rating or --trust-syndication)")
        biz["rating"] = old_rating
        biz["rating_source"] = prev_biz.get("rating_source", "existing file (official)")
    else:
        biz["rating"] = rating if rating is not None else 5.0
    biz["review_count"] = count if count is not None else prev_biz.get("review_count", len(reviews))

    data = {
        "business": biz,
        "fetched_at": today,
        "source": source,
        "reviews": reviews,
    }
    with open(args.out, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    hidden_n = sum(1 for r in reviews if r.get("hidden_by_yelp"))
    print(f"wrote {args.out}: {biz['rating']} stars, {biz['review_count']} reviews on yelp, "
          f"{len(reviews)} displayed ({hidden_n} from the hidden section)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
