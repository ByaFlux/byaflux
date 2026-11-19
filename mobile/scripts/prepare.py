from pathlib import Path
import json
import shutil
import subprocess

mobile = Path(__file__).resolve().parents[1]
lock = json.loads((mobile / 'base-lock.json').read_text())
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
print('Pinned sources prepared.')
