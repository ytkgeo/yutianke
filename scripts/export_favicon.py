"""Export the approved logo as browser icons without changing its artwork."""

import argparse
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / "assets"
    with Image.open(args.source) as source:
        artwork = source.convert("RGB")
    # Remove excess white canvas, then retain a small safety margin at icon sizes.
    bounds = artwork.convert("L").point(lambda value: 255 if value < 180 else 0).getbbox()
    if bounds is None:
        raise ValueError("Source contains no visible artwork")
    artwork = artwork.crop(bounds)
    side = round(max(artwork.size) / 0.9)
    master = Image.new("RGB", (side, side), "white")
    master.paste(artwork, ((side - artwork.width) // 2, (side - artwork.height) // 2))
    for size in (32, 180, 512):
        master.resize((size, size), Image.Resampling.LANCZOS).save(
            output / f"favicon-k-{size}.png", optimize=True
        )
    master.resize((256, 256), Image.Resampling.LANCZOS).save(
        output / "favicon-k.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)]
    )
    print(f"Exported K favicon assets from {args.source.name}")


if __name__ == "__main__":
    main()
