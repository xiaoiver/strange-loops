"""Rebuild the checked-in, self-hosted WOFF2 from a pinned Noto Serif SC TTF.

python3 -m pip install fonttools[woff]==4.60.2 brotli==1.2.0
python3 scripts/subset-font.py /path/to/NotoSerifSC.ttf
"""
import hashlib
import json
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
expected = '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected, 'Unexpected source font'
files = [root / 'index.html', root / 'style.css', root / 'garden.css', *sorted((root / 'src').glob('*.js'))]
characters = set(''.join(path.read_text() for path in files))
characters.update(chr(code) for code in range(32, 127))
font = TTFont(source, recalcTimestamp=False)
supported = set(font.getBestCmap())
covered = sorted({ord(char) for char in characters} & supported)
options = subset.Options()
options.layout_features = ['*']
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=covered)
subsetter.subset(font)
instantiateVariableFont(font, {'wght': (400, 700)}, inplace=True)
family = 'Strange Loops Serif SC'
for record in font['name'].names:
    if record.nameID in (1, 4, 6, 16):
        record.string = (family.replace(' ', '') if record.nameID == 6 else family).encode(record.getEncoding())
directory = root / 'assets/fonts'
directory.mkdir(parents=True, exist_ok=True)
output = directory / 'serif-sc.woff2'
font.flavor = 'woff2'
font.save(output)
manifest = {
    'family': family,
    'source': 'https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf',
    'sourceSha256': expected,
    'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'weight': [400, 700],
    'codepoints': covered,
}
(directory / 'subset.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(covered)} glyphs, {output.stat().st_size} bytes')
