#!/usr/bin/env python3
"""Gera todos os arquivos de marca da Vytra a partir de uma geometria canonica unica.

Fonte da verdade da geometria do mark. Roda da raiz do repositorio:

    pip install fonttools cairosvg
    python3 scripts/brand/gen_brand.py

Escreve em assets/brand/. Nao editar aqueles arquivos a mao: a proxima execucao sobrescreve.
Regras de uso da marca em docs/marca/BRAND.md.
"""
import os, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import cairosvg

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "assets", "brand")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- paleta
MINT   = "#2ED9A3"
INK    = "#0A0C0D"
PAPER  = "#ECEFEE"
WHITE  = "#FFFFFF"

# ------------------------------------------------------- geometria do mark
# Linha de sinal vital: base plana, um unico pico pra baixo cujo vertice e a letra V.
# Unidades canonicas. Traco 8, pontas retas (bordas retas de proposito, sem arredondar).
SW = 8.0
BASE_Y   = 22.0     # linha de base
APEX_Y   = 52.0     # vertice do V
V_HALF   = 16.0     # meia-largura do V
# O verice fica a esquerda do centro, nao centralizado: bracos 28/40 no desenho de
# referencia (proporcao ~0.7). Cada variante recalcula o mesmo x do vertice a partir da
# sua propria largura, pra manter a MESMA proporcao visual em vez de um x fixo.
ARM_RATIO = 28.0 / 40.0

def apex_x(left_edge, right_edge):
    flat = (right_edge - left_edge) - 2 * V_HALF
    left_arm = flat * ARM_RATIO / (1 + ARM_RATIO)
    return left_edge + left_arm + V_HALF

def mark_points(left_edge, right_edge):
    ax = apex_x(left_edge, right_edge)
    return [(left_edge, BASE_Y), (ax - V_HALF, BASE_Y), (ax, APEX_Y),
            (ax + V_HALF, BASE_Y), (right_edge, BASE_Y)]

# variante larga (lockups, cabecalho, favicon largo)
FULL = mark_points(8, 112)
# variante compacta (icone quadrado) - mesma proporcao de vertice, rabichos mais curtos
COMPACT = mark_points(22, 98)

def bbox(points):
    xs = [p[0] for p in points]; ys = [p[1] for p in points]
    return (min(xs) - SW / 2, min(ys) - SW / 2, max(xs) + SW / 2, max(ys) + SW / 2)

def polyline(points, color, sw=SW):
    pts = " ".join(f"{x:g},{y:g}" for x, y in points)
    return (f'<polyline points="{pts}" fill="none" stroke="{color}" '
            f'stroke-width="{sw:g}" stroke-linecap="butt" stroke-linejoin="miter"/>')

# ------------------------------------------------------------- wordmark
FONT = os.path.join(ROOT, "assets", "fonts", "IBMPlexMono-Medium.ttf")

def wordmark_path(text="VYTRA", cap_height=34.0, tracking_ratio=0.10):
    """Devolve (path_d, largura, altura_de_caixa_alta) com o texto ja convertido em curvas."""
    font = TTFont(FONT)
    upm = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight if hasattr(font["OS/2"], "sCapHeight") else 700
    glyphset = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    scale = cap_height / cap          # unidades de fonte -> unidades do desenho
    tracking = cap_height * tracking_ratio
    pen_x = 0.0
    parts = []
    for ch in text:
        gname = cmap[ord(ch)]
        spen = SVGPathPen(glyphset)
        # y invertido: fonte cresce pra cima, SVG cresce pra baixo
        tpen = TransformPen(spen, (scale, 0, 0, -scale, pen_x, 0))
        glyphset[gname].draw(tpen)
        d = spen.getCommands()
        if d:
            parts.append(d)
        pen_x += hmtx[gname][0] * scale + tracking
    width = pen_x - tracking
    return " ".join(parts), width, cap_height

WM_D, WM_W, WM_CAP = wordmark_path()

# --------------------------------------------------------------- svgs
def svg(w, h, body, extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" '
            f'width="{w:g}" height="{h:g}"{extra}>\n  ' + body + "\n</svg>\n")

def write(name, content):
    p = os.path.join(OUT, name)
    with open(p, "w") as f:
        f.write(content)
    return p

def mark_svg(color, points=FULL, label="Marca Vytra"):
    x0, y0, x1, y1 = bbox(points)
    w, h = x1 - x0, y1 - y0
    body = f'<g transform="translate({-x0:g},{-y0:g})" role="img" aria-label="{label}">{polyline(points, color)}</g>'
    return svg(w, h, body)

def lockup_svg(mark_color, text_color, points=FULL, gap=26.0):
    x0, y0, x1, y1 = bbox(points)
    mw, mh = x1 - x0, y1 - y0
    # texto centralizado verticalmente com o mark
    ty = (mh + WM_CAP) / 2
    tx = mw + gap
    w = tx + WM_W
    body = (f'<g role="img" aria-label="Vytra">'
            f'<g transform="translate({-x0:g},{-y0:g})">{polyline(points, mark_color)}</g>'
            f'<path transform="translate({tx:g},{ty:g})" d="{WM_D}" fill="{text_color}"/>'
            f'</g>')
    return svg(w, mh, body)

def stacked_svg(mark_color, text_color, points=COMPACT, gap=18.0, cap=22.0):
    d, ww, _ = wordmark_path(cap_height=cap)
    x0, y0, x1, y1 = bbox(points)
    mw, mh = x1 - x0, y1 - y0
    w = max(mw, ww)
    h = mh + gap + cap
    body = (f'<g role="img" aria-label="Vytra">'
            f'<g transform="translate({(w-mw)/2 - x0:g},{-y0:g})">{polyline(points, mark_color)}</g>'
            f'<path transform="translate({(w-ww)/2:g},{mh+gap+cap:g})" d="{d}" fill="{text_color}"/>'
            f'</g>')
    return svg(w, h, body)

def wordmark_svg(color, cap=34.0):
    d, ww, _ = wordmark_path(cap_height=cap)
    pad = cap * 0.12
    return svg(ww, cap + pad * 2,
               f'<path transform="translate(0,{cap+pad:g})" d="{d}" fill="{color}" '
               f'role="img" aria-label="Vytra"/>')

def icon_svg(bg, fg, size=1024, coverage=0.62, radius=None, sw=SW):
    """Icone quadrado: mark compacto centrado, com area de respiro segura."""
    x0, y0, x1, y1 = bbox(COMPACT)
    mw, mh = x1 - x0, y1 - y0
    s = (size * coverage) / mw
    tx = (size - mw * s) / 2 - x0 * s
    ty = (size - mh * s) / 2 - y0 * s
    bgel = ""
    if bg:
        r = f' rx="{radius:g}"' if radius else ""
        bgel = f'<rect width="{size}" height="{size}" fill="{bg}"{r}/>'
    body = (f'{bgel}<g transform="translate({tx:g},{ty:g}) scale({s:g})">'
            f'{polyline(COMPACT, fg, sw)}</g>')
    return svg(size, size, body)

# ------------------------------------------------------------ arquivos
files = {
    # marca isolada
    "vytra-mark.svg":            mark_svg(MINT),
    "vytra-mark-white.svg":      mark_svg(WHITE, label="Marca Vytra, versao branca"),
    "vytra-mark-black.svg":      mark_svg(INK,   label="Marca Vytra, versao preta"),
    "vytra-mark-compact.svg":    mark_svg(MINT, COMPACT, "Marca Vytra, versao compacta"),
    # lockups horizontais
    "vytra-lockup.svg":          lockup_svg(MINT, PAPER),
    "vytra-lockup-white.svg":    lockup_svg(WHITE, WHITE),
    "vytra-lockup-black.svg":    lockup_svg(INK, INK),
    "vytra-lockup-mint.svg":     lockup_svg(MINT, MINT),
    # empilhado
    "vytra-lockup-stacked.svg":       stacked_svg(MINT, PAPER),
    "vytra-lockup-stacked-white.svg": stacked_svg(WHITE, WHITE),
    "vytra-lockup-stacked-black.svg": stacked_svg(INK, INK),
    # wordmark puro
    "vytra-wordmark.svg":        wordmark_svg(PAPER),
    "vytra-wordmark-black.svg":  wordmark_svg(INK),
    # icones
    "vytra-app-icon.svg":        icon_svg(INK, MINT, coverage=0.66, sw=11.0),
    "vytra-icon-foreground.svg": icon_svg(None, MINT, coverage=0.50, sw=11.0),
    "vytra-icon-monochrome.svg": icon_svg(None, WHITE, coverage=0.50, sw=11.0),
    "vytra-icon-background.svg": svg(1024, 1024, f'<rect width="1024" height="1024" fill="{INK}"/>'),
    "vytra-splash.svg":          icon_svg(None, MINT, size=512, coverage=0.74, sw=11.0),
    # variante optica pra tamanho pequeno (favicon, 16-48px): traco mais pesado
    "vytra-icon-small.svg":      icon_svg(INK, MINT, coverage=0.72, sw=13.0),
    "vytra-mark-small.svg":      mark_svg(MINT, COMPACT, "Marca Vytra, otica pequena").replace(f'stroke-width="{SW:g}"', 'stroke-width="13"'),
}
for name, content in files.items():
    write(name, content)

# --------------------------------------------------------------- pngs
png_jobs = [
    ("vytra-app-icon.svg",        "vytra-app-icon-1024.png",        1024, 1024),
    ("vytra-icon-foreground.svg", "vytra-icon-foreground-1024.png", 1024, 1024),
    ("vytra-icon-monochrome.svg", "vytra-icon-monochrome-1024.png", 1024, 1024),
    ("vytra-icon-background.svg", "vytra-icon-background-1024.png", 1024, 1024),
    ("vytra-icon-small.svg",      "vytra-favicon-196.png",           196,  196),
    ("vytra-icon-small.svg",      "vytra-favicon-48.png",             48,   48),
    ("vytra-icon-small.svg",      "vytra-favicon-32.png",             32,   32),
    ("vytra-splash.svg",          "vytra-splash-512.png",            512,  512),
    ("vytra-mark.svg",            "vytra-mark-1024.png",            1024, None),
    ("vytra-mark-white.svg",      "vytra-mark-white-1024.png",      1024, None),
    ("vytra-lockup.svg",          "vytra-lockup-2400.png",          2400, None),
    ("vytra-lockup-white.svg",    "vytra-lockup-white-2400.png",    2400, None),
    ("vytra-lockup-black.svg",    "vytra-lockup-black-2400.png",    2400, None),
    ("vytra-lockup-stacked.svg",  "vytra-lockup-stacked-1200.png",  1200, None),
]
for src, dst, w, h in png_jobs:
    kw = {"output_width": w}
    if h:
        kw["output_height"] = h
    cairosvg.svg2png(url=os.path.join(OUT, src), write_to=os.path.join(OUT, dst), **kw)

print("wordmark width:", round(WM_W, 2))
for f in sorted(os.listdir(OUT)):
    print(" ", f, os.path.getsize(os.path.join(OUT, f)))

# ---- aliases: sobrescrevem os arquivos da primeira tentativa (geometria antiga),
# pra nao sobrar nenhum asset com proporcao errada no repositorio.
import shutil
for src, dst in [
    ("vytra-mark-white.svg",           "vytra-mark-mono.svg"),
    ("vytra-icon-foreground.svg",      "vytra-mark-foreground.svg"),
    ("vytra-icon-foreground-1024.png", "vytra-mark-foreground-1024.png"),
    ("vytra-icon-monochrome-1024.png", "vytra-mark-mono-1024.png"),
]:
    shutil.copyfile(os.path.join(OUT, src), os.path.join(OUT, dst))
cairosvg.svg2png(url=os.path.join(OUT, "vytra-wordmark.svg"),
                 write_to=os.path.join(OUT, "vytra-wordmark-1200.png"), output_width=1200)
cairosvg.svg2png(url=os.path.join(OUT, "vytra-lockup.svg"),
                 write_to=os.path.join(OUT, "vytra-lockup-1200.png"), output_width=1200)
print("aliases ok")
