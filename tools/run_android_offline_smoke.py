#!/usr/bin/env python3
"""Download approved model, switch an emulator offline, test native inference.

SPDX-License-Identifier: AGPL-3.0-or-later
Only emulator serials are accepted. Restores previous network settings.
"""
import argparse
from pathlib import Path
import re
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', default='emulator-5554')
    parser.add_argument('--adb', default='adb')
    a = parser.parse_args()
    if not re.fullmatch(r'emulator-\d+', a.device):
        parser.error('only emulator serials are allowed; no personal device network changes')

    def adb(*args):
        return subprocess.check_output([a.adb, '-s', a.device, 'shell', *args], text=True).strip()

    previous = [adb('settings', 'get', 'global', k) for k in ('airplane_mode_on', 'wifi_on', 'mobile_data')]
    command = ['flutter', 'test', 'integration_test/model_smoke_test.dart', '-d', a.device,
               '--dart-define=RUN_MODEL_SMOKE=true', '--dart-define=MODEL_SMOKE_WAIT_FOR_OFFLINE=true',
               '--reporter', 'expanded']
    root = Path(__file__).resolve().parents[1]
    confirmed = False
    process = None
    try:
        adb('cmd', 'connectivity', 'airplane-mode', 'disable')
        adb('svc', 'wifi', 'enable')
        process = subprocess.Popen(command, cwd=root/'apps/city_ai_demo', stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in process.stdout:
            print(line, end='', flush=True)
            if 'MODEL_READY_FOR_OFFLINE' in line:
                adb('cmd', 'connectivity', 'airplane-mode', 'enable')
                adb('svc', 'wifi', 'disable')
                adb('svc', 'data', 'disable')
                for _ in range(10):
                    connectivity = adb('dumpsys', 'connectivity')
                    if 'Active default network: none' in connectivity:
                        confirmed = True
                        print('OFFLINE_CONFIRMED airplane=1 wifi=0 data=0 default_network=none', flush=True)
                        break
                    time.sleep(.5)
                if not confirmed:
                    process.terminate()
                    raise RuntimeError('emulator still has an active default network')
        code = process.wait()
        if code != 0 or not confirmed:
            return code or 1
        return 0
    finally:
        if process and process.poll() is None:
            process.terminate()
        adb('cmd', 'connectivity', 'airplane-mode', 'enable' if previous[0] == '1' else 'disable')
        adb('svc', 'wifi', 'enable' if previous[1] == '1' else 'disable')
        adb('svc', 'data', 'enable' if previous[2] == '1' else 'disable')


if __name__ == '__main__':
    sys.exit(main())
