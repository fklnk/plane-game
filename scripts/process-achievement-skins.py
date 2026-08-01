from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "skins" / "achievement"
CANVAS_SIZE = 256
SUBJECT_SIZE = 224


def crop_visible(image: Image.Image, padding: int = 12) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("generated skin has no visible pixels")
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


for path in sorted(ROOT.glob("*.png")):
    image = Image.open(path).convert("RGBA")
    if image.size == (CANVAS_SIZE, CANVAS_SIZE):
        print(f"{path.name}: already {CANVAS_SIZE}x{CANVAS_SIZE}, skipped")
        continue
    source = crop_visible(image)
    source.thumbnail((SUBJECT_SIZE, SUBJECT_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE))
    canvas.alpha_composite(
        source,
        ((CANVAS_SIZE - source.width) // 2, (CANVAS_SIZE - source.height) // 2),
    )
    if canvas.getpixel((0, 0))[3] != 0:
        raise ValueError(f"{path.name}: corner is not transparent")
    canvas.save(path, optimize=True)
    print(f"{path.name}: {source.width}x{source.height} on {CANVAS_SIZE}x{CANVAS_SIZE}")
