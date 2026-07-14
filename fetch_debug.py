import urllib.request

url = 'http://localhost:3000/api/debug/insert-manager'
req = urllib.request.Request(url)
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.status)
        print(resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('status', e.code)
    print(e.read().decode('utf-8'))
except Exception as exc:
    print('error', exc)
