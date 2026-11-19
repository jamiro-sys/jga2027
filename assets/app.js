(function () {
  "use strict";

  var DATA_URL = "data/trip.json";
  var state = { data: null, event: null, zone: "alle" };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Helfer ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function $(id) { return document.getElementById(id); }
  function chf(n) { return Number(n).toLocaleString("de-CH"); }
  function link(url, label, cls) {
    return '<a class="btn ' + (cls || "") + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + "</a>";
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

  /* Zahlen hochzaehlen */
  function countUp(el, to, suffix) {
    suffix = suffix || "";
    if (reduceMotion) { el.textContent = chf(to) + suffix; return; }
    var start = performance.now(), dur = 1400;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = chf(Math.round(to * e)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Elemente beim Scrollen einblenden */
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      io.unobserve(en.target);
      var n = en.target.querySelectorAll("[data-count]");
      Array.prototype.forEach.call(n, function (x) { countUp(x, +x.getAttribute("data-count")); });
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;

  function observe(root) {
    var els = (root || document).querySelectorAll("[data-reveal]:not(.in)");
    Array.prototype.forEach.call(els, function (el) {
      if (io) io.observe(el); else el.classList.add("in");
    });
  }

  /* ---------- Chronograph ---------- */
  function buildDial() {
    var ticks = "", nums = "";
    for (var i = 0; i < 96; i++) {
      var major = i % 4 === 0;
      var a = (i / 96) * Math.PI * 2 - Math.PI / 2;
      var r1 = 170, r2 = major ? 156 : 163;
      ticks += '<line class="tick' + (major ? "" : " minor") + '" style="--i:' + i + '" x1="' + (200 + Math.cos(a) * r1).toFixed(1) + '" y1="' + (200 + Math.sin(a) * r1).toFixed(1) +
        '" x2="' + (200 + Math.cos(a) * r2).toFixed(1) + '" y2="' + (200 + Math.sin(a) * r2).toFixed(1) + '" stroke-width="' + (major ? 2 : 1) + '"/>';
    }
    [24, 3, 6, 9, 12, 15, 18, 21].forEach(function (h, k) {
      var a = (h % 24) / 24 * Math.PI * 2 - Math.PI / 2;
      nums += '<text class="numeral" style="--i:' + k + '" x="' + (200 + Math.cos(a) * 143).toFixed(1) + '" y="' + (205 + Math.sin(a) * 143).toFixed(1) + '" text-anchor="middle">' + h + "</text>";
    });
    $("ticks").innerHTML = ticks;
    $("numerals").innerHTML = nums;
  }

  function setDial(ev, d) {
    // Stundenzeiger zeigt den Rennstart auf dem 24 Stunden Zifferblatt
    var times = ev.rennstartKurz.match(/\d{1,2}(:\d{2})?/g) || ["16"];
    var last = times[times.length - 1].split(":");
    var hours = +last[0] + (last[1] ? +last[1] / 60 : 0);
    $("hand-hour").style.transform = "rotate(" + (hours / 24 * 360) + "deg)";
    $("chrono-sub").textContent = "START " + ev.rennstartKurz.toUpperCase();

    // Goldener Bogen: wie weit die Vorfreude schon ist (von heute bis zur Abfahrt, gerechnet ab Planungsstart)
    var from = new Date(d.stand + "T00:00:00"), to = new Date(ev.abreise), now = new Date();
    var p = Math.max(0.03, Math.min(1, (now - from) / (to - from)));
    var arc = $("race-arc"), len = 2 * Math.PI * 132;
    arc.style.strokeDashoffset = len;
    requestAnimationFrame(function () { requestAnimationFrame(function () { arc.style.strokeDashoffset = len * (1 - p); }); });
  }

  /* ---------- Countdown ---------- */
  var timer = null, last = {};
  function renderCountdown(ev) {
    if (timer) clearInterval(timer);
    last = {};
    var box = $("countdown");
    box.innerHTML = ["Tage", "Std", "Min", "Sek"].map(function (l, i) {
      return '<div><strong class="num" data-k="' + i + '">0</strong><span>' + l + "</span></div>";
    }).join("");
    var cells = box.querySelectorAll("strong");
    function tick() {
      var diff = new Date(ev.abreise) - new Date();
      if (diff <= 0) { box.innerHTML = '<div><strong>Los</strong><span>Gute Fahrt</span></div>'; clearInterval(timer); return; }
      var v = [Math.floor(diff / 864e5), Math.floor(diff / 36e5) % 24, Math.floor(diff / 6e4) % 60, Math.floor(diff / 1e3) % 60];
      v.forEach(function (n, i) {
        var txt = i === 0 ? String(n) : (n < 10 ? "0" : "") + n;
        if (last[i] !== txt) {
          cells[i].textContent = txt;
          if (!reduceMotion && last[i] !== undefined) {
            cells[i].classList.remove("flip"); void cells[i].offsetWidth; cells[i].classList.add("flip");
          }
          last[i] = txt;
        }
      });
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ---------- Einmalige Teile ---------- */
  function renderStatic(d) {
    $("hero-lead").textContent = d.einleitung;
    var keys = Object.keys(d.events);
    var sw = $("switch");
    sw.insertAdjacentHTML("beforeend", keys.map(function (k) {
      return '<button type="button" role="tab" data-event="' + esc(k) + '" aria-selected="false">' + esc(d.events[k].name) + "</button>";
    }).join(""));
    sw.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-event]");
      if (b) setEvent(b.getAttribute("data-event"), true);
    });

    $("decision").textContent = (d.entscheid && d.events[d.entscheid]) ? "Entschieden: " + d.events[d.entscheid].name : (d.entscheidHinweis || "");

    var today = new Date();
    $("updates").innerHTML = (d.updates || []).map(function (u) {
      var age = (today - new Date(u.datum + "T12:00:00")) / 864e5;
      return '<div class="update' + (age <= 7 ? " new" : "") + '"><time datetime="' + esc(u.datum) + '">' + esc(fmtDate(u.datum)) + "</time><p>" + esc(u.text) + "</p></div>";
    }).join("");

    $("availability").textContent = d.verfuegbarkeit || "";
    $("cost-note").textContent = d.kostenHinweis || "";
    $("stand").textContent = "Stand " + fmtDate(d.stand);

    $("tasks").innerHTML = (d.checkliste || []).map(function (t, i) {
      return '<li data-reveal style="--i:' + i + '" class="' + (t.erledigt ? "done" : "") + '"><span>' + esc(t.frist) + "</span><p>" + esc(t.text) + "</p><em>" + (t.erledigt ? "Erledigt" : "Offen") + "</em></li>";
    }).join("");

    var packed = {};
    try { packed = JSON.parse(store("jga-pack") || "{}") || {}; } catch (e) { packed = {}; }
    $("pack").innerHTML = (d.packliste || []).map(function (p, i) {
      var id = "pack-" + i;
      return '<li><label for="' + id + '"><input type="checkbox" id="' + id + '" data-item="' + esc(p) + '"' + (packed[p] ? " checked" : "") + "><span>" + esc(p) + "</span></label></li>";
    }).join("");
    $("pack").addEventListener("change", function (e) {
      var item = e.target.getAttribute("data-item");
      if (!item) return;
      packed[item] = e.target.checked;
      store("jga-pack", JSON.stringify(packed));
    });

    $("zone-filter").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-zone]");
      if (!b) return;
      state.zone = b.getAttribute("data-zone");
      Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      renderStays();
    });

    buildDial();
  }

  /* ---------- Alles auf einen Blick ---------- */
  function renderGlance(ev, d) {
    var ci = costInfo(ev, d);
    var done = (d.checkliste || []).filter(function (t) { return t.erledigt; }).length;
    var total = (d.checkliste || []).length;
    var next = (d.checkliste || []).filter(function (t) { return !t.erledigt; })[0];
    var near = ev.unterkuenfte.filter(function (u) { return u.zone === "strecke"; }).length;
    var town = ev.unterkuenfte.length - near;
    var price = (ev.tickets.preis.match(/^[\d.,]+\s*EUR/) || [ev.tickets.preis])[0];

    var tiles = [
      { href: "#programm", k: "Programm", v: ev.reise.replace(/ 20\d\d$/, ""), extra: '<ul class="mini">' + ev.programm.map(function (p) { return "<li><b>" + esc(p.tag.slice(0, 2).toUpperCase()) + "</b>" + esc(p.kurz || "") + "</li>"; }).join("") + "</ul>" },
      { href: "#tickets", k: "Tickets", v: price, s: "pro Person, alle offenen Tribünen inklusive. Nur offiziell kaufen." },
      { href: "#unterkunft", k: "Unterkunft", v: ev.unterkuenfte.length + " mit Parkplatz", s: near + " nahe der Strecke, " + town + " in der Stadt. Plus Live Suche." },
      { href: "#kosten", k: "Kosten", v: '<span data-countto="' + ci.lo + '">0</span> bis <span data-countto="' + ci.hi + '">0</span> CHF', s: "pro Zahler. Der Bräutigam ist eingeladen.", raw: true },
      { href: "#essen", k: "Tafel und Bar", v: ev.essen[0].name, s: "und " + (ev.essen.length - 1) + " weitere Adressen für gute Abende." },
      { href: "#todo", k: "To do", v: done + " von " + total + " erledigt", s: next ? "Als Nächstes: " + next.text : "Alles erledigt.", extra: '<div class="meter"><i data-w="' + (total ? Math.round(done / total * 100) : 0) + '"></i></div>' }
    ];

    var g = $("glance");
    g.innerHTML = tiles.map(function (t, i) {
      return '<a class="tile" style="--i:' + i + '" href="' + t.href + '"><span class="k">' + esc(t.k) + '</span><span class="v num">' + (t.raw ? t.v : esc(t.v)) + "</span>" +
        (t.s ? '<span class="s">' + esc(t.s) + "</span>" : "") + (t.extra || "") + '<span class="go">Ansehen</span></a>';
    }).join("");

    var delay = g.classList.contains("ready") ? 300 : 1100;
    setTimeout(function () {
      Array.prototype.forEach.call(g.querySelectorAll("[data-countto]"), function (el) { countUp(el, +el.getAttribute("data-countto")); });
      Array.prototype.forEach.call(g.querySelectorAll(".meter i"), function (el) { el.style.width = Math.max(4, +el.getAttribute("data-w")) + "%"; });
    }, reduceMotion ? 0 : delay);
    g.classList.add("ready");
  }

  function renderStays() {
    var ev = state.data.events[state.event];
    var zoneLabel = { strecke: "Nahe Strecke", stadt: "In der Stadt" };
    var statusLabel = { frei: "Verfügbar", voll: "Ausgebucht", pruefen: "Live prüfen" };
    var list = ev.unterkuenfte.filter(function (u) { return state.zone === "alle" || u.zone === state.zone; });
    $("stays").innerHTML = list.map(function (u, i) {
      var st = u.status || "pruefen";
      return '<article class="stay" data-reveal style="--i:' + i + '">' +
        '<div class="stay-top"><span class="tag">' + esc(zoneLabel[u.zone] || "") + '</span><span class="status ' + esc(st) + '">' + esc(statusLabel[st] || st) + "</span></div>" +
        "<h3>" + esc(u.name) + "</h3>" +
        '<p class="where">' + esc(u.ort) + "</p>" +
        "<ul>" +
          "<li><b>I</b><span>" + esc(u.typ) + (u.platz ? ", " + esc(u.platz) : "") + "</span></li>" +
          '<li class="park"><b>P</b><span>' + esc(u.parkplatz) + "</span></li>" +
          "<li><b>€</b><span>" + esc(u.preis) + "</span></li>" +
        "</ul>" +
        (u.hinweis ? '<p class="hint">' + esc(u.hinweis) + "</p>" : "") +
        link(u.url, u.linkLabel || "Ansehen", "primary") +
        "</article>";
    }).join("");
    observe($("stays"));
  }

  /* ---------- Inhalte der gewaehlten Variante ---------- */
  function renderEvent() {
    var d = state.data, ev = d.events[state.event];
    document.title = "JGA 2027 · " + ev.name;
    $("hero-eyebrow").textContent = "Junggesellenabschied 2027 · " + ev.ort;
    $("hero-meta").innerHTML = "<span>" + esc(ev.reise) + "</span><span>" + esc(ev.distanz.replace(/^ca\. /, "")) + " ab " + esc(d.start.replace(/ TG$/, "")) + "</span>";

    var sw = $("switch"), idx = 0;
    Array.prototype.forEach.call(sw.querySelectorAll("button"), function (b, i) {
      var on = b.getAttribute("data-event") === state.event;
      b.setAttribute("aria-selected", on ? "true" : "false");
      if (on) idx = i;
    });
    sw.setAttribute("data-index", idx);

    setDial(ev, d);
    renderCountdown(ev);
    renderGlance(ev, d);

    $("days").innerHTML = ev.programm.map(function (day, i) {
      return '<div class="day" data-reveal style="--i:' + i + '"><h3>' + esc(day.tag) + "<span>" + esc(day.datum) + '</span></h3><div class="slots">' +
        day.punkte.map(function (p) {
          return '<div class="slot' + (p.highlight ? " key" : "") + '"><time>' + esc(p.zeit) + "</time><p>" + esc(p.text) + "</p></div>";
        }).join("") + "</div></div>";
    }).join("");

    var t = ev.tickets, k = ev.kart;
    $("ticket-box").innerHTML =
      '<article class="card" data-reveal><p class="eyebrow">Rennticket</p><h3>' + esc(t.titel) + '</h3><p class="price num">' + esc(t.preis) + "</p>" +
      "<dl><div><dt>Inklusive</dt><dd>" + esc(t.inklusive) + "</dd></div><div><dt>Verkauf</dt><dd>" + esc(t.status) + "</dd></div></dl>" +
      '<div class="buttons">' + t.links.map(function (l, i) { return link(l.url, l.label, i === 0 ? "primary" : ""); }).join("") + "</div>" +
      '<p class="warn">' + esc(t.warnung) + "</p></article>" +
      '<article class="card" data-reveal style="--i:1"><p class="eyebrow">Kartrennen</p><h3>' + esc(k.name) + "</h3><p>" + esc(k.text) + "</p>" +
      '<p>Telefon: <span class="tel">' + esc(k.telefon) + "</span></p>" +
      '<div class="buttons">' + link(k.url, "Zur Kartbahn") + "</div></article>";

    renderStays();
    $("live-links").innerHTML = ev.liveSuche.map(function (l) { return link(l.url, l.label); }).join("");

    var c = ev.kosten, ci = costInfo(ev, d);
    $("costs").innerHTML =
      "<thead><tr><th>CHF, ganze Gruppe</th>" + c.spalten.map(function (s) { return "<th>" + esc(s) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      c.zeilen.map(function (z) { return "<tr><td>" + esc(z.posten) + "</td>" + z.werte.map(function (w) { return "<td>" + chf(w) + "</td>"; }).join("") + "</tr>"; }).join("") +
      '<tr class="total"><td>Total Gruppe</td>' + ci.totals.map(function (x) { return "<td>" + chf(x) + "</td>"; }).join("") + "</tr>" +
      '<tr class="payer"><td>Pro Zahler</td>' + ci.per.map(function (p) { return '<td data-count="' + p + '">' + chf(p) + "</td>"; }).join("") + "</tr></tbody>";

    $("dine").innerHTML = ev.essen.map(function (e, i) {
      return '<div data-reveal style="--i:' + i + '"><span class="tag">' + esc(e.ort) + "</span><h3>" + esc(e.name) + "</h3><p>" + esc(e.text) + "</p></div>";
    }).join("");

    // Kosten Zeile neu einblenden, damit die Zahlen beim Wechsel wieder hochzaehlen
    var cg = document.querySelector(".cost-grid");
    if (cg && cg.classList.contains("in")) {
      Array.prototype.forEach.call(cg.querySelectorAll("[data-count]"), function (x) { countUp(x, +x.getAttribute("data-count")); });
    }
    observe(document);
  }

  function setEvent(key, push) {
    if (!state.data.events[key] || key === state.event) return;
    state.event = key;
    store("jga-event", key);
    if (push && history.replaceState) history.replaceState(null, "", "#" + key);
    var box = $("event-content");
    if (reduceMotion) { renderEvent(); return; }
    box.classList.add("swap");
    setTimeout(function () { renderEvent(); box.classList.remove("swap"); }, 280);
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

  /* Topbar Schatten und aktiver Abschnitt */
  window.addEventListener("scroll", function () {
    $("topbar").classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  function watchNav() {
    if (!("IntersectionObserver" in window)) return;
    var links = document.querySelectorAll(".nav a");
    var nav = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    links.forEach(function (a) { var s = document.querySelector(a.getAttribute("href")); if (s) nav.observe(s); });
  }

  fetch(DATA_URL, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      state.data = d;
      renderStatic(d);
      state.event = chooseInitialEvent(d);
      renderEvent();
      observe(document);
      watchNav();
    })
    .catch(function () {
      $("hero-lead").textContent = "Die Daten konnten nicht geladen werden. Bitte Seite neu laden.";
    });
})();
