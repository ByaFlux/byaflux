"""Package source files, retaining mod/scripts/build (which is source code)."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'ByaFlux-Base.zip'
ROOT_FILES = ['README.md', 'RELEASE_NOTES.md', 'UPSTREAM.json', 'brand.json', '.gitignore', 'package.json', 'pnpm-lock.yaml']
GENERATED = {ROOT / 'mod' / 'dist', ROOT / 'installer' / 'build'}

def include(path):
    relative = path.relative_to(ROOT)
    if any(part in {'.git', 'node_modules', '__pycache__'} for part in relative.parts):
        return False
    if any(directory == path or directory in path.parents for directory in GENERATED):
        return False
    return path.is_file() and path.suffix not in {'.exe', '.syso', '.log', '.pyc'}

files = [ROOT / name for name in ROOT_FILES]
for directory in ['mod', 'installer', 'scripts', 'assets', 'tests', '.github']:
    files.extend(path for path in (ROOT / directory).rglob('*') if include(path))
with ZipFile(OUTPUT, 'w', ZIP_DEFLATED, compresslevel=7) as archive:
    for path in sorted(set(files)):
        archive.write(path, Path('ByaFlux') / path.relative_to(ROOT))
with ZipFile(OUTPUT) as archive:
    assert archive.testzip() is None
    for required in ['mod/scripts/build/build.mjs', 'mod/scripts/build/common.mjs', 'scripts/package-manager.mjs', 'mod/pnpm-lock.yaml']:
        assert 'ByaFlux/' + required in archive.namelist(), required
    print(f'{OUTPUT.name}: {len(archive.namelist())} arquivos; código de compilação presente')
