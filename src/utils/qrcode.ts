/*
 * 無相依套件的 QR Code 產生器（只支援 byte 模式，用於員工雙因素綁定的 otpauth:// 連結）。
 * 演算法移植自 Project Nayuki 的 QR Code generator library（MIT License）：
 *   Copyright (c) Project Nayuki. (MIT License) https://www.nayuki.io/page/qr-code-generator-library
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 *   documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 *   the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright
 *   notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 * 為了不新增 npm 套件（package-lock.json 為受保護路徑）而內建。
 */

export type Ecc = 'L' | 'M' | 'Q' | 'H'
const ECC_ORDINAL: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 }
const ECC_FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 }

const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
]
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
]

const getBit = (x: number, i: number) => ((x >>> i) & 1) !== 0

export function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}
export function numDataCodewords(ver: number, ecl: Ecc): number {
  const o = ECC_ORDINAL[ecl]
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[o][ver] * NUM_ERROR_CORRECTION_BLOCKS[o][ver]
}
export function alignmentPositions(ver: number): number[] {
  if (ver === 1) return []
  const numAlign = Math.floor(ver / 7) + 2, size = ver * 4 + 17
  const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2
  const result = [6]
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos)
  return result
}

function rsMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x }
  return z & 0xFF
}
function rsDivisor(degree: number): number[] {
  const result: number[] = []
  for (let i = 0; i < degree - 1; i++) result.push(0)
  result.push(1)
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = rsMultiply(root, 0x02)
  }
  return result
}
function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => { result[i] ^= rsMultiply(coef, factor) })
  }
  return result
}

export interface QrMatrix { version: number; size: number; mask: number; ecl: Ecc; modules: boolean[][] }

/** 產生 QR 矩陣（UTF-8 byte 模式，自動選擇最小版本與遮罩）。 */
export function encodeQr(text: string, ecl: Ecc = 'M'): QrMatrix {
  const bytes = Array.from(new TextEncoder().encode(text))
  let version = 1
  for (; ; version++) {
    if (version > 40) throw new Error('資料太長，無法產生 QR code')
    const ccBits = version <= 9 ? 8 : 16
    if (bytes.length < (1 << ccBits) && 4 + ccBits + bytes.length * 8 <= numDataCodewords(version, ecl) * 8) break
  }
  // 資料位元：模式 0100、字數、資料、結束符、補位
  const bits: number[] = []
  const append = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  append(0x4, 4); append(bytes.length, version <= 9 ? 8 : 16); bytes.forEach(b => append(b, 8))
  const capacity = numDataCodewords(version, ecl) * 8
  append(0, Math.min(4, capacity - bits.length))
  append(0, (8 - bits.length % 8) % 8)
  for (let pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) append(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))

  const size = version * 4 + 17
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const isFunction = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const setFunction = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; isFunction[y][x] = true }

  // 功能圖形
  for (let i = 0; i < size; i++) { setFunction(6, i, i % 2 === 0); setFunction(i, 6, i % 2 === 0) }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFunction(xx, yy, dist !== 2 && dist !== 4)
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)
  const align = alignmentPositions(version), n = align.length
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunction(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }
  const drawFormat = (mask: number) => {
    const d = (ECC_FORMAT_BITS[ecl] << 3) | mask
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const fb = ((d << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) setFunction(8, i, getBit(fb, i))
    setFunction(8, 7, getBit(fb, 6)); setFunction(8, 8, getBit(fb, 7)); setFunction(7, 8, getBit(fb, 8))
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, getBit(fb, i))
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, getBit(fb, i))
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, getBit(fb, i))
    setFunction(8, size - 8, true)
  }
  drawFormat(0)
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25)
    const vb = (version << 12) | rem
    for (let i = 0; i < 18; i++) { const bit = getBit(vb, i), a = size - 11 + i % 3, b = Math.floor(i / 3); setFunction(a, b, bit); setFunction(b, a, bit) }
  }

  // 錯誤更正碼與交錯
  const o = ECC_ORDINAL[ecl], numBlocks = NUM_ERROR_CORRECTION_BLOCKS[o][version], eccLen = ECC_CODEWORDS_PER_BLOCK[o][version]
  const rawCodewords = Math.floor(numRawDataModules(version) / 8), numShort = numBlocks - rawCodewords % numBlocks, shortLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(eccLen), blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1)); k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((blk, j) => { if (i !== shortLen - eccLen || j >= numShort) codewords.push(blk[i]) })

  // 之字形填入資料
  let idx = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert
      if (!isFunction[y][x] && idx < codewords.length * 8) { modules[y][x] = getBit(codewords[idx >>> 3], 7 - (idx & 7)); idx++ }
    }
  }

  // 遮罩：逐一試 8 種，取扣分最低者
  const invert = (mask: number, x: number, y: number) => {
    switch (mask) {
      case 0: return (x + y) % 2 === 0
      case 1: return y % 2 === 0
      case 2: return x % 3 === 0
      case 3: return (x + y) % 3 === 0
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
      case 5: return x * y % 2 + x * y % 3 === 0
      case 6: return (x * y % 2 + x * y % 3) % 2 === 0
      default: return ((x + y) % 2 + x * y % 3) % 2 === 0
    }
  }
  const applyMask = (mask: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y][x] && invert(mask, x, y)) modules[y][x] = !modules[y][x] }
  let best = 0, bestPenalty = Infinity
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask); drawFormat(mask)
    const p = penalty(modules)
    if (p < bestPenalty) { best = mask; bestPenalty = p }
    applyMask(mask)   // 再套一次即還原
  }
  applyMask(best); drawFormat(best)
  return { version, size, mask: best, ecl, modules }
}

/** 遮罩扣分（ISO/IEC 18004 規則 1–4 的簡化版本；只影響選哪個遮罩，任何遮罩都可被正確解碼）。 */
function penalty(m: boolean[][]): number {
  const size = m.length
  let result = 0
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < size; a++) {
    let run = 1
    for (let b = 1; b <= size; b++) {
      const same = b < size && (pass === 0 ? m[a][b] === m[a][b - 1] : m[b][a] === m[b - 1][a])
      if (same) run++
      else { if (run >= 5) result += 3 + (run - 5); run = 1 }
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = m[y][x]
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3
  }
  const pattern = [true, false, true, true, true, false, true]
  for (let y = 0; y < size; y++) for (let x = 0; x + 7 <= size; x++) {
    let row = true, col = true
    for (let k = 0; k < 7; k++) { if (m[y][x + k] !== pattern[k]) row = false; if (m[x + k][y] !== pattern[k]) col = false }
    if (row) result += 40; if (col) result += 40
  }
  let dark = 0
  for (const r of m) for (const c of r) if (c) dark++
  const total = size * size
  result += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10
  return result
}

/** 轉成 SVG 字串（含 4 格靜區），可直接放進 v-html 或 data URL。 */
export function qrSvg(text: string, ecl: Ecc = 'M', border = 4): string {
  const q = encodeQr(text, ecl), dim = q.size + border * 2
  const parts: string[] = []
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) parts.push(`M${x + border},${y + border}h1v1h-1z`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img"><rect width="100%" height="100%" fill="#fff"/><path d="${parts.join('')}" fill="#000"/></svg>`
}
