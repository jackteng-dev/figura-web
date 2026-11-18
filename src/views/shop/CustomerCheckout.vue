<script setup lang="ts">
// 結帳頁：購物車結帳與「直接購買」共用同一頁。
// - 購物車結帳：/shop/checkout，讀本人購物車（現貨＋預購）與伺服器分組報價，下單呼叫 POST /customer/checkout（帶整車版本與總額），
//   伺服器在同一個交易拆成一張現貨訂單＋每個預購批次一張訂單，任何一張失敗全部回滾。
// - 直接購買：/shop/checkout?product=&sku=&qty=，只買這一款，不讀也不清購物車，下單呼叫 POST /customer/orders/direct。
// 進入本頁、選地址、新增／編輯地址都不保留庫存；只有按「確認下單」才建立訂單並保留 30 分鐘。
// 送出前先向伺服器重讀金額／版本／地址，與畫面不同就停下讓顧客確認；伺服器仍會再核對一次。
// 送出後回應未確認：把原操作（同一 requestId＋內容）存在這個分頁（依顧客分開），之後只能用同一操作重試或到我的訂單核對。
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import ProductCover from './ProductCover.vue'
import AddressForm from './AddressForm.vue'
import { publicProduct, money, type PublicProduct } from '@/api/catalog'
import { getCart, getAddresses, saveAddress, issueText, type AddressView, type AddressWrite, type CartView } from '@/api/shopping'
import { placeOrder, placeDirectOrder, getQuote, placeCheckout, type PlaceOrder, type DirectOrder, type Quote, type CheckoutPlace, type PlacedOrder } from '@/api/orders'
import { detailLink } from '@/api/orderCenter'
import { CustomerApiError, getCustomer } from '@/api/customer'
import { useCustomerStore } from '@/stores/customer'
import { rememberReturn, reviewItems, loadReview, serverCount, countOf, reloadGuest, guestLines, lastMerge } from './guestCart'
import { useCatalog } from './useCatalog'

// legacyCart：舊版（只結帳現貨）留下的未確認操作，仍用原 API 原內容重試
type Pending = { kind: 'cart'; body: CheckoutPlace } | { kind: 'legacyCart'; body: PlaceOrder } | { kind: 'direct'; body: DirectOrder }
const amountOf = (p: Pending) => (p.kind === 'cart' ? p.body.expectedTotalTwd : p.body.expectedSubtotalTwd)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PENDING_KEY = 'figura.checkout.pending.v1'
const LEGACY_BUY_NOW_KEY = 'figura.buyNow.pending.v1' // 舊「直接購買」頁保存的未確認操作，仍要能接手
const route = useRoute(), router = useRouter(), store = useCustomerStore(), catalog = useCatalog()
const q = (name: string) => typeof route.query[name] === 'string' ? route.query[name] as string : ''
const directProductId = UUID.test(q('product')) ? q('product') : '', directSkuId = UUID.test(q('sku')) ? q('sku') : ''
const rawQty = Number(q('qty'))
const queryQty = Number.isInteger(rawQty) && rawQty >= 1 && rawQty <= 99 ? rawQty : 1
const quantity = ref(queryQty)
const kind = ref<'cart' | 'direct'>(directProductId && directSkuId ? 'direct' : 'cart')

const loading = ref(true), busy = ref(false), error = ref(''), notice = ref(''), needsReload = ref(false)
const cart = ref<CartView>(), quote = ref<Quote>(), product = ref<PublicProduct>(), addresses = ref<AddressView[]>([]), addressId = ref('')
const attempt = ref<Pending>(), unknown = ref(false)
let attemptOwner = '' // 這次操作屬於哪位會員；換人登入時不得沿用
let viewOwner = '' // 畫面上的購物車／地址／未確認操作是哪位會員的
// placedId：已確認建立的訂單；之後只導向付款，不再送任何下單請求
// storageBroken：無法讀寫這個分頁的保存空間，無法保證未知結果時重試同一操作，停止下單
const placedId = ref(''), placedOrders = ref<PlacedOrder[]>([]), storageBroken = ref(false)
const editingAddress = ref(''), addressBusy = ref(false), addressError = ref(''), addressNeedsReload = ref(false)
// 登入時訪客購物車沒有合併完成（仍有訪客商品或合併失敗）：購物車結帳要先回購物車完成核對
const guestUnmerged = ref(false)

const sku = computed(() => product.value?.skus.find(s => s.id === (attempt.value?.kind === 'direct' ? attempt.value.body.skuId : directSkuId)))
const selectedAddress = computed(() => addresses.value.find(a => a.id === addressId.value))
const validQty = computed(() => Number.isInteger(quantity.value) && quantity.value >= 1 && quantity.value <= 99)
const imageOf = (productId: string) => catalog.products.value.find(p => p.id === productId)?.image
/** 畫面顯示的商品行：購物車取伺服器購物車；直接購買取公開商品資料。 */
const lines = computed(() => {
  if (kind.value === 'cart') return (quote.value?.groups || []).flatMap(g => g.lines.map(l => ({ key: (l.batchId || l.skuId), productId: l.productId, title: l.title, label: l.label, quantity: l.quantity, unit: l.unitPriceTwd as number | null, total: l.lineTotalTwd as number | null, issue: l.issue ? (l.batchId ? '此預購目前無法下單' : issueText(l.issue as any)) : '', image: imageOf(l.productId) })))
  if (!product.value || !sku.value) return []
  return [{ key: sku.value.id, productId: product.value.id, title: product.value.title, label: sku.value.label, quantity: quantity.value, unit: sku.value.priceTwd, total: sku.value.priceTwd * quantity.value, issue: sku.value.available ? '' : '暫無庫存', image: product.value.image }]
})
const subtotal = computed(() => unknown.value && attempt.value ? amountOf(attempt.value) : kind.value === 'cart' ? quote.value?.totalTwd || 0 : lines.value[0]?.total || 0)
const itemsReady = computed(() => kind.value === 'cart' ? !!quote.value?.groups.length && !!quote.value.ready : !!sku.value?.available && validQty.value)
// 已保存的未確認操作（unknown）只送原本的 requestId＋內容，不依賴畫面上重讀的資料，所以讀取失敗也仍可重試
const canSubmit = computed(() => !busy.value && !loading.value && !placedId.value && !storageBroken.value
  && (unknown.value || (!needsReload.value && !editingAddress.value && !addressNeedsReload.value && itemsReady.value && !!selectedAddress.value && !(kind.value === 'cart' && guestUnmerged.value))))

// ---- 未確認操作保存（依顧客分開）----
const keyOf = (customerId: string) => PENDING_KEY + '.' + customerId
/** 保存成功才回傳 true；保存失敗就不能送出（否則回應遺失、重新整理後會變成新的操作）。 */
function savePending(customerId: string, p: Pending) { try { sessionStorage.setItem(keyOf(customerId), JSON.stringify({ customerId, ...p })); return true } catch { return false } }
function clearPending() { const id = store.profile?.id; if (!id) return; try { sessionStorage.removeItem(keyOf(id)); sessionStorage.removeItem(LEGACY_BUY_NOW_KEY + '.' + id) } catch { /* ignore */ } }
/** 讀取失敗（儲存空間無法使用）會丟出錯誤，由呼叫端停止下單，不能當成「沒有未確認操作」。 */
function readPending(customerId: string): Pending | undefined {
  let raw: string | null, rawOld: string | null
  try { raw = sessionStorage.getItem(keyOf(customerId)); rawOld = sessionStorage.getItem(LEGACY_BUY_NOW_KEY + '.' + customerId) } catch { throw new StorageUnavailable() }
  try {
    const v = JSON.parse(raw || 'null')
    if (v && v.customerId === customerId && (v.kind === 'cart' || v.kind === 'legacyCart' || v.kind === 'direct') && v.body && UUID.test(v.body.requestId)) {
      // 舊版購物車結帳（只有現貨、帶 expectedSubtotalTwd）的未確認操作
      if (v.kind === 'cart' && typeof v.body.expectedTotalTwd !== 'number') return { kind: 'legacyCart', body: v.body }
      return { kind: v.kind, body: v.body }
    }
    const old = JSON.parse(rawOld || 'null')
    if (old && old.customerId === customerId && old.body && UUID.test(old.body.requestId)) return { kind: 'direct', body: old.body }
  } catch { /* 內容損毀：不是本頁格式，當作沒有 */ }
  return undefined
}
class StorageUnavailable extends Error {}
const STORAGE_MSG = '這個瀏覽器無法保存下單紀錄（可能停用了網站資料或空間已滿）。為避免結果不明時重複下單，已停止送出；請改用一般視窗或清出空間後重新整理。'
async function toLogin() { rememberReturn(route.fullPath); await router.replace('/shop/login') }
const message = (e: unknown, fallback: string) => e instanceof Error && e.message ? e.message : fallback

// ---- 載入 ----
async function readItems() {
  if (kind.value === 'cart') { const [c, qt] = await Promise.all([getCart(), getQuote()]); cart.value = c; quote.value = qt; serverCount.value = countOf(c); return }
  const p = attempt.value?.kind === 'direct' ? attempt.value.body : undefined
  product.value = await publicProduct(p?.productId || directProductId).catch(e => { if (p) return undefined; throw e })
}
function pickAddress(list: AddressView[], prefer?: string) {
  addresses.value = list
  if (prefer && list.some(a => a.id === prefer)) addressId.value = prefer
  else if (!list.some(a => a.id === addressId.value)) addressId.value = list[0]?.id || ''
}
/** 回傳是否讀取成功；失敗時鎖住下單（needsReload），直到重新讀取成功。 */
async function load(): Promise<boolean> {
  if (busy.value) return false
  busy.value = true; loading.value = true; error.value = ''; notice.value = ''
  try {
    const me = await getCustomer(); store.profile = me; viewOwner = ''
    loadReview(me.id)
    let pending: Pending | undefined
    try { pending = readPending(me.id); storageBroken.value = false } catch { storageBroken.value = true }
    // 身分與保存紀錄已依這位會員讀取（商品／地址讀取失敗也不影響這件事）
    viewOwner = me.id
    reloadGuest(); guestUnmerged.value = guestLines.value.length > 0 || !!lastMerge.value?.error
    // 換了會員（例如另一分頁登入別人）：丟掉畫面上前一位會員的操作狀態（其保存紀錄仍留在他自己的 key）
    if (attemptOwner && attemptOwner !== me.id) { attempt.value = undefined; unknown.value = false; attemptOwner = ''; kind.value = directProductId && directSkuId ? 'direct' : 'cart'; quantity.value = queryQty; product.value = undefined; cart.value = undefined }
    if (pending) { attempt.value = pending; attemptOwner = me.id; unknown.value = true; kind.value = pending.kind === 'direct' ? 'direct' : 'cart'; if (pending.kind === 'direct') quantity.value = pending.body.quantity }
    if (kind.value === 'direct' && !pending && (!directProductId || !directSkuId)) { error.value = '找不到要購買的商品，請回商品頁重新選擇。'; return false }
    const [, list] = await Promise.all([readItems(), getAddresses()])
    pickAddress(list, pending?.body.addressId)
    if (storageBroken.value) error.value = STORAGE_MSG
    else if (pending) error.value = '上一次下單結果未確認，請按「用同一操作重試」，或到我的訂單核對；不要重新建立另一筆。'
    else if (kind.value === 'direct' && !sku.value) error.value = '這個款式已不存在，請回商品頁重新選擇。'
    needsReload.value = false
    return true
  } catch (e) {
    if (e instanceof CustomerApiError && e.status === 401) { busy.value = false; await toLogin(); return false }
    needsReload.value = true; error.value = message(e, '無法載入結帳資料') + '，請按「重新讀取」。'
    return false
  } finally { busy.value = false; loading.value = false }
}

// ---- 地址：同頁新增／編輯，儲存後重讀清單取得最新版本 ----
const editingTarget = computed(() => addresses.value.find(a => a.id === editingAddress.value))
function editAddress(a?: AddressView) { if (busy.value || unknown.value || addressNeedsReload.value) return; addressError.value = ''; editingAddress.value = a?.id || crypto.randomUUID() }
async function saveAddressForm(form: AddressWrite) {
  if (addressBusy.value || addressNeedsReload.value) return
  addressBusy.value = true; addressError.value = ''
  const id = editingAddress.value
  // 先確認登入的還是同一位會員，避免把前一位會員填的收件資料存到別人名下；確認失敗就不送
  try {
    const me = await getCustomer()
    if (me.id !== viewOwner) { addressBusy.value = false; editingAddress.value = ''; store.profile = me; if (await load()) error.value = '登入的會員已變更，未儲存地址，已重新讀取這位會員的結帳資料。'; return }
  } catch (e) {
    addressBusy.value = false
    if (e instanceof CustomerApiError && e.status === 401) { await toLogin(); return }
    addressError.value = '無法確認登入狀態（' + message(e, '連線失敗') + '），地址尚未儲存，請稍後再試。'; return
  }
  try {
    await saveAddress(id, form)
    pickAddress(await getAddresses(), id); editingAddress.value = ''; notice.value = '收件地址已儲存，請確認下方資訊。'
  } catch (e) {
    if (e instanceof CustomerApiError && e.status === 401) { addressBusy.value = false; await toLogin(); return }
    if (e instanceof CustomerApiError && e.status === 400) { addressError.value = message(e, '地址格式不正確'); return }
    // 409（別處改過）或結果未確認：不重送；成功重讀地址前鎖住地址與下單
    const why = e instanceof CustomerApiError ? message(e, '地址已變更') : '儲存結果未確認'
    addressNeedsReload.value = true; addressBusy.value = false
    await reloadAddresses(id, why)
  } finally { addressBusy.value = false }
}

/** 重讀地址；成功才解除鎖定。 */
async function reloadAddresses(prefer?: string, why?: string) {
  if (addressBusy.value) return
  addressBusy.value = true
  try {
    pickAddress(await getAddresses(), prefer); editingAddress.value = ''; addressNeedsReload.value = false
    addressError.value = why ? why + '，已重新讀取地址，請確認下方收件資訊後再操作。' : ''
  } catch (e) {
    if (e instanceof CustomerApiError && e.status === 401) { addressBusy.value = false; await toLogin(); return }
    addressError.value = (why ? why + '；' : '') + '無法重新讀取地址，請按「重新讀取地址」後再操作。'
  } finally { addressBusy.value = false }
}

// ---- 送出 ----
/** 送出前最後一次向伺服器核對：內容、金額或地址和畫面不同就停下，請顧客確認新內容。 */
async function recheck(): Promise<Pending | undefined> {
  const shown = { subtotal: subtotal.value, version: quote.value?.cartVersion, address: selectedAddress.value }
  const [, list] = await Promise.all([readItems(), getAddresses()])
  pickAddress(list, shown.address?.id)
  const address = list.find(a => a.id === shown.address?.id)
  if (!address || address.version !== shown.address?.version) { error.value = '收件地址已變更或刪除，請重新確認收件資訊後再下單。'; return }
  if (!itemsReady.value) { error.value = kind.value === 'cart' ? '購物車有商品無法購買，請回購物車調整。' : '這個款式目前無法購買。'; return }
  if (subtotal.value !== shown.subtotal || (kind.value === 'cart' && quote.value!.cartVersion !== shown.version)) { error.value = '商品內容或金額已更新，請確認新的金額後再按一次「確認下單」。'; return }
  const requestId = crypto.randomUUID()
  if (kind.value === 'cart') return { kind: 'cart', body: { requestId, cartVersion: quote.value!.cartVersion, addressId: address.id, addressVersion: address.version, expectedTotalTwd: quote.value!.totalTwd } }
  return { kind: 'direct', body: { requestId, productId: product.value!.id, skuId: sku.value!.id, quantity: quantity.value, addressId: address.id, addressVersion: address.version, expectedSubtotalTwd: subtotal.value } }
}
async function submit() {
  if (!canSubmit.value || !store.profile) return
  busy.value = true; error.value = ''; notice.value = ''
  // 先向伺服器確認目前登入的是誰：別的分頁可能已換成其他會員。這一步失敗不代表下單失敗，不能清除任何保存的操作
  let me: Awaited<ReturnType<typeof getCustomer>>
  try { me = await getCustomer() }
  catch (e) {
    busy.value = false
    if (e instanceof CustomerApiError && e.status === 401) { if (attempt.value) error.value = '登入已失效，請重新登入後用同一操作重試。'; await toLogin(); return }
    error.value = '無法確認登入狀態（' + message(e, '連線失敗') + '），請稍後再試；尚未送出訂單。'; return
  }
  // 畫面資料（或未確認操作）不是這位會員的：停止這次送出，改讀這位會員自己的資料與保存紀錄
  if (me.id !== viewOwner || (unknown.value && me.id !== attemptOwner)) { busy.value = false; store.profile = me; if (await load()) error.value = '登入的會員已變更，已重新讀取這位會員的結帳資料，請確認後再操作。'; return }
  store.profile = me
  try {
    if (!unknown.value) {
      const fresh = await recheck()
      if (!fresh) return
      // 送出前先保存：回應遺失或離頁後回來仍是同一操作；保存不了就不送
      if (!savePending(store.profile.id, fresh)) { storageBroken.value = true; error.value = STORAGE_MSG; return }
      attempt.value = fresh; attemptOwner = store.profile.id
    }
    const p = attempt.value!
    let created: PlacedOrder[]
    if (p.kind === 'cart') {
      const result = await placeCheckout(p.body)
      if (!result || !Array.isArray(result.orders) || !result.orders.length || result.orders.some(o => typeof o?.id !== 'string' || !UUID.test(o.id))) throw new TypeError('無法判讀下單回應')
      created = result.orders
    } else {
      const result = p.kind === 'legacyCart' ? await placeOrder(p.body) : await placeDirectOrder(p.body)
      const id = result?.order?.id
      if (typeof id !== 'string' || !UUID.test(id)) throw new TypeError('無法判讀下單回應') // 視為結果未確認，保留原操作
      created = [{ kind: 'STOCK', id, status: result.order.status, totalTwd: result.order.totalTwd, expiresAt: result.order.expiresAt, title: '' }]
    }
    // 訂單已建立：之後只導向付款，不再送任何下單請求
    placedOrders.value = created; placedId.value = created[0].id; clearPending(); unknown.value = false; attempt.value = undefined
    if (p.kind !== 'direct') serverCount.value = (cart.value?.preorders.length && p.kind === 'legacyCart') ? null : 0
    // 只有一張訂單就直接到它的付款區；拆成多張時留在本頁列出每一張
    if (created.length === 1) await goPay()
  } catch (e) {
    if (e instanceof CustomerApiError && e.status === 401) {
      // 未授權不能證明先前沒有成功：有已送出的操作就保留，重新登入後回到這頁用同一操作重試
      if (attempt.value) { unknown.value = true; error.value = '登入已失效，請重新登入後用同一操作重試。' }
      busy.value = false; await toLogin(); return
    }
    if (!attempt.value) { error.value = message(e, '無法核對最新內容，請重試。'); return } // 送出前的重讀失敗：還沒下單
    const known = e instanceof CustomerApiError && [400, 404, 409].includes(e.status)
    if (known) {
      // 伺服器明確拒絕、沒有建立訂單：清除這次操作並重讀最新內容（不重送）
      const why = message(e, '下單失敗')
      clearPending(); unknown.value = false; attempt.value = undefined; busy.value = false
      const why2 = error.value
      if (await load()) error.value = why + '。已重新讀取最新內容，請確認後再下單。'
      else if (needsReload.value) error.value = why + '；' + (error.value || why2)
    } else { unknown.value = true; error.value = '下單結果未確認，請按「用同一操作重試」，或到我的訂單核對；不要重新建立另一筆。' }
  } finally { busy.value = false }
}
async function goPay(order: PlacedOrder | undefined = placedOrders.value[0]) {
  if (!order) return
  try { await router.replace(order.kind === 'STOCK' ? { path: '/shop/orders', query: { pay: order.id } } : detailLink(order)) }
  catch { /* 導頁失敗：畫面保留「前往付款」按鈕 */ }
}
/** 核對後放棄：只有顧客確認已在我的訂單核對過才清除保存的操作。 */
function abandon() {
  if (!window.confirm('確定已在「我的訂單」核對過，要放棄這次未確認的下單嗎？')) return
  clearPending(); unknown.value = false; attempt.value = undefined; error.value = ''
  kind.value = directProductId && directSkuId ? 'direct' : 'cart'; quantity.value = queryQty; product.value = undefined; void load()
}
function bump(delta: number) { const next = quantity.value + delta; if (next >= 1 && next <= 99) quantity.value = next }
onBeforeRouteLeave(to => {
  // 本頁自己的去向（成功後到付款、登入失效到登入頁）一律放行
  if (['/shop/orders', '/shop/preorder-orders', '/shop/my-orders', '/shop/login'].includes(to.path)) return true
  if (busy.value) return false
  if (unknown.value) return window.confirm('下單結果尚未確認。離開後回到此頁仍會保留同一操作，確定離開？')
  return true
})
onMounted(() => { catalog.load(); void load() })
</script>

<template>
 <section class="checkout">
  <div class="head">
   <h1>結帳</h1>
   <ol class="steps" aria-label="結帳步驟">
    <li v-if="kind === 'cart'"><router-link to="/shop/cart">1 購物車</router-link></li>
    <li aria-current="step">{{ kind === 'cart' ? '2' : '1' }} 確認訂單</li><li>{{ kind === 'cart' ? '3' : '2' }} 付款</li>
   </ol>
  </div>
  <p v-if="error" role="alert" class="shop-error">{{ error }} <button v-if="needsReload" type="button" class="link" :disabled="busy" @click="load">重新讀取</button><router-link v-if="unknown" to="/shop/orders">到我的訂單核對 →</router-link> <button v-if="unknown" type="button" class="link" @click="abandon">已核對，放棄這次下單</button></p>
  <p v-if="notice" role="status" class="shop-success">{{ notice }}</p>
  <div v-if="placedId" class="placed" role="status" data-testid="checkout-placed">
   <template v-if="placedOrders.length > 1">
    <p>已依商品類型拆成 {{ placedOrders.length }} 張訂單，每張各自付款、各自保留期限：</p>
    <ul class="placed-list">
     <li v-for="o in placedOrders" :key="o.id"><span class="tag" :class="o.kind === 'PREORDER' ? 'pre' : 'stock'">{{ o.kind === 'PREORDER' ? '預購' : '現貨' }}</span> {{ o.title }} · {{ money(o.totalTwd) }} <router-link class="shop-button primary" :to="o.kind === 'STOCK' ? { path: '/shop/orders', query: { pay: o.id } } : detailLink(o)">前往付款</router-link></li>
    </ul>
    <router-link to="/shop/my-orders?stage=PENDING_PAYMENT">到我的訂單查看全部 →</router-link>
   </template>
   <template v-else><p>訂單已建立（編號 {{ placedId.slice(0, 8) }}），請前往付款。</p><button class="shop-button primary" @click="goPay()">前往付款</button></template>
  </div>
  <p v-if="loading" role="status">正在讀取結帳資料…</p>
  <div v-if="!loading && kind === 'cart' && guestUnmerged && !unknown" class="merge-warn top" role="alert" data-testid="checkout-guest-unmerged">登入前加入的商品還沒有合併進購物車。請先<router-link to="/shop/cart">回購物車</router-link>完成合併與核對，再結帳。</div>

  <!-- 未確認、但商品資料讀不到時仍能重試或核對 -->
  <div v-if="!loading && unknown && attempt && !lines.length" class="pending-box" data-testid="checkout-pending">
   <p>上一次下單：金額 {{ money(amountOf(attempt)) }}。商品資料目前無法讀取，仍可用同一操作重試或到我的訂單核對。</p>
   <button class="shop-button primary" :disabled="busy" @click="submit">用同一操作重試</button>
  </div>

  <div v-else-if="!loading && kind === 'cart' && quote && !quote.groups.length" class="empty" data-testid="checkout-empty">
   <p>購物車目前是空的，沒有可結帳的商品。</p><router-link class="shop-button primary" to="/shop/products">探索收藏商品</router-link>
  </div>

  <div v-else-if="!loading && lines.length && !placedId" class="layout">
   <div class="main">
    <div v-if="kind === 'cart' && !guestUnmerged && reviewItems.length" class="merge-warn" role="status">登入前加入的部分商品需要核對（可能未加入或結果未確認）。<router-link to="/shop/cart">回購物車核對 →</router-link></div>

    <!-- ① 商品 -->
    <section class="card" aria-labelledby="co-items">
     <div class="card-head"><h2 id="co-items">商品明細</h2><router-link v-if="kind === 'cart' && !unknown" to="/shop/cart" class="edit-link">修改購物車</router-link></div>
     <p v-if="kind === 'cart' && quote && quote.groups.length > 1" class="split-note" data-testid="checkout-split-note">這次結帳會拆成 {{ quote.groups.length }} 張訂單：現貨一張、每個預購批次各一張，各自付款與出貨。</p>
     <template v-if="kind === 'cart' && quote">
      <div v-for="g in quote.groups" :key="g.key" class="group" :data-testid="'checkout-group-' + g.key">
       <p class="group-head"><span class="tag" :class="g.kind === 'PREORDER' ? 'pre' : 'stock'">{{ g.kind === 'PREORDER' ? '預購' : '現貨' }}</span> <strong>{{ g.kind === 'PREORDER' ? g.title : '現貨訂單' }}</strong>
        <span v-if="g.arrivalFrom" class="arrival">預計 {{ g.arrivalFrom }} ～ {{ g.arrivalTo }} 到貨</span><span v-else class="arrival">付款後出貨</span></p>
       <ul class="lines">
        <li v-for="l in g.lines" :key="l.batchId || l.skuId" class="line" :class="{ issue: l.issue }" :data-testid="'checkout-line-' + (l.batchId || l.skuId)">
         <router-link class="thumb" :to="'/shop/products/' + l.productId" :aria-label="'查看商品 ' + l.title"><ProductCover :image="imageOf(l.productId)" /></router-link>
         <div class="line-info"><h3>{{ l.title }}</h3><p>款式：{{ l.label }}</p><p>{{ money(l.unitPriceTwd) }}／件</p><p v-if="l.issue" class="shop-error">{{ l.batchId ? '此預購目前無法下單' : issueText(l.issue as any) }}</p></div>
         <span class="qty-text">× {{ l.quantity }}</span>
         <strong class="line-total">{{ money(l.lineTotalTwd) }}</strong>
        </li>
       </ul>
       <p class="group-total">這張訂單 {{ money(g.totalTwd) }}<template v-if="g.payLaterTwd"> · 現在付 {{ money(g.payNowTwd) }}，之後付 {{ money(g.payLaterTwd) }}</template></p>
      </div>
     </template>
     <ul v-if="kind !== 'cart'" class="lines">
      <li v-for="l in lines" :key="l.key" class="line" :class="{ issue: l.issue }" :data-testid="'checkout-line-' + l.key">
       <router-link class="thumb" :to="'/shop/products/' + l.productId" :aria-label="'查看商品 ' + l.title"><ProductCover :image="l.image" /></router-link>
       <div class="line-info"><h3>{{ l.title }}</h3><p>款式：{{ l.label }}</p><p>{{ l.unit === null ? '下架款式暫不計價' : money(l.unit) + '／件' }}</p><p v-if="l.issue" class="shop-error">{{ l.issue }}</p></div>
       <div v-if="kind === 'direct' && !unknown" class="qty-step" role="group" aria-label="購買數量">
        <button type="button" aria-label="減少數量" :disabled="busy || quantity <= 1" @click="bump(-1)">−</button><input v-model.number="quantity" aria-label="數量" type="number" inputmode="numeric" min="1" max="99" step="1" :disabled="busy"><button type="button" aria-label="增加數量" :disabled="busy || quantity >= 99" @click="bump(1)">+</button>
       </div>
       <span v-else class="qty-text">× {{ unknown && attempt?.kind === 'direct' ? attempt.body.quantity : l.quantity }}</span>
       <strong class="line-total">{{ l.total === null ? '不計價' : money(unknown && attempt?.kind === 'direct' ? attempt.body.expectedSubtotalTwd : l.total) }}</strong>
      </li>
     </ul>
     <p v-if="kind === 'direct'" class="fine">只購買這一款，不會改動購物車。</p>
     <p v-if="kind === 'direct' && !validQty" class="shop-error">數量需為 1–99 的整數。</p>
     <p v-if="kind === 'cart' && quote && !quote.ready" class="shop-error">有商品無法購買，請<router-link to="/shop/cart">回購物車</router-link>調整後再結帳。</p>
    </section>

    <!-- ② 收件資訊 -->
    <section class="card" aria-labelledby="co-ship">
     <div class="card-head"><h2 id="co-ship">收件資訊</h2><button v-if="!unknown && !editingAddress && addresses.length < 10" type="button" class="edit-link" :disabled="busy || addressNeedsReload" @click="editAddress()">新增地址</button></div>
     <p v-if="addressError" role="alert" class="shop-error">{{ addressError }} <button v-if="addressNeedsReload" type="button" class="link" :disabled="addressBusy" @click="reloadAddresses(editingAddress || addressId)">重新讀取地址</button></p>
     <template v-if="addresses.length && !editingAddress">
      <label for="checkout-address">收件地址</label>
      <select id="checkout-address" v-model="addressId" :disabled="busy || unknown">
       <option v-for="a in addresses" :key="a.id" :value="a.id">{{ a.recipientName }} · {{ a.city }}{{ a.district }}{{ a.street }}</option>
      </select>
      <div v-if="selectedAddress" class="ship-to" data-testid="checkout-shipping">
       <p><strong>{{ selectedAddress.recipientName }}</strong>　{{ selectedAddress.phone }}</p>
       <p>{{ selectedAddress.postalCode }} {{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.street }}</p>
       <button v-if="!unknown" type="button" class="link" :disabled="busy || addressNeedsReload" @click="editAddress(selectedAddress)">編輯這個地址</button>
      </div>
     </template>
     <p v-if="!addresses.length && !editingAddress" class="no-address" data-testid="checkout-no-address">還沒有收件地址，請先新增一個。<button type="button" class="shop-button" :disabled="busy || unknown" @click="editAddress()">新增收件地址</button></p>
     <AddressForm v-if="editingAddress" :key="editingAddress" id-prefix="co-" :address="editingTarget" :disabled="addressBusy || addressNeedsReload" save-label="儲存並使用這個地址" @save="saveAddressForm" @cancel="editingAddress = ''; addressError = ''" />
    </section>

    <!-- ③ 配送 ④ 付款：只說明目前真的有的能力 -->
    <section class="card" aria-labelledby="co-delivery">
     <h2 id="co-delivery">配送方式</h2>
     <p class="option">宅配到府 <span class="tag">目前唯一方式</span></p>
     <p class="fine">目前為測試營運：出貨與配送進度為模擬，運費以 NT$0 展示，正式運費尚未開放。</p>
    </section>
    <section class="card" aria-labelledby="co-pay">
     <h2 id="co-pay">付款方式</h2>
     <p class="fine">建立訂單後，在「我的訂單」選擇付款：信用卡（綠界測試環境）或付款模擬。兩者都不會實際扣款；付款結果以伺服器收到的通知為準。</p>
    </section>
   </div>

   <!-- ⑤ 金額 ⑥ 送出 -->
   <aside class="panel" aria-labelledby="co-summary">
    <h2 id="co-summary">訂單金額</h2>
    <div v-if="kind === 'cart' && quote && quote.groups.length > 1" class="sum-row"><span>訂單數</span><span>{{ quote.groups.length }} 張</span></div>
    <div class="sum-row"><span>商品小計</span><span>{{ money(subtotal) }}</span></div>
    <div class="sum-row"><span>運費（展示）</span><span>NT$ 0</span></div>
    <div class="sum-row total"><span>應付金額</span><strong data-testid="order-total">{{ money(subtotal) }}</strong></div>
    <div v-if="selectedAddress" class="mini-ship">寄送給 {{ selectedAddress.recipientName }}・{{ selectedAddress.city }}{{ selectedAddress.district }}</div>
    <button class="shop-button primary submit" data-testid="checkout-submit" :disabled="!canSubmit" @click="submit">{{ busy ? '處理中…' : unknown ? '用同一操作重試' : '確認下單' }}</button>
    <p v-if="!unknown && !selectedAddress" class="fine warn">請先選擇或新增收件地址。</p>
    <p class="fine">按下「確認下單」才會建立訂單並保留庫存／預購配額 30 分鐘（預購不超過截單時間），請在時限內完成付款，逾時自動取消。多張訂單會一起建立，任一張無法建立就全部不建立。</p>
   </aside>
  </div>
 </section>
</template>

<style scoped>
.head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.head h1{margin:0}
.steps{list-style:none;margin:0;padding:0;display:flex;gap:8px;flex-wrap:wrap;font-size:14px}.steps li{background:#fff;color:#4b5060;padding:7px 14px;border-radius:999px}.steps li a{color:inherit;text-decoration:none}.steps li[aria-current]{background:#1b1f3b;color:#fff;font-weight:700}
.layout{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
.main{flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:16px}
.card{background:#fff;border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:10px;overflow-wrap:anywhere}
.card h2{font-size:18px;margin:0}.card-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.edit-link{font-size:14px;border:0;background:transparent;color:#1d4ed8;text-decoration:underline;cursor:pointer;font-family:inherit;padding:4px}
.lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.line{display:grid;grid-template-columns:72px minmax(0,1fr) auto auto;gap:14px;align-items:center;padding-bottom:12px;border-bottom:1px solid #eef0f4}.line:last-child{border-bottom:0;padding-bottom:0}
.line.issue{background:#fff5f5;border-radius:10px;padding:8px}
.thumb{display:block;width:72px}.thumb :deep(.cover-empty small){display:none}
.line-info h3{font-size:15px;margin:0 0 4px;line-height:1.45}.shop-shell .line-info p{margin:0;font-size:13px}
.qty-text{font-size:15px;color:#4b5060;white-space:nowrap}.line-total{font-size:16px;white-space:nowrap}
.qty-step{display:inline-flex;align-items:stretch;border:1px solid #d6d9e2;border-radius:10px;overflow:hidden;background:#fff;height:40px}
.qty-step button{width:38px;border:0;background:#f3f4f8;color:#15161a;font:inherit;font-size:18px;line-height:1;cursor:pointer}.qty-step button:hover:not(:disabled){background:#e6e8ef}.qty-step button:disabled{color:#b5b8c4;cursor:not-allowed}
.shop-shell .qty-step input{width:48px;border:0;border-left:1px solid #d6d9e2;border-right:1px solid #d6d9e2;border-radius:0;padding:0;margin:0;text-align:center;font-size:15px;font-weight:700;appearance:textfield;-moz-appearance:textfield}.qty-step input::-webkit-inner-spin-button,.qty-step input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.card label{font-size:14px;font-weight:700}.card select{padding:10px;border:1px solid #d5d8e0;border-radius:8px;font:inherit;max-width:100%}
.ship-to{background:#f3f4f8;border-radius:10px;padding:12px 14px;font-size:14px}.shop-shell .ship-to p{margin:0 0 4px}
.no-address{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:0}
.option{margin:0;font-weight:700;display:flex;align-items:center;gap:8px}.tag{font-size:12px;font-weight:400;background:#eef2ff;color:#3730a3;border-radius:999px;padding:2px 10px}
.panel{flex:1 1 320px;min-width:0;background:#fff;border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:10px;position:sticky;top:140px}
.panel h2{margin:0 0 4px;font-size:20px}.sum-row{display:flex;justify-content:space-between;gap:12px;font-size:14px;color:#4b5060}
.sum-row.total{border-top:1px solid #e3e5ec;padding-top:12px;margin-top:4px;color:#15161a;align-items:baseline;font-weight:700}.sum-row.total strong{font-size:24px;font-weight:900;color:#c2410c}
.mini-ship{font-size:13px;color:#4b5060;background:#f3f4f8;border-radius:8px;padding:8px 10px}
.submit{margin-top:6px;padding:16px;font-size:17px}.fine{font-size:12px;color:#4b5060;margin:0}.warn{color:#b42318}
.pending-box,.empty{background:#fff;border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.placed{background:#fff;border-radius:14px;padding:20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:16px}.shop-shell .placed p{margin:0}
.split-note{margin:0;font-size:14px;background:#fff7ed;color:#9a3412;border-radius:10px;padding:8px 12px}
.group{border:1px solid #eef0f4;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}.shop-shell .group-head{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}.arrival{font-size:13px;color:#4b5060}.shop-shell .group-total{margin:0;text-align:right;font-size:14px;font-weight:700}
.tag.stock{background:#eef2ff;color:#3730a3}.tag.pre{background:#fff7ed;color:#9a3412}.placed-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;width:100%}.placed-list li{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.merge-warn.top{margin-bottom:16px}
.merge-warn{background:#fff7f1;border:1px solid #fed7bd;border-radius:12px;padding:12px 14px;font-size:14px;color:#7c2d12}
.link{border:0;background:transparent;color:#1d4ed8;text-decoration:underline;cursor:pointer;font:inherit;padding:0}
@media(max-width:768px){.line{grid-template-columns:64px minmax(0,1fr)}.thumb{width:64px}.qty-step,.qty-text{grid-column:2;justify-self:start}.line-total{grid-column:2}.panel{position:static}}
</style>
