import base64
import os
from pathlib import Path

names = ['MOBILE_KEYSTORE_BASE64', 'KEYSTORE_PASSWORD', 'KEYSTORE_ENTRY_ALIAS', 'KEYSTORE_ENTRY_PASSWORD']
present = [bool(os.environ.get(name)) for name in names]
if any(present) and not all(present):
    raise RuntimeError('Incomplete Android signing secrets')
signed = all(present)
if signed:
    path = Path('mobile/work/manager/app/keystore.jks')
    path.write_bytes(base64.b64decode(os.environ[names[0]], validate=True))
    path.chmod(0o600)
with open(os.environ['GITHUB_ENV'], 'a') as output:
    output.write(f"MOBILE_SIGNED={'true' if signed else 'false'}\n")
