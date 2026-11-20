from pathlib import Path
import base64
import hashlib
import json
import os
import subprocess

repo = os.environ['GH_REPO']
if repo != 'ByaFlux/byaflux':
    raise RuntimeError('Unexpected release repository')
def gh(*args, input=None, check=True):
    return subprocess.run(['gh', *args], input=input, text=True, capture_output=True, check=check)
version = json.loads(Path('mobile/base-lock.json').read_text())['version']
major, minor, patch = map(int, version.split('-')[0].split('.'))
preview = int(version.split('-preview.')[1]) if '-preview.' in version else 99
code = major * 1000000 + minor * 10000 + patch * 100 + preview
tag = 'mobile-v' + version
apk = Path(f'mobile-output/ByaFluxMobile-{version}.apk')
channel = {'versionName':version, 'versionCode':code, 'packageId':'app.byaflux.manager',
           'apkUrl':f'https://github.com/{repo}/releases/download/{tag}/{apk.name}',
           'apkSize':apk.stat().st_size, 'sha256':hashlib.sha256(apk.read_bytes()).hexdigest()}
# Published version tags are immutable. Bump the version before another release.
existing = gh('release', 'view', tag, '--json', 'id', check=False)
if existing.returncode == 0:
    print(f'{tag} already published. No release or update channel changes.')
    raise SystemExit(0)
notes = Path('mobile-output/RELEASE_NOTES.txt')
notes.write_text(f'ByaFlux Mobile {version}\nByaFlux para Android 9 ou superior.\nNova logo BF no instalador e nas configurações.\nInstale o APK do instalador. Após atualizar, reinstale o ByaFlux pelo instalador.\nSomente os plugins obrigatórios são ativados por padrão. Aviso de atualização com botão Atualizar.\n')
assets = [str(apk), 'mobile-output/SHA256SUMS', 'mobile-output/byaflux-mobile.bundle', 'mobile-output/manifest.json']
gh('release','create',tag,*assets,'--target',os.environ['GITHUB_SHA'],'--title',f'ByaFlux Mobile {version}','--notes-file',str(notes),'--latest=false')
# Keep the desktop release title intact: its commit hash drives desktop updates.
principal = json.loads(gh('api', f'repos/{repo}/releases/latest').stdout)
asset_names = {asset['name'] for asset in principal['assets']}
if principal['draft'] or principal['prerelease'] or not {
    'desktop.asar', 'ByaFluxInstaller.exe', 'ByaFluxInstallerCli.exe'
}.issubset(asset_names):
    raise RuntimeError('Main Windows release is unavailable')
gh('release', 'upload', principal['tag_name'], str(apk), '--clobber')
branch = 'mobile-updates'
ref = gh('api',f'repos/{repo}/git/ref/heads/{branch}',check=False)
if ref.returncode != 0:
    gh('api',f'repos/{repo}/git/refs','-X','POST','-f',f'ref=refs/heads/{branch}','-f',f"sha={os.environ['GITHUB_SHA']}")
endpoint = f'repos/{repo}/contents/android.json'
current = gh('api',endpoint+'?ref='+branch,check=False)
body={'branch':branch,'message':f'Publish mobile update {version}', 'content':base64.b64encode((json.dumps(channel,indent=2)+'\n').encode()).decode()}
if current.returncode == 0:
    info=json.loads(current.stdout)
    old=json.loads(base64.b64decode(info['content']))
    if old.get('versionCode',0) >= code:
        raise RuntimeError('Refusing to roll back update channel')
    body['sha']=info['sha']
gh('api',endpoint,'-X','PUT','--input','-',input=json.dumps(body))
print(f'Published {tag} and Android update channel.')
