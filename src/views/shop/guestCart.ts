import { computed, ref } from 'vue'
import { getCart, setCartItem, type CartView } from '@/api/shopping'
import { CustomerApiError } from '@/api/customer'

/*
 * 訪客購物車：未登入時先把款式放在這台瀏覽器（localStorage），結帳時才要求登入。
 * 只保存 skuId／productId／數量，不保存價格；價格與可售狀態一律以伺服器為準。
 * 登入後合併進本人伺服器購物車（同款數量相加，上限 99），每一步都帶整車版本，
 * 回應未確認時不自動重送，停下並保留尚未合併的款式。
 */
// pending：已送出合併寫入但尚未確認結果（見 mergeGuestCart）
export interface GuestLine { skuId: string; productId: string; quantity: number; pending?: boolean }
const KEY = 'figura.guestCart.v1'
export const MAX_QTY = 99
export const MAX_LINES = 30

function read(): GuestLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((l: any) => typeof l?.skuId === 'string' && typeof l?.productId === 'string' && Number.isInteger(l?.quantity) && l.quantity >= 1)
      .map((l: any) => ({ skuId: l.skuId, productId: l.productId, quantity: Math.min(MAX_QTY, l.quantity), ...(l.pending === true ? { pending: true } : {}) }))
      .slice(0, MAX_LINES)
  } catch { return [] }
}
function write(lines: GuestLine[]) {
  guestLines.value = lines
  try { lines.length ? localStorage.setItem(KEY, JSON.stringify(lines)) : localStorage.removeItem(KEY) } catch { /* 無痕或停用儲存時只留在記憶體 */ }
}

export const guestLines = ref<GuestLine[]>(read())
export const guestCount = computed(() => guestLines.value.reduce((n, l) => n + l.quantity, 0))
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === KEY) guestLines.value = read() })

/** 加入訪客購物車；回傳加入後該款數量。超過上限丟出錯誤訊息。 */
export function addGuest(productId: string, skuId: string, quantity: number) {
  const lines = [...guestLines.value]
  const found = lines.find(l => l.skuId === skuId)
  const total = (found?.quantity || 0) + quantity
  if (!Number.isInteger(quantity) || quantity < 1 || total > MAX_QTY) throw new Error(`同款式最多 ${MAX_QTY} 件，請核對購物車數量。`)
  if (!found && lines.length >= MAX_LINES) throw new Error(`購物車最多 ${MAX_LINES} 種款式，請先結帳或移除部分款式。`)
  if (found) found.quantity = total; else lines.push({ skuId, productId, quantity })
  write(lines.map(l => ({ ...l })))
  return total
}
export function setGuest(skuId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) throw new Error(`數量需為 1–${MAX_QTY} 件。`)
  write(guestLines.value.map(l => l.skuId === skuId ? { ...l, quantity } : l))
}
export function removeGuest(skuId: string) { write(guestLines.value.filter(l => l.skuId !== skuId)) }

/** 伺服器購物車件數（登入時），供頁首顯示；由購物車相關頁面更新。 */
export const serverCount = ref<number | null>(null)
export const countOf = (cart: CartView) => cart.items.reduce((n, i) => n + i.quantity, 0)

export interface MergeIssue { skuId: string; productId: string; quantity: number; reason: string }
export interface MergeResult { merged: number; skipped: MergeIssue[]; uncertain: MergeIssue[]; error?: string }
/** 最近一次合併的結果，購物車頁顯示用（登入頁合併後導回購物車時）。 */
export const lastMerge = ref<MergeResult | null>(null)
let merging: Promise<MergeResult> | null = null
const LOGIN_LOST = '登入狀態已失效，訪客購物車保留在這台裝置，請重新登入。'
const READ_FAILED = '暫時無法讀取你的購物車，訪客購物車已保留，下次開啟購物車會再合併。'
const UNCERTAIN = '有款式的合併結果未確認，請核對下方購物車數量；其餘尚未合併的款式仍保留在這台裝置。'

function setPending(skuId: string, pending: boolean) {
  write(guestLines.value.map(l => l.skuId === skuId ? { ...l, pending } : l))
}
const issue = (l: GuestLine, reason: string): MergeIssue => ({ skuId: l.skuId, productId: l.productId, quantity: l.quantity, reason })

/**
 * 把訪客購物車合併進已登入顧客的伺服器購物車（同款數量相加，上限 99）。
 * - 跨分頁：用 Web Locks 讓同一瀏覽器同時只有一個分頁在合併，並在鎖內重讀 localStorage 的最新內容。
 * - 每款寫入前先標記 pending；寫入成功才移除。若分頁在「已送出、未確認」時被關閉，下次看到 pending
 *   不會再自動相加（可能已寫入），改列為待核對，避免數量重複。
 * - 讀取購物車失敗：什麼都沒寫入，保留全部訪客款式，之後再合併。
 * - 409：重讀後整車版本不同才是「別處剛更新」，重試一次；版本相同代表款式本身的問題
 *   （下架、庫存不足、款式數上限），列出原因並繼續處理其他款式。
 * - 400／404／422：伺服器明確拒絕、未寫入，列出原因並繼續。
 * - 網路錯誤或 5xx：結果未知，不自動重送；該款列為待核對並停止，其餘保留下次合併。
 */
export function mergeGuestCart(): Promise<MergeResult> {
  if (merging) return merging
  const locks = (typeof navigator !== 'undefined' ? (navigator as any).locks : undefined)
  const run = () => doMerge()
  merging = (locks?.request ? locks.request('figura-guest-cart-merge', run) as Promise<MergeResult> : run())
    .finally(() => { merging = null })
  return merging
}

async function doMerge(): Promise<MergeResult> {
  const result: MergeResult = { merged: 0, skipped: [], uncertain: [] }
  const finish = () => {
    if (result.merged || result.skipped.length || result.uncertain.length || result.error) lastMerge.value = result
    return result
  }
  guestLines.value = read()
  for (const l of guestLines.value.filter(l => l.pending)) {
    result.uncertain.push(issue(l, '上次合併被中斷，請核對購物車數量'))
    removeGuest(l.skuId)
  }
  for (const line of guestLines.value.filter(l => !l.pending)) {
    let retried = false
    for (;;) {
      let cart: CartView
      try { cart = await getCart() }
      catch (e) { result.error = e instanceof CustomerApiError && e.status === 401 ? LOGIN_LOST : READ_FAILED; return finish() }
      const current = cart.items.find(i => i.skuId === line.skuId)?.quantity || 0
      const target = Math.min(MAX_QTY, current + line.quantity)
      if (target === current) { removeGuest(line.skuId); result.merged++; break }
      setPending(line.skuId, true)
      try {
        serverCount.value = countOf(await setCartItem(line.skuId, target, cart.version))
        removeGuest(line.skuId); result.merged++; break
      } catch (e) {
        if (!(e instanceof CustomerApiError) || e.status >= 500) {
          removeGuest(line.skuId)
          result.uncertain.push(issue(line, '合併結果未確認，請核對購物車數量'))
          result.error = UNCERTAIN
          return finish()
        }
        setPending(line.skuId, false)
        if (e.status === 401) { result.error = LOGIN_LOST; return finish() }
        if (e.status === 409 && !retried) {
          const now = await getCart().catch(() => null)
          if (now && now.version !== cart.version) { retried = true; continue }
        }
        removeGuest(line.skuId)
        result.skipped.push(issue(line, e.message || '無法加入購物車'))
        break
      }
    }
  }
  return finish()
}

/* 登入後回到原頁：存在 sessionStorage（不放網址，避免改變 /shop/login 路徑），30 分鐘內有效。 */
const RETURN_KEY = 'figura.loginReturn.v1'
export function rememberReturn(path: string) {
  if (!path.startsWith('/shop/') || path.startsWith('//') || path.startsWith('/shop/login') || path.startsWith('/shop/register') || path.startsWith('/shop/reset-password') || path.startsWith('/shop/verify-email') || path.startsWith('/shop/forgot-password')) return
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, at: Date.now() })) } catch { /* ignore */ }
}
export function takeReturn(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY)
    if (!raw) return null
    const { path, at } = JSON.parse(raw)
    return typeof path === 'string' && path.startsWith('/shop/') && !path.startsWith('//') && Date.now() - at < 30 * 60_000 ? path : null
  } catch { return null }
}
