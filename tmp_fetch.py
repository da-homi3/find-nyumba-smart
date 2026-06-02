import urllib.request
url = 'http://127.0.0.1:8081/@id/virtual:tanstack-start-dev-client-entry'
print('url', url)
res = urllib.request.urlopen(url)
print('status', res.status)
js = res.read().decode('utf-8', errors='replace')
print('len', len(js))
print(js[:2000])
