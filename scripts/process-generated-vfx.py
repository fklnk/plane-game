from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "effects" / "generated"


def crop_visible(image: Image.Image, padding: int = 10) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


for path in ROOT.glob("*.png"):
    if path.name.endswith("_chroma.png"):
        continue
    source = crop_visible(Image.open(path).convert("RGBA"))
    if path.name == "siphon_chain.png":
        source.thumbnail((512, 58), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (512, 64))
    else:
        source.thumbnail((244, 244), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (256, 256))
    canvas.alpha_composite(
        source,
        ((canvas.width - source.width) // 2, (canvas.height - source.height) // 2),
    )
    canvas.save(path, optimize=True)
