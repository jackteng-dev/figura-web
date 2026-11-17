import { computed, ref } from 'vue'
import { getCart, setCartItem, type CartView } from '@/api/shopping'
import { CustomerApiError } from '@/api/customer'

/*
 * 訪客購物車：未登入時先把款式放在這台瀏覽器（localStorage），結帳時才要求登入。
 * 只保存 skuId／productId／數量，不保存價格；價格與可售狀態一律以伺服器為準。
 * 登入後合併進本人伺服器購物車（同款數量相加，上限 99），每一步都帶整車版本，
 * 回應未確認時不自動重送，停下並保留尚未合併的款式。
 */
// pending：已送出合併寫入但尚未確認結果（見 mergeGuestCart）；pendingFor：當時合併到哪位會員
export interface GuestLine { skuId: string; productId: string; quantity: number; pending?: boolean; pendingFor?: string }
const KEY = 'figura.guestCart.v1'
export const MAX_QTY = 99
export const MAX_LINES = 30

function read(): GuestLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((l: any) => typeof l?.skuId === 'string' && typeof l?.productId === 'string' && Number.isInteger(l?.quantity) && l.quantity >= 1)
      .map((l: any) => ({ skuId: l.skuId, productId: l.productId, quantity: Math.min(MAX_QTY, l.quantity), ...(l.pending === true ? { pending: true, ...(typeof l.pendingFor === 'string' ? { pendingFor: l.pendingFor } : {}) } : {}) }))
      .slice(0, MAX_LINES)
  } catch { return [] }
}
function write(lines: GuestLine[]) {
  guestLines.value = lines
  try { lines.length ? localStorage.setItem(KEY, JSON.stringify(lines)) : localStorage.removeItem(KEY) } catch { /* 無痕或停用儲存時只留在記憶體 */ }
}

export const guestLines = ref<GuestLine[]>(read())
/** 重新讀取 localStorage（登入前呼叫，取得其他分頁或上次中斷留下的最新內容）。 */
export function reloadGuest() { guestLines.value = read() }
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
/*
 * 合併紀錄（每位會員分開保存在 localStorage，直到該會員在購物車頁按「我已了解」）：
 * - uncertain：合併結果未確認（可能已寫入），請顧客核對數量。
 * - skipped：沒有加入購物車的款式與原因（下架、庫存不足…）。
 * 寫入時一律先重讀 localStorage 再合併，並透過 storage 事件同步其他分頁，避免互相覆蓋。
 */
export interface ReviewItem extends MergeIssue { kind: 'uncertain' | 'skipped'; at: number }
const REVIEW_PREFIX = 'figura.guestCart.review.v2.'
let reviewOwner = ''
// 寫入 localStorage 失敗（空間不足、停用儲存）時只存在記憶體的紀錄，之後寫入時一併保留，不會被下一筆蓋掉
const unsaved = new Map<string, ReviewItem[]>()
const reviewKey = (customerId: string) => REVIEW_PREFIX + customerId
function readReview(customerId: string): ReviewItem[] {
  try {
    const r = JSON.parse(localStorage.getItem(reviewKey(customerId)) || '[]')
    return Array.isArray(r) ? r.filter((x: any) => typeof x?.skuId === 'string' && (x.kind === 'uncertain' || x.kind === 'skipped')) : []
  } catch { return [] }
}
export const reviewItems = ref<ReviewItem[]>([])
/** 切換到目前登入的會員；之後顯示與清除都只針對這位會員。 */
export function loadReview(customerId: string) {
  reviewOwner = customerId
  reviewItems.value = customerId ? (unsaved.get(customerId) || readReview(customerId)) : []
  try { localStorage.removeItem('figura.guestCart.review.v1') } catch { /* 舊版共用清單，不再使用 */ }
}
function addReview(customerId: string, item: ReviewItem) {
  const same = (a: ReviewItem, b: ReviewItem) => a.kind === b.kind && a.skuId === b.skuId
  const pendingMem = unsaved.get(customerId) || []
  const base = [...readReview(customerId), ...pendingMem.filter(m => !readReview(customerId).some(r => same(r, m)))]
  const next = [...base.filter(r => !same(r, item)), item]
  try { localStorage.setItem(reviewKey(customerId), JSON.stringify(next)); unsaved.delete(customerId) }
  catch { unsaved.set(customerId, next) }
  if (reviewOwner === customerId) reviewItems.value = next
}
export function clearReview() {
  if (!reviewOwner) return
  try { localStorage.removeItem(reviewKey(reviewOwner)) } catch { /* ignore */ }
  unsaved.delete(reviewOwner)
  reviewItems.value = []
}
if (typeof window !== 'undefined') window.addEventListener('storage', e => {
  if (reviewOwner && e.key === reviewKey(reviewOwner)) reviewItems.value = readReview(reviewOwner)
})
/** 最近一次合併的結果，購物車頁顯示用（登入頁合併後導回購物車時）。 */
export const lastMerge = ref<MergeResult | null>(null)
let merging: Promise<MergeResult> | null = null
const LOGIN_LOST = '登入狀態已失效，訪客購物車保留在這台裝置，請重新登入。'
const READ_FAILED = '暫時無法讀取你的購物車，訪客購物車已保留，下次開啟購物車會再合併。'
const UNCERTAIN = '有款式的合併結果未確認，請核對下方購物車數量；其餘尚未合併的款式仍保留在這台裝置。'
const BUSY = '購物車剛被其他地方更新，尚未合併的款式仍保留在這台裝置，稍後開啟購物車會再合併。'

function setPending(skuId: string, pending: boolean, customerId?: string) {
  write(guestLines.value.map(l => l.skuId === skuId ? (pending ? { ...l, pending: true, pendingFor: customerId } : { skuId: l.skuId, productId: l.productId, quantity: l.quantity }) : l))
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
export function mergeGuestCart(customerId: string): Promise<MergeResult> {
  if (merging) return merging
  const locks = (typeof navigator !== 'undefined' ? (navigator as any).locks : undefined)
  const run = () => doMerge(customerId)
  merging = (locks?.request ? locks.request('figura-guest-cart-merge', run) as Promise<MergeResult> : run())
    .finally(() => { merging = null })
  return merging
}

async function doMerge(customerId: string): Promise<MergeResult> {
  const result: MergeResult = { merged: 0, skipped: [], uncertain: [] }
  const finish = () => {
    if (result.merged || result.skipped.length || result.uncertain.length || result.error) lastMerge.value = result
    return result
  }
  guestLines.value = read()
  for (const l of guestLines.value.filter(l => l.pending)) {
    const it = issue(l, '上次合併被中斷，請核對購物車數量')
    // 記在當時合併的那位會員名下（可能不是現在登入的會員）
    const owner = l.pendingFor || customerId
    if (owner === customerId) result.uncertain.push(it)
    addReview(owner, { ...it, kind: 'uncertain', at: Date.now() })
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
      setPending(line.skuId, true, customerId)
      try {
        serverCount.value = countOf(await setCartItem(line.skuId, target, cart.version))
        removeGuest(line.skuId); result.merged++; break
      } catch (e) {
        if (!(e instanceof CustomerApiError) || e.status >= 500) {
          const it = issue(line, '合併結果未確認，請核對購物車數量')
          result.uncertain.push(it); addReview(customerId, { ...it, kind: 'uncertain', at: Date.now() })
          removeGuest(line.skuId)
          result.error = UNCERTAIN
          return finish()
        }
        setPending(line.skuId, false)
        if (e.status === 401) { result.error = LOGIN_LOST; return finish() }
        if (e.status === 409) {
          // 409 時寫入未生效。無法確認原因（讀取失敗）或重試後仍衝突時，保留這款，下次再合併
          if (retried) { result.error = BUSY; return finish() }
          const now = await getCart().catch(() => null)
          if (!now) { result.error = READ_FAILED; return finish() }
          if (now.version !== cart.version) { retried = true; continue }
          // 版本相同：是這款本身的問題（下架、庫存不足、款式數上限），列出原因並繼續其他款式
        }
        removeGuest(line.skuId)
        const skipped = issue(line, e.message || '無法加入購物車')
        result.skipped.push(skipped); addReview(customerId, { ...skipped, kind: 'skipped', at: Date.now() })
        break
      }
    }
  }
  return finish()
}

/* 登入後回到原頁：存在 sessionStorage（不放網址，避免改變 /shop/login 路徑），30 分鐘內有效。 */
const RETURN_KEY = 'figura.loginReturn.v1'
export function rememberReturn(path: string) {
  if (!path.startsWith('/shop/') || path.startsWith('//') || path.startsWith('/shop/login') || path.startsWith('/shop/register')) return
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
