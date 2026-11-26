<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { inbox, markRead, preferences, savePreferences, type Notice, type Preferences } from '@/api/engagement'
import { unreadCount } from './useNotices'
const router = useRouter()
const PAGE = 20
const items = ref<Notice[]>([]), total = ref(0), page = ref(1), onlyUnread = ref(false), loading = ref(false), error = ref('')
async function load(p = page.value) {
  loading.value = true; error.value = ''
  try { const r = await inbox(p, PAGE, onlyUnread.value); items.value = r.items; total.value = r.total; page.value = r.page; unreadCount.value = r.unread }
  catch (e) { error.value = e instanceof Error ? e.message : '通知暫時無法載入' }
  finally { loading.value = false }
}
function target(n: Notice) {
  if (n.productId) return '/shop/products/' + n.productId
  if (n.preorderOrderId) return '/shop/preorder-orders'
  if (n.orderId) return '/shop/my-orders'
  return null
}
async function open(n: Notice) {
  if (!n.readAt) { try { unreadCount.value = (await markRead({ ids: [n.id] })).unread; n.readAt = new Date().toISOString() } catch { /* 標記失敗不阻擋查看 */ } }
  const to = target(n); if (to) await router.push(to)
}
async function readAll() {
  try { unreadCount.value = (await markRead({ all: true })).unread; await load(1) } catch (e) { error.value = e instanceof Error ? e.message : '操作失敗' }
}
const time = (v: string) => new Date(v).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// 通知設定（偏好只影響 Email；站內通知一律保留）
const pref = ref<Preferences>(), prefSaving = ref(false), prefMsg = ref(''), prefErr = ref('')
async function loadPref() { try { pref.value = await preferences() } catch (e) { prefErr.value = e instanceof Error ? e.message : '通知設定暫時無法載入' } }
async function savePref() {
  if (!pref.value) return
  prefSaving.value = true; prefMsg.value = ''; prefErr.value = ''
  const { emailEnabled, orderUpdates, productAlerts, version } = pref.value
  try { pref.value = await savePreferences({ emailEnabled, orderUpdates, productAlerts, expectedVersion: version }); prefMsg.value = '通知設定已儲存。' }
  catch (e) {
    if (e instanceof CustomerApiError && e.status === 409) { await loadPref(); prefErr.value = '設定已在其他裝置變更，已重新載入，請確認後再儲存。' }
    else prefErr.value = e instanceof Error ? e.message : '儲存失敗，請稍後再試'
  } finally { prefSaving.value = false }
}
onMounted(() => { void load(1); void loadPref() })
</script>
<template>
  <section class="shop-panel">
    <h1>通知</h1>
    <div class="bar">
      <label class="shop-check"><input v-model="onlyUnread" type="checkbox" @change="load(1)"> 只看未讀</label>
      <button type="button" class="link" :disabled="!unreadCount" @click="readAll">全部標為已讀</button>
    </div>
    <p v-if="loading && !items.length" role="status">正在載入通知…</p>
    <div v-else-if="error" class="shop-error" role="alert">{{ error }} <button class="shop-button" @click="load()">重新載入</button></div>
    <div v-else-if="!items.length" class="shop-empty">{{ onlyUnread ? '沒有未讀通知。' : '目前沒有通知。訂單狀態與你設定的商品提醒會出現在這裡。' }}</div>
    <ul v-else class="notice-list">
      <li v-for="n in items" :key="n.id" :class="{ unread: !n.readAt }">
        <button type="button" @click="open(n)">
          <span class="cat">{{ n.category === 'PRODUCT' ? '商品提醒' : '訂單' }}</span>
          <span class="t">{{ n.title }}<span v-if="!n.readAt" class="visually-hidden">（未讀）</span></span>
          <span class="m">{{ n.message }}</span>
          <time :datetime="n.createdAt">{{ time(n.createdAt) }}</time>
        </button>
      </li>
    </ul>
    <nav v-if="total > PAGE" class="pager" aria-label="通知分頁">
      <button type="button" :disabled="page <= 1 || loading" @click="load(page - 1)">上一頁</button>
      <span>{{ page }} / {{ Math.ceil(total / PAGE) }}</span>
      <button type="button" :disabled="page * PAGE >= total || loading" @click="load(page + 1)">下一頁</button>
    </nav>
  </section>

  <section class="shop-panel" aria-labelledby="pref-title">
    <h2 id="pref-title">通知設定</h2>
    <p class="muted">站內通知一律保留；以下設定控制是否同時寄 Email。</p>
    <p v-if="prefErr" class="shop-error" role="alert">{{ prefErr }}</p>
    <form v-if="pref" @submit.prevent="savePref">
      <label class="shop-check"><input v-model="pref.emailEnabled" type="checkbox"> 寄送 Email 通知</label>
      <label class="shop-check"><input v-model="pref.orderUpdates" type="checkbox" :disabled="!pref.emailEnabled"> 訂單與付款、出貨進度</label>
      <label class="shop-check"><input v-model="pref.productAlerts" type="checkbox" :disabled="!pref.emailEnabled"> 我設定的商品提醒（補貨、開放預購、截止、發售）</label>
      <p v-if="pref.emailEnabled && !pref.emailVerified" class="warn">你的 Email 尚未驗證，驗證後才會寄出。<router-link to="/shop/account">前往會員資料 →</router-link></p>
      <p v-if="pref.emailEnabled && !pref.emailDeliveryActive" class="warn">目前為測試環境，Email 不會實際寄出。</p>
      <button class="shop-button" :disabled="prefSaving">{{ prefSaving ? '儲存中…' : '儲存設定' }}</button>
      <p v-if="prefMsg" class="shop-success" role="status">{{ prefMsg }}</p>
    </form>
  </section>
</template>
<style scoped>
.bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.link { background: none; border: 0; color: #1d4ed8; cursor: pointer; text-decoration: underline; min-height: 40px; }
.link:disabled { color: #9ca0ad; cursor: default; text-decoration: none; }
.notice-list { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 8px; }
.notice-list button { width: 100%; text-align: left; display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "cat t time" "m m m"; gap: 4px 10px; background: #fff; border: 1px solid #e3e5ec; border-radius: 12px; padding: 12px; cursor: pointer; color: #2b2e38; }
.notice-list button:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
.unread button { border-color: #fdba74; background: #fffaf5; }
.unread .t { font-weight: 900; }
.cat { grid-area: cat; font-size: 12px; background: #eceef4; border-radius: 999px; padding: 2px 8px; align-self: center; }
.t { grid-area: t; }
.m { grid-area: m; font-size: 14px; color: #4b5060; }
time { grid-area: time; font-size: 12px; color: #6b7080; }
.muted { color: #4b5060; font-size: 14px; }
.warn { font-size: 14px; color: #92400e; background: #fef3c7; border-radius: 8px; padding: 6px 10px; }
.pager { display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 16px; }
.pager button { min-height: 40px; padding: 0 14px; }
</style>
