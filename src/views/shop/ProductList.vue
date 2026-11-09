<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ProductCover from './ProductCover.vue'
import { publicProducts, money, type Page, type PublicProduct } from '@/api/catalog'
const result = ref<Page<PublicProduct>>(), page = ref(1), loading = ref(false), error = ref('')
async function load(next = page.value) {
  loading.value = true; error.value = ''; result.value = undefined
  try { result.value = await publicProducts(next); page.value = next } catch (e: any) { error.value = e.message }
  finally { loading.value = false }
}
onMounted(() => load())
</script>
<template>
  <section><p class="eyebrow">THE COLLECTION</p><h1>收藏商品</h1><p>每一款，都為喜歡的角色留一個位置。可加入購物車與下單，付款、配送及退款目前提供模擬演練。</p>
    <p v-if="loading" role="status">正在載入商品…</p>
    <div v-else-if="error" role="alert" class="shop-error">{{ error }} <button class="shop-button" @click="load()">重新載入</button></div>
    <p v-else-if="result?.items.length === 0" role="status">目前沒有上架商品，歡迎稍後再來看看。</p>
    <div v-else class="catalog-grid"><router-link v-for="product in result?.items" :key="product.id" :to="'/shop/products/' + product.id" class="catalog-card">
      <ProductCover :image="product.image" :category="product.category" />
      <div class="catalog-copy"><p>{{ product.brand }} · {{ product.category }}<span v-if="product.work"> · {{product.work}}</span></p><h2>{{ product.title }}</h2><strong>{{ money(Math.min(...product.skus.map(s => s.priceTwd))) }} 起</strong><p class="mt-2">{{ product.skus.some(s => s.available) ? '有庫存' : '暫無庫存' }}</p><span>查看款式 →</span></div>
    </router-link></div>
    <nav v-if="result && result.total > result.pageSize" class="catalog-pagination" aria-label="商品分頁"><button class="shop-button" :disabled="loading || page === 1" @click="load(page-1)">上一頁</button><span>第 {{ page }} 頁 · {{ result.total }} 件商品</span><button class="shop-button" :disabled="loading || page * result.pageSize >= result.total" @click="load(page+1)">下一頁</button></nav>
  </section>
</template>
<style>
.eyebrow { font-size:11px;letter-spacing:3px; }.catalog-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:32px; }.catalog-card { background:#fffdf8;border:1px solid #dedfd1;border-radius:10px;overflow:hidden;min-width:0; }.catalog-card:focus-visible { outline:3px solid #365545;outline-offset:4px; }.catalog-art { aspect-ratio:1.2;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;background:linear-gradient(145deg,#e3e7d9,#ede3d1);color:#64735c; }.catalog-art span { font-size:12px; }.catalog-art strong { font:38px Georgia;letter-spacing:6px; }.catalog-art small { letter-spacing:3px;font-size:9px; }.catalog-copy { padding:22px;overflow-wrap:anywhere; }.catalog-copy p { font-size:12px;margin-bottom:10px; }.catalog-copy h2 { font-size:20px;line-height:1.5;margin-bottom:18px; }.catalog-copy>span { display:block;font-size:13px;margin-top:16px; }.catalog-pagination { display:flex;justify-content:center;gap:20px;align-items:center;margin-top:30px; }
@media(max-width:800px) { .catalog-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }@media(max-width:500px) { .catalog-grid { grid-template-columns:1fr; }.catalog-pagination { gap:8px;font-size:12px; } }
</style>
