/*!
 * yelp-reviews.js — self-hosted Yelp reviews widget (Elfsight replacement)
 * Zero dependencies. Embed:
 *   <script src="yelp-reviews.js" defer></script>
 *   <div data-yelp-reviews data-src="yelp-reviews.json"></div>
 * Options on the div:
 *   data-src="path/to/reviews.json"   (default: yelp-reviews.json)
 *   data-layout="carousel|grid"       (default: carousel)
 * Or inline data (no extra request):
 *   <div data-yelp-reviews><script type="application/json">{...}</script></div>
 */
(function () {
  "use strict";

  var YELP_RED = "#d32323";

  // Font Awesome Free 6.5.2 "yelp" brand icon (CC BY 4.0) — viewBox 0 0 384 512
  var YELP_PATH = "M42.9 240.32l99.62 48.61c19.2 9.4 16.2 37.51-4.5 42.71L30.5 358.45a22.79 22.79 0 0 1-28.21-19.6 197.16 197.16 0 0 1 9-85.32 22.8 22.8 0 0 1 31.61-13.21zm44 239.25a199.45 199.45 0 0 0 79.42 32.11A22.78 22.78 0 0 0 192.94 490l3.9-110.82c.7-21.3-25.5-31.91-39.81-16.1l-74.21 82.4a22.82 22.82 0 0 0 4.09 34.09zm145.34-109.92l58.81 94a22.93 22.93 0 0 0 34 5.5 198.36 198.36 0 0 0 52.71-67.61A23 23 0 0 0 364.17 370l-105.42-34.26c-20.31-6.5-37.81 15.8-26.51 33.91zm148.33-132.23a197.44 197.44 0 0 0-50.41-69.31 22.85 22.85 0 0 0-34 4.4l-62 91.92c-11.9 17.7 4.7 40.61 25.2 34.71L366 268.63a23 23 0 0 0 14.61-31.21zM62.11 30.18a22.86 22.86 0 0 0-9.9 32l104.12 180.44c11.7 20.2 42.61 11.9 42.61-11.4V22.88a22.67 22.67 0 0 0-24.5-22.8 320.37 320.37 0 0 0-112.33 30.1z";

  var CSS = [
    ".yrw{--yrw-accent:" + YELP_RED + ";--yrw-text:#333;--yrw-muted:#8a8a8a;--yrw-card-bg:#fff;",
    "  --yrw-border:#e6e6e6;--yrw-star-empty:#dcdcdc;--yrw-per-view:3;--yrw-gap:16px;",
    "  font-family:inherit;color:var(--yrw-text);margin:1.5em 0;text-align:left}",
    ".yrw *{box-sizing:border-box}",
    ".yrw a{color:inherit;border-bottom:none}",
    /* header */
    ".yrw-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:18px}",
    ".yrw-head-left{display:flex;align-items:center;gap:14px}",
    ".yrw-big{font-size:2.6em;font-weight:700;line-height:1;color:var(--yrw-text)}",
    ".yrw-head-meta{display:flex;flex-direction:column;gap:4px}",
    ".yrw-count{font-size:.9em;color:var(--yrw-muted)}",
    ".yrw-count a{text-decoration:underline;text-underline-offset:2px}",
    ".yrw-brand{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:var(--yrw-accent);font-size:.95em}",
    ".yrw-brand svg{width:1.15em;height:1.15em;fill:var(--yrw-accent)}",
    ".yrw-cta{display:inline-block;background:var(--yrw-accent);color:#fff !important;font-weight:600;",
    "  font-size:.85em;letter-spacing:.02em;padding:.75em 1.4em;border-radius:6px;text-decoration:none;",
    "  box-shadow:none;border:0;transition:filter .15s}",
    ".yrw-cta:hover{filter:brightness(1.1);color:#fff}",
    /* stars */
    ".yrw-stars{position:relative;display:inline-block;line-height:0}",
    ".yrw-stars svg{width:1.1em;height:1.1em;display:inline-block}",
    ".yrw-stars-bg svg{fill:var(--yrw-star-empty)}",
    ".yrw-stars-fg{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap}",
    ".yrw-stars-fg svg{fill:var(--yrw-accent)}",
    ".yrw-head .yrw-stars svg{width:1.35em;height:1.35em}",
    /* carousel */
    ".yrw-body{position:relative}",
    ".yrw-track{display:flex;gap:var(--yrw-gap);overflow-x:auto;scroll-snap-type:x mandatory;",
    "  scrollbar-width:none;-ms-overflow-style:none;padding:4px 2px 8px;scroll-behavior:smooth}",
    "@media (prefers-reduced-motion:reduce){.yrw-track{scroll-behavior:auto}}",
    ".yrw-track::-webkit-scrollbar{display:none}",
    ".yrw-card{flex:0 0 calc((100% - (var(--yrw-per-view) - 1)*var(--yrw-gap))/var(--yrw-per-view));",
    "  scroll-snap-align:start;background:var(--yrw-card-bg);border:1px solid var(--yrw-border);",
    "  border-radius:10px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.06);display:flex;flex-direction:column}",
    ".yrw[data-layout=grid] .yrw-track{flex-wrap:wrap;overflow:visible}",
    ".yrw[data-layout=grid] .yrw-arrow,.yrw[data-layout=grid] .yrw-dots{display:none}",
    /* card innards */
    ".yrw-card-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
    ".yrw-avatar{width:42px;height:42px;border-radius:50%;color:#fff;font-weight:700;font-size:.95em;",
    "  display:flex;align-items:center;justify-content:center;flex:0 0 42px;user-select:none}",
    ".yrw-who{min-width:0;flex:1}",
    ".yrw-name{font-weight:700;font-size:.95em;color:var(--yrw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".yrw-date{font-size:.78em;color:var(--yrw-muted)}",
    ".yrw-card-yelp{flex:0 0 auto}",
    ".yrw-card-yelp svg{width:1em;height:1em;fill:var(--yrw-accent);opacity:.9}",
    ".yrw-card .yrw-stars{margin:2px 0 8px}",
    ".yrw-text{font-size:.9em;line-height:1.55;color:var(--yrw-text);margin:0;",
    "  display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}",
    ".yrw-more{margin-top:auto;padding-top:10px;font-size:.82em;font-weight:600;color:var(--yrw-accent) !important;",
    "  text-decoration:none;align-self:flex-start}",
    ".yrw-more:hover{text-decoration:underline}",
    /* arrows + dots (all:unset shields them from host-page button styling) */
    ".yrw-arrow{all:unset;position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;",
    "  border:1px solid var(--yrw-border);background:#fff;color:#555;cursor:pointer;z-index:2;",
    "  display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.12);",
    "  transition:opacity .15s;font-size:16px;line-height:1;padding:0;box-sizing:border-box;text-align:center}",
    ".yrw-arrow[disabled]{opacity:.25;cursor:default}",
    ".yrw-prev{left:-14px}.yrw-next{right:-14px}",
    ".yrw-dots{display:flex;justify-content:center;gap:7px;margin-top:12px}",
    ".yrw-dot{all:unset;box-sizing:border-box;display:inline-block;width:8px;height:8px;border-radius:50%;",
    "  background:#d5d5d5;cursor:pointer;transition:background .15s}",
    ".yrw-dot.on{background:var(--yrw-accent)}",
    /* per-view is set from container width in JS (media queries can't see container) */
    "@media (max-width:560px){.yrw-prev{left:-6px}.yrw-next{right:-6px}}"
  ].join("\n");

  var AVATAR_COLORS = ["#7f6de0", "#e06d8f", "#4aa3a2", "#c98a4b", "#5b8dd6", "#8a67ab", "#5aa469", "#d0716d"];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function yelpSvg() {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 384 512");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", YELP_PATH);
    s.appendChild(p);
    return s;
  }

  function starSvg() {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z");
    s.appendChild(p);
    return s;
  }

  function starRow(rating) {
    var wrap = el("span", "yrw-stars");
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", "Rated " + rating + " out of 5");
    var bg = el("span", "yrw-stars-bg");
    var fg = el("span", "yrw-stars-fg");
    for (var i = 0; i < 5; i++) { bg.appendChild(starSvg()); fg.appendChild(starSvg()); }
    fg.style.width = Math.max(0, Math.min(100, rating / 5 * 100)) + "%";
    wrap.appendChild(bg);
    wrap.appendChild(fg);
    return wrap;
  }

  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/);
    var a = (parts[0] || "?").charAt(0);
    var b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (a + b).toUpperCase().replace(/\./g, "");
  }

  function avatarColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function relDate(iso) {
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d)) return iso;
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "a day ago";
    if (days < 7) return days + " days ago";
    if (days < 14) return "a week ago";
    if (days < 45) return Math.round(days / 7) + " weeks ago";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function render(root, data) {
    var biz = data.business || {};
    var reviews = data.reviews || [];
    root.classList.add("yrw");
    if (!root.getAttribute("data-layout")) root.setAttribute("data-layout", "carousel");

    // ---- header
    var head = el("div", "yrw-head");
    var left = el("div", "yrw-head-left");
    left.appendChild(el("div", "yrw-big", (biz.rating != null ? biz.rating.toFixed(1) : "")));
    var meta = el("div", "yrw-head-meta");
    meta.appendChild(starRow(biz.rating || 0));
    var count = el("div", "yrw-count");
    var brand = el("a", "yrw-brand");
    brand.href = biz.url || "#";
    brand.target = "_blank";
    brand.rel = "noopener";
    brand.appendChild(yelpSvg());
    brand.appendChild(document.createTextNode("Yelp"));
    var countLink = el("a", null, "Based on " + (biz.review_count || reviews.length) + " reviews");
    countLink.href = biz.url || "#";
    countLink.target = "_blank";
    countLink.rel = "noopener";
    count.appendChild(countLink);
    count.appendChild(document.createTextNode("\u00a0on\u00a0"));
    count.appendChild(brand);
    meta.appendChild(count);
    left.appendChild(meta);
    head.appendChild(left);
    if (biz.write_review_url) {
      var cta = el("a", "yrw-cta", "Review us on Yelp");
      cta.href = biz.write_review_url;
      cta.target = "_blank";
      cta.rel = "noopener";
      head.appendChild(cta);
    }
    root.appendChild(head);

    // ---- cards
    var body = el("div", "yrw-body");
    var track = el("div", "yrw-track");
    track.setAttribute("aria-label", "Yelp reviews");
    reviews.forEach(function (r) {
      var card = el("article", "yrw-card");
      var top = el("div", "yrw-card-top");
      var av = el("div", "yrw-avatar", initials(r.author));
      av.style.background = avatarColor(r.author || "");
      av.setAttribute("aria-hidden", "true");
      top.appendChild(av);
      var who = el("div", "yrw-who");
      who.appendChild(el("div", "yrw-name", r.author || "Yelp user"));
      who.appendChild(el("div", "yrw-date", relDate(r.date)));
      top.appendChild(who);
      var mark = el("a", "yrw-card-yelp");
      mark.href = r.url || biz.url || "#";
      mark.target = "_blank";
      mark.rel = "noopener";
      mark.setAttribute("aria-label", "View this review on Yelp");
      mark.appendChild(yelpSvg());
      top.appendChild(mark);
      card.appendChild(top);
      card.appendChild(starRow(r.rating != null ? r.rating : 5));
      card.appendChild(el("p", "yrw-text", r.text || ""));
      if (r.url) {
        var more = el("a", "yrw-more", "Read more");
        more.href = r.url;
        more.target = "_blank";
        more.rel = "noopener";
        card.appendChild(more);
      }
      track.appendChild(card);
    });
    body.appendChild(track);

    // ---- arrows + dots (carousel only)
    var prev = el("button", "yrw-arrow yrw-prev", "\u2039");
    var next = el("button", "yrw-arrow yrw-next", "\u203a");
    prev.type = next.type = "button";
    prev.setAttribute("aria-label", "Previous reviews");
    next.setAttribute("aria-label", "Next reviews");
    body.appendChild(prev);
    body.appendChild(next);
    root.appendChild(body);
    var dots = el("div", "yrw-dots");
    reviews.forEach(function (_, i) {
      var d = el("button", "yrw-dot");
      d.type = "button";
      d.setAttribute("aria-label", "Go to review " + (i + 1));
      d.addEventListener("click", function () {
        var card = track.children[i];
        if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft });
      });
      dots.appendChild(d);
    });
    root.appendChild(dots);

    function cardStep() {
      var c = track.children[0];
      if (!c) return 0;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
      return c.getBoundingClientRect().width + gap;
    }
    prev.addEventListener("click", function () { track.scrollBy({ left: -cardStep() }); });
    next.addEventListener("click", function () { track.scrollBy({ left: cardStep() }); });

    var raf = null;
    function sync() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var w = root.clientWidth;
        root.style.setProperty("--yrw-per-view", w > 840 ? 3 : w > 520 ? 2 : 1);
        var max = track.scrollWidth - track.clientWidth;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max - 2;
        var noScroll = max <= 4;
        prev.style.display = next.style.display = noScroll ? "none" : "flex";
        dots.style.display = noScroll ? "none" : "flex";
        var step = cardStep() || 1;
        var idx = Math.round(track.scrollLeft / step);
        Array.prototype.forEach.call(dots.children, function (d, i) {
          d.classList.toggle("on", i === idx);
        });
      });
    }
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  function boot(target) {
    var inline = target.querySelector('script[type="application/json"]');
    if (inline) {
      try { render(target, JSON.parse(inline.textContent)); } catch (e) { console.error("[yelp-reviews] bad inline JSON", e); }
      return;
    }
    var src = target.getAttribute("data-src") || "yelp-reviews.json";
    fetch(src).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      render(target, data);
    }).catch(function (e) {
      console.error("[yelp-reviews] failed to load " + src, e);
    });
  }

  function init() {
    if (!document.getElementById("yrw-style")) {
      var st = document.createElement("style");
      st.id = "yrw-style";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var targets = document.querySelectorAll("[data-yelp-reviews]");
    Array.prototype.forEach.call(targets, boot);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
