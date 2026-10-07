"""Erzeugt die Extension-Icons (rosa Kachel mit weißer Sprechblase) ohne externe Abhängigkeiten."""
import struct, zlib, os

def inside(x, y):
    # Koordinaten 0..1. Rückgabe: 'bg', 'bubble', 'dot' oder None
    def rrect(px, py, x0, y0, x1, y1, r):
        cx = min(max(px, x0 + r), x1 - r); cy = min(max(py, y0 + r), y1 - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r and x0 <= px <= x1 and y0 <= py <= y1
    if not rrect(x, y, 0.02, 0.02, 0.98, 0.98, 0.22):
        return None
    for dx in (0.34, 0.5, 0.66):
        if (x - dx) ** 2 + (y - 0.44) ** 2 <= 0.055 ** 2:
            return 'dot'
    if rrect(x, y, 0.18, 0.2, 0.82, 0.68, 0.12):
        return 'bubble'
    # Sprechblasen-Spitze unten links
    if 0.66 <= y <= 0.84 and 0.28 <= x <= 0.46 and (x - 0.28) <= (0.84 - y) * 1.0 + 0.0 and x >= 0.28 + (y - 0.66) * 0.2:
        return 'bubble'
    return 'bg'

COLORS = {'bg': (219, 39, 119), 'bubble': (255, 255, 255), 'dot': (219, 39, 119)}

def png(size, path, ss=4):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    k = inside((px + (sx + .5) / ss) / size, (py + (sy + .5) / ss) / size)
                    if k:
                        c = COLORS[k]
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            n = ss * ss
            a = acc[3] / n
            if a:
                row += bytes([round(acc[0] / (acc[3] / 255)), round(acc[1] / (acc[3] / 255)), round(acc[2] / (acc[3] / 255)), round(a)])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)

out = os.path.join(os.path.dirname(__file__), '..', 'extension', 'icons')
for s in (16, 32, 48, 128):
    png(s, os.path.join(out, f'icon{s}.png'))
print('ok')
