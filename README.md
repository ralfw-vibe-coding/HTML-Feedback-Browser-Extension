# HTML Feedback

Chrome-Extension, mit der man auf beliebigen Webseiten Elemente, Bereiche und Punkte markiert, kommentiert und alles als **eine JSON-Datei inklusive Screenshots** exportiert. Diese Datei gibt man einer KI-Coding-Session, die die Seite dann entsprechend ändert.

```
extension/            Chrome-Extension (Manifest V3)
skill/html-feedback/  Claude-Code-Skill: Paket auspacken und Feedback umsetzen
test/beispiel.html    Testseite zum Ausprobieren
tools/make_icons.py   erzeugt die Icons neu
```

## Installation

1. Chrome → `chrome://extensions` → oben rechts **Entwicklermodus** einschalten.
2. **Entpackte Erweiterung laden** → den Ordner `extension/` wählen.
3. Für lokale HTML-Dateien (`file://…`): bei „HTML Feedback“ auf **Details** → **Zugriff auf Datei-URLs zulassen** einschalten.
4. Optional: Extension in der Symbolleiste anheften (Puzzle-Symbol → Pin).

Der Claude-Code-Skill ist per Symlink installiert: `~/.claude/skills/html-feedback` → `skill/html-feedback`.

## Benutzung

Extension-Icon klicken (oder **Alt+Shift+F**). Rechts erscheint das Panel.

| Modus | Bedienung |
|---|---|
| **Element** | Maus über die Seite bewegen; das Element darunter wird hervorgehoben. **Alt+↑** wählt das umgebende Element, **Alt+↓** geht wieder zurück. Klick → Kommentar. |
| **Bereich** | Rechteck aufziehen → Kommentar mit Screenshot des Ausschnitts. Einfacher Klick → **Punkt**-Kommentar (Stelle wird im Screenshot eingekreist). |
| **Aus** | Seite normal bedienen, z. B. ein Menü aufklappen, danach wieder Element/Bereich wählen. |

**Shift+Ziehen** zieht auch im Element-Modus einen Bereich auf.
Im Kommentarfeld: **⌘↵** speichert, **Esc** bricht ab.
Nummerierte Pins markieren kommentierte Stellen. Klick auf Pin oder Listeneintrag → bearbeiten.

Kommentare werden pro Seiten-URL im Browser zwischengespeichert und überstehen ein Neuladen der Seite. **Löschen** im Panel räumt sie ab.

### Export

- **Exportieren** speichert `~/Downloads/html-feedback/feedback-<seite>-<zeit>.json` und legt den **Pfad in die Zwischenablage**. Mit **⌥/Alt-Klick** kann man den Speicherort selbst wählen.
- **Kopieren** legt das Feedback **ohne Screenshots** als JSON in die Zwischenablage. Das ist nur möglich, solange es keine Bereichs- oder Punkt-Kommentare gibt, denn deren Inhalt steckt im Bild. So landen nie versehentlich Hunderte KB Base64 im Chat.

### In der Coding-Session

> Hier ist Feedback zur Seite: /Users/…/Downloads/html-feedback/feedback-beispiel-20261007-2108.json

Der Skill `html-feedback` packt die Datei mit `extract_feedback.py` aus, schreibt die Screenshots als PNG, liest Zusammenfassung und Bilder und setzt die Kommentare um.

## Paketformat `html-feedback/1`

```jsonc
{
  "format": "html-feedback/1",
  "page": { "url": "...", "title": "...", "viewport": {"width": 1440, "height": 900}, "devicePixelRatio": 2, "documentSize": {...} },
  "created": "2026-10-07T21:08:31",
  "items": [
    {
      "n": 1, "kind": "element",          // "element" | "region" | "point"
      "comment": "Überschrift kleiner …",
      "element": { "selector": "div.card:nth-of-type(1) > h2", "label": "h2", "text": "Umsatz Q3",
                   "html": "<h2>Umsatz Q3</h2>", "styles": { "font-size": "22px", ... } },
      "point": { "x": 659, "y": 517 },      // nur bei "point"
      "rect": { "x": 52, "y": 102, "w": 269, "h": 33 },   // Seitenkoordinaten in CSS-Pixeln
      "covered": { "commonAncestor": {...}, "elements": [...] },  // nur bei "region"
      "screenshot": { "data": "data:image/webp;base64,…", "width": 571, "height": 98 },
      "created": "..."
    }
  ]
}
```

## Grenzen

- Screenshots erfassen nur den **sichtbaren** Teil der Seite.
- Inhalte in **iframes** lassen sich nicht einzeln auswählen; als Bereich mit Screenshot geht es.
- Auf `chrome://`-Seiten und im Chrome Web Store erlaubt Chrome keine Erweiterungen.
