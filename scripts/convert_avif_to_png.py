# Convert AVIF files misnamed as .png in assets/images to real PNGs
# Uses pillow + pillow_avif_plugin
from pathlib import Path
from PIL import Image
import sys

root = Path(__file__).resolve().parents[1]
images_dir = root / 'assets' / 'images'
if not images_dir.exists():
    print('Images directory not found:', images_dir)
    sys.exit(1)

png_files = list(images_dir.glob('*.png'))
if not png_files:
    print('No .png files found in', images_dir)
    sys.exit(0)

converted = []
failed = []
for p in png_files:
    try:
        with p.open('rb') as f:
            header = f.read(16)
        # detect avif box signature 'ftypavif' in header
        if b'ftypavif' in header:
            print('Converting (avif->png):', p.name)
            # Open and re-save as PNG; pillow-avif-plugin should enable AVIF support
            img = Image.open(p)
            # Create a temp file then replace
            tmp = p.with_suffix('.tmp.png')
            img.save(tmp, format='PNG')
            tmp.replace(p)
            converted.append(p.name)
        else:
            # not avif, skip
            pass
    except Exception as e:
        failed.append((p.name, str(e)))

print('\nSummary:')
print('Converted:', len(converted))
for n in converted:
    print(' -', n)
if failed:
    print('Failed:', len(failed))
    for n,err in failed:
        print(' -', n, ':', err)
else:
    print('No failures')
