import { computed, ref } from 'vue'
import { getCart, setCartItem, type CartView } from '@/api/shopping'
import { CustomerApiError } from '@/api/customer'

/*
 * 訪客購物車：未登入時先把款式放在這台瀏覽器（localStorage），結帳時才要求登入。
 * 只保存 skuId／productId／數量，不保存價格；價格與可售狀態一律以伺服器為準。
 * 登入後合併進本人伺服器購物車（同款數量相加，上限 99），每一步都帶整車版本，
 * 回應未確認時不自動重送，停下並保留尚未合併的款式。
 */
export interface GuestLine { skuId: string; productId: string; quantity: number }
const KEY = 'figura.guestCart.v1'
export const MAX_QTY = 99
export const MAX_LINES = 30

function read(): GuestLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((l: any) => typeof l?.skuId === 'string' && typeof l?.productId === 'string' && Number.isInteger(l?.quantity) && l.quantity >= 1)
      .map((l: any) => ({ skuId: l.skuId, productId: l.productId, quantity: Math.min(MAX_QTY, l.quantity) }))
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

export interface MergeResult { merged: number; skipped: string[]; error?: string; uncertain?: boolean; uncertainSkus?: string[] }
/** 最近一次合併的結果，購物車頁顯示用（登入頁合併後導回購物車時）。 */
export const lastMerge = ref<MergeResult | null>(null)
let merging: Promise<MergeResult> | null = null
/**
 * 把訪客購物車合併進已登入顧客的伺服器購物車。
 * 每款：重讀整車 → 以目前版本寫入「原數量＋訪客數量」（上限 99）→ 成功才從訪客購物車移除。
 * 400 類（款式下架、數量不合法）略過並保留說明；未確認回應（網路／5xx）停止，剩餘款式留在訪客購物車。
 */
export function mergeGuestCart(): Promise<MergeResult> {
  if (merging) return merging
  merging = (async () => {
    const result: MergeResult = { merged: 0, skipped: [] }
    outer: for (const line of [...guestLines.value]) {
      // 409（整車版本已變）代表這次寫入沒有生效，重讀後再試一次是安全的
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const cart = await getCart()
          const current = cart.items.find(i => i.skuId === line.skuId)?.quantity || 0
          const target = Math.min(MAX_QTY, current + line.quantity)
          const updated = target === current ? cart : await setCartItem(line.skuId, target, cart.version)
          serverCount.value = countOf(updated)
          removeGuest(line.skuId)
          result.merged++
          continue outer
        } catch (e) {
          if (e instanceof CustomerApiError && e.status === 409 && attempt === 0) continue
          if (e instanceof CustomerApiError && e.status === 401) { result.error = '登入狀態已失效，訪客購物車保留在這台裝置。'; break outer }
          if (e instanceof CustomerApiError && [400, 404, 422].includes(e.status)) { result.skipped.push(line.skuId); removeGuest(line.skuId); continue outer }
          if (e instanceof CustomerApiError && e.status === 409) { result.error = '購物車剛被其他裝置更新，尚未合併的款式保留在這台裝置，請重新整理購物車。'; break outer }
          // 回應未確認：伺服器可能已寫入，不能再自動合併同一款（會重複相加）。
          // 從訪客購物車移出並列出，請顧客在購物車核對數量；其餘未處理款式保留，下次再合併。
          result.uncertain = true
          result.uncertainSkus = [line.skuId]
          removeGuest(line.skuId)
          result.error = '有款式的合併結果未確認，請核對下方購物車數量；其餘尚未合併的款式仍保留在這台裝置。'
          break outer
        }
      }
    }
    if (result.merged || result.skipped.length || result.error) lastMerge.value = result
    return result
  })().finally(() => { merging = null })
  return merging
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
