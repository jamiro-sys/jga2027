(function () {
  "use strict";

  var DATA_URL = "data/trip.json";
  var state = { data: null, event: null, zone: "alle" };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  /* ---------- Helfer ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function $(id) { return document.getElementById(id); }
  function chf(n) { return Number(n).toLocaleString("de-CH"); }
  function btn(url, label, cls) {
    return '<a class="btn ' + (cls || "") + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + "</a>";
  }
  function more(url, label) {
    return '<a class="link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + "</a>";
  }
  function fmtDate(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
  }
  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function costInfo(ev, d) {
    var c = ev.kosten;
    var totals = c.spalten.map(function (_, i) { return c.zeilen.reduce(function (s, z) { return s + z.werte[i]; }, 0); });
    var per = totals.map(function (t) { return Math.round(t / d.zahler / 5) * 5; });
    return { totals: totals, per: per, lo: Math.min.apply(null, per), hi: Math.max.apply(null, per) };
  }
  function ticketEur(ev) { return +((ev.tickets.preis.match(/^[\d.,]+/) || ["0"])[0]); }
  function countUp(el, to) {
    if (reduce) { el.textContent = chf(to); return; }
    var t0 = performance.now(), dur = 1300;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = chf(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add("in");
      io.unobserve(el);
      each(el.querySelectorAll("[data-count]"), function (x) { countUp(x, +x.getAttribute("data-count")); });
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }) : null;

  function observe(root) {
    each((root || document).querySelectorAll(".reveal:not(.in)"), function (el) {
      if (io) io.observe(el); else el.classList.add("in");
    });
  }

  /* ---------- Segmented Control ---------- */
  function placeThumb(seg) {
    var thumb = seg.querySelector(".seg-thumb");
    var on = seg.querySelector('button[aria-selected="true"],button[aria-pressed="true"]');
    if (!thumb || !on) return;
    thumb.style.width = on.offsetWidth + "px";
    thumb.style.transform = "translateX(" + (on.offsetLeft - 3) + "px)";
  }

  /* ---------- Drehzahlmesser (zwei Stueck) ---------- */
  var G = { cx: 150, cy: 150, r: 112, a0: -135, a1: 135, max: 8 };
  function pt(a, r) { var rad = a * Math.PI / 180; return [G.cx + r * Math.sin(rad), G.cy - r * Math.cos(rad)]; }
  function arcPath(from, to, r) {
    var s = pt(from, r), e = pt(to, r), large = (to - from) > 180 ? 1 : 0;
    return "M" + s[0].toFixed(2) + " " + s[1].toFixed(2) + " A" + r + " " + r + " 0 " + large + " 1 " + e[0].toFixed(2) + " " + e[1].toFixed(2);
  }
  function valToAngle(v) { return G.a0 + (G.a1 - G.a0) * (v / G.max); }

  function gaugeSvg() {
    var ticks = "", nums = "", k = 0;
    for (var v = 0; v <= G.max; v += 0.5) {
      var a = valToAngle(v), major = v % 1 === 0;
      var p1 = pt(a, G.r - 8), p2 = pt(a, G.r - (major ? 22 : 15));
      ticks += '<line class="g-tick' + (major ? "" : " minor") + '" style="--i:' + (k++) + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '" stroke-width="' + (major ? 2.4 : 1.2) + '"/>';
      if (major) {
        var pn = pt(a, G.r - 38);
        nums += '<text class="g-num' + (v >= 7 ? " red" : "") + '" style="--i:' + v + '" x="' + pn[0].toFixed(1) + '" y="' + (pn[1] + 6).toFixed(1) + '" text-anchor="middle">' + v + "</text>";
      }
    }
    return '<svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="128" class="g-face"/>' +
      '<path class="g-track" d="' + arcPath(G.a0, G.a1, G.r) + '"/>' +
      '<path class="g-red" d="' + arcPath(valToAngle(6.5), G.a1, G.r) + '"/>' +
      '<path class="g-fill"/>' + ticks + nums +
      '<g class="g-needle"><path d="M147 150 L150 46 L153 150 Z"/></g><circle cx="150" cy="150" r="14" class="g-hub"/></svg>';
  }

  function renderGauges(d) {
    var keys = Object.keys(d.events);
    $("gauges").innerHTML = keys.map(function (k) {
      var ev = d.events[k];
      return '<div class="gcol reveal" data-ev="' + esc(k) + '"><div class="gauge" aria-hidden="true">' + gaugeSvg() +
        '<div class="g-readout"><span class="g-days num">0</span><span class="g-unit">Tage</span></div></div>' +
        '<p class="gname">' + esc(ev.name) + '</p><p class="gdate">' + esc(ev.reise) + "</p>" +
        '<div class="gcount" aria-live="off">' + ["Tage", "Std", "Min", "Sek"].map(function (l) { return '<div><strong class="num">0</strong><span>' + l + "</span></div>"; }).join("") + "</div></div>";
    }).join("");

    // Nadeln hochdrehen: je naeher die Abfahrt, desto hoeher die Drehzahl
    each($("gauges").querySelectorAll(".gcol"), function (col) {
      var ev = d.events[col.getAttribute("data-ev")];
      var from = new Date(d.stand + "T00:00:00"), to = new Date(ev.abreise);
      var p = Math.max(0.04, Math.min(1, (new Date() - from) / (to - from)));
      var target = valToAngle(p * G.max);
      var needle = col.querySelector(".g-needle"), fill = col.querySelector(".g-fill");
      fill.setAttribute("d", arcPath(G.a0, target + 0.01, G.r));
      var len = fill.getTotalLength ? fill.getTotalLength() : 0;
      fill.style.strokeDasharray = len;
      fill.style.strokeDashoffset = len;
      needle.style.transform = "rotate(" + G.a0 + "deg)";
      col.addEventListener("transitionend", function () {}, { once: true });
      var go = function () {
        setTimeout(function () {
          needle.style.transform = "rotate(" + target + "deg)";
          fill.style.strokeDashoffset = 0;
        }, reduce ? 0 : 250);
      };
      if (io) {
        var o = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { go(); o.disconnect(); } }, { threshold: 0.3 });
        o.observe(col);
      } else go();
    });

    var cols = $("gauges").querySelectorAll(".gcol"), last = [];
    function tick() {
      each(cols, function (col, ci) {
        var ev = d.events[col.getAttribute("data-ev")];
        var diff = Math.max(0, new Date(ev.abreise) - new Date());
        var v = [Math.floor(diff / 864e5), Math.floor(diff / 36e5) % 24, Math.floor(diff / 6e4) % 60, Math.floor(diff / 1e3) % 60];
        var cells = col.querySelectorAll(".gcount strong");
        last[ci] = last[ci] || {};
        v.forEach(function (n, i) {
          var txt = i === 0 ? String(n) : (n < 10 ? "0" : "") + n;
          if (last[ci][i] === txt) return;
          cells[i].textContent = txt;
          if (!reduce && last[ci][i] !== undefined) { cells[i].classList.remove("flip"); void cells[i].offsetWidth; cells[i].classList.add("flip"); }
          last[ci][i] = txt;
        });
        col.querySelector(".g-days").textContent = v[0];
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Vergleich ---------- */
  function renderCompare(d) {
    var keys = Object.keys(d.events), evs = keys.map(function (k) { return d.events[k]; });
    var stripe = '<span class="t-stripe" aria-hidden="true"><i></i><i></i><i></i></span>';
    var ci = evs.map(function (ev) { return costInfo(ev, d); });
    var km = evs.map(function (ev) { return +((ev.distanz.match(/(\d+)\s*km/) || [0, 0])[1]); });
    var tk = evs.map(ticketEur);
    function best(vals, i) { var m = Math.min.apply(null, vals); return vals[i] === m && vals.some(function (x) { return x !== m; }); }

    var head = '<div class="cmp-head">' + evs.map(function (ev, i) {
      return '<div class="cmp-col">' + stripe + '<p class="cmp-name">' + esc(ev.name) + '</p><p class="cmp-place">' + esc(ev.ort) + '</p><p class="cmp-date num">' + esc(ev.reise.replace(/ 20\d\d$/, "")) + "</p>" +
        '<a class="btn" href="#details" data-pick="' + esc(keys[i]) + '">Details ansehen</a></div>';
    }).join("") + "</div>";

    function row(label, cells) {
      return '<div class="cmp-row"><p class="cmp-label">' + esc(label) + '</p><div class="cmp-cells">' + cells.map(function (c) { return "<div>" + c + "</div>"; }).join("") + "</div></div>";
    }
    var rows = [
      row("Pro Zahler", evs.map(function (ev, i) {
        return '<span class="cmp-big num"><span data-count="' + ci[i].lo + '">' + chf(ci[i].lo) + "</span><small>bis " + chf(ci[i].hi) + ' CHF</small></span>' + (best(ci.map(function (c) { return c.lo; }), i) ? '<span class="win">Günstiger</span>' : "");
      })),
      row("Rennen", evs.map(function (ev) { return esc(ev.rennen); })),
      row("Fahrt ab " + d.start.replace(/ TG$/, ""), evs.map(function (ev, i) {
        return '<span class="cmp-big num">' + km[i] + "<small>km</small></span>" + '<span class="cmp-sub">' + esc((ev.distanz.match(/[\d.]+ Std\./) || [""])[0]) + "</span>" + (best(km, i) ? '<span class="win">Kürzer</span>' : "");
      })),
      row("Ticket pro Person", evs.map(function (ev, i) {
        return '<span class="cmp-big num">' + tk[i] + '<small>EUR</small></span><span class="cmp-sub">' + esc(ev.verkaufKurz || "") + "</span>";
      })),
      row("Unterkünfte mit Parkplatz", evs.map(function (ev) {
        var air = ev.unterkuenfte.filter(function (u) { return u.plattform === "Airbnb"; }).length;
        return '<span class="cmp-big num">' + ev.unterkuenfte.length + '</span><span class="cmp-sub">davon ' + air + " Airbnb</span>";
      })),
      row("Erlebnisse", evs.map(function (ev) { return esc((ev.erlebnisse || []).slice(0, 3).map(function (e) { return e.name; }).join(", ")); })),
      row("Abend mit dem Bräutigam", evs.map(function (ev) {
        var f = (ev.essen || []).filter(function (e) { return /Bräutigam/.test(e.stil || ""); })[0] || ev.essen[0];
        return "<b>" + esc(f.name) + '</b><span class="cmp-sub">' + esc(f.ort) + "</span>";
      })),
      row("Stimmung", evs.map(function (ev, i) {
        return i === 0 ? "Kult an der Nordschleife, Racer Dörfer, Grill bei den Fans" : "Schönste Strecke der Welt, Fan Village mit Konzerten, Ardennen Brasserien";
      }))
    ];
    $("compare").innerHTML = head + rows.join("");

    $("compare").addEventListener("click", function (e) {
      var a = e.target.closest("[data-pick]");
      if (!a) return;
      setEvent(a.getAttribute("data-pick"), true);
    });
  }

  /* ---------- Einmalige Teile ---------- */
  function renderStatic(d) {
    var sw = $("switch");
    sw.insertAdjacentHTML("beforeend", Object.keys(d.events).map(function (k) {
      return '<button type="button" role="tab" data-event="' + esc(k) + '" aria-selected="false">' + esc(d.events[k].name) + "</button>";
    }).join(""));
    sw.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-event]");
      if (b) setEvent(b.getAttribute("data-event"), true);
    });

    $("decision").textContent = (d.entscheid && d.events[d.entscheid]) ? "Entschieden: " + d.events[d.entscheid].name : (d.entscheidHinweis || "");

    var latest = (d.updates || [])[0];
    if (latest) $("ribbon").innerHTML = "<b>Neu.</b> " + esc(latest.text.replace(/^Neu:\s*/, "")) + ' <a href="#todo">Alle Updates ›</a>';
    else $("ribbon").hidden = true;

    $("updates").innerHTML = (d.updates || []).map(function (u) {
      return '<div class="update"><time datetime="' + esc(u.datum) + '">' + esc(fmtDate(u.datum)) + "</time><p>" + esc(u.text) + "</p></div>";
    }).join("");

    $("availability").textContent = d.verfuegbarkeit || "";
    $("cost-note").textContent = d.kostenHinweis || "";
    $("stand").textContent = "Stand " + fmtDate(d.stand);

    var list = d.checkliste || [];
    var done = list.filter(function (t) { return t.erledigt; }).length;
    $("task-count").textContent = done + " von " + list.length + " erledigt";
    $("tasks").innerHTML = list.map(function (t) {
      return '<li class="' + (t.erledigt ? "done" : "") + '"><span class="circle" aria-hidden="true"></span><div><small>' + esc(t.frist) + "</small><p>" + esc(t.text) + "</p></div></li>";
    }).join("");

    var packed = {};
    try { packed = JSON.parse(store("jga-pack") || "{}") || {}; } catch (e) { packed = {}; }
    $("pack").innerHTML = (d.packliste || []).map(function (p, i) {
      return '<li><label for="pack-' + i + '"><input type="checkbox" id="pack-' + i + '" data-item="' + esc(p) + '"' + (packed[p] ? " checked" : "") + "><span>" + esc(p) + "</span></label></li>";
    }).join("");
    $("pack").addEventListener("change", function (e) {
      var item = e.target.getAttribute("data-item");
      if (!item) return;
      packed[item] = e.target.checked;
      store("jga-pack", JSON.stringify(packed));
    });

    var zf = $("zone-filter");
    zf.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-zone]");
      if (!b) return;
      state.zone = b.getAttribute("data-zone");
      each(zf.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      placeThumb(zf);
      filterStays();
    });

    var car = $("stays");
    function step(dir) {
      var card = car.querySelector(".stay:not(.hide)");
      var w = card ? card.getBoundingClientRect().width + 18 : 340;
      car.scrollBy({ left: dir * w, behavior: reduce ? "auto" : "smooth" });
    }
    $("prev").addEventListener("click", function () { step(-1); });
    $("next").addEventListener("click", function () { step(1); });
    car.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", function () { placeThumb($("switch")); placeThumb(zf); updateArrows(); });

    renderGauges(d);
    renderCompare(d);
  }

  function updateArrows() {
    var car = $("stays");
    $("prev").disabled = car.scrollLeft < 8;
    $("next").disabled = car.scrollLeft + car.clientWidth >= car.scrollWidth - 8;
  }

  /* ---------- Unterkuenfte ---------- */
  function renderStays(ev) {
    var zoneLabel = { strecke: "Nahe Strecke", stadt: "In der Stadt" };
    var statusLabel = { frei: "Verfügbar", voll: "Ausgebucht", pruefen: "Live prüfen" };
    $("stays").innerHTML = ev.unterkuenfte.map(function (u) {
      var st = u.status || "pruefen", plat = u.plattform || "";
      return '<article class="stay" data-zone="' + esc(u.zone) + '" data-plat="' + esc(plat.toLowerCase()) + '">' +
        '<div class="stay-top"><span class="label">' + esc(zoneLabel[u.zone] || "") + '</span><span class="chip ' + esc(st) + '">' + esc(statusLabel[st] || st) + "</span></div>" +
        (plat ? '<span class="plat ' + esc(plat.toLowerCase()) + '">' + esc(plat) + "</span>" : "") +
        "<h3>" + esc(u.name) + '</h3><p class="where">' + esc(u.ort) + "</p>" +
        '<ul class="facts"><li><span>Art</span><span>' + esc(u.typ) + (u.platz ? ", " + esc(u.platz) : "") + '</span></li>' +
        '<li class="park"><span>Parkplatz</span><span>' + esc(u.parkplatz) + "</span></li>" +
        "<li><span>Preis</span><span>" + esc(u.preis) + "</span></li></ul>" +
        (u.hinweis ? '<p class="hint">' + esc(u.hinweis) + "</p>" : "") +
        btn(u.url, u.linkLabel || "Ansehen") +
        "</article>";
    }).join("");
    filterStays();
  }
  function filterStays() {
    each($("stays").querySelectorAll(".stay"), function (s) {
      var z = state.zone, show = z === "alle" || (z === "airbnb" ? s.getAttribute("data-plat") === "airbnb" : s.getAttribute("data-zone") === z);
      s.classList.toggle("hide", !show);
    });
    $("stays").scrollLeft = 0;
    updateArrows();
  }

  function cards(list, withPrice) {
    return list.map(function (e, i) {
      var feature = /Bräutigam/.test(e.stil || "");
      var tag = e.typ || e.stil || "";
      return '<div class="eat reveal' + (feature ? " feature" : "") + '" style="--i:' + (i % 3) + '"><div class="eat-top"><span class="label">' + esc(e.ort) + "</span>" +
        (tag ? '<span class="chip' + (feature ? "" : " blue") + '">' + esc(tag) + "</span>" : "") + "</div>" +
        "<h3>" + esc(e.name) + "</h3><p>" + esc(e.text) + "</p>" +
        (withPrice && e.preis ? '<p class="price-line">' + esc(e.preis) + "</p>" : "") +
        (e.url ? more(e.url, "Mehr erfahren") : "") + "</div>";
    }).join("");
  }

  /* ---------- Details der gewaehlten Variante ---------- */
  function renderEvent() {
    var d = state.data, ev = d.events[state.event], ci = costInfo(ev, d);
    document.title = "JGA 2027 · " + ev.name;

    var sw = $("switch");
    each(sw.querySelectorAll("button"), function (b) { b.setAttribute("aria-selected", b.getAttribute("data-event") === state.event ? "true" : "false"); });
    placeThumb(sw);

    $("days").innerHTML = ev.programm.map(function (day, i) {
      return '<div class="day reveal" style="--i:' + i + '"><div class="day-head"><h3>' + esc(day.tag) + '</h3><span class="date">' + esc(day.datum) + "</span></div>" +
        day.punkte.map(function (p) { return '<div class="slot' + (p.highlight ? " key" : "") + '"><time>' + esc(p.zeit) + "</time><p>" + esc(p.text) + "</p></div>"; }).join("") + "</div>";
    }).join("");

    var t = ev.tickets, k = ev.kart;
    $("ticket-box").innerHTML =
      '<article class="card reveal"><span class="label">Rennticket</span><h3>' + esc(t.titel) + '</h3><p class="price num">' + ticketEur(ev) + "<small>EUR pro Person" + (/2026/.test(t.preis) ? ", Preis 2026" : "") + "</small></p>" +
      "<dl><div><dt>Inklusive</dt><dd>" + esc(t.inklusive) + "</dd></div><div><dt>Verkauf</dt><dd>" + esc(t.status) + "</dd></div></dl>" +
      '<p class="warn">' + esc(t.warnung) + "</p>" +
      '<div class="btns">' + t.links.map(function (l, i) { return btn(l.url, l.label, i ? "ghost" : ""); }).join("") + "</div></article>" +
      '<article class="card dark reveal" style="--i:1"><span class="t-stripe" aria-hidden="true"><i></i><i></i><i></i></span><span class="label light">Kartrennen</span><h3>' + esc(k.name) + '</h3><p class="muted">' + esc(k.text) + "</p>" +
      '<p class="tel">' + esc(k.telefon) + '</p><div class="btns">' + btn(k.url, "Zur Kartbahn") + btn("#erlebnisse", "Alternativen", "ghost").replace(' target="_blank" rel="noopener"', "") + "</div></article>";

    $("erlebnis-hint").textContent = ev.erlebnisseHinweis || "";
    $("erlebnisse-list").innerHTML = cards(ev.erlebnisse || [], true);

    renderStays(ev);
    $("live-links").innerHTML = ev.liveSuche.map(function (l) { return more(l.url, l.label); }).join("");

    $("price-hero").innerHTML = ev.kosten.spalten.map(function (s, i) {
      return '<div class="ph' + (i === 0 ? " dark" : "") + '">' + (i === 0 ? '<span class="t-stripe" aria-hidden="true"><i></i><i></i><i></i></span>' : "") + '<span class="t-label">' + esc(s) + '</span><strong class="num"><span data-count="' + ci.per[i] + '">' + chf(ci.per[i]) + '</span><small>CHF</small></strong><p>pro Zahler, Total Gruppe ' + chf(ci.totals[i]) + " CHF</p></div>";
    }).join("");

    var c = ev.kosten;
    $("costs").innerHTML =
      "<thead><tr><th>Ganze Gruppe, CHF</th>" + c.spalten.map(function (s) { return "<th>" + esc(s) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      c.zeilen.map(function (z) { return "<tr><td>" + esc(z.posten) + "</td>" + z.werte.map(function (w) { return "<td>" + chf(w) + "</td>"; }).join("") + "</tr>"; }).join("") +
      '<tr class="total"><td>Total</td>' + ci.totals.map(function (x) { return "<td>" + chf(x) + "</td>"; }).join("") + "</tr></tbody>";

    $("dine").innerHTML = cards(ev.essen, false);

    var ph = $("price-hero");
    if (ph.classList.contains("in")) each(ph.querySelectorAll("[data-count]"), function (x) { countUp(x, +x.getAttribute("data-count")); });
    observe(document);
  }

  function setEvent(key, push) {
    if (!state.data.events[key]) return;
    if (key === state.event) return;
    state.event = key;
    store("jga-event", key);
    if (push && history.replaceState) history.replaceState(null, "", "#details");
    var box = $("event-content");
    if (reduce) { renderEvent(); return; }
    box.style.transition = "opacity .3s ease";
    box.style.opacity = "0";
    setTimeout(function () { renderEvent(); box.style.opacity = "1"; }, 300);
  }

  function chooseInitialEvent(d) {
    var hash = (location.hash || "").replace("#", "");
    if (d.events[hash]) return hash;
    if (d.entscheid && d.events[d.entscheid]) return d.entscheid;
    var saved = store("jga-event");
    if (saved && d.events[saved]) return saved;
    return Object.keys(d.events)[0];
  }

  window.addEventListener("hashchange", function () {
    var h = location.hash.replace("#", "");
    if (state.data && state.data.events[h]) setEvent(h, false);
  });

  /* ---------- Scroll: Nav Linie, Hero zieht sich zurueck ---------- */
  var heroIn = $("hero-in"), ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      $("nav").classList.toggle("scrolled", y > 4);
      if (!reduce && heroIn) {
        var p = Math.min(1, y / 520);
        heroIn.style.transform = "scale(" + (1 - p * 0.06) + ") translateY(" + (p * 30) + "px)";
        heroIn.style.opacity = String(1 - p * 0.75);
      }
      ticking = false;
    });
  }, { passive: true });

  function watchNav() {
    if (!("IntersectionObserver" in window)) return;
    var links = document.querySelectorAll(".links a");
    var nav = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        each(links, function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    each(links, function (a) { var s = document.querySelector(a.getAttribute("href")); if (s) nav.observe(s); });
  }

  fetch(DATA_URL, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      state.data = d;
      renderStatic(d);
      state.event = chooseInitialEvent(d);
      renderEvent();
      placeThumb($("zone-filter"));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placeThumb($("switch")); placeThumb($("zone-filter")); });
      watchNav();
    })
    .catch(function () {
      $("hero-meta").textContent = "Die Daten konnten nicht geladen werden. Bitte Seite neu laden.";
    });
})();
