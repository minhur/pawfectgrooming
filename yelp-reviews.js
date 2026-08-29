/*!
 * yelp-reviews.js — self-hosted Yelp reviews widget
 * CX replica of the Elfsight Yelp Reviews carousel (classic template) built
 * from the live widget's rendered DOM and pixels (2026-08-28), minus branding.
 *
 * Embed:
 *   <script src="yelp-reviews.js" defer></script>
 *   <div data-yelp-reviews data-src="yelp-reviews.json"></div>
 */
(function () {
  "use strict";

  var CSS = [
    /* palette measured from the live Elfsight render */
    ".yrw{--yrw-star:#fcbf02;--yrw-yelp:#d32323;--yrw-card:#f8f8f8;--yrw-name:#222;",
    "  --yrw-text:#7a7a7a;--yrw-mut:#9b9b9b;--yrw-per-view:3;--yrw-gap:20px;",
    "  font-family:inherit;margin:1.5em 0;text-align:left;position:relative}",
    ".yrw *{box-sizing:border-box}",
    ".yrw a{border-bottom:none;text-decoration:none}",
    ".yrw-body{position:relative}",
    ".yrw-track{display:flex;gap:var(--yrw-gap);overflow-x:auto;scroll-snap-type:x mandatory;",
    "  scrollbar-width:none;-ms-overflow-style:none;padding:2px;scroll-behavior:smooth}",
    "@media (prefers-reduced-motion:reduce){.yrw-track{scroll-behavior:auto}}",
    ".yrw-track::-webkit-scrollbar{display:none}",
    /* card: flat light-gray, subtle radius, no border (per live widget) */
    ".yrw-card{flex:0 0 calc((100% - (var(--yrw-per-view) - 1)*var(--yrw-gap))/var(--yrw-per-view));",
    "  scroll-snap-align:start;background:var(--yrw-card);border-radius:6px;padding:20px;",
    "  display:flex;flex-direction:column;align-items:flex-start}",
    /* author row */
    ".yrw-top{display:flex;align-items:center;gap:10px;width:100%}",
    ".yrw-ava{width:40px;height:40px;border-radius:50%;flex:0 0 40px;overflow:hidden;background:#d8d8d8;",
    "  display:flex;align-items:center;justify-content:center}",
    ".yrw-ava img{width:100%;height:100%;object-fit:cover;display:block}",
    ".yrw-ava svg{width:20px;height:20px;fill:#fff}",
    ".yrw-who{min-width:0}",
    ".yrw-name{display:flex;align-items:center;gap:5px;font-size:.85em;font-weight:700;color:var(--yrw-name);line-height:1.3}",
    ".yrw-name .yrw-badge{width:.9em;height:.9em;display:inline-block}",
    ".yrw-name .yrw-badge svg{width:100%;height:100%;fill:var(--yrw-yelp);display:block}",
    ".yrw-name .yrw-badge{width:1em;height:1em}",
    ".yrw-date{font-size:.72em;color:var(--yrw-mut);margin-top:1px}",
    ".yrw-date a{color:var(--yrw-yelp)}",
    ".yrw-date a:hover{text-decoration:underline}",
    /* stars: orange-gold, prominent, tight row */
    ".yrw-stars{display:flex;gap:0;margin:12px 0 10px;line-height:0}",
    ".yrw-stars svg{width:18px;height:18px;fill:var(--yrw-star);stroke:var(--yrw-star);stroke-width:2.4;stroke-linejoin:round;margin-right:1px}",
    ".yrw-stars svg.off{fill:#dcdcdc}",
    /* review text: clamped, gray */
    ".yrw-text{font-size:.84em;line-height:1.5;color:var(--yrw-text);margin:0;width:100%;",
    "  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
    ".yrw-card.open .yrw-text{display:block;-webkit-line-clamp:unset;overflow:visible}",
    /* inline expander (matches es-text-shortener-control) */
    ".yrw-more{all:unset;box-sizing:border-box;margin-top:8px;font-size:.78em;color:var(--yrw-mut);cursor:pointer;font-family:inherit;line-height:1.4;display:none;border:0;text-decoration:none}",
    ".yrw-more.show{display:inline-block}",
    ".yrw-more:hover{color:var(--yrw-text)}",
    /* arrows: dark circle, white chevron, overlapping edge (per live widget) */
    ".yrw-arrow{all:unset;box-sizing:border-box;position:absolute;top:50%;transform:translateY(-50%);",
    "  width:38px;height:38px;border-radius:50%;background:#3f3f3f;color:#fff;cursor:pointer;z-index:2;",
    "  display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);text-align:center}",
    ".yrw-arrow svg{width:14px;height:14px;fill:#fff}",
    ".yrw-arrow[data-hidden=\"1\"]{display:none}",
    ".yrw-prev{left:-12px}.yrw-next{right:-12px}",
    "@media (max-width:560px){.yrw-prev{left:-6px}.yrw-next{right:-6px}}",
    /* bullets */
    ".yrw-dots{display:flex;justify-content:center;gap:6px;margin-top:14px}",
    ".yrw-dot{all:unset;box-sizing:border-box;display:inline-block;width:7px;height:7px;border-radius:50%;",
    "  background:#d3d3d3;cursor:pointer}",
    ".yrw-dot.on{background:#7a7a7a}"
  ].join("\n");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svg(vb, d) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", vb);
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    s.appendChild(p);
    return s;
  }
  var STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
  var PERSON = "M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z";
  var CHECK_BADGE = "M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm-1.7 15.5l-4-4 1.6-1.6 2.4 2.4 5.8-5.8 1.6 1.6-7.4 7.4z";
  var CHEV_L = "M15.4 4.6L14 3.2 6.2 11l7.8 7.8 1.4-1.4L9 11z";
  var CHEV_R = "M8.6 4.6L10 3.2l7.8 7.8-7.8 7.8-1.4-1.4L14 11z";

  function btnize(n, label, onAct) {
    n.setAttribute("role", "button");
    n.setAttribute("tabindex", "0");
    if (label) n.setAttribute("aria-label", label);
    n.addEventListener("click", onAct);
    n.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAct(e); }
    });
    return n;
  }

  function fmtDate(iso) {
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d)) return iso;
    var opts = { month: "long", day: "numeric" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("en-US", opts);
  }

  function render(root, data) {
    var reviews = data.reviews || [];
    root.classList.add("yrw");

    var body = el("div", "yrw-body");
    var track = el("div", "yrw-track");
    track.setAttribute("aria-label", "Yelp reviews");

    reviews.forEach(function (r) {
      var card = el("article", "yrw-card");

      var top = el("div", "yrw-top");
      var avaLink = el("a", "yrw-ava-link");
      avaLink.href = r.url || "#";
      avaLink.target = "_blank";
      avaLink.rel = "noopener";
      var ava = el("span", "yrw-ava");
      if (r.avatar) {
        var img = document.createElement("img");
        img.loading = "lazy";
        img.src = r.avatar;
        img.alt = r.author || "";
        img.onerror = function () { ava.textContent = ""; ava.appendChild(svg("0 0 24 24", PERSON)); };
        ava.appendChild(img);
      } else {
        ava.appendChild(svg("0 0 24 24", PERSON));
      }
      avaLink.appendChild(ava);
      top.appendChild(avaLink);

      var who = el("div", "yrw-who");
      var nameLink = el("a");
      nameLink.href = r.url || "#";
      nameLink.target = "_blank";
      nameLink.rel = "noopener";
      var name = el("span", "yrw-name");
      name.appendChild(document.createTextNode(r.author || "Yelp user"));
      var badge = el("span", "yrw-badge");
      badge.appendChild(svg("0 0 24 24", CHECK_BADGE));
      name.appendChild(badge);
      nameLink.appendChild(name);
      nameLink.style.color = "inherit";
      who.appendChild(nameLink);

      var date = el("div", "yrw-date");
      date.appendChild(document.createTextNode(fmtDate(r.date) + " on "));
      var ylink = el("a", null, "Yelp");
      ylink.href = r.url || "#";
      ylink.target = "_blank";
      ylink.rel = "noopener";
      date.appendChild(ylink);
      who.appendChild(date);
      top.appendChild(who);
      card.appendChild(top);

      var stars = el("div", "yrw-stars");
      stars.setAttribute("role", "img");
      var rating = r.rating != null ? r.rating : 5;
      stars.setAttribute("aria-label", "Rated " + rating + " out of 5");
      for (var i = 1; i <= 5; i++) {
        var st = svg("0 0 24 24", STAR);
        if (i > rating) st.setAttribute("class", "off");
        stars.appendChild(st);
      }
      card.appendChild(stars);

      var txt = el("p", "yrw-text", r.text || "");
      card.appendChild(txt);

      var more = el("div", "yrw-more", "Read more");
      btnize(more, null, function () {
        var open = card.classList.toggle("open");
        more.textContent = open ? "Show less" : "Read more";
      });
      card.appendChild(more);

      track.appendChild(card);
    });
    body.appendChild(track);

    var prev = el("div", "yrw-arrow yrw-prev");
    var next = el("div", "yrw-arrow yrw-next");
    btnize(prev, "Previous reviews", function () { track.scrollBy({ left: -cardStep() }); });
    btnize(next, "Next reviews", function () { track.scrollBy({ left: cardStep() }); });
    prev.appendChild(svg("0 0 22 22", CHEV_L));
    next.appendChild(svg("0 0 22 22", CHEV_R));
    body.appendChild(prev);
    body.appendChild(next);
    root.appendChild(body);

    var dots = el("div", "yrw-dots");
    reviews.forEach(function (_, i) {
      var d = el("div", "yrw-dot");
      btnize(d, "Go to review " + (i + 1), function () {
        var card = track.children[i];
        if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft });
      });
      dots.appendChild(d);
    });
    root.appendChild(dots);

    function cardStep() {
      var c = track.children[0];
      if (!c) return 0;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 20;
      return c.getBoundingClientRect().width + gap;
    }
    var raf = null;
    function sync() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var w = root.clientWidth;
        root.style.setProperty("--yrw-per-view", w > 840 ? 3 : w > 520 ? 2 : 1);
        var max = track.scrollWidth - track.clientWidth;
        var noScroll = max <= 4;
        prev.setAttribute("data-hidden", (noScroll || track.scrollLeft <= 2) ? "1" : "0");
        next.setAttribute("data-hidden", (noScroll || track.scrollLeft >= max - 2) ? "1" : "0");
        // dot-per-review stops scaling past a dozen reviews — arrows/swipe only
        dots.style.display = (noScroll || reviews.length > 12) ? "none" : "flex";
        var step = cardStep() || 1;
        var idx = Math.round(track.scrollLeft / step);
        Array.prototype.forEach.call(dots.children, function (d, i) {
          d.classList.toggle("on", i === idx);
        });
        // show Read more only when the text is actually clamped
        Array.prototype.forEach.call(track.children, function (card) {
          var t = card.querySelector(".yrw-text");
          var m = card.querySelector(".yrw-more");
          if (!t || !m) return;
          if (card.classList.contains("open") || t.scrollHeight > t.clientHeight + 2) m.classList.add("show");
          else m.classList.remove("show");
        });
      });
    }
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
    setTimeout(sync, 60);
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
    Array.prototype.forEach.call(document.querySelectorAll("[data-yelp-reviews]"), boot);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
