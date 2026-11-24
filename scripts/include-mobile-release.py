import base64
import hashlib
import json
import subprocess
from pathlib import Path

def gh(*args):
    return subprocess.check_output(["gh", *args], text=True)
repo = "ByaFlux/byaflux"
record = json.loads(gh("api", f"repos/{repo}/contents/android.json?ref=mobile-updates"))
channel = json.loads(base64.b64decode(record["content"]))
version = channel["versionName"]
if not all(c.isdigit() or c in ".-abcdefghijklmnopqrstuvwxyz" for c in version):
    raise ValueError("Invalid mobile version")
name = f"ByaFluxMobile-{version}.apk"
gh("release", "download", "mobile-v" + version, "--repo", repo, "--pattern", name, "--dir", "publish")
apk = Path("publish") / name
if apk.stat().st_size != channel["apkSize"] or hashlib.sha256(apk.read_bytes()).hexdigest() != channel["sha256"]:
    raise ValueError("Invalid mobile APK")
