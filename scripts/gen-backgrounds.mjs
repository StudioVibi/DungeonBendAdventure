// Gera os backgrounds placeholder (SVG) das 3 dungeons em public/assets/generated.
// Uso: node scripts/gen-backgrounds.mjs
import { writeFileSync } from 'node:fs'

const W = 1600, H = 900
const out = new URL('../public/assets/generated/', import.meta.url)

function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
}
const f = (n) => n.toFixed(1)

function blob(r, cx, cy, rad, pts = 9, jitter = 0.35) {
  let d = ''
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2
    const rr = rad * (1 - jitter / 2 + r() * jitter)
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr * 0.75)}`
  }
  return d + 'Z'
}

function noiseFilter(id, freq, octaves, slope, seed) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${slope} 0"/>
  </filter>`
}

const vignette = `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>`

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>${defs}${vignette}</defs>
${body}
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`
}

// ---------- Caverna ----------
{
  const r = rng(11)
  let rocks = '', pebbles = '', puddles = ''
  for (let i = 0; i < 26; i++) {
    const edge = r() < 0.7
    const x = edge ? (r() < 0.5 ? r() * 180 : W - r() * 180) : r() * W
    const y = edge ? r() * H : (r() < 0.5 ? r() * 90 : H - r() * 90)
    const s = 40 + r() * 90
    rocks += `<path d="${blob(r, x, y, s)}" fill="#3a332e" stroke="#1d1916" stroke-width="5"/><path d="${blob(r, x - s * 0.15, y - s * 0.2, s * 0.55)}" fill="#4a423b" opacity=".8"/>`
  }
  for (let i = 0; i < 140; i++) pebbles += `<ellipse cx="${f(r() * W)}" cy="${f(r() * H)}" rx="${f(2 + r() * 6)}" ry="${f(2 + r() * 4)}" fill="${r() < 0.5 ? '#2a2420' : '#5b524a'}" opacity=".7"/>`
  for (let i = 0; i < 5; i++) puddles += `<path d="${blob(r, 300 + r() * 1000, 150 + r() * 600, 50 + r() * 60, 12, 0.25)}" fill="#1f2a33" opacity=".55"/>`
  writeFileSync(new URL('bg-caverna.svg', out), svg(
    noiseFilter('n', 0.012, 4, 0.55, 3) + noiseFilter('n2', 0.08, 2, 0.25, 8) +
    `<radialGradient id="floor" cx=".45" cy=".55" r=".8"><stop offset="0" stop-color="#6b5d50"/><stop offset="1" stop-color="#3d342d"/></radialGradient>`,
    `<rect width="${W}" height="${H}" fill="url(#floor)"/>
<rect width="${W}" height="${H}" filter="url(#n)"/>
<rect width="${W}" height="${H}" filter="url(#n2)"/>
${puddles}${pebbles}${rocks}`))
}

// ---------- Cripta (chão de castelo visto de cima) ----------
{
  const r = rng(29)
  const T = 120 // laje quadrada, grade alinhada (sem deslocamento de tijolo)
  let slabs = '', cracks = '', wear = '', candles = '', bones = ''

  for (let gy = -1; gy * T < H; gy++) {
    for (let gx = 0; gx * T < W; gx++) {
      const x = gx * T, y = gy * T + 30
      const c = 74 + Math.floor(r() * 22)
      const tint = `rgb(${c},${c - 2},${c - 6})`
      const roll = r()
      if (roll < 0.18) {
        // laje dividida em duas metades
        const vert = r() < 0.5
        const a = vert ? [x, y, T / 2, T] : [x, y, T, T / 2]
        const b = vert ? [x + T / 2, y, T / 2, T] : [x, y + T / 2, T, T / 2]
        for (const [bx, by, bw, bh] of [a, b]) {
          const c2 = 70 + Math.floor(r() * 24)
          slabs += `<rect x="${bx + 3}" y="${by + 3}" width="${bw - 6}" height="${bh - 6}" rx="4" fill="rgb(${c2},${c2 - 2},${c2 - 6})"/>`
        }
      } else {
        slabs += `<rect x="${x + 3}" y="${y + 3}" width="${T - 6}" height="${T - 6}" rx="5" fill="${tint}"/>`
        // bisel: luz em cima/esquerda, sombra embaixo/direita
        slabs += `<path d="M${x + 6} ${y + T - 6}V${y + 6}H${x + T - 6}" stroke="#fff" stroke-opacity=".07" stroke-width="3" fill="none"/>`
        slabs += `<path d="M${x + 6} ${y + T - 5}H${x + T - 5}V${y + 6}" stroke="#000" stroke-opacity=".25" stroke-width="3" fill="none"/>`
      }
      if (r() < 0.22) wear += `<ellipse cx="${f(x + 20 + r() * (T - 40))}" cy="${f(y + 20 + r() * (T - 40))}" rx="${f(10 + r() * 22)}" ry="${f(6 + r() * 14)}" fill="#000" opacity=".12"/>`
    }
  }

  for (let i = 0; i < 26; i++) {
    let x = r() * W, y = r() * H, d = `M${f(x)} ${f(y)}`
    for (let k = 0; k < 3; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; d += `L${f(x)} ${f(y)}` }
    cracks += `<path d="${d}" stroke="#1d1c1f" stroke-width="2" fill="none" opacity=".75"/>`
  }

  for (let i = 0; i < 5; i++) {
    const x = 150 + r() * 1300, y = 90 + r() * 720
    candles += `<g transform="translate(${f(x)} ${f(y)})"><circle r="46" fill="#ffcf7a" opacity=".13"/><circle r="22" fill="#ffcf7a" opacity=".12"/>
      <circle r="9" fill="#e9e2cf" stroke="#3a3428" stroke-width="2"/><circle r="4" fill="#ffb347"/><circle r="2" fill="#fff6c8"/></g>`
  }
  for (let i = 0; i < 7; i++) {
    const x = 120 + r() * 1360, y = 100 + r() * 700, a = r() * 180
    bones += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" opacity=".85"><rect x="-14" y="-2.5" width="28" height="5" rx="2" fill="#e8e1cf"/><circle cx="-14" cy="-3" r="4" fill="#e8e1cf"/><circle cx="-14" cy="3" r="4" fill="#e8e1cf"/><circle cx="14" cy="-3" r="4" fill="#e8e1cf"/><circle cx="14" cy="3" r="4" fill="#e8e1cf"/></g>`
  }

  writeFileSync(new URL('bg-cripta.svg', out), svg(
    noiseFilter('n', 0.02, 3, 0.4, 5),
    `<rect width="${W}" height="${H}" fill="#2a292e"/>${slabs}
<rect width="${W}" height="${H}" filter="url(#n)"/>${wear}${cracks}${bones}${candles}`))
}

// ---------- Jardim ----------
{
  const r = rng(47)
  let bushes = '', flowers = '', grass = '', dirt = ''
  for (let i = 0; i < 6; i++) dirt += `<path d="${blob(r, 200 + r() * 1200, 100 + r() * 700, 70 + r() * 60, 12, 0.3)}" fill="#7a6640" opacity=".35"/>`
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H
    grass += `<path d="M${f(x)} ${f(y)}l-4 -12M${f(x)} ${f(y)}l1 -15M${f(x)} ${f(y)}l6 -11" stroke="${r() < 0.5 ? '#2f6b28' : '#4f9a3a'}" stroke-width="2.5" stroke-linecap="round"/>`
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, c = ['#f6d24a', '#f27aa8', '#ffffff', '#b98cf2'][Math.floor(r() * 4)]
    flowers += `<g transform="translate(${f(x)} ${f(y)})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${f(Math.cos(a * Math.PI / 180) * 5)}" cy="${f(Math.sin(a * Math.PI / 180) * 5)}" r="4" fill="${c}"/>`).join('')}<circle r="3" fill="#a5641e"/></g>`
  }
  for (let i = 0; i < 24; i++) {
    const edge = r() < 0.75
    const x = edge ? (r() < 0.5 ? r() * 170 : W - r() * 170) : r() * W
    const y = edge ? r() * H : (r() < 0.5 ? r() * 80 : H - r() * 80)
    const s = 45 + r() * 70
    bushes += `<path d="${blob(r, x, y, s, 14, 0.45)}" fill="#1f4d1d" stroke="#102a0f" stroke-width="5"/><path d="${blob(r, x - s * 0.2, y - s * 0.25, s * 0.55, 10, 0.4)}" fill="#2f7a2a"/>`
  }
  writeFileSync(new URL('bg-jardim.svg', out), svg(
    noiseFilter('n', 0.01, 4, 0.4, 9) + `<radialGradient id="floor" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#5f9a43"/><stop offset="1" stop-color="#2f5d25"/></radialGradient>`,
    `<rect width="${W}" height="${H}" fill="url(#floor)"/>
<rect width="${W}" height="${H}" filter="url(#n)"/>${dirt}${grass}${flowers}${bushes}`))
}
console.log('backgrounds ok')
