# HTML Feedback

**Gezieltes Feedback zu Webseiten, für KI-Coding-Sessions.**

Wenn eine KI (Claude Code, Cursor, Codex …) eine HTML-Seite gebaut hat, ist Feedback dazu mühsam: „Die Überschrift in der linken Karte oben …“, „der Button über der Tabelle …“. Man beschreibt Stellen umständlich, und die KI muss raten, was gemeint ist.

HTML Feedback löst das mit einer **Chrome-Extension**: Man zeigt direkt auf der Seite auf Elemente, Bereiche oder Punkte und schreibt jeweils einen Kommentar dazu. Am Ende entsteht **eine einzige JSON-Datei** mit allen Kommentaren, technischen Angaben zu jeder Stelle (CSS-Selektor, Text, HTML-Auszug, Styles, Position) und **Screenshots der markierten Stellen**. Diese Datei gibt man der KI, und sie weiß genau, was wo geändert werden soll.

Für **Claude Code** gibt es dazu einen **Skill**, der das Paket auspackt, sich die Screenshots ansieht und die Änderungen umsetzt.

```
  Browser                               Coding-Session
 ┌────────────────────────────┐        ┌───────────────────────────────────┐
 │ Seite + HTML Feedback      │        │ „Hier ist Feedback:               │
 │  ① Element  → Kommentar    │  JSON  │   ~/Downloads/html-feedback/…json“│
 │  ② Bereich  → Kommentar    │ ─────▶ │                                   │
 │  ③ Punkt    → Kommentar    │        │ Skill packt aus, sieht Screen-    │
 │  [Exportieren]             │        │ shots, ändert die Seite           │
 └────────────────────────────┘        └───────────────────────────────────┘
```

Die Extension funktioniert auf jeder normalen Seite: lokale Dateien (`file://`), Dev-Server (`localhost`) und Seiten im Internet. Alles läuft lokal im Browser. Es gibt keinen Server und kein Konto, und es werden keine Daten verschickt.

---

## Inhalt des Repos

| Ordner | Inhalt |
|---|---|
| `extension/` | Die Chrome-Extension (Manifest V3) |
| `skill/html-feedback/` | Der Claude-Code-Skill mit dem Auspack-Skript `extract_feedback.py` |
| `test/beispiel.html` | Eine Beispielseite zum Ausprobieren |
| `tools/make_icons.py` | Erzeugt die Extension-Icons neu (nur für die Entwicklung) |

---

## Installation

### 1. Repo holen

```bash
git clone https://github.com/ralfw-vibe-coding/HTML-Feedback-Browser-Extension.git
```

Den Ordner dauerhaft liegen lassen: Chrome lädt die Extension direkt von dort.

### 2. Chrome-Extension laden

Die Extension ist nicht im Chrome Web Store, sondern wird als „entpackte Erweiterung“ geladen:

1. In Chrome `chrome://extensions` öffnen.
2. Oben rechts den **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** klicken und den Ordner **`extension/`** im Repo auswählen.
4. Empfohlen: Über das Puzzle-Symbol in der Symbolleiste „HTML Feedback“ **anheften**.
5. **Für lokale HTML-Dateien** (`file://…`): Bei „HTML Feedback“ auf **Details** gehen und **„Zugriff auf Datei-URLs zulassen“** einschalten. Ohne diese Freigabe zeigt die Extension beim Klick eine Hilfeseite dazu.

Läuft auch in anderen Chromium-Browsern wie Edge, Brave oder Arc (dort jeweils über deren Erweiterungsseite).

**Updates:** Nach `git pull` auf `chrome://extensions` beim Eintrag „HTML Feedback“ das Neu-laden-Symbol ↻ klicken.

### 3. Claude-Code-Skill installieren

Der Skill bringt Claude Code bei, mit den Feedback-Dateien richtig umzugehen. Ein Skill ist ein Ordner mit einer Anleitung (`SKILL.md`) und ggf. Hilfsskripten. Claude Code lädt ihn automatisch, sobald er zur Aufgabe passt.

**Für alle Projekte** (empfohlen), per Symlink. So kommen Updates über `git pull` automatisch mit:

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/HTML-Feedback-Browser-Extension/skill/html-feedback" ~/.claude/skills/html-feedback
```

Alternativ als Kopie, dann ohne automatische Updates:

```bash
cp -R HTML-Feedback-Browser-Extension/skill/html-feedback ~/.claude/skills/
```

**Nur für ein bestimmtes Projekt:** Den Ordner `skill/html-feedback` nach `<projekt>/.claude/skills/html-feedback` kopieren.

Voraussetzung ist **Python 3** (unter macOS vorhanden). Unter macOS wandelt das Skript die Screenshots mit dem Bordmittel `sips` von WebP nach PNG um. Auf anderen Systemen bleiben sie WebP, was Claude ebenfalls lesen kann.

Neue Claude-Code-Sessions erkennen den Skill sofort. Test: In einer Session fragen „Welche Skills hast du?“, dort sollte `html-feedback` auftauchen.

---

## Benutzung

### Feedback geben

Seite in Chrome öffnen, dann das Extension-Icon klicken oder **Alt+Shift+F** drücken. Rechts erscheint ein Panel mit drei Modi:

| Modus | So geht's |
|---|---|
| **Element** | Maus über die Seite bewegen: Das Element darunter wird blau umrandet. **Alt+↑** wählt das umgebende Element (z. B. vom Wort zum Absatz zur ganzen Karte), **Alt+↓** geht zurück. **Klick** öffnet das Kommentarfeld. |
| **Bereich** | Ein **Rechteck aufziehen**, z. B. über mehrere Elemente hinweg. Der Ausschnitt wird als Screenshot gespeichert. Ein **einfacher Klick** setzt einen **Punkt-Kommentar**; die Stelle wird im Screenshot eingekreist. |
| **Aus** | Die Seite normal bedienen, z. B. ein Menü aufklappen oder scrollen. Danach wieder „Element“ oder „Bereich“ wählen. |

- **Shift+Ziehen** zieht auch im Element-Modus einen Bereich auf.
- Im Kommentarfeld speichert **⌘↵** (Windows: Strg+↵), **Esc** bricht ab.
- Jeder Kommentar bekommt einen **nummerierten Pin** auf der Seite. Klick auf Pin oder Listeneintrag → bearbeiten oder löschen.
- Die Kommentare werden pro Seite im Browser zwischengespeichert und **überstehen ein Neuladen**. **Löschen** im Panel leert die Liste für eine neue Runde.
- Ein weiterer Klick aufs Icon blendet das Panel aus und wieder ein.

### Feedback übergeben

**Exportieren** (der Normalfall)
Speichert alles als eine Datei unter `~/Downloads/html-feedback/feedback-<seite>-<datum-zeit>.json` und legt den **Dateipfad in die Zwischenablage**. Mit **⌥/Alt-Klick** auf „Exportieren“ wählt man den Speicherort selbst.

In der Coding-Session dann einfach:

> Hier ist Feedback zur Seite: /Users/…/Downloads/html-feedback/feedback-beispiel-20261007-2115.json

**Kopieren** (schnell, nur Text)
Legt das Feedback **ohne Screenshots** als JSON-Text in die Zwischenablage, zum direkten Einfügen in einen Chat. Das geht nur, solange es ausschließlich Element-Kommentare gibt. Bei Bereichs- und Punkt-Kommentaren steckt die Information im Bild, deshalb ist „Kopieren“ dann gesperrt. Das verhindert auch, dass versehentlich Hunderte KB Bilddaten im Chat landen.

### Was der Skill in Claude Code macht

1. Er liest die JSON-Datei **nicht** als Text ein, denn die eingebetteten Bilder würden den Kontext fluten. Stattdessen ruft er `extract_feedback.py` auf. Das Skript schreibt jeden Screenshot als PNG-Datei und gibt eine kompakte Zusammenfassung aller Kommentare aus.
2. Er **sieht sich die Screenshots an**.
3. Er findet die Stelle im Quelltext: über die URL der Seite (Datei oder Projekt), den HTML-Auszug, den Text, den CSS-Selektor und die Styles.
4. Er setzt die Änderungen um und berichtet **pro Kommentar-Nummer**, was gemacht wurde. Bei Unklarheiten fragt er nach.

Auch eingefügtes Text-Feedback aus „Kopieren“ erkennt der Skill und verarbeitet es direkt.

### Ohne Claude Code

Andere KI-Tools können das Paket genauso nutzen. Man lässt das Skript laufen und gibt dem Tool die Zusammenfassung und die PNG-Dateien:

```bash
python3 skill/html-feedback/extract_feedback.py ~/Downloads/html-feedback/feedback-….json --out ./feedback
# → ./feedback/summary.md und ./feedback/item-01.png, item-02.png, …
```

---

## Dateiformat `html-feedback/1`

```jsonc
{
  "format": "html-feedback/1",
  "page": {
    "url": "file:///…/beispiel.html", "title": "Beispiel-Dashboard",
    "viewport": { "width": 1330, "height": 743 }, "devicePixelRatio": 2,
    "documentSize": { "width": 1330, "height": 743 }
  },
  "created": "2026-10-07T21:15:29",
  "items": [
    {
      "n": 1,
      "kind": "element",                       // "element" | "region" | "point"
      "comment": "Euro-Zeichen kleiner",
      "element": {                             // bei "point": das Element unter dem Punkt
        "selector": "div.card:nth-of-type(1) > div.value",
        "label": "div.value",
        "text": "48.210 €",
        "html": "<div class=\"value\">48.210 €</div>",
        "styles": { "font-size": "32px", "font-weight": "700", "color": "rgb(15, 118, 110)" }
      },
      "point": { "x": 659, "y": 517 },         // nur bei "point"
      "rect": { "x": 52, "y": 141, "w": 371, "h": 48 },   // Seitenkoordinaten, CSS-Pixel
      "covered": {                             // nur bei "region": was im Bereich liegt
        "commonAncestor": { "selector": "#orders", "label": "table#orders" },
        "elements": [ { "selector": "th:nth-of-type(2)", "text": "KUNDE" } ]
      },
      "screenshot": { "data": "data:image/webp;base64,…", "width": 775, "height": 128 },
      "created": "2026-10-07T21:14:02"
    }
  ]
}
```

Ein typisches Paket mit 5–10 Kommentaren ist etwa 100–500 KB groß.

---

## Grenzen

- Screenshots erfassen nur den **sichtbaren** Teil der Seite. Was über den Bildschirmrand hinausgeht, ist abgeschnitten.
- Inhalte in **iframes** lassen sich nicht als einzelne Elemente auswählen; als Bereich mit Screenshot geht es.
- Auf `chrome://`-Seiten, der neuen Tab-Seite und im Chrome Web Store erlaubt Chrome grundsätzlich keine Erweiterungen.
- Der CSS-Selektor beschreibt das **gerenderte** DOM. Bei generierten Seiten (React, Templates …) muss die KI die passende Quelldatei suchen; HTML-Auszug und Text helfen dabei.

## Entwicklung

Keine Build-Schritte: Die Dateien in `extension/` werden direkt geladen. Nach Änderungen auf `chrome://extensions` ↻ klicken und die Seite neu laden.

- `content.js`: Overlay in der Seite (Auswahl, Panel, Kommentare, Screenshot-Zuschnitt, Export)
- `background.js`: Service Worker (Injektion, `captureVisibleTab`, Download)
- `offscreen.html/.js`: erzeugt Blob-URLs für große Downloads
- `help.html/.js`: Hilfeseite (Datei-Zugriff, gesperrte Seiten)
