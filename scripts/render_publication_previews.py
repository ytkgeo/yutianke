"""Render verified first-page excerpts without rewriting the paper content."""
import argparse
import json
from pathlib import Path

import pypdfium2 as pdfium

# Bottom edges in PDF points, inspected against the end of each abstract.
PAPERS = [
    (1, 'Exibit-NatureCommunications-Ke2026.pdf', 472),
    (2, 'Exibit-Global Biogeochemical Cycles-Ke2025.pdf', 472),
    (3, 'Exibit-ScienceAdvances-Geyman2025.pdf', 266),
    (4, 'Exibit-ISPRS-Tian2025.pdf', 570),
    (5, 'Exibit-esurf-Ke2024.pdf', 602),
    (6, 'Exibit-Smith_2024_Environ._Res._Lett._19_084041.pdf', 667),
    (7, 'Exibit-AGUAdvances-Douglas2024.pdf', 466),
    (8, 'Exibit-JGR Planets-Kalucha2024.pdf', 384),
    (9, 'Exibit-essd-Ke2022.pdf', 518),
    (10, 'Exibit-Catena2020.pdf', 534),
    (11, 'Exibit-EngineeringGeology-Song2020.pdf', 507),
    (12, 'Exibit-GeocartoInternational-chen2017.pdf', 378),
    (13, 'Exibit-SoilDynamicsEarthquakeEnginnering-Song2020.pdf', 482),
    (14, 'Exibit-NaturalHazard-Chen2020.pdf', 360),
    (15, 'Exibit-Landslides-Chen2019.pdf', 390),
    (16, 'Exibit-IJMS -Ke2018.pdf', 394),
    (17, 'Exibit-ArabJGeosci-Wu2017.pdf', 524),
    (18, 'Exibit-ArabJGeosci-WuKe2016.pdf', 576),
    (20, 'Exibit-RAC-2016.pdf', 515),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--conference-pdf', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    destination = root / 'assets/publication-previews'
    destination.mkdir(exist_ok=True)
    manifest = []
    for number, filename, bottom in PAPERS:
        source = args.conference_pdf if number == 20 else args.source_dir / filename
        document = pdfium.PdfDocument(source)
        page = document[0]
        width, height = page.get_size()
        if not 0 < bottom < height:
            raise ValueError(f'Invalid crop for {filename}')
        scale = 1600 / width
        image = page.render(scale=scale).to_pil().convert('RGB')
        image = image.crop((0, 0, image.width, round(bottom * scale)))
        output = destination / f'paper-{number:02d}.webp'
        image.save(output, quality=92, method=6)
        manifest.append({
            'number': f'{number:02d}',
            'src': f'assets/publication-previews/{output.name}',
            'width': image.width,
            'height': image.height,
            'source': filename,
            'page': 1,
            'cropBottomPoints': bottom,
            'version': 'Accepted manuscript' if number == 12 else 'Published paper',
        })
        document.close()
        print(number, output.name, image.size)
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
