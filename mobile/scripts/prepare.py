from pathlib import Path
import json
import shutil
import subprocess

mobile = Path(__file__).resolve().parents[1]
lock = json.loads((mobile / 'base-lock.json').read_text())
version = lock['version']
major, minor, patch = map(int, version.split('-')[0].split('.'))
preview = int(version.split('-preview.')[1]) if '-preview.' in version else 99
code = major * 1000000 + minor * 10000 + patch * 100 + preview
work = mobile / 'work'
work.mkdir(exist_ok=True)
for name in ('core', 'manager'):
    destination = work / name
    if not destination.exists():
        subprocess.run(['git', 'init', str(destination)], check=True)
        subprocess.run(['git', '-C', str(destination), 'remote', 'add', 'origin', lock[name]['repo']], check=True)
        subprocess.run(['git', '-C', str(destination), 'fetch', '--depth', '1', 'origin', lock[name]['commit']], check=True)
        subprocess.run(['git', '-C', str(destination), 'checkout', '--detach', 'FETCH_HEAD'], check=True)
    current = subprocess.check_output(['git', '-C', str(destination), 'rev-parse', 'HEAD'], text=True).strip()
    if current != lock[name]['commit']:
        raise RuntimeError(f'Unexpected upstream revision: {name}')
    shutil.copytree(mobile / 'overlay' / name, destination, dirs_exist_ok=True)
    (destination / 'gradlew').chmod(0o755)
(work / 'core/bundle/src/byaflux/version.ts').write_text(
    f"export const MobileVersionName = '{version}'\nexport const MobileVersionCode = {code}\n"
)
properties = work / 'manager/gradle.properties'
lines = properties.read_text().splitlines()
properties.write_text('\n'.join(
    f'version = {version}' if line.startswith('version = ') else line for line in lines
) + '\n')
print('Pinned sources prepared.')
