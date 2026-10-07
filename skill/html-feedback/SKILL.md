---
name: html-feedback
description: Liest ein Feedback-Paket der Chrome-Extension "HTML Feedback" (JSON mit "format": "html-feedback/1", meist ~/Downloads/html-feedback/feedback-*.json) ein, packt die eingebetteten Screenshots als PNG aus und setzt die Kommentare in der zugehörigen HTML-Seite bzw. im Quellcode um. Verwenden, wenn der Nutzer auf eine solche Feedback-Datei zeigt, JSON mit "html-feedback/1" einfügt oder sagt "hier ist Feedback zur Seite/zum HTML".
---

# HTML-Feedback einarbeiten

Die Chrome-Extension „HTML Feedback“ erzeugt **eine** JSON-Datei pro Feedback-Runde. Sie enthält zu jedem Kommentar Selektor, Text, HTML-Auszug, Computed Styles, Position und einen Screenshot. Die Screenshots sind als Base64-`data:`-URLs eingebettet.

## Wichtig: Datei nie roh einlesen

Die JSON-Datei **nicht** mit Read oder `cat` öffnen. Base64-Bilder kosten sehr viel Kontext und sind als Text nutzlos. Immer zuerst das Skript laufen lassen:

```bash
python3 ~/.claude/skills/html-feedback/extract_feedback.py "/pfad/zu/feedback-….json" --out "<scratchpad>/html-feedback"
```

- `--out`: Wenn es ein Scratchpad-Verzeichnis gibt, dorthin schreiben. Sonst weglassen, dann wird ins System-Temp-Verzeichnis geschrieben.
- Das Skript gibt eine Markdown-Zusammenfassung aus (zusätzlich gespeichert als `summary.md` im Zielordner). Die Screenshots liegen dort als `item-NN.png`.
- Jeden aufgeführten Screenshot mit dem Read-Tool **ansehen**. Gerade bei Bereichs- und Punkt-Kommentaren steckt die eigentliche Information im Bild. Bei Punkt-Kommentaren ist die gemeinte Stelle im Bild rosa eingekreist.

Hat der Nutzer stattdessen JSON-Text direkt in den Chat eingefügt, ist das die Text-Variante ohne Screenshots (`"note": "Text-Export ohne Screenshots."`). Dann direkt damit arbeiten.

## Kommentare umsetzen

1. **Quelle finden:** `page.url` zeigt, um welche Seite es geht.
   - `file:///…` → das ist direkt die HTML-Datei auf der Platte (URL-Kodierung wie `%20` beachten).
   - `http://localhost:…` o. Ä. → die Seite wird von einem Dev-Server / einer App erzeugt. Die zugehörigen Quelldateien (Templates, Komponenten, CSS) im Projekt suchen. Im Zweifel nachfragen.
2. **Stelle im Quelltext lokalisieren**, je Kommentar in dieser Reihenfolge:
   - HTML-Auszug und Text des Elements (am verlässlichsten),
   - CSS-Selektor (`element.selector`, bei Bereichen `covered.commonAncestor` und `covered.elements`),
   - Computed Styles, um die richtige CSS-Regel zu finden,
   - Screenshot und Position zur Kontrolle.
   Der Selektor beschreibt das gerenderte DOM. Bei generierten Seiten kann er vom Quelltext abweichen.
3. **Mehrdeutig?** Wenn eine Stelle oder die gewünschte Änderung nicht klar ist: beim Nutzer nachfragen und dabei die Kommentar-Nummer nennen, statt zu raten.
4. **Umsetzen** und abschließend pro Kommentar-Nummer kurz berichten, was geändert wurde (z. B. „① Überschrift auf 1.25rem verkleinert, Zeitraum als `<small>` darunter“).

## Paketformat (Kurzreferenz)

```text
format: "html-feedback/1"
page:   { url, title, viewport{width,height}, devicePixelRatio, documentSize }
items[]:
  n, kind ("element" | "region" | "point"), comment, created
  element?  { selector, label, text, html, styles }   – bei "point": Element unter dem Punkt
  point?    { x, y }                                   – Seitenkoordinaten
  rect      { x, y, w, h }                             – Seitenkoordinaten (CSS-Pixel)
  covered?  { commonAncestor{selector,label}, elements[{selector,text}] }   – nur "region"
  screenshot? { data: "data:image/webp;base64,…", width, height }
```
