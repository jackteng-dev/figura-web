"""Start the gallery API against the existing loopback demo only. Never prints env values."""
import json
import os
import socket
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT.parent / 'figura-api'
JAVA = Path(r'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot\bin\java.exe')
WORK = ROOT / 'work/catalog-gallery'


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    for line in (API / 'work/demo.env').read_text('utf-8').splitlines():
        if line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v.strip().strip('\'"')
    assert env['DB_URL'].split('?', 1)[0] == 'jdbc:mysql://127.0.0.1:13306/figura_shop_demo'
    assert env['SERVER_ADDRESS'] == '127.0.0.1' and env['SERVER_PORT'] == '19092'
    assert env['REDIS_HOST'] == '127.0.0.1' and env['REDIS_PORT'] == '17379'
    assert env['SHOP_IMAGES_ENDPOINT'] == 'http://127.0.0.1:18333'
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', 19092)) == 0:
            raise RuntimeError('19092 is occupied; identify the owner before restarting')
    jar = API / 'work/gallery-target/figura-api-1.0-SNAPSHOT.jar'
    with (WORK / 'api.stdout.log').open('ab') as out, (WORK / 'api.stderr.log').open('ab') as err:
        child = subprocess.Popen([str(JAVA), '-Xmx768m', '-XX:ActiveProcessorCount=4', '-jar', str(jar), '--spring.profiles.active=demo'],
                                 cwd=API, env=env, stdout=out, stderr=err, creationflags=subprocess.CREATE_NO_WINDOW)
    (WORK / 'api-process.json').write_text(json.dumps({'pid': child.pid, 'startedAt': time.time(), 'jar': str(jar), 'port': 19092, 'database': 'figura_shop_demo', 'priorPortState': 'connection_refused', 'envValuesPrinted': False}, indent=2))
    print('Started local gallery API PID', child.pid)


if __name__ == '__main__':
    main()
