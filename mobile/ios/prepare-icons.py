"""Generate the iOS app-icon catalog from the existing website icon (macOS)."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
catalog = root / 'SacredAttempt' / 'Assets.xcassets'
icon = catalog / 'AppIcon.appiconset'
icon.mkdir(parents=True, exist_ok=True)
source = root.parent.parent / 'public' / 'icon-512.png'
subprocess.run(['sips', '-z', '1024', '1024', str(source), '--out', str(icon / 'AppIcon.png')], check=True)
(catalog / 'Contents.json').write_text(json.dumps({'info': {'author': 'xcode', 'version': 1}}, indent=2))
(icon / 'Contents.json').write_text(json.dumps({
    'images': [{'filename': 'AppIcon.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}],
    'info': {'author': 'xcode', 'version': 1}
}, indent=2))
