<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { favorites, removeFavorite, ALERT_LABELS, type Favorite } from '@/api/engagement'
import { money, AVAILABILITY_LABELS } from '@/api/catalog'
import ProductCover from './ProductCover.vue'
const PAGE = 20
const items = ref<Favorite[]>([]), total = ref(0), page = ref(1), loading = ref(false), error = ref('')
async function load(p = page.value) {
  loading.value = true; error.value = ''
  try { const r = await favorites(p, PAGE); items.value = r.items; total.value = r.total; page.value = r.page }
  catch (e) { error.value = e instanceof Error ? e.message : '收藏暫時無法載入' }
  finally { loading.value = false }
}
async function remove(f: Favorite) {
  try { await removeFavorite(f.product.id); const last = items.value.length === 1 && page.value > 1; await load(last ? page.value - 1 : page.value) }
  catch (e) { error.value = e instanceof Error ? e.message : '移除失敗，請稍後再試' }
}
onMounted(() => load(1))
</script>
<template>
  <section class="shop-panel">
    <h1>我的收藏</h1>
    <p class="muted">共 {{ total }} 件。已下架的商品不會顯示；價格與可售狀態以商品頁下單時為準。</p>
    <p v-if="loading && !items.length" role="status">正在載入收藏…</p>
    <div v-else-if="error" class="shop-error" role="alert">{{ error }} <button class="shop-button" @click="load()">重新載入</button></div>
    <div v-else-if="!items.length" class="shop-empty">還沒有收藏商品。<router-link to="/shop/products">去逛逛 →</router-link></div>
    <ul v-else class="fav-list">
      <li v-for="f in items" :key="f.product.id">
        <router-link :to="'/shop/products/' + f.product.id" class="thumb" :aria-label="f.product.title"><ProductCover :image="f.product.image" :category="f.product.category" /></router-link>
        <div class="info">
          <router-link :to="'/shop/products/' + f.product.id" class="title">{{ f.product.title }}</router-link>
          <span class="meta">{{ f.product.brand }}<template v-if="f.product.work">・{{ f.product.work }}</template></span>
          <span><strong class="price">{{ f.product.minPriceTwd != null ? money(f.product.minPriceTwd) : '—' }}</strong>
            <span v-if="f.product.availability" class="avail" :class="'a-' + f.product.availability">{{ AVAILABILITY_LABELS[f.product.availability] }}</span></span>
          <span v-if="f.alerts.length" class="alerts">提醒：{{ f.alerts.map(a => ALERT_LABELS[a]).join('、') }}</span>
        </div>
        <button type="button" class="remove" :aria-label="'取消收藏 ' + f.product.title" @click="remove(f)">取消收藏</button>
      </li>
    </ul>
    <nav v-if="total > PAGE" class="pager" aria-label="收藏分頁">
      <button type="button" :disabled="page <= 1 || loading" @click="load(page - 1)">上一頁</button>
      <span>{{ page }} / {{ Math.ceil(total / PAGE) }}</span>
      <button type="button" :disabled="page * PAGE >= total || loading" @click="load(page + 1)">下一頁</button>
    </nav>
  </section>
</template>
<style scoped>
.muted { color: #4b5060; font-size: 14px; }
.fav-list { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 12px; }
.fav-list li { display: grid; grid-template-columns: 88px 1fr auto; gap: 12px; align-items: center; background: #fff; border: 1px solid #e3e5ec; border-radius: 12px; padding: 10px; }
.thumb { display: block; width: 88px; }
.info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.title { font-weight: 700; color: #15161a; overflow-wrap: anywhere; }
.meta, .alerts { font-size: 12px; color: #6b7080; }
.price { color: #c2410c; margin-right: 8px; }
.avail { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.a-IN_STOCK { background: #e7f6ec; color: #166534; } .a-PREORDER { background: #fff1e8; color: #9a3412; } .a-SOLD_OUT { background: #eceef4; color: #4b5060; }
.remove { border: 1px solid #d4d7e2; background: #fff; border-radius: 8px; padding: 8px 10px; cursor: pointer; min-height: 40px; }
.pager { display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 16px; }
.pager button { min-height: 40px; padding: 0 14px; }
@media (max-width: 480px) { .fav-list li { grid-template-columns: 72px 1fr; } .thumb { width: 72px; } .remove { grid-column: 1 / -1; } }
</style>
