import { computed, ref } from 'vue'
import { getCart, setCartItem, setCartPreorder, type CartView } from '@/api/shopping'
import { CustomerApiError, getCustomer } from '@/api/customer'

/*
 * 訪客購物車：未登入時先把款式放在這台瀏覽器（localStorage），結帳時才要求登入。
 * 只保存 skuId／productId／數量，不保存價格；價格與可售狀態一律以伺服器為準。
 * 登入後合併進本人伺服器購物車（同款數量相加，上限 99），每一步都帶整車版本，
 * 回應未確認時不自動重送，停下並保留尚未合併的款式。
 */
// pending：已送出合併寫入但尚未確認結果（見 mergeGuestCart）；pendingFor：當時合併到哪位會員
// batchId：預購項目（以批次為鍵；同 SKU 不同批次、或同 SKU 的現貨與預購都是不同品項）
export interface GuestLine { skuId: string; productId: string; quantity: number; batchId?: string; pending?: boolean; pendingFor?: string }
/** 品項鍵：現貨 S:<skuId>、預購 B:<batchId>。 */
export const guestKey = (l: { skuId: string; batchId?: string }) => (l.batchId ? 'B:' + l.batchId : 'S:' + l.skuId)
export const MAX_PRE_QTY = 100
const cap = (l: { batchId?: string }) => (l.batchId ? MAX_PRE_QTY : MAX_QTY)
const KEY = 'figura.guestCart.v1'
export const MAX_QTY = 99
export const MAX_LINES = 30

function read(): GuestLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((l: any) => typeof l?.skuId === 'string' && typeof l?.productId === 'string' && Number.isInteger(l?.quantity) && l.quantity >= 1)
      .map((l: any) => ({ skuId: l.skuId, productId: l.productId, quantity: Math.min(typeof l.batchId === 'string' ? MAX_PRE_QTY : MAX_QTY, l.quantity), ...(typeof l.batchId === 'string' ? { batchId: l.batchId } : {}), ...(l.pending === true ? { pending: true, ...(typeof l.pendingFor === 'string' ? { pendingFor: l.pendingFor } : {}) } : {}) }))
      .slice(0, MAX_LINES)
  } catch { return [] }
}
// 曾經寫入失敗（無痕、空間不足、停用儲存）時，記憶體內容較新，之後不再用磁碟內容覆蓋它
let storageFailed = false
function write(lines: GuestLine[]) {
  guestLines.value = lines
  try { lines.length ? localStorage.setItem(KEY, JSON.stringify(lines)) : localStorage.removeItem(KEY); storageFailed = false }
  catch { storageFailed = true }
}

export const guestLines = ref<GuestLine[]>(read())
/** 重新讀取 localStorage（登入前呼叫，取得其他分頁或上次中斷留下的最新內容）。 */
export function reloadGuest() { if (!storageFailed) guestLines.value = read() }
export const guestCount = computed(() => guestLines.value.reduce((n, l) => n + l.quantity, 0))
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === KEY && !storageFailed) guestLines.value = read() })

/** 加入訪客購物車；回傳加入後該款數量。超過上限丟出錯誤訊息。 */
export function addGuest(productId: string, skuId: string, quantity: number, batchId?: string) {
  const lines = [...guestLines.value]
  const key = guestKey({ skuId, batchId })
  const found = lines.find(l => guestKey(l) === key)
  const total = (found?.quantity || 0) + quantity, max = batchId ? MAX_PRE_QTY : MAX_QTY
  if (!Number.isInteger(quantity) || quantity < 1 || total > max) throw new Error(`同一品項最多 ${max} 件，請核對購物車數量。`)
  if (!found && lines.length >= MAX_LINES) throw new Error(`購物車最多 ${MAX_LINES} 種品項，請先結帳或移除部分品項。`)
  if (found) found.quantity = total; else lines.push({ skuId, productId, quantity, ...(batchId ? { batchId } : {}) })
  write(lines.map(l => ({ ...l })))
  return total
}
/** key 為 guestKey()；舊呼叫傳入 skuId 時視為現貨。 */
export function setGuest(key: string, quantity: number) {
  const k = key.includes(':') ? key : 'S:' + key, max = k.startsWith('B:') ? MAX_PRE_QTY : MAX_QTY
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) throw new Error(`數量需為 1–${max} 件。`)
  write(guestLines.value.map(l => guestKey(l) === k ? { ...l, quantity } : l))
}
export function removeGuest(key: string) { const k = key.includes(':') ? key : 'S:' + key; write(guestLines.value.filter(l => guestKey(l) !== k)) }
/**
 * 合併處理完一款後，只扣掉這次處理的件數（重讀最新內容）。若合併期間其他訪客分頁把同款改多，
 * 多出來的件數會留下、下次再合併，而不是整筆刪除。
 */
function settleGuest(key: string, handled: number) {
  reloadGuest()
  write(guestLines.value.flatMap(l => {
    if (guestKey(l) !== key) return [l]
    const left = l.quantity - handled
    return left > 0 ? [{ skuId: l.skuId, productId: l.productId, quantity: left, ...(l.batchId ? { batchId: l.batchId } : {}) }] : []
  }))
}

/** 伺服器購物車件數（登入時），供頁首顯示；由購物車相關頁面更新。 */
export const serverCount = ref<number | null>(null)
export const countOf = (cart: CartView) => cart.items.reduce((n, i) => n + i.quantity, 0) + (cart.preorders || []).reduce((n, p) => n + p.quantity, 0)

export interface MergeIssue { skuId: string; productId: string; quantity: number; reason: string; batchId?: string }
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
const reviewKey = (customerId: string) => REVIEW_PREFIX + customerId
function readReview(customerId: string): ReviewItem[] {
  try {
    const r = JSON.parse(localStorage.getItem(reviewKey(customerId)) || '[]')
    return Array.isArray(r) ? r.filter((x: any) => typeof x?.skuId === 'string' && (x.kind === 'uncertain' || x.kind === 'skipped')).map((x: any) => { const { batchId, ...rest } = x; return typeof batchId === 'string' ? { ...rest, batchId } : rest }) : []
  } catch { return [] }
}
export const reviewItems = ref<ReviewItem[]>([])
const sameReview = (a: ReviewItem, b: ReviewItem) => a.kind === b.kind && guestKey(a) === guestKey(b)
/** 待核對清單以 localStorage 為準。儲存無法使用時只保留在記憶體（重新整理後消失，已知限制）。 */
function combined(customerId: string): ReviewItem[] { return readReview(customerId) }
/** 切換到目前登入的會員；之後顯示與清除都只針對這位會員。 */
export function loadReview(customerId: string) {
  reviewOwner = customerId
  reviewItems.value = customerId ? combined(customerId) : []
  try { localStorage.removeItem('figura.guestCart.review.v1') } catch { /* 舊版共用清單，不再使用 */ }
}
function addReview(customerId: string, item: ReviewItem) {
  const next = [...readReview(customerId).filter(r => !sameReview(r, item)), item]
  let saved = true
  try { localStorage.setItem(reviewKey(customerId), JSON.stringify(next)) } catch { saved = false }
  if (reviewOwner === customerId) reviewItems.value = saved ? next : [...reviewItems.value.filter(r => !sameReview(r, item)), item]
}
export function clearReview() {
  if (!reviewOwner) return
  try { localStorage.removeItem(reviewKey(reviewOwner)) } catch { /* ignore */ }
  reviewItems.value = []
}
if (typeof window !== 'undefined') window.addEventListener('storage', e => {
  if (!reviewOwner || e.key !== reviewKey(reviewOwner)) return
  // 其他分頁更新了清單：以磁碟內容為主，再補上本分頁寫入失敗、只存在記憶體的紀錄
  reviewItems.value = combined(reviewOwner)
})
/** 最近一次合併的結果，購物車頁顯示用（登入頁合併後導回購物車時）。 */
export const lastMerge = ref<MergeResult | null>(null)
let merging: Promise<MergeResult> | null = null
const LOGIN_LOST = '登入狀態已失效，訪客購物車保留在這台裝置，請重新登入。'
const READ_FAILED = '暫時無法讀取你的購物車，訪客購物車已保留，下次開啟購物車會再合併。'
const UNCERTAIN = '有款式的合併結果未確認，請核對下方購物車數量；其餘尚未合併的款式仍保留在這台裝置。'
const ACCOUNT_CHANGED = '登入的帳號已變更，已停止合併；訪客購物車保留在這台裝置。'
const BUSY = '購物車剛被其他地方更新，尚未合併的款式仍保留在這台裝置，稍後開啟購物車會再合併。'

function setPending(key: string, pending: boolean, customerId?: string) {
  write(guestLines.value.map(l => guestKey(l) === key ? (pending ? { ...l, pending: true, pendingFor: customerId } : { skuId: l.skuId, productId: l.productId, quantity: l.quantity, ...(l.batchId ? { batchId: l.batchId } : {}) }) : l))
}
const issue = (l: GuestLine, reason: string): MergeIssue => ({ skuId: l.skuId, productId: l.productId, quantity: l.quantity, reason, ...(l.batchId ? { batchId: l.batchId } : {}) })

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
  reloadGuest() // 寫入失敗過就保留記憶體內容，不用磁碟覆蓋
  for (const l of guestLines.value.filter(l => l.pending)) {
    const it = issue(l, '上次合併被中斷，請核對購物車數量')
    // 記在當時合併的那位會員名下（可能不是現在登入的會員）
    const owner = l.pendingFor || customerId
    if (owner === customerId) result.uncertain.push(it)
    addReview(owner, { ...it, kind: 'uncertain', at: Date.now() })
    settleGuest(guestKey(l), l.quantity)
  }
  for (const line of guestLines.value.filter(l => !l.pending)) {
    const key = guestKey(line)
    let retried = false
    for (;;) {
      // 合併期間若有其他分頁換了登入帳號，共享的 Cookie 會指向另一位會員：確認身分仍相同才寫入
      try { if ((await getCustomer()).id !== customerId) { result.error = ACCOUNT_CHANGED; return finish() } }
      catch (e) { result.error = e instanceof CustomerApiError && e.status === 401 ? LOGIN_LOST : READ_FAILED; return finish() }
      let cart: CartView
      try { cart = await getCart() }
      catch (e) { result.error = e instanceof CustomerApiError && e.status === 401 ? LOGIN_LOST : READ_FAILED; return finish() }
      const current = (line.batchId ? (cart.preorders || []).find(p => p.batchId === line.batchId)?.quantity : cart.items.find(i => i.skuId === line.skuId)?.quantity) || 0
      const target = Math.min(cap(line), current + line.quantity)
      if (target === current) { settleGuest(key, line.quantity); result.merged++; break }
      setPending(key, true, customerId)
      try {
        serverCount.value = countOf(line.batchId ? await setCartPreorder(line.batchId, target, cart.version) : await setCartItem(line.skuId, target, cart.version))
        settleGuest(key, line.quantity); result.merged++; break
      } catch (e) {
        if (!(e instanceof CustomerApiError) || e.status >= 500) {
          const it = issue(line, '合併結果未確認，請核對購物車數量')
          result.uncertain.push(it); addReview(customerId, { ...it, kind: 'uncertain', at: Date.now() })
          settleGuest(key, line.quantity)
          result.error = UNCERTAIN
          return finish()
        }
        setPending(key, false)
        if (e.status === 401) { result.error = LOGIN_LOST; return finish() }
        if (e.status === 409) {
          // 409 時寫入未生效。無法確認原因（讀取失敗）或重試後仍衝突時，保留這款，下次再合併
          if (retried) { result.error = BUSY; return finish() }
          const now = await getCart().catch(() => null)
          if (!now) { result.error = READ_FAILED; return finish() }
          if (now.version !== cart.version) { retried = true; continue }
          // 版本相同：是這款本身的問題（下架、庫存不足、款式數上限），列出原因並繼續其他款式
        }
        settleGuest(key, line.quantity)
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
