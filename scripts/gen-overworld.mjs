// Gera a arte do menu diegético (planície com caverna, castelo-cripta, jardim e barraca da loja).
// Saída: public/assets/generated/overworld/*.svg + src/game/overworld-layout.json (posições na cena).
// Uso: node scripts/gen-overworld.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/assets/generated/overworld/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const W = 1600, H = 900
const INK = '#2a1d16'

// posições (centro do desenho) e tamanhos na cena 1600×900
const LAYOUT = {
  scene: { w: W, h: H },
  crossroads: { x: 800, y: 655 },
  hero: { x: 800, y: 640 },
  places: {
    caverna: { x: 315, y: 345, w: 440, h: 352, door: { x: 330, y: 455 } },
    cripta: { x: 800, y: 255, w: 420, h: 357, door: { x: 800, y: 392 } },
    jardim: { x: 1285, y: 350, w: 440, h: 352, door: { x: 1290, y: 470 } },
    shop: { x: 440, y: 700, w: 320, h: 256, door: { x: 470, y: 760 } },
  },
}
writeFileSync(new URL('../src/game/overworld-layout.json', import.meta.url), JSON.stringify(LAYOUT, null, 2) + '\n')

let seed = 9
const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const f = (n) => n.toFixed(1)

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`

// ---------------- fundo: planície ----------------
{
  seed = 21
  const { crossroads: c, places: P } = LAYOUT
  const path = (a, b, bend) => {
    const mx = (a.x + b.x) / 2 + bend, my = (a.y + b.y) / 2
    return `M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}`
  }
  const roads = [
    path(c, P.caverna.door, -60),
    path(c, P.cripta.door, 30),
    path(c, P.jardim.door, 60),
    path(c, P.shop.door, 20),
    path(c, { x: 820, y: 940 }, -40),
  ]
  const roadSvg = roads
    .map((d) => `<path d="${d}" fill="none" stroke="#8a6a3e" stroke-width="58" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#d8b679" stroke-width="44" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#e8cf98" stroke-width="16" stroke-linecap="round" stroke-dasharray="2 26" opacity=".7"/>`)
    .join('')

  // montanhas distantes
  let far = ''
  for (const [col, base, amp, step, off] of [['#9fb1d3', 245, 90, 140, 0], ['#8199bf', 262, 60, 110, 50]]) {
    let d = `M0 ${base}`
    for (let x = 0; x <= W + step; x += step) d += `L${x + off} ${f(base - 20 - r() * amp)}L${x + off + step / 2} ${f(base - r() * 20)}`
    far += `<path d="${d}L${W} 320L0 320Z" fill="${col}"/>`
  }
  // linha de árvores no horizonte
  let treeline = ''
  for (let x = -20; x < W + 40; x += 34 + r() * 20) {
    const y = 268 + r() * 10, s = 22 + r() * 16
    treeline += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="${r() < 0.5 ? '#4f8a3c' : '#5c9846'}"/>`
  }
  // árvores grandes espalhadas (longe das construções)
  // árvores: desenhadas na cena por profundidade (React), não no fundo
  const trees = [[90, 610], [1530, 640], [585, 575], [975, 790], [1500, 470], [110, 830], [1180, 760], [1420, 820], [655, 878]]
  LAYOUT.trees = trees.map(([x, y]) => ({ x, y, s: +(0.8 + r() * 0.5).toFixed(2) }))
  writeFileSync(new URL('../src/game/overworld-layout.json', import.meta.url), JSON.stringify(LAYOUT, null, 2) + '\n')
  const treeSvg = ''
  {
    const treeArt = `<g transform="translate(70 130)">
      <ellipse cx="6" cy="8" rx="46" ry="12" fill="#000" opacity=".18"/>
      <rect x="-8" y="-40" width="16" height="48" rx="4" fill="#7a4f2c" stroke="${INK}" stroke-width="4"/>
      <circle cx="0" cy="-70" r="44" fill="#3f7d34" stroke="${INK}" stroke-width="4"/>
      <circle cx="-22" cy="-52" r="28" fill="#3f7d34" stroke="${INK}" stroke-width="4"/>
      <circle cx="24" cy="-54" r="30" fill="#3f7d34" stroke="${INK}" stroke-width="4"/>
      <circle cx="-4" cy="-72" r="40" fill="#4f9440"/>
      <circle cx="-14" cy="-86" r="16" fill="#6fb35a" opacity=".8"/>
    </g>`
    writeFileSync(new URL('tree.svg', OUT), svg(140, 150, treeArt))
  }
  let tufts = ''
  for (let i = 0; i < 220; i++) {
    const x = r() * W, y = 300 + r() * (H - 300)
    tufts += `<path d="M${f(x)} ${f(y)}l-4 -10M${f(x)} ${f(y)}l1 -13M${f(x)} ${f(y)}l5 -9" stroke="${r() < 0.5 ? '#4f8f3a' : '#6aa94e'}" stroke-width="2.5" stroke-linecap="round"/>`
  }
  let flowers = ''
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = 320 + r() * (H - 320), c = ['#f6d24a', '#f27aa8', '#ffffff', '#b98cf2', '#ff9d4d'][Math.floor(r() * 5)]
    flowers += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.5 + r() * 2)}" fill="${c}"/>`
  }
  let rocks = ''
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = 340 + r() * (H - 360), s = 8 + r() * 14
    rocks += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * 0.65)}" fill="#a39a8c" stroke="${INK}" stroke-width="3"/><ellipse cx="${f(x - s * 0.25)}" cy="${f(y - s * 0.2)}" rx="${f(s * 0.4)}" ry="${f(s * 0.25)}" fill="#c4bcaf"/>`
  }
  let clouds = ''
  for (const [x, y, s] of [[180, 90, 1], [640, 60, 0.8], [1150, 110, 1.1], [1450, 60, 0.7]]) {
    clouds += `<g transform="translate(${x} ${y}) scale(${s})" opacity=".92"><ellipse cx="0" cy="0" rx="70" ry="22" fill="#fff"/><circle cx="-24" cy="-12" r="26" fill="#fff"/><circle cx="16" cy="-18" r="32" fill="#fff"/><ellipse cx="0" cy="8" rx="70" ry="10" fill="#e6eef8"/></g>`
  }
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb7e6"/><stop offset=".75" stop-color="#cfe2ee"/><stop offset="1" stop-color="#f3dcae"/></linearGradient>
    <linearGradient id="plain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc063"/><stop offset="1" stop-color="#5e9a42"/></linearGradient>
    <filter id="gn" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.3  0 0 0 0 0.08  0 0 0 .35 0"/></filter>`
  writeFileSync(
    new URL('plain.svg', OUT),
    svg(W, H, `<rect width="${W}" height="${H}" fill="url(#sky)"/>${clouds}${far}
      <path d="M0 272Q400 255 800 268T1600 266V${H}H0Z" fill="url(#plain)"/>
      <rect y="270" width="${W}" height="${H - 270}" filter="url(#gn)"/>
      ${treeline}${tufts}${flowers}${roadSvg}${rocks}
      ${treeSvg}`, defs),
  )
  // só a planície (tela de carregamento)
  writeFileSync(
    new URL('plain-empty.svg', OUT),
    svg(W, H, `<rect width="${W}" height="${H}" fill="url(#sky)"/>${clouds}${far}
      <path d="M0 272Q400 255 800 268T1600 266V${H}H0Z" fill="url(#plain)"/>
      <rect y="270" width="${W}" height="${H - 270}" filter="url(#gn)"/>
      ${treeline}${tufts}${flowers}${rocks}
      ${treeSvg}`, defs),
  )
}

// ---------------- caverna ----------------
{
  seed = 33
  const w = 440, h = 352
  const rock = `M30 330 L45 250 L20 200 L70 150 L60 100 L120 60 L160 80 L200 30 L250 55 L300 40 L330 90 L380 110 L370 170 L415 220 L395 280 L420 330 Z`
  let moss = ''
  for (const [x, y, s] of [[90, 140, 30], [300, 70, 24], [370, 200, 22], [60, 230, 20]]) moss += `<ellipse cx="${x}" cy="${y}" rx="${s}" ry="${s * 0.45}" fill="#6a8f3f" stroke="${INK}" stroke-width="3"/>`
  let pebbles = ''
  for (let i = 0; i < 7; i++) {
    const x = 60 + r() * 320, y = 318 + r() * 18, s = 8 + r() * 12
    pebbles += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * 0.6)}" fill="#8f857b" stroke="${INK}" stroke-width="3"/>`
  }
  const body = `
    <ellipse cx="220" cy="332" rx="200" ry="18" fill="#000" opacity=".2"/>
    <path d="${rock}" fill="#7b6f66" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M60 100 L120 60 L160 80 L200 30 L250 55 L300 40 L330 90 L300 120 L240 95 L190 120 L130 105 Z" fill="#978b80"/>
    <path d="M380 110 L370 170 L415 220 L395 280 L420 330 L330 330 L360 260 L340 190 Z" fill="#62584f"/>
    <path d="M130 170l40 -20M250 130l30 18M330 240l26 -10M100 280l30 6" stroke="${INK}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    ${moss}
    <!-- boca da caverna -->
    <path d="M140 332 L140 230 Q140 160 220 160 Q300 160 300 230 L300 332 Z" fill="#1a1311" stroke="${INK}" stroke-width="6"/>
    <path d="M160 332 L160 236 Q160 182 220 182 Q280 182 280 236 L280 332 Z" fill="url(#deep)"/>
    <path d="M176 178l10 22l10 -24M222 168l9 26l9 -26M258 176l8 22l9 -20" fill="#7b6f66" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <!-- escoras de madeira -->
    <rect x="124" y="196" width="22" height="136" rx="3" fill="#8a5a32" stroke="${INK}" stroke-width="5"/>
    <rect x="294" y="196" width="22" height="136" rx="3" fill="#8a5a32" stroke="${INK}" stroke-width="5"/>
    <rect x="112" y="180" width="216" height="24" rx="4" fill="#9c6a3c" stroke="${INK}" stroke-width="5"/>
    <path d="M130 192h180" stroke="#6b4423" stroke-width="3"/>
    <!-- tocha -->
    <rect x="336" y="232" width="10" height="44" rx="3" fill="#6b4423" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="341" cy="226" r="26" fill="#ffb347" opacity=".25"/>
    <path d="M341 200c8 10 12 16 8 26c-2 6-14 6-16 0c-4-10 0-16 8-26z" fill="#ff9a1f" stroke="${INK}" stroke-width="3"/>
    <path d="M341 212c3 5 5 8 3 12c-1 3-6 3-7 0c-1-4 1-7 4-12z" fill="#ffe36b"/>
    <!-- trilho de mina -->
    <path d="M190 332 L176 352 M250 332 L264 352" stroke="#5a4636" stroke-width="5"/>
    ${pebbles}`
  writeFileSync(new URL('caverna.svg', OUT), svg(w, h, body, `<radialGradient id="deep" cx=".5" cy=".75" r=".7"><stop offset="0" stop-color="#3a2c24"/><stop offset="1" stop-color="#0d0908"/></radialGradient>`))
}

// ---------------- castelo-cripta ----------------
{
  seed = 44
  const w = 420, h = 357
  const stone = '#8d8a95', dark = '#6b6874', light = '#aba8b3'
  const tower = (x, top) => `
    <rect x="${x}" y="${top}" width="78" height="${320 - top}" fill="${stone}" stroke="${INK}" stroke-width="5"/>
    <rect x="${x + 52}" y="${top}" width="26" height="${320 - top}" fill="${dark}"/>
    <path d="M${x - 10} ${top} L${x + 39} ${top - 78} L${x + 88} ${top} Z" fill="#4a4560" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M${x + 39} ${top - 78} L${x + 88} ${top} L${x + 50} ${top} Z" fill="#383450"/>
    <path d="M${x + 39} ${top - 78} v-24" stroke="${INK}" stroke-width="4"/>
    <path d="M${x + 39} ${top - 100} l24 7 l-24 7z" fill="#7d3b8a" stroke="${INK}" stroke-width="3"/>
    <path d="M${x + 39} ${top + 40} v26" stroke="#2c2a33" stroke-width="10" stroke-linecap="round"/>
    <path d="M${x + 39} ${top + 40} v26" stroke="#8fd46a" stroke-width="5" stroke-linecap="round" opacity=".8"/>`
  let bricks = ''
  for (let i = 0; i < 26; i++) {
    const x = 120 + r() * 170, y = 150 + r() * 160
    bricks += `<rect x="${f(x)}" y="${f(y)}" width="${f(18 + r() * 14)}" height="9" rx="2" fill="${r() < 0.5 ? dark : light}" opacity=".6"/>`
  }
  let crenel = ''
  for (let x = 106; x < 316; x += 30) crenel += `<rect x="${x}" y="118" width="20" height="22" fill="${stone}" stroke="${INK}" stroke-width="5"/>`
  const grave = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 16V-6a14 14 0 0 1 28 0V16z" fill="#9a97a2" stroke="${INK}" stroke-width="4"/><path d="M-3 -6h6v4h4v5h-4v8h-6v-8h-4v-5h4z" fill="#6b6874"/></g>`
  const body = `
    <ellipse cx="210" cy="324" rx="200" ry="20" fill="#000" opacity=".22"/>
    <rect x="106" y="138" width="208" height="182" fill="${stone}" stroke="${INK}" stroke-width="5"/>
    <rect x="270" y="138" width="44" height="182" fill="${dark}"/>
    ${bricks}${crenel}
    ${tower(34, 120)}${tower(308, 120)}
    <!-- porta gótica com brilho verde (slimes) -->
    <path d="M160 320 V230 Q160 178 210 168 Q260 178 260 230 V320 Z" fill="#1d1a22" stroke="${INK}" stroke-width="6"/>
    <path d="M174 320 V236 Q174 194 210 186 Q246 194 246 236 V320 Z" fill="url(#slimeglow)"/>
    <path d="M190 320V200M210 320V188M230 320V200M176 250h68M176 286h68" stroke="#3a3542" stroke-width="5"/>
    <!-- janelas -->
    <path d="M136 200 v-18 a12 12 0 0 1 24 0 v18z" fill="#2c2a33" stroke="${INK}" stroke-width="4"/>
    <path d="M260 200 v-18 a12 12 0 0 1 24 0 v18z" fill="#2c2a33" stroke="${INK}" stroke-width="4"/>
    <path d="M140 196 v-12 a8 8 0 0 1 16 0 v12z M264 196 v-12 a8 8 0 0 1 16 0 v12z" fill="#8fd46a" opacity=".55"/>
    <!-- estandartes -->
    <path d="M118 150 h26 v52 l-13 -10 l-13 10z" fill="#7d3b8a" stroke="${INK}" stroke-width="4"/>
    <path d="M276 150 h26 v52 l-13 -10 l-13 10z" fill="#7d3b8a" stroke="${INK}" stroke-width="4"/>
    <path d="M131 162 v20 M289 162 v20" stroke="#e9c46a" stroke-width="4"/>
    <!-- escadinha e túmulos -->
    <rect x="150" y="318" width="120" height="14" rx="3" fill="#a9a6b0" stroke="${INK}" stroke-width="4"/>
    ${grave(70, 322, 1)}${grave(352, 326, 0.9)}${grave(392, 318, 0.75)}${grave(30, 330, 0.8)}`
  writeFileSync(new URL('cripta.svg', OUT), svg(w, h, body, `<radialGradient id="slimeglow" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#7fdc5a" stop-opacity=".9"/><stop offset=".45" stop-color="#2f6b28" stop-opacity=".7"/><stop offset="1" stop-color="#121016"/></radialGradient>`))
}

// ---------------- jardim ----------------
{
  seed = 55
  const w = 440, h = 352
  const hedge = '#3f7f35', hedgeD = '#2f6128', hedgeL = '#5fa64a'
  let leaves = ''
  for (let i = 0; i < 46; i++) {
    const x = 30 + r() * 380, y = 170 + r() * 140
    if (x > 160 && x < 280 && y > 190) continue
    leaves += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(6 + r() * 8)}" fill="${r() < 0.5 ? hedgeL : hedgeD}" opacity=".75"/>`
  }
  const angry = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 0 v-60" stroke="#4f8a2c" stroke-width="10" stroke-linecap="round"/><path d="M0 0 v-60" stroke="${INK}" stroke-width="14" stroke-linecap="round" opacity=".0"/>
      <circle cx="0" cy="-74" r="30" fill="#7da33a" stroke="${INK}" stroke-width="5"/>
      ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${f(Math.cos((a - 90) * Math.PI / 180) * 30)}" cy="${f(-74 + Math.sin((a - 90) * Math.PI / 180) * 30)}" rx="16" ry="24" transform="rotate(${a} ${f(Math.cos((a - 90) * Math.PI / 180) * 30)} ${f(-74 + Math.sin((a - 90) * Math.PI / 180) * 30)})" fill="#f06a2a" stroke="${INK}" stroke-width="4"/>`).join('')}
      <circle cx="0" cy="-74" r="20" fill="#7da33a" stroke="${INK}" stroke-width="4"/>
      <ellipse cx="0" cy="-74" rx="8" ry="11" fill="#1a1412"/><path d="M0 -82 v16" stroke="#f6d24a" stroke-width="3"/>
    </g>`
  const carn = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 0 q-10 -40 6 -70" fill="none" stroke="#4f8a2c" stroke-width="9" stroke-linecap="round"/>
      <path d="M-34 -92 q34 -40 70 0 q-10 26 -36 26 q-26 0 -34 -26z" fill="#d4567a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M-30 -88 q30 18 64 0" fill="none" stroke="${INK}" stroke-width="4"/>
      <circle cx="-8" cy="-104" r="5" fill="#f3c6d3"/><circle cx="12" cy="-110" r="4" fill="#f3c6d3"/>
      <path d="M-22 -86 l4 7 l4 -7 M2 -86 l4 7 l4 -7" fill="#fff" stroke="${INK}" stroke-width="2"/>
    </g>`
  const body = `
    <ellipse cx="220" cy="330" rx="205" ry="18" fill="#000" opacity=".2"/>
    ${angry(110, 190, 1.05)}${carn(330, 196, 1.1)}${angry(380, 170, 0.75)}${carn(60, 180, 0.8)}
    <!-- muro de cerca viva -->
    <path d="M20 330 V200 Q20 170 50 170 H390 Q420 170 420 200 V330 Z" fill="${hedge}" stroke="${INK}" stroke-width="6"/>
    <path d="M20 200 Q20 170 50 170 H390 Q420 170 420 200 V214 H20Z" fill="${hedgeL}" opacity=".6"/>
    ${leaves}
    <!-- arco de pedra com trepadeira -->
    <path d="M150 330 V200 Q150 120 220 120 Q290 120 290 200 V330 H266 V204 Q266 146 220 146 Q174 146 174 204 V330 Z" fill="#b9ad98" stroke="${INK}" stroke-width="5"/>
    <path d="M174 330 V204 Q174 146 220 146 Q266 146 266 204 V330 Z" fill="url(#gardenin)"/>
    <path d="M156 300 q14 -30 0 -60 q-12 -30 8 -60 q20 -30 56 -40 q40 -2 58 30" fill="none" stroke="#3f7f35" stroke-width="6" stroke-linecap="round"/>
    ${[[160, 270], [160, 220], [176, 168], [214, 140], [258, 150]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="${hedgeL}" stroke="${INK}" stroke-width="2.5"/>`).join('')}
    <circle cx="186" cy="156" r="6" fill="#f27aa8" stroke="${INK}" stroke-width="2"/><circle cx="268" cy="176" r="6" fill="#f6d24a" stroke="${INK}" stroke-width="2"/>
    <!-- portão de ferro aberto -->
    <path d="M174 330 V230 L140 246 V338 Z" fill="none" stroke="#2c2a33" stroke-width="5"/>
    <path d="M152 244v92M162 240v92" stroke="#2c2a33" stroke-width="3.5"/>
    <path d="M266 330 V230 L300 246 V338 Z" fill="none" stroke="#2c2a33" stroke-width="5"/>
    <path d="M278 240v92M288 244v92" stroke="#2c2a33" stroke-width="3.5"/>`
  writeFileSync(new URL('jardim.svg', OUT), svg(w, h, body, `<linearGradient id="gardenin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6128"/><stop offset="1" stop-color="#8cc063"/></linearGradient>`))
}

// ---------------- barraca da loja ----------------
{
  seed = 66
  const w = 320, h = 256
  let stripes = ''
  for (let i = 0; i < 8; i++) stripes += `<path d="M${30 + i * 32} 70 L${46 + i * 32} 70 L${50 + i * 32} 118 L${30 + i * 32} 118 Z" fill="${i % 2 ? '#f3e3c3' : '#c8453c'}"/>`
  let scallop = ''
  for (let i = 0; i < 9; i++) scallop += `<path d="M${22 + i * 31} 116 q15 22 31 0" fill="${i % 2 ? '#f3e3c3' : '#c8453c'}" stroke="${INK}" stroke-width="4"/>`
  const bottle = (x, y, c, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="-26" width="8" height="10" fill="#8a5a32" stroke="${INK}" stroke-width="2.5"/><path d="M-10 -16 h20 v4 a12 12 0 1 1 -20 0z" fill="${c}" stroke="${INK}" stroke-width="3"/><circle cx="-3" cy="-4" r="3" fill="#fff" opacity=".6"/></g>`
  const body = `
    <ellipse cx="160" cy="236" rx="150" ry="16" fill="#000" opacity=".22"/>
    <!-- postes -->
    <rect x="34" y="76" width="14" height="160" rx="3" fill="#8a5a32" stroke="${INK}" stroke-width="4"/>
    <rect x="272" y="76" width="14" height="160" rx="3" fill="#8a5a32" stroke="${INK}" stroke-width="4"/>
    <!-- toldo listrado -->
    <path d="M14 118 L40 60 H280 L306 118 Z" fill="#c8453c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${stripes}
    <path d="M14 118 L40 60 H280 L306 118 Z" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${scallop}
    <!-- placa com moeda -->
    <path d="M160 60 V34" stroke="${INK}" stroke-width="4"/>
    <circle cx="160" cy="26" r="20" fill="#ffd25a" stroke="${INK}" stroke-width="4"/><circle cx="160" cy="26" r="12" fill="none" stroke="#c98a1a" stroke-width="3"/>
    <!-- balcão -->
    <rect x="40" y="168" width="240" height="68" rx="6" fill="#a0703f" stroke="${INK}" stroke-width="5"/>
    <rect x="32" y="158" width="256" height="18" rx="5" fill="#bf8a52" stroke="${INK}" stroke-width="5"/>
    <path d="M60 190 h200 M60 212 h200" stroke="#7d5330" stroke-width="3"/>
    ${bottle(80, 158, '#e0474c')}${bottle(108, 158, '#e0474c', 1.2)}${bottle(140, 158, '#4a7fd6', 0.9)}
    <!-- espada e cutelo no balcão -->
    <path d="M190 156 l60 -40" stroke="#cfd6e6" stroke-width="7" stroke-linecap="round"/><path d="M190 156 l60 -40" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
    <path d="M184 160 l14 -9 M188 150 l6 10" stroke="#6b4423" stroke-width="6" stroke-linecap="round"/>
    <!-- caixotes e saco -->
    <rect x="252" y="196" width="50" height="42" rx="3" fill="#b07a45" stroke="${INK}" stroke-width="4"/><path d="M252 196 l50 42 M302 196 l-50 42" stroke="#7d5330" stroke-width="3"/>
    <path d="M10 238 q-6 -40 22 -46 q28 6 22 46z" fill="#d8c49a" stroke="${INK}" stroke-width="4"/><path d="M22 196 q10 6 20 0" stroke="${INK}" stroke-width="3" fill="none"/>`
  writeFileSync(new URL('shop.svg', OUT), svg(w, h, body))
}

console.log('overworld ok')
