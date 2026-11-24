// Gera o áudio original do jogo por síntese (sem samples de terceiros):
//   music/trilha.mp3                — tema do menu (loop sem emenda)
//   sfx/construction-<bioma>.mp3    — construção da estrada (poeira / pedrinhas / grama)
//   sfx/impact-<bioma>.mp3          — chegada da trilha na onda
// Uso: node scripts/gen-audio.mjs   (precisa de ffmpeg)
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const SR = 44100
const OUT = new URL('../public/assets/audio/', import.meta.url).pathname
mkdirSync(OUT + 'music', { recursive: true })
mkdirSync(OUT + 'sfx', { recursive: true })

// ---------- utilidades ----------
let seed = 12345
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const noise = () => rand() * 2 - 1
const midi = (m) => 440 * 2 ** ((m - 69) / 12)

function writeMp3(samples, path, bitrate = '128k') {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  const k = peak > 0 ? 0.89 / peak : 1
  const pcm = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * k)) * 32767), i * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  const wav = path.replace(/\.mp3$/, '.wav')
  writeFileSync(wav, Buffer.concat([header, pcm]))
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', bitrate, path])
  rmSync(wav)
}

/** filtro passa-baixa de 1 polo (in place) */
function lowpass(buf, hz) {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / SR)
  let y = 0
  for (let i = 0; i < buf.length; i++) buf[i] = y += a * (buf[i] - y)
  return buf
}
function highpass(buf, hz) {
  const lp = lowpass(Float32Array.from(buf), hz)
  for (let i = 0; i < buf.length; i++) buf[i] -= lp[i]
  return buf
}

/** reverb de Schroeder simples (4 combs + 2 allpass) */
function reverb(dry, mix = 0.22, size = 1) {
  const combs = [1557, 1617, 1491, 1422].map((n) => Math.round(n * size))
  const out = new Float32Array(dry.length)
  for (const d of combs) {
    const buf = new Float32Array(d)
    let idx = 0
    let lp = 0
    for (let i = 0; i < dry.length; i++) {
      const y = buf[idx]
      lp = y * 0.8 + lp * 0.2
      buf[idx] = dry[i] + lp * 0.8
      out[i] += y / combs.length
      idx = (idx + 1) % d
    }
  }
  for (const d of [225, 556]) {
    const buf = new Float32Array(d)
    let idx = 0
    for (let i = 0; i < out.length; i++) {
      const b = buf[idx]
      const x = out[i]
      const y = -x + b
      buf[idx] = x + b * 0.5
      out[i] = y
      idx = (idx + 1) % d
    }
  }
  const res = new Float32Array(dry.length)
  for (let i = 0; i < dry.length; i++) res[i] = dry[i] * (1 - mix) + out[i] * mix * 2.2
  return res
}

/** corda dedilhada (Karplus-Strong) somada em `buf` */
function pluck(buf, t, freq, dur, amp, bright = 0.5) {
  const start = Math.round(t * SR)
  const n = Math.round(dur * SR)
  const N = Math.max(2, Math.round(SR / freq))
  const ring = new Float32Array(N)
  for (let i = 0; i < N; i++) ring[i] = noise()
  lowpass(ring, 2000 + bright * 6000)
  let idx = 0
  const decay = 0.9985
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const next = (idx + 1) % N
    const v = ring[idx]
    ring[idx] = decay * 0.5 * (ring[idx] + ring[next])
    idx = next
    const env = Math.min(1, i / 40) * (i > n - 2000 ? (n - i) / 2000 : 1)
    buf[start + i] += v * amp * env
  }
}

/** voz soprada (flauta suave) */
function flute(buf, t, freq, dur, amp) {
  const start = Math.round(t * SR)
  const n = Math.round(dur * SR)
  let ph = 0
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const tt = i / SR
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * tt) * Math.min(1, tt / 0.3)
    ph += (2 * Math.PI * freq * vib) / SR
    const env = Math.min(1, tt / 0.07) * Math.min(1, (n - i) / (0.12 * SR))
    const breath = noise() * 0.03
    buf[start + i] += (Math.sin(ph) + 0.18 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph) + breath) * amp * env
  }
}

function sine(buf, t, freq, dur, amp, attack = 0.02, release = 0.2) {
  const start = Math.round(t * SR)
  const n = Math.round(dur * SR)
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const tt = i / SR
    const env = Math.min(1, tt / attack) * Math.min(1, (n - i) / (release * SR))
    buf[start + i] += (Math.sin(2 * Math.PI * freq * tt) + 0.25 * Math.sin(4 * Math.PI * freq * tt)) * amp * env
  }
}

// ---------- tema do menu ----------
{
  seed = 7
  const BPM = 84
  const beat = 60 / BPM
  const bar = beat * 4
  // ré menor: Dm Bb C Am | Dm Gm A Dm (2 voltas: a 2ª com melodia)
  const chords = [
    [50, [0, 3, 7]], [46, [0, 4, 7]], [48, [0, 4, 7]], [45, [0, 3, 7]],
    [50, [0, 3, 7]], [43, [0, 3, 7]], [45, [0, 4, 7]], [50, [0, 3, 7]],
  ]
  const melody = [
    [[0, 1.5, 74], [1.5, 0.5, 76], [2, 1, 77], [3, 1, 76]],
    [[0, 2, 74], [2, 1, 70], [3, 1, 72]],
    [[0, 1.5, 72], [1.5, 0.5, 74], [2, 1, 76], [3, 1, 79]],
    [[0, 3, 76], [3, 1, 72]],
    [[0, 1, 74], [1, 1, 77], [2, 1, 81], [3, 1, 79]],
    [[0, 2, 77], [2, 1, 74], [3, 1, 79]],
    [[0, 1.5, 76], [1.5, 0.5, 77], [2, 2, 73]],
    [[0, 4, 74]],
  ]
  const bars = 16
  const loopLen = bars * bar
  const tail = 4
  const buf = new Float32Array(Math.round((loopLen + tail) * SR))
  const arp = [0, 2, 3, 1, 2, 3, 2, 1] // índices em [raiz, 3ª/5ª..., oitava]
  for (let b = 0; b < bars; b++) {
    const [root, iv] = chords[b % 8]
    const t0 = b * bar
    const tones = [root, root + iv[1], root + iv[2], root + 12, root + 12 + iv[1]]
    // dedilhado em colcheias
    arp.forEach((k, j) => pluck(buf, t0 + j * (beat / 2) + (rand() - 0.5) * 0.008, midi(tones[k] + 12), beat * 1.6, j === 0 ? 0.5 : 0.4, 0.4))
    // baixo nos tempos 1 e 3
    sine(buf, t0, midi(root - 12), beat * 1.9, 0.09, 0.03, 0.4)
    sine(buf, t0 + 2 * beat, midi(root - 12 + (b % 2 ? 7 : 0)), beat * 1.9, 0.07, 0.03, 0.4)
    // pad suave
    for (const m of [root + 12 + iv[1], root + 12 + iv[2]]) sine(buf, t0, midi(m) * 1.002, bar * 1.05, 0.06, 0.5, 0.5)
    // melodia na segunda volta
    if (b >= 8) for (const [s, d, m] of melody[b - 8]) flute(buf, t0 + s * beat, midi(m), d * beat * 0.95, 0.16)
  }
  const wet = reverb(buf, 0.28, 1.1)
  // loop sem emenda: a cauda volta para o início
  const out = new Float32Array(Math.round(loopLen * SR))
  for (let i = 0; i < wet.length; i++) out[i % out.length] += wet[i]
  writeMp3(out, OUT + 'music/trilha.mp3', '128k')
}

// ---------- construção da estrada ----------
const LEN = 1.2

function thud(buf, t, f0, f1, dur, amp) {
  const start = Math.round(t * SR)
  const n = Math.round(dur * SR)
  let ph = 0
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const k = i / n
    ph += (2 * Math.PI * (f0 + (f1 - f0) * k)) / SR
    buf[start + i] += Math.sin(ph) * amp * Math.exp(-k * 5) * Math.min(1, i / 60)
  }
}
function click(buf, t, f, decay, amp) {
  const start = Math.round(t * SR)
  const n = Math.round(decay * 6 * SR)
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const tt = i / SR
    buf[start + i] += (Math.sin(2 * Math.PI * f * tt) * 0.7 + noise() * 0.3 * Math.exp(-tt / 0.002)) * amp * Math.exp(-tt / decay)
  }
}
function noiseBurst(dur, lp, hp) {
  const b = new Float32Array(Math.round(dur * SR))
  for (let i = 0; i < b.length; i++) b[i] = noise()
  if (lp) lowpass(b, lp)
  if (hp) highpass(b, hp)
  return b
}

// Caverna: arrasto de terra + poeira (ruído grave granulado)
{
  seed = 101
  const buf = noiseBurst(LEN, 900, 60)
  let g = 0
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR
    if (i % 900 === 0) g = 0.5 + rand() * 0.5
    const env = Math.min(1, t / 0.06) * (0.85 + 0.15 * Math.sin(t * 40)) * g
    buf[i] *= env
  }
  writeMp3(reverb(buf, 0.18, 0.7), OUT + 'sfx/construction-caverna.mp3', '96k')
  const imp = new Float32Array(Math.round(0.6 * SR))
  thud(imp, 0, 85, 40, 0.35, 0.9)
  const puff = noiseBurst(0.45, 600, 50)
  for (let i = 0; i < puff.length; i++) imp[i] += puff[i] * Math.exp(-i / SR / 0.12) * 0.6
  writeMp3(reverb(imp, 0.2, 0.7), OUT + 'sfx/impact-caverna.mp3', '96k')
}

// Cripta: pedrinhas batendo (cliques ressonantes) + raspado de pedra
{
  seed = 202
  const buf = noiseBurst(LEN, 2500, 300)
  for (let i = 0; i < buf.length; i++) buf[i] *= 0.18 * Math.min(1, i / SR / 0.05)
  let t = 0.02
  while (t < LEN - 0.05) {
    click(buf, t, 1600 + rand() * 3200, 0.006 + rand() * 0.012, 0.5 + rand() * 0.5)
    t += 0.02 + rand() * 0.06
  }
  writeMp3(reverb(buf, 0.22, 0.6), OUT + 'sfx/construction-cripta.mp3', '96k')
  const imp = new Float32Array(Math.round(0.6 * SR))
  thud(imp, 0, 120, 60, 0.2, 0.6)
  for (let k = 0; k < 7; k++) click(imp, 0.01 + rand() * 0.18, 1800 + rand() * 3000, 0.008 + rand() * 0.01, 0.7)
  writeMp3(reverb(imp, 0.25, 0.6), OUT + 'sfx/impact-cripta.mp3', '96k')
}

// Jardim: farfalhar de grama (ruído agudo em rajadas) + torrões
{
  seed = 303
  const buf = noiseBurst(LEN, 9000, 1800)
  const env = new Float32Array(buf.length)
  let t = 0
  while (t < LEN) {
    const s = Math.round(t * SR)
    const d = Math.round((0.08 + rand() * 0.1) * SR)
    const a = 0.5 + rand() * 0.5
    for (let i = 0; i < d && s + i < env.length; i++) env[s + i] = Math.max(env[s + i], a * Math.sin((Math.PI * i) / d))
    t += 0.06 + rand() * 0.09
  }
  for (let i = 0; i < buf.length; i++) buf[i] *= env[i]
  for (let k = 0; k < 4; k++) thud(buf, 0.1 + rand() * 0.9, 140, 80, 0.08, 0.25)
  writeMp3(reverb(buf, 0.15, 0.5), OUT + 'sfx/construction-jardim.mp3', '96k')
  const imp = new Float32Array(Math.round(0.6 * SR))
  thud(imp, 0, 100, 55, 0.25, 0.6)
  const rustle = noiseBurst(0.4, 8000, 2000)
  for (let i = 0; i < rustle.length; i++) imp[i] += rustle[i] * Math.exp(-i / SR / 0.1) * 0.7
  writeMp3(reverb(imp, 0.2, 0.5), OUT + 'sfx/impact-jardim.mp3', '96k')
}

console.log('audio ok')
