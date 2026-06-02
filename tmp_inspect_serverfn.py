import http.client
import re
import urllib.request
from urllib.parse import urljoin

conn = http.client.HTTPConnection('127.0.0.1', 8081)
conn.request('GET', '/')
r = conn.getresponse()
body = r.read().decode('utf-8', errors='replace')
print('body len', len(body))
script_srcs = re.findall(r'<script[^>]+src="([^"]+)"', body)
print('script srcs', script_srcs)
match = None
for src in script_srcs:
    if 'index-' in src and src.endswith('.js'):
        match = src
        break
print('script match', match)
if not match:
    raise SystemExit(1)
asset = match
asset_url = urljoin('http://127.0.0.1:8081/', asset)
js = urllib.request.urlopen(asset_url).read().decode('utf-8', errors='replace')
print('js len', len(js))
print('first 200 chars', js[:200])
found = re.search(r'TSS_SERVER_FN_BASE\s*=\s*["\']([^"\']+)["\']', js)
print('TSS_SERVER_FN_BASE match', found.group(1) if found else None)
ids = list({m.group(1) for m in re.finditer(r'serverFnMeta\.id\s*=\s*["\']([^"\']+)["\']', js)})
print('ids sample', ids[:30])
