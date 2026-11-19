"""Encode reviewed local AI samples, without dependencies or catalog/API writes.

Requires ffmpeg + ffprobe on PATH (libwebp, libaom-av1). Originals and the local
session file stay in ignored work/. Run from any directory:
  python scripts/prepare-figure-samples.py
This creates static review assets, not a production image delivery pipeline.
"""
import hashlib
import html
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work/figure-render-samples"
OUT = ROOT / "src/brand/figure-render-samples"


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dimensions(path):
    data = json.loads(run("ffprobe", "-v", "error", "-select_streams", "v:0",
                          "-show_entries", "stream=width,height", "-of", "json", str(path)))
    return data["streams"][0]


def encode(source, target, crop, width, height, fmt):
    filters = []
    if crop:
        x, y, w, h = crop
        dim = dimensions(source)
        if min(x, y) < 0 or min(w, h) <= 0 or x + w > dim["width"] or y + h > dim["height"]:
            raise ValueError(f"Invalid reviewed crop for {source.name}")
        filters.append(f"crop={w}:{h}:{x}:{y}")
        source_w, source_h = w, h
    else:
        dim = dimensions(source)
        source_w, source_h = dim["width"], dim["height"]
    if width > source_w or height > source_h:
        raise ValueError(f"Refusing to upscale {source.name}")
    if abs(source_w / source_h - width / height) > .005:
        raise ValueError(f"Crop must match output aspect ratio: {source.name}")
    # AVIF must declare the same YUV matrix used during conversion. Unlabelled
    # AV1 can decode with a different matrix in browsers, shifting paint colors.
    color_conversion = ":out_color_matrix=bt709:out_range=tv" if fmt == "avif" else ""
    filters.extend([f"scale={width}:{height}:flags=lanczos{color_conversion}", "setsar=1"])
    codecs = {
        "webp": ["-c:v", "libwebp", "-quality", "84", "-compression_level", "6"],
        "avif": ["-c:v", "libaom-av1", "-still-picture", "1", "-crf", "30",
                 "-b:v", "0", "-cpu-used", "6", "-pix_fmt", "yuv420p",
                 "-colorspace", "bt709", "-color_trc", "iec61966-2-1",
                 "-color_primaries", "bt709", "-color_range", "tv"],
        "jpg": ["-c:v", "mjpeg", "-q:v", "2", "-pix_fmt", "yuvj420p"],
    }
    run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
        "-vf", ",".join(filters), "-frames:v", "1", "-map_metadata", "-1",
        *codecs[fmt], str(target))
    actual = dimensions(target)
    if (actual["width"], actual["height"]) != (width, height):
        raise ValueError(f"Unexpected encoded dimensions: {target.name}")
    return {"file": target.name, "format": fmt, **actual,
            "bytes": target.stat().st_size, "sha256": digest(target)}


def picture(item, eager=False):
    assets = item["derivatives"]
    prefix = "../src/brand/figure-render-samples/"
    def srcset(fmt):
        return ", ".join(f'{prefix}{a["file"]} {a["width"]}w' for a in assets if a["format"] == fmt)
    jpg = next(a for a in assets if a["format"] == "jpg")
    sizes = "(max-width: 680px) calc(100vw - 48px), (max-width: 1100px) 30vw, 350px"
    if item["view"] == "banner":
        sizes = "(max-width: 1150px) calc(100vw - 48px), 1100px"
    return (f'<a href="{prefix}{jpg["file"]}" target="_blank" rel="noopener" aria-label="查看原尺寸：{html.escape(item["alt"])}">'
            f'<picture><source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{srcset("webp")}" sizes="{sizes}">'
            f'<img src="{prefix}{jpg["file"]}" width="{jpg["width"]}" height="{jpg["height"]}" '
            f'alt="{html.escape(item["alt"])}" loading="{"eager" if eager else "lazy"}" '
            f'{"fetchpriority=high" if eager else ""} decoding="async"></picture></a>')


def gallery(items):
    sections = []
    for key, title in [("001", "月梨信差 · 月丘果園郵隊"), ("068", "冷熔鍋爐姊 · 冬炭修理廳")]:
        cards = []
        for item in items:
            if item["productKey"] != f"FIGURA-AI-{key}" or item["view"] == "banner":
                continue
            cards.append(f'<figure>{picture(item, key == "001" and item["view"] == "main")}'
                         f'<figcaption><b>{html.escape(item["label"])}</b>'
                         f'<span class="status">{html.escape(item["reviewStatus"])}</span>'
                         f'<p>{html.escape(item["reviewNote"])}</p></figcaption></figure>')
        sections.append(f'<section><h2>{title}</h2><div class="grid">{"".join(cards)}</div></section>')
    banner = next(i for i in items if i["view"] == "banner")
    sections.append(f'<section><h2>收藏場景 · Banner 概念</h2><figure>{picture(banner)}'
                    f'<figcaption><b>{html.escape(banner["label"])}</b><span class="status">{html.escape(banner["reviewStatus"])}</span>'
                    f'<p>{html.escape(banner["reviewNote"])}</p></figcaption></figure></section>')
    return '''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Figura｜擬真公仔圖片一致性樣本</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f2ee;color:#252631;font:16px/1.65 system-ui,sans-serif}
main{max-width:1148px;margin:auto;padding:36px 24px 64px}.eyebrow{letter-spacing:.13em;color:#676671;font-size:13px}
h1{font-size:clamp(26px,4vw,40px);line-height:1.25;margin:12px 0}h2{font-size:23px;margin:36px 0 18px}
.lead{max-width:760px;color:#5c5c67}.notice{padding:18px 22px;background:#fff0ce;border:1px solid #dfc78b;border-radius:14px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}figure{margin:0;background:white;border-radius:16px;overflow:hidden}
img{display:block;width:100%;height:auto}a{color:#343993}a:focus-visible{outline:3px solid #393b8f;outline-offset:3px}
figcaption{padding:16px}figcaption b{display:block}.status{display:inline-block;margin:8px 0 0;padding:3px 9px;background:#fff0ce;border-radius:6px;font-size:13px}
figcaption p{font-size:14px;color:#555864;margin:8px 0 0}footer{margin-top:32px;font-size:14px}nav{display:flex;gap:20px;flex-wrap:wrap}
@media(max-width:680px){.grid{grid-template-columns:1fr}main{padding-top:24px}h2{font-size:21px}}
</style></head><body><main><header><div class="eyebrow">FIGURA. / IMAGE STUDY 01 / 2026.11.19</div>
<h1>讓每個角度，都像同一件收藏。</h1><p class="lead">兩款虛構公仔的材質、棚拍與多角度一致性試作。點圖片可開啟 JPEG 原尺寸對照；角度尚未全部通過，先不批次替換商品。</p>
<p class="notice"><strong>AI 生成展示素材</strong><br>以下為虛構公仔概念圖，採擬真公仔渲染風格；非實物攝影，非可操作的 3D 模型。材質是概念設定，背面細節尚待定稿。</p>
<nav><a href="AI_FIGURE_IMAGE_STANDARD.md">製作規範</a><a href="AI_FIGURE_SAMPLE_REVIEW.md">驗收紀錄</a><a href="../src/brand/figure-render-samples/manifest.json">完整 prompts 與檔案紀錄</a></nav></header>''' + "".join(sections) + '''
<footer>獨立評估頁，未接商品資料庫或正式首頁。圖片會依瀏覽器選擇 AVIF／WebP／JPEG；頁面沒有 3D 檢視器。</footer></main></body></html>
'''


def main():
    session = json.loads((WORK / "session.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"schemaVersion": 1, "generatedAt": session["generatedAt"],
                "tool": "OpenAI built-in ImageGen", "modelVersion": None, "seed": None,
                "purpose": "Figura fictional collectible image consistency study; raster images, not 3D models",
                "encoder": run("ffmpeg", "-version").splitlines()[0],
                "encodingSettings": {"webp": "libwebp quality=84 compression_level=6", "avif": "libaom-av1 crf=30 cpu-used=6 yuv420p, BT.709 matrix/primaries, sRGB transfer, limited range", "jpg": "mjpeg q=2 yuvj420p"},
                "attempts": [], "items": []}
    source_by_key = {i["key"]: WORK / "originals" / i["source"] for i in session["attempts"]}
    source_by_key.update({i["key"]: WORK / "originals" / i["source"] for i in session["legacyReferences"]})
    for item in session["attempts"]:
        source = source_by_key[item["key"]]
        saved = {k: v for k, v in item.items() if k not in ("source", "publish")}
        saved["source"] = {"localArchive": f'work/figure-render-samples/originals/{source.name}',
                           "sha256": digest(source), **dimensions(source)}
        saved["references"] = [{"key": key, "sha256": digest(source_by_key[key])} for key in item["referenceKeys"]]
        if not item["publish"]:
            manifest["attempts"].append(saved)
            continue
        sizes = [(320, 320), (640, 640), (960, 960)]
        if item["view"] == "banner":
            sizes = [(640, 360), (960, 540), (1536, 864)]
        saved["derivatives"] = []
        for width, height in sizes:
            formats = ["webp", "avif", "jpg"] if (width, height) == sizes[-1] else ["webp", "avif"]
            for fmt in formats:
                product_number = item["productKey"].rsplit("-", 1)[-1].lower()
                target = OUT / f'figura-ai-{product_number}-r1-{item["view"]}-{width}.{fmt}'
                saved["derivatives"].append(encode(source, target, item.get("crop"), width, height, fmt))
        manifest["items"].append(saved)
        print(f'{item["key"]}: {len(saved["derivatives"])} derivatives', flush=True)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "docs/figure-render-samples.html").write_text(gallery(manifest["items"]), encoding="utf-8")
    print(f'Saved {len(manifest["items"])} samples, {sum(sum(a["bytes"] for a in i["derivatives"]) for i in manifest["items"])} bytes')


if __name__ == "__main__":
    main()
