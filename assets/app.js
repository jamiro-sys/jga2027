(function () {
  "use strict";

  var DATA_URL = "data/trip.json";
  var state = { data: null, event: null, zone: "alle" };

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
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
  }
  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  function chooseInitialEvent(d) {
    var hash = (location.hash || "").replace("#", "");
    if (d.events[hash]) return hash;
    if (d.entscheid && d.events[d.entscheid]) return d.entscheid;
    var saved = store("jga-event");
    if (saved && d.events[saved]) return saved;
    return Object.keys(d.events)[0];
  }

  function renderStatic(d) {
    $("hero-lead").textContent = d.einleitung;
    var keys = Object.keys(d.events);
    $("switch").innerHTML = keys.map(function (k) {
      return '<button type="button" role="tab" data-event="' + esc(k) + '" aria-selected="false">' + esc(d.events[k].name) + "</button>";
    }).join("");
    $("switch").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-event]");
      if (!b) return;
      setEvent(b.getAttribute("data-event"), true);
    });

    if (d.entscheid && d.events[d.entscheid]) {
      $("decision").textContent = "Entschieden: " + d.events[d.entscheid].name;
    } else {
      $("decision").textContent = d.entscheidHinweis || "";
    }

    var today = new Date();
    $("updates").innerHTML = (d.updates || []).map(function (u) {
      var age = (today - new Date(u.datum + "T12:00:00")) / 864e5;
      return '<div class="update' + (age <= 7 ? " new" : "") + '"><time datetime="' + esc(u.datum) + '">' + esc(fmtDate(u.datum)) + "</time><p>" + esc(u.text) + "</p></div>";
    }).join("");

    $("availability").textContent = d.verfuegbarkeit || "";
    $("cost-note").textContent = d.kostenHinweis || "";
    $("stand").textContent = "Stand " + fmtDate(d.stand);

    $("tasks").innerHTML = (d.checkliste || []).map(function (t) {
      return '<li class="' + (t.erledigt ? "done" : "") + '"><span>' + esc(t.frist) + "</span><p>" + esc(t.text) + "</p><em>" + (t.erledigt ? "Erledigt" : "Offen") + "</em></li>";
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
  }

  function renderStays() {
    var ev = state.data.events[state.event];
    var zoneLabel = { strecke: "Nahe Strecke", stadt: "In der Stadt" };
    var statusLabel = { frei: "Verfügbar", voll: "Ausgebucht", pruefen: "Live prüfen" };
    var list = ev.unterkuenfte.filter(function (u) { return state.zone === "alle" || u.zone === state.zone; });
    $("stays").innerHTML = list.map(function (u) {
      var st = u.status || "pruefen";
      return '<article class="stay">' +
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
  }

  var timer = null;
  function renderCountdown(ev) {
    if (timer) clearInterval(timer);
    function tick() {
      var diff = new Date(ev.abreise) - new Date();
      if (diff <= 0) { $("countdown").innerHTML = '<div><strong>Los</strong><span>Gute Fahrt</span></div>'; return; }
      var d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60;
      $("countdown").innerHTML =
        '<div><strong class="num">' + d + "</strong><span>Tage</span></div>" +
        '<div><strong class="num">' + h + "</strong><span>Stunden</span></div>" +
        '<div><strong class="num">' + m + "</strong><span>Minuten</span></div>";
    }
    tick();
    timer = setInterval(tick, 30000);
  }

  function renderEvent() {
    var d = state.data, ev = d.events[state.event];
    document.title = "JGA 2027 · " + ev.name;
    $("hero-eyebrow").textContent = "Junggesellenabschied 2027 · " + ev.ort;
    Array.prototype.forEach.call($("switch").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-event") === state.event ? "true" : "false");
    });
    renderCountdown(ev);

    var c = ev.kosten;
    var totals = c.spalten.map(function (_, i) { return c.zeilen.reduce(function (s, z) { return s + z.werte[i]; }, 0); });
    var perPayer = totals.map(function (t) { return Math.round(t / d.zahler / 5) * 5; });
    var lo = Math.min.apply(null, perPayer), hi = Math.max.apply(null, perPayer);

    $("facts").innerHTML =
      '<div class="fact"><span>Reise</span><strong>' + esc(ev.reise) + "</strong><small>ab " + esc(d.start) + "</small></div>" +
      '<div class="fact"><span>Rennen</span><strong>' + esc(ev.rennen) + "</strong></div>" +
      '<div class="fact"><span>Fahrt mit dem Bus</span><strong>' + esc(ev.distanz) + "</strong><small>" + esc(ev.route) + "</small></div>" +
      '<div class="fact"><span>Pro Zahler</span><strong class="num">' + chf(lo) + " bis " + chf(hi) + " CHF</strong><small>" + d.teilnehmer + " Personen, " + d.zahler + " zahlen</small></div>";

    $("days").innerHTML = ev.programm.map(function (day) {
      return '<div class="day"><h3>' + esc(day.tag) + "<span>" + esc(day.datum) + "</span></h3>" +
        day.punkte.map(function (p) {
          return '<div class="slot' + (p.highlight ? " key" : "") + '"><time>' + esc(p.zeit) + "</time><p>" + esc(p.text) + "</p></div>";
        }).join("") + "</div>";
    }).join("");

    var t = ev.tickets, k = ev.kart;
    $("ticket-box").innerHTML =
      '<article class="card"><p class="eyebrow">Rennticket</p><h3>' + esc(t.titel) + '</h3><p class="price num">' + esc(t.preis) + "</p>" +
      "<dl><div><dt>Inklusive</dt><dd>" + esc(t.inklusive) + "</dd></div><div><dt>Verkauf</dt><dd>" + esc(t.status) + "</dd></div></dl>" +
      '<div class="buttons">' + t.links.map(function (l, i) { return link(l.url, l.label, i === 0 ? "primary" : ""); }).join("") + "</div>" +
      '<p class="warn">' + esc(t.warnung) + "</p></article>" +
      '<article class="card"><p class="eyebrow">Kartrennen</p><h3>' + esc(k.name) + "</h3><p>" + esc(k.text) + "</p>" +
      '<p>Telefon: <span class="tel">' + esc(k.telefon) + "</span></p>" +
      '<div class="buttons">' + link(k.url, "Zur Kartbahn") + "</div></article>";

    renderStays();
    $("live-links").innerHTML = ev.liveSuche.map(function (l) { return link(l.url, l.label); }).join("");

    $("costs").innerHTML =
      "<thead><tr><th>CHF, ganze Gruppe</th>" + c.spalten.map(function (s) { return "<th>" + esc(s) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      c.zeilen.map(function (z) { return "<tr><td>" + esc(z.posten) + "</td>" + z.werte.map(function (w) { return "<td>" + chf(w) + "</td>"; }).join("") + "</tr>"; }).join("") +
      '<tr class="total"><td>Total Gruppe</td>' + totals.map(function (t) { return "<td>" + chf(t) + "</td>"; }).join("") + "</tr>" +
      '<tr class="payer"><td>Pro Zahler</td>' + perPayer.map(function (p) { return "<td>" + chf(p) + "</td>"; }).join("") + "</tr></tbody>";

    $("dine").innerHTML = ev.essen.map(function (e) {
      return '<div><span class="tag">' + esc(e.ort) + "</span><h3>" + esc(e.name) + "</h3><p>" + esc(e.text) + "</p></div>";
    }).join("");
  }

  function setEvent(key, push) {
    if (!state.data.events[key]) return;
    state.event = key;
    store("jga-event", key);
    if (push && history.replaceState) history.replaceState(null, "", "#" + key);
    renderEvent();
  }

  window.addEventListener("hashchange", function () {
    var h = location.hash.replace("#", "");
    if (state.data && state.data.events[h] && h !== state.event) setEvent(h, false);
  });

  // Aktiven Abschnitt in der Navigation markieren
  function watchNav() {
    if (!("IntersectionObserver" in window)) return;
    var links = document.querySelectorAll(".nav a");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    links.forEach(function (a) { var s = document.querySelector(a.getAttribute("href")); if (s) io.observe(s); });
  }

  fetch(DATA_URL, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      state.data = d;
      renderStatic(d);
      state.event = chooseInitialEvent(d);
      renderEvent();
      watchNav();
    })
    .catch(function () {
      $("hero-lead").textContent = "Die Daten konnten nicht geladen werden. Bitte Seite neu laden.";
    });
})();
