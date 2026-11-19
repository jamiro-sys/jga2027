# JGA 2027

Webseite für den Junggesellenabschied 2027: Programm, Tickets, Unterkunft, Kosten und To do für beide Varianten (24h Nürburgring und 24h Spa).

## Seite einmalig einschalten

1. Im Repo auf **Settings** und dann **Pages** gehen.
2. Bei **Source** "Deploy from a branch" wählen, Branch **main**, Ordner **/ (root)**, speichern.
3. Nach ca. 1 Minute ist die Seite hier erreichbar: **https://jamiro-sys.github.io/jga2027/**

Diesen Link könnt ihr den Teilnehmern schicken. Direkt auf eine Variante verlinken geht mit `#spa` oder `#nuerburgring` am Ende.

## Updates machen

Alle Inhalte stehen in einer einzigen Datei: **`data/trip.json`**. Den Code müsst ihr nie anfassen.

1. Auf GitHub die Datei `data/trip.json` öffnen und auf den Stift (Edit) klicken.
2. Text ändern, dann **Commit changes** klicken.
3. Nach ca. 1 Minute ist die Änderung auf der Seite.

### Häufige Updates

**Neue Meldung oben auf der Seite** (die neueste zuerst, wird 7 Tage als "Neu" markiert):

```json
"updates": [
  { "datum": "2026-12-05", "text": "Tickets sind gekauft!" },
  { "datum": "2026-11-19", "text": "Webseite ist online." }
],
```

**Entscheid festlegen** (dann öffnet die Seite automatisch diese Variante):

```json
"entscheid": "spa",
```

Möglich sind `"spa"`, `"nuerburgring"` oder `null` für noch offen.

**Aufgabe abhaken:** in der `checkliste` bei der Aufgabe `"erledigt": true` setzen.

**Unterkunft Status ändern:** bei der Unterkunft `"status"` auf `"frei"`, `"voll"` oder `"pruefen"` setzen.

**Kosten anpassen:** in `kosten` die Zahlen ändern. Total und Betrag pro Zahler rechnet die Seite selbst aus.

### Wichtig

* Texte immer in "Anführungszeichen".
* Nach jedem Eintrag ausser dem letzten in einer Liste kommt ein Komma.
* Wenn die Seite nach einer Änderung leer bleibt, fehlt meistens ein Komma oder ein Anführungszeichen. Die Datei auf jsonlint.com einfügen zeigt den Fehler an.

## Gemeinsam arbeiten

Damit dein Kollege auch Updates machen kann: **Settings**, **Collaborators**, **Add people**, seinen GitHub Namen eingeben.

## Aufbau

* `index.html`: Grundgerüst der Seite
* `assets/style.css`: Gestaltung
* `assets/app.js`: baut die Seite aus den Daten
* `data/trip.json`: alle Inhalte
