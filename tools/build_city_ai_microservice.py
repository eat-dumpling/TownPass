#!/usr/bin/env python3
"""Package the buildless microservice as one offline asset with hash-based CSP.
SPDX-License-Identifier: AGPL-3.0-or-later
"""
from pathlib import Path
import hashlib
import base64

root = Path(__file__).resolve().parents[1]
source = root/'microservices/city_ai'
script = (source/'app.js').read_text()
style = (source/'style.css').read_text()
assert '</script' not in script.lower() and '</style' not in style.lower()
def digest(value):
    return base64.b64encode(hashlib.sha256(value.encode()).digest()).decode()
csp = ("default-src 'none'; connect-src 'none'; img-src 'none'; frame-src 'none'; "
       "base-uri 'none'; form-action 'none'; "
       f"script-src 'sha256-{digest(script)}'; style-src 'sha256-{digest(style)}'")
html = (source/'index.html').read_text().replace('__CSP__', csp).replace('__STYLE__', style).replace('__SCRIPT__', script)
target = root/'assets/microservices/city_ai/index.html'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(html)
(source/'dist').mkdir(exist_ok=True)
(source/'dist/index.html').write_text(html)
print(f'Packaged {len(html.encode())} bytes: {target.relative_to(root)}')
