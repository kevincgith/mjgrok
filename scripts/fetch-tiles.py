#!/usr/bin/env python3
"""Download Wikimedia Commons oblique mahjong tiles and crop each to its face.

Source category: "SVG Oblique illustrations of Mahjong tiles"
(CC BY-SA 4.0, Cangjie6 and other contributors).
This script does not read any other mahjong application.
"""
from __future__ import annotations

import html
import json
import re
import subprocess
import time
import urllib.parse
from pathlib import Path

UA = {"User-Agent": "MJWaitsTileFetch/1.0 (face crop; CC BY-SA attribution; contact local dev)"}
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "tiles"
CREDITS = ROOT / "src" / "lib" / "tileCredits.json"

MAPPING: dict[str, str] = {}
for i in range(1, 10):
    MAPPING[f"m{i}"] = f"MJw{i}-.svg"
    MAPPING[f"t{i}"] = f"MJt{i}-.svg"
    MAPPING[f"b{i}"] = f"MJs{i}-.svg"
for i, fn in enumerate(["MJf1-.svg", "MJf2-.svg", "MJf3-.svg", "MJf4-.svg", "MJd1-.svg", "MJd2-.svg", "MJd3-.svg"], 1):
    MAPPING[f"z{i}"] = fn
for i in range(1, 5):
    MAPPING[f"season{i}"] = f"MJh{i}-.svg"
    MAPPING[f"flower{i}"] = f"MJh{i + 4}-.svg"
MAPPING["joker"] = "MJj1-.svg"


def get(url: str) -> bytes:
    delay = 2.0
    last = ""
    for _attempt in range(5):
        proc = subprocess.run(
            ["curl", "-fsSL", "-A", UA["User-Agent"], "--retry", "0", url],
            check=False,
            capture_output=True,
        )
        if proc.returncode == 0 and proc.stdout:
            return proc.stdout
        last = proc.stderr.decode("utf-8", "replace")[:300]
        time.sleep(delay)
        delay *= 1.6
    raise RuntimeError(f"{url} {last}")


def meta_text(meta: dict, key: str) -> str:
    raw = (meta.get(key) or {}).get("value", "")
    raw = re.sub(r"<[^>]+>", "", raw)
    return re.sub(r"\s+", " ", html.unescape(raw)).strip()


def path_bbox(d: str) -> tuple[float, float, float, float]:
    tokens = re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)
    i = 0
    x = y = sx = sy = 0.0
    cmd = "M"
    xs: list[float] = []
    ys: list[float] = []

    def num() -> float:
        nonlocal i
        v = float(tokens[i])
        i += 1
        return v

    while i < len(tokens):
        t = tokens[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t
            i += 1
            if cmd in "Zz":
                x, y = sx, sy
                xs.append(x)
                ys.append(y)
            continue
        c = cmd
        if c == "M":
            x, y = num(), num()
            sx, sy = x, y
            xs.append(x)
            ys.append(y)
            cmd = "L"
        elif c == "m":
            x += num()
            y += num()
            sx, sy = x, y
            xs.append(x)
            ys.append(y)
            cmd = "l"
        elif c == "L":
            x, y = num(), num()
            xs.append(x)
            ys.append(y)
        elif c == "l":
            x += num()
            y += num()
            xs.append(x)
            ys.append(y)
        elif c == "H":
            x = num()
            xs.append(x)
            ys.append(y)
        elif c == "h":
            x += num()
            xs.append(x)
            ys.append(y)
        elif c == "V":
            y = num()
            xs.append(x)
            ys.append(y)
        elif c == "v":
            y += num()
            xs.append(x)
            ys.append(y)
        elif c == "C":
            x1, y1, x2, y2, x, y = num(), num(), num(), num(), num(), num()
            xs += [x1, x2, x]
            ys += [y1, y2, y]
        elif c == "c":
            dx1, dy1, dx2, dy2, dx, dy = num(), num(), num(), num(), num(), num()
            x1, y1 = x + dx1, y + dy1
            x2, y2 = x + dx2, y + dy2
            x, y = x + dx, y + dy
            xs += [x1, x2, x]
            ys += [y1, y2, y]
        elif c == "S":
            x2, y2, x, y = num(), num(), num(), num()
            xs += [x2, x]
            ys += [y2, y]
        elif c == "s":
            dx2, dy2, dx, dy = num(), num(), num(), num()
            x2, y2 = x + dx2, y + dy2
            x, y = x + dx, y + dy
            xs += [x2, x]
            ys += [y2, y]
        elif c == "Q":
            x1, y1, x, y = num(), num(), num(), num()
            xs += [x1, x]
            ys += [y1, y]
        elif c == "q":
            dx1, dy1, dx, dy = num(), num(), num(), num()
            x1, y1 = x + dx1, y + dy1
            x, y = x + dx, y + dy
            xs += [x1, x]
            ys += [y1, y]
        elif c in "Aa":
            num()
            num()
            num()
            num()
            num()
            if c == "A":
                x, y = num(), num()
            else:
                x += num()
                y += num()
            xs.append(x)
            ys.append(y)
        elif c in "Tt":
            if c == "T":
                x, y = num(), num()
            else:
                x += num()
                y += num()
            xs.append(x)
            ys.append(y)
        else:
            raise SystemExit(f"bad path cmd {c}")
    return min(xs), min(ys), max(xs), max(ys)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    CREDITS.parent.mkdir(parents=True, exist_ok=True)
    titles = "|".join("File:" + v for v in MAPPING.values())
    api = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {
            "action": "query",
            "titles": titles,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "format": "json",
        }
    )
    data = json.loads(get(api))
    bytitle: dict[str, dict[str, str]] = {}
    for page in data["query"]["pages"].values():
        if "missing" in page:
            raise SystemExit("missing " + page.get("title", ""))
        info = page["imageinfo"][0]
        meta = info.get("extmetadata") or {}
        bytitle[page["title"].replace("File:", "")] = {
            "url": info["url"].split("?")[0],
            "desc": meta_text(meta, "ImageDescription"),
            "artist": meta_text(meta, "Artist"),
        }
    credits = []
    for key, fn in MAPPING.items():
        info = bytitle[fn]
        dest = OUT / f"{key}.svg"
        raw = get(info["url"]).decode("utf-8", "replace")
        time.sleep(0.35)
        raw = re.sub(r"<!DOCTYPE[\s\S]*?<svg", "<svg", raw, count=1)
        raw = re.sub(r"<i:pgfRef[\s\S]*?</i:pgfRef>", "", raw)
        raw = re.sub(r"<i:pgf\b[\s\S]*?</i:pgf>", "", raw)
        raw = re.sub(r"<foreignObject[\s\S]*?</foreignObject>", "", raw)
        raw = re.sub(r"<metadata[\s\S]*?</metadata>", "", raw)
        raw = re.sub(r"<\?xml[\s\S]*?\?>", "", raw)
        match = re.search(r'<path[^>]*\bid="rect3765"[^>]*\bd="([^"]+)"', raw)
        if not match:
            match = re.search(r'<path[^>]*\bclass="st3"[^>]*\bd="([^"]+)"', raw)
        if not match:
            raise SystemExit(f"no face path in {fn}")
        x0, y0, x1, y1 = path_bbox(match.group(1).replace("\n", " ").replace("\t", " "))
        tm = re.search(
            r"matrix\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)",
            raw,
        )
        tx = ty = 0.0
        if tm:
            a, b, c, d, e, f = map(float, tm.groups())
            if abs(a - 1) < 0.05 and abs(d - 1) < 0.05 and abs(b) < 0.05 and abs(c) < 0.05:
                tx, ty = e, f
            else:
                raise SystemExit(f"unexpected transform in {fn}")
        x0 += tx
        x1 += tx
        y0 += ty
        y1 += ty
        inset = 1.2
        vx, vy = x0 + inset, y0 + inset
        vw, vh = (x1 - x0) - 2 * inset, (y1 - y0) - 2 * inset
        raw = re.sub(
            r"<svg\b[^>]*>",
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx:.2f} {vy:.2f} {vw:.2f} {vh:.2f}">',
            raw,
            count=1,
        )
        raw = raw.replace('xmlns:x="&ns_extend;"', "").replace('xmlns:i="&ns_ai;"', "").replace('xmlns:graph="&ns_graphs;"', "")
        comment = (
            f"<!-- Face cropped from Wikimedia Commons {fn} ({info['desc']}). "
            f"License: CC BY-SA 4.0. Artwork: {info['artist']}. "
            "Changes: cropped to the front face, removed oblique side and top, stripped Adobe metadata. "
            f"https://commons.wikimedia.org/wiki/File:{fn} -->\n"
        )
        dest.write_text(comment + raw.strip() + "\n", encoding="utf-8")
        if "rect3765" not in dest.read_text(encoding="utf-8") and key != "skip":
            # symbol art must remain even if the face id was the crop source
            pass
        credits.append(
            {
                "id": key,
                "file": fn,
                "page": "https://commons.wikimedia.org/wiki/File:" + fn,
                "artist": info["artist"],
                "license": "CC BY-SA 4.0",
                "description": info["desc"],
            }
        )
        print(f"{key:10} {vw:.1f}x{vh:.1f} {dest.stat().st_size}")
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", len(credits))


if __name__ == "__main__":
    main()
