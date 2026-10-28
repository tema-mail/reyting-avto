# Разово: границы 10 районов Новосибирска из OpenStreetMap (Overpass, admin_level=9) → src/data/rayony.json.
# Запуск: python3 -I scripts/rayony-iz-osm.py <osm.json> src/data/rayony.json
# osm.json – ответ Overpass на запрос:
#   [out:json];rel["boundary"="administrative"]["admin_level"="9"](54.75,82.6,55.2,83.2);out geom;
# Кольца собираются из внешних линий отношения, упрощаются (Дуглас – Пекер, ~15 м), координаты [долгота, широта].
import json, sys

def close(a, b):
    return abs(a[0] - b[0]) < 1e-9 and abs(a[1] - b[1]) < 1e-9

def rings(ways):
    ways = [w[:] for w in ways if len(w) > 1]
    out = []
    while ways:
        ring = ways.pop(0)
        changed = True
        while not close(ring[0], ring[-1]) and changed:
            changed = False
            for i, w in enumerate(ways):
                if close(ring[-1], w[0]): ring += w[1:]
                elif close(ring[-1], w[-1]): ring += w[::-1][1:]
                elif close(ring[0], w[-1]): ring = w[:-1] + ring
                elif close(ring[0], w[0]): ring = w[::-1][:-1] + ring
                else: continue
                ways.pop(i); changed = True; break
        out.append(ring)
    return out

def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = (dx * dx + dy * dy) ** 0.5 or 1e-12
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / n
        if d > dmax: dmax, idx = d, i
    if dmax > eps:
        return dp(pts[: idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [a, b]

src = json.load(open(sys.argv[1]))
res = []
for e in src['elements']:
    name = e['tags']['name'].replace(' район', '')
    outer = [[[p['lon'], p['lat']] for p in m['geometry']] for m in e['members'] if m['type'] == 'way' and m.get('role') == 'outer']
    rs = []
    for r in rings(outer):
        # замкнутое кольцо делим в самой дальней от начала точке, иначе упрощение схлопнет его
        k = max(range(len(r)), key=lambda i: (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2)
        s = dp(r[: k + 1], 0.00015)[:-1] + dp(r[k:], 0.00015)
        rs.append([[round(x, 5), round(y, 5)] for x, y in s])
    res.append({'name': name, 'osm': e['id'], 'rings': rs})
res.sort(key=lambda r: r['name'])
json.dump({'источник': 'OpenStreetMap, Overpass API, admin_level=9, снято 28.10.2026; © участники OpenStreetMap, ODbL', 'районы': res}, open(sys.argv[2], 'w'), ensure_ascii=False)
print([(r['name'], len(r['rings']), sum(len(x) for x in r['rings'])) for r in res])
