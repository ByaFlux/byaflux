from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import shutil
import urllib.request

mobile = Path(__file__).resolve().parents[1]
lock = json.loads((mobile / 'base-lock.json').read_text())
cache = mobile / 'work' / 'downloads'
cache.mkdir(parents=True, exist_ok=True)
for name, asset in lock['assets'].items():
    destination = cache / name
    if not destination.exists():
        urllib.request.urlretrieve(asset['url'], destination)
    if hashlib.sha256(destination.read_bytes()).hexdigest() != asset['sha256']:
        raise RuntimeError(f'Upstream checksum mismatch: {name}')
dist = mobile / 'work' / 'core' / 'bundle' / 'dist'
manifest = json.loads((dist / 'manifest.json').read_text())
plugins = {p['id']: p for p in manifest['plugins']}
for plugin in ['byaflux.bya-badges', 'byaflux.fake-badges', 'byaflux.always-extended']:
    if plugin not in plugins:
        raise RuntimeError(f'Missing bundled plugin: {plugin}')
if not plugins['byaflux.bya-badges'].get('essential'):
    raise RuntimeError('ByaBadges must be required')
if manifest['version'] != lock['release']:
    raise RuntimeError('Loader and JavaScript bundle versions differ')
assets = mobile / 'work' / 'manager' / 'app' / 'src' / 'main' / 'assets'
assets.mkdir(parents=True, exist_ok=True)
output = assets / 'byaflux-loader-unsigned.apk'
with ZipFile(cache / 'app-release.apk') as original, ZipFile(output, 'w', ZIP_DEFLATED) as patched:
    for info in original.infolist():
        if info.filename.upper().startswith('META-INF/'):
            continue
        if info.filename in ('assets/valenced.bundle', 'assets/manifest.json'):
            continue
        patched.writestr(info, original.read(info.filename))
    patched.write(dist / 'valenced.bundle', 'assets/valenced.bundle')
    patched.write(dist / 'manifest.json', 'assets/manifest.json')
with ZipFile(output) as result:
    if result.testzip() is not None:
        raise RuntimeError('Invalid loader APK archive')
shutil.copyfile(cache / 'valenced.reseam', assets / 'byaflux-patches.reseam')
print('ByaFlux loader and trusted upstream patches prepared.')
