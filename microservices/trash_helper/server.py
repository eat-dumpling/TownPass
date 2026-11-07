#!/usr/bin/env python3
"""Local dev server for the Trash Helper microservice (static files only, no dependencies).

    python3 microservices/trash_helper/server.py                    # http://127.0.0.1:8788/
    python3 microservices/trash_helper/server.py --host 192.168.x.y # iPhone on the same Wi-Fi

For production, deploy this folder as static files (e.g. Firebase Hosting) and pass
--dart-define=TRASH_HELPER_URL=https://<host>/ to the TownPass build.
SPDX-License-Identifier: AGPL-3.0-or-later
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Do not serve the server script or the raw source CSVs.
BLOCKED = ('/server.py', '/data/source/', '/README.md')


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if any(path == b or path.startswith(b) for b in BLOCKED):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        # Dev-only event log from the page (see devLog in app.js). Printed, never stored.
        if self.path != '/api/log':
            self.send_error(404)
            return
        length = min(int(self.headers.get('Content-Length') or 0), 4096)
        body = self.rfile.read(length).decode('utf-8', 'replace')
        print(f'[page] {body}', flush=True)
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        if '/api/log' not in str(args[0] if args else ''):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8788)
    parser.add_argument('--host', default='127.0.0.1')
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=str(ROOT))) as server:
        print(f'Trash Helper: http://{args.host}:{args.port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
