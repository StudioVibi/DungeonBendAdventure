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

// ---------- Cripta ----------
{
  const r = rng(29)
  let tiles = '', graves = '', cracks = '', candles = ''
  const tw = 100, th = 70
  for (let y = 0; y < H; y += th) {
    const off = (y / th) % 2 ? tw / 2 : 0
    for (let x = -off; x < W; x += tw) {
      const c = 58 + Math.floor(r() * 18)
      tiles += `<rect x="${x + 3}" y="${y + 3}" width="${tw - 6}" height="${th - 6}" rx="6" fill="rgb(${c},${c + 2},${c + 10})"/>`
    }
  }
  for (let i = 0; i < 22; i++) {
    let x = r() * W, y = r() * H, d = `M${f(x)} ${f(y)}`
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; d += `L${f(x)} ${f(y)}` }
    cracks += `<path d="${d}" stroke="#1b1c22" stroke-width="2.5" fill="none" opacity=".7"/>`
  }
  const spots = [[60, 120], [60, 420], [60, 720], [W - 70, 160], [W - 70, 470], [W - 70, 780], [420, 40], [800, 40], [1180, 40], [600, H - 30], [1000, H - 30]]
  for (const [x, y] of spots) {
    graves += `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="38" rx="40" ry="10" fill="#000" opacity=".35"/>
      <path d="M-28 38V-12a28 28 0 0 1 56 0V38z" fill="#7d8190" stroke="#262830" stroke-width="5"/>
      <path d="M-4 -16h8v10h10v8H4v22h-8V2h-10v-8h10z" fill="#4c4f5c"/></g>`
  }
  for (let i = 0; i < 10; i++) {
    const x = 200 + r() * 1200, y = 80 + r() * 740
    candles += `<g transform="translate(${f(x)} ${f(y)})"><circle r="38" fill="#ffcf7a" opacity=".12"/><rect x="-5" y="-6" width="10" height="20" rx="2" fill="#e9e2cf" stroke="#3a3428" stroke-width="2"/><path d="M0 -18c4 5 4 9 0 12c-4-3-4-7 0-12z" fill="#ffb347"/></g>`
  }
  writeFileSync(new URL('bg-cripta.svg', out), svg(
    noiseFilter('n', 0.02, 3, 0.45, 5),
    `<rect width="${W}" height="${H}" fill="#22232b"/>${tiles}
<rect width="${W}" height="${H}" filter="url(#n)"/>${cracks}${candles}${graves}`))
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
