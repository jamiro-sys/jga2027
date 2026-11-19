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
      each(el.querySelectorAll("[data-w]"), function (x) { x.style.width = x.getAttribute("data-w") + "%"; });
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }) : null;

  function observe(root) {
    each((root || document).querySelectorAll(".reveal:not(.in)"), function (el) {
      if (io) io.observe(el);
      else {
        el.classList.add("in");
        each(el.querySelectorAll("[data-w]"), function (x) { x.style.width = x.getAttribute("data-w") + "%"; });
      }
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

  /* ---------- Drehzahlmesser ---------- */
  var G = { cx: 150, cy: 150, r: 112, a0: -135, a1: 135, max: 8 };
  function pt(a, r) {
    var rad = a * Math.PI / 180;
    return [G.cx + r * Math.sin(rad), G.cy - r * Math.cos(rad)];
  }
  function arcPath(from, to, r) {
    var s = pt(from, r), e = pt(to, r), large = (to - from) > 180 ? 1 : 0;
    return "M" + s[0].toFixed(2) + " " + s[1].toFixed(2) + " A" + r + " " + r + " 0 " + large + " 1 " + e[0].toFixed(2) + " " + e[1].toFixed(2);
  }
  function valToAngle(v) { return G.a0 + (G.a1 - G.a0) * (v / G.max); }

  function buildGauge() {
    $("g-track").setAttribute("d", arcPath(G.a0, G.a1, G.r));
    $("g-red").setAttribute("d", arcPath(valToAngle(6.5), G.a1, G.r));
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
    $("g-ticks").innerHTML = ticks;
    $("g-nums").innerHTML = nums;
  }

  function setGauge(ev, d) {
    // Die Nadel dreht hoch, je naeher die Abfahrt kommt
    var from = new Date(d.stand + "T00:00:00"), to = new Date(ev.abreise), now = new Date();
    var p = Math.max(0.04, Math.min(1, (now - from) / (to - from)));
    var target = valToAngle(p * G.max);
    var needle = $("g-needle"), fill = $("g-fill");
    fill.setAttribute("d", arcPath(G.a0, target + 0.01, G.r));
    var len = fill.getTotalLength ? fill.getTotalLength() : 0;
    fill.style.strokeDasharray = len;
    fill.style.strokeDashoffset = len;
    needle.style.transition = "none";
    needle.style.transform = "rotate(" + G.a0 + "deg)";
    void needle.getBoundingClientRect();
    needle.style.transition = "";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        needle.style.transform = "rotate(" + target + "deg)";
        fill.style.strokeDashoffset = 0;
      });
    });
  }

  /* ---------- Countdown ---------- */
  var timer = null;
  function renderCountdown(ev) {
    if (timer) clearInterval(timer);
    var box = $("countdown"), last = {};
    box.innerHTML = ["Tage", "Std", "Min", "Sek"].map(function (l) {
      return '<div><strong class="num">0</strong><span>' + l + "</span></div>";
    }).join("");
    var cells = box.querySelectorAll("strong");
    function tick() {
      var diff = new Date(ev.abreise) - new Date();
      if (diff <= 0) { box.innerHTML = '<div><strong>Los</strong><span>Gute Fahrt</span></div>'; $("g-days").textContent = "0"; clearInterval(timer); return; }
      var v = [Math.floor(diff / 864e5), Math.floor(diff / 36e5) % 24, Math.floor(diff / 6e4) % 60, Math.floor(diff / 1e3) % 60];
      v.forEach(function (n, i) {
        var txt = i === 0 ? String(n) : (n < 10 ? "0" : "") + n;
        if (last[i] === txt) return;
        cells[i].textContent = txt;
        if (!reduce && last[i] !== undefined) { cells[i].classList.remove("flip"); void cells[i].offsetWidth; cells[i].classList.add("flip"); }
        last[i] = txt;
      });
      $("g-days").textContent = v[0];
    }
    tick();
    timer = setInterval(tick, 1000);
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
    if (latest) $("ribbon").innerHTML = "<b>Neu.</b> " + esc(latest.text) + ' <a href="#todo">Alle Updates ›</a>';
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

    buildGauge();
  }

  function updateArrows() {
    var car = $("stays");
    $("prev").disabled = car.scrollLeft < 8;
    $("next").disabled = car.scrollLeft + car.clientWidth >= car.scrollWidth - 8;
  }

  /* ---------- Auf einen Blick (Bento) ---------- */
  function renderGlance(ev, d) {
    var ci = costInfo(ev, d);
    var list = d.checkliste || [];
    var done = list.filter(function (t) { return t.erledigt; }).length;
    var next = list.filter(function (t) { return !t.erledigt; })[0];
    var near = ev.unterkuenfte.filter(function (u) { return u.zone === "strecke"; }).length;
    var price = (ev.tickets.preis.match(/^[\d.,]+/) || ["?"])[0];
    var stripe = '<span class="t-stripe" aria-hidden="true"><i></i><i></i><i></i></span>';

    $("glance").innerHTML = [
      '<a class="tile w2 reveal" style="--i:0" href="#programm"><span class="t-label">Programm</span><span class="t-big">' + esc(ev.reise.replace(/ 20\d\d$/, "")) + '</span><span class="t-sub">' + esc(ev.rennen) + '</span><ul class="t-days">' +
        ev.programm.map(function (p) { return "<li><b>" + esc(p.tag.slice(0, 2).toUpperCase()) + "</b><span>" + esc(p.kurz || "") + "</span></li>"; }).join("") +
        '</ul><span class="t-more">Zum Programm</span></a>',
      '<a class="tile w2 dark reveal" style="--i:1" href="#kosten">' + stripe + '<span class="t-label">Pro Zahler</span><span class="t-big tech"><span data-count="' + ci.lo + '">' + chf(ci.lo) + '</span> bis <span data-count="' + ci.hi + '">' + chf(ci.hi) + '</span><small>CHF</small></span><span class="t-sub">' + d.teilnehmer + " Personen, " + d.zahler + ' zahlen. Der Bräutigam ist eingeladen.</span><span class="t-more">Zu den Kosten</span></a>',
      '<a class="tile reveal" style="--i:2" href="#tickets"><span class="t-label">Ticket</span><span class="t-big tech">' + esc(price) + '<small>EUR</small></span><span class="t-sub">pro Person, offene Tribünen inklusive.</span><span class="t-more">Tickets</span></a>',
      '<a class="tile reveal" style="--i:3" href="#unterkunft"><span class="t-label">Unterkunft</span><span class="t-big tech">' + ev.unterkuenfte.length + '</span><span class="t-sub">mit Parkplatz. ' + near + " nahe der Strecke, " + (ev.unterkuenfte.length - near) + ' in der Stadt.</span><span class="t-more">Ansehen</span></a>',
      '<a class="tile w2 reveal" style="--i:4" href="#essen"><span class="t-label">Essen und Bars</span><span class="t-big">' + esc(ev.essen[0].name) + '</span><span class="t-sub">' + esc(ev.essen[0].text) + " Dazu " + (ev.essen.length - 1) + ' weitere Adressen.</span><span class="t-more">Alle Adressen</span></a>',
      '<a class="tile w4 reveal" style="--i:5" href="#todo"><span class="t-label">To do</span><span class="t-big">' + done + " von " + list.length + ' erledigt</span><div class="t-bar"><i data-w="' + Math.max(3, list.length ? Math.round(done / list.length * 100) : 0) + '"></i></div><span class="t-sub">' + (next ? "Als Nächstes: " + esc(next.text) : "Alles erledigt.") + '</span><span class="t-more">Zur Liste</span></a>'
    ].join("");
  }

  /* ---------- Unterkuenfte ---------- */
  function renderStays(ev) {
    var zoneLabel = { strecke: "Nahe Strecke", stadt: "In der Stadt" };
    var statusLabel = { frei: "Verfügbar", voll: "Ausgebucht", pruefen: "Live prüfen" };
    $("stays").innerHTML = ev.unterkuenfte.map(function (u) {
      var st = u.status || "pruefen";
      return '<article class="stay" data-zone="' + esc(u.zone) + '">' +
        '<div class="stay-top"><span class="label">' + esc(zoneLabel[u.zone] || "") + '</span><span class="chip ' + esc(st) + '">' + esc(statusLabel[st] || st) + "</span></div>" +
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
      s.classList.toggle("hide", state.zone !== "alle" && s.getAttribute("data-zone") !== state.zone);
    });
    $("stays").scrollLeft = 0;
    updateArrows();
  }

  /* ---------- Variante darstellen ---------- */
  function renderEvent() {
    var d = state.data, ev = d.events[state.event], ci = costInfo(ev, d);
    document.title = "JGA 2027 · " + ev.name;
    $("hero-eyebrow").textContent = "Junggesellenabschied 2027 · " + ev.ort;
    $("hero-meta").textContent = ev.reise + " · " + ev.distanz.replace(/^ca\. /, "") + " ab " + d.start.replace(/ TG$/, "");

    var sw = $("switch");
    each(sw.querySelectorAll("button"), function (b) { b.setAttribute("aria-selected", b.getAttribute("data-event") === state.event ? "true" : "false"); });
    placeThumb(sw);

    $("specs").innerHTML =
      "<div><dt>Reise</dt><dd>" + esc(ev.reise.replace(/ 20\d\d$/, "")) + "</dd></div>" +
      "<div><dt>Rennstart</dt><dd>" + esc(ev.rennstartKurz) + "</dd></div>" +
      "<div><dt>Fahrt ab " + esc(d.start.replace(/ TG$/, "")) + "</dt><dd>" + esc(ev.distanz.replace(/^ca\. /, "")) + "</dd></div>" +
      "<div><dt>Pro Zahler</dt><dd>" + chf(ci.lo) + " bis " + chf(ci.hi) + " CHF</dd></div>";

    setGauge(ev, d);
    renderCountdown(ev);
    renderGlance(ev, d);

    $("days").innerHTML = ev.programm.map(function (day, i) {
      return '<div class="day reveal" style="--i:' + i + '"><div class="day-head"><h3>' + esc(day.tag) + '</h3><span class="date">' + esc(day.datum) + "</span></div>" +
        day.punkte.map(function (p) { return '<div class="slot' + (p.highlight ? " key" : "") + '"><time>' + esc(p.zeit) + "</time><p>" + esc(p.text) + "</p></div>"; }).join("") + "</div>";
    }).join("");

    var t = ev.tickets, k = ev.kart, eur = (t.preis.match(/^[\d.,]+/) || [""])[0];
    $("ticket-box").innerHTML =
      '<article class="card reveal"><span class="label">Rennticket</span><h3>' + esc(t.titel) + '</h3><p class="price num">' + esc(eur) + "<small>EUR pro Person" + (/2026/.test(t.preis) ? ", Preis 2026" : "") + "</small></p>" +
      "<dl><div><dt>Inklusive</dt><dd>" + esc(t.inklusive) + "</dd></div><div><dt>Verkauf</dt><dd>" + esc(t.status) + "</dd></div></dl>" +
      '<p class="warn">' + esc(t.warnung) + "</p>" +
      '<div class="btns">' + t.links.map(function (l, i) { return btn(l.url, l.label, i ? "ghost" : ""); }).join("") + "</div></article>" +
      '<article class="card dark reveal" style="--i:1"><span class="t-stripe" aria-hidden="true"><i></i><i></i><i></i></span><span class="label light">Kartrennen</span><h3>' + esc(k.name) + '</h3><p class="muted">' + esc(k.text) + "</p>" +
      '<p class="tel">' + esc(k.telefon) + '</p><div class="btns">' + btn(k.url, "Zur Kartbahn") + "</div></article>";

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

    $("dine").innerHTML = ev.essen.map(function (e, i) {
      return '<div class="eat reveal" style="--i:' + (i % 3) + '"><span class="label">' + esc(e.ort) + "</span><h3>" + esc(e.name) + "</h3><p>" + esc(e.text) + "</p></div>";
    }).join("");

    var ph = $("price-hero");
    if (ph.classList.contains("in")) each(ph.querySelectorAll("[data-count]"), function (x) { countUp(x, +x.getAttribute("data-count")); });
    observe(document);
  }

  function setEvent(key, push) {
    if (!state.data.events[key] || key === state.event) return;
    state.event = key;
    store("jga-event", key);
    if (push && history.replaceState) history.replaceState(null, "", "#" + key);
    var box = $("event-content"), gl = $("glance");
    if (reduce) { renderEvent(); return; }
    box.style.transition = gl.style.transition = "opacity .3s ease";
    box.style.opacity = gl.style.opacity = "0";
    setTimeout(function () {
      renderEvent();
      box.style.opacity = gl.style.opacity = "1";
    }, 300);
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

  /* ---------- Scroll: Nav Linie, Hero zieht sich zurueck wie bei Apple ---------- */
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
