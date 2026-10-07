#!/usr/bin/env python3
"""Packt ein HTML-Feedback-Paket (format "html-feedback/1") aus.

Schreibt die eingebetteten Screenshots als PNG-Dateien in einen Ordner und gibt
eine Markdown-Zusammenfassung aller Kommentare aus (auch als summary.md gespeichert).
Die Base64-Daten selbst landen so nie im Kontext.

Aufruf:  extract_feedback.py <feedback.json> [--out <ordner>]
"""
import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile

EXT = {"image/webp": "webp", "image/jpeg": "jpg", "image/png": "png"}
KIND = {"element": "Element", "region": "Bereich", "point": "Punkt"}


def save_image(data_url, path_base):
    """Speichert eine data:-URL; WebP wird (falls möglich) per sips nach PNG konvertiert."""
    meta, b64 = data_url.split(",", 1)
    mime = meta[5:].split(";")[0]
    ext = EXT.get(mime, "bin")
    raw_path = f"{path_base}.{ext}"
    with open(raw_path, "wb") as f:
        f.write(base64.b64decode(b64))
    if ext == "webp" and shutil.which("sips"):
        png_path = f"{path_base}.png"
        r = subprocess.run(["sips", "-s", "format", "png", raw_path, "--out", png_path],
                           capture_output=True)
        if r.returncode == 0 and os.path.exists(png_path):
            os.remove(raw_path)
            return png_path
    return raw_path


def fence(text, lang=""):
    tick = "````" if "```" in text else "```"
    return f"{tick}{lang}\n{text}\n{tick}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--out", help="Zielordner für Bilder und summary.md")
    args = ap.parse_args()

    with open(args.file, encoding="utf-8") as f:
        pkg = json.load(f)
    if not str(pkg.get("format", "")).startswith("html-feedback/"):
        sys.exit(f"Kein HTML-Feedback-Paket (format = {pkg.get('format')!r})")

    stem = os.path.splitext(os.path.basename(args.file))[0]
    out = os.path.abspath(args.out or os.path.join(tempfile.gettempdir(), "html-feedback", stem))
    os.makedirs(out, exist_ok=True)

    page = pkg.get("page", {})
    vp = page.get("viewport", {})
    lines = [
        f"# Feedback zu: {page.get('title') or '(ohne Titel)'}",
        "",
        f"- URL: {page.get('url')}",
        f"- Viewport: {vp.get('width')}×{vp.get('height')} (devicePixelRatio {page.get('devicePixelRatio')})",
        f"- Erstellt: {pkg.get('created')}",
        f"- Anzahl Kommentare: {len(pkg.get('items', []))}",
        f"- Bilder in: {out}",
    ]
    if pkg.get("note"):
        lines.append(f"- Hinweis: {pkg['note']}")

    for it in pkg.get("items", []):
        n = it.get("n")
        lines += ["", f"## {n}. {KIND.get(it.get('kind'), it.get('kind'))}", ""]
        lines += ["**Kommentar:**", "", *[f"> {l}" for l in it.get("comment", "").splitlines() or [""]], ""]

        el = it.get("element")
        if el:
            label = "Element unter dem Punkt" if it.get("kind") == "point" else "Element"
            lines.append(f"- {label}: `{el.get('selector')}`")
            if el.get("text"):
                lines.append(f"- Text: „{el['text']}“")
            if el.get("styles"):
                styles = "; ".join(f"{k}: {v}" for k, v in el["styles"].items())
                lines.append(f"- Computed Styles: {styles}")
        r = it.get("rect")
        if r:
            lines.append(f"- Position (Seitenkoordinaten): x={r['x']} y={r['y']} w={r['w']} h={r['h']}")
        p = it.get("point")
        if p:
            lines.append(f"- Punkt: x={p['x']} y={p['y']} (im Screenshot rosa markiert)")
        cov = it.get("covered")
        if cov:
            if cov.get("commonAncestor"):
                lines.append(f"- Gemeinsamer Container: `{cov['commonAncestor']['selector']}`")
            for e in cov.get("elements", []):
                txt = f" – „{e['text']}“" if e.get("text") else ""
                lines.append(f"  - enthält `{e['selector']}`{txt}")

        shot = it.get("screenshot")
        if shot and shot.get("data"):
            path = save_image(shot["data"], os.path.join(out, f"item-{n:02d}"))
            lines.append(f"- Screenshot: {path} ({shot.get('width')}×{shot.get('height')} px)")
        else:
            lines.append("- Screenshot: keiner")

        if el and el.get("html"):
            lines += ["", "HTML-Auszug:", "", fence(el["html"], "html")]

    summary = "\n".join(lines) + "\n"
    with open(os.path.join(out, "summary.md"), "w", encoding="utf-8") as f:
        f.write(summary)
    print(summary)


if __name__ == "__main__":
    main()
