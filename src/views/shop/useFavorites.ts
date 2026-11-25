// 收藏狀態：登入時以伺服器為準；未登入時暫存在這台裝置（localStorage，最多 100 件），登入後合併。
import { ref, watch } from 'vue'
import { addFavorite, favoriteIds, mergeFavorites, removeFavorite } from '@/api/engagement'
import { useCustomerStore } from '@/stores/customer'

const KEY = 'figuraGuestFavorites', MAX_GUEST = 100
const ids = ref<Set<string>>(new Set())
const guest = ref(true)
let loadedFor: string | null | undefined

function readGuest(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, MAX_GUEST) : [] } catch { return [] }
}
function writeGuest(list: string[]) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_GUEST))) } catch { /* 無痕或停用儲存：只在記憶體 */ } }

async function load(customerId: string | null) {
  if (loadedFor === customerId) return
  loadedFor = customerId
  guest.value = !customerId
  if (!customerId) { ids.value = new Set(readGuest()); return }
  try { ids.value = new Set((await favoriteIds()).productIds) } catch { ids.value = new Set() }
}

/** 登入成功後呼叫：把訪客收藏合併進會員收藏（冪等，下架或已滿的略過），成功後清掉裝置暫存。 */
export async function mergeGuestFavorites() {
  const list = readGuest()
  if (!list.length) return
  try { await mergeFavorites(list); writeGuest([]) } catch { /* 保留暫存，下次登入再試 */ }
  loadedFor = undefined
}

export function useFavorites() {
  const customer = useCustomerStore()
  watch(() => customer.profile?.id ?? null, id => { void load(id) }, { immediate: true })
  const pending = ref(new Set<string>())
  async function toggle(productId: string) {
    if (pending.value.has(productId)) return
    const on = ids.value.has(productId)
    if (guest.value) {
      const next = new Set(ids.value); on ? next.delete(productId) : next.add(productId)
      if (next.size > MAX_GUEST) throw new Error(`未登入最多暫存 ${MAX_GUEST} 件，請登入後再收藏`)
      ids.value = next; writeGuest([...next]); return
    }
    pending.value.add(productId)
    try { ids.value = new Set((on ? await removeFavorite(productId) : await addFavorite(productId)).productIds) }
    finally { pending.value.delete(productId) }
  }
  return { ids, guest, pending, toggle, has: (id: string) => ids.value.has(id) }
}
