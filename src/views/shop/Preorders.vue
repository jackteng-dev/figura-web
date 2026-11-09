<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { publicBatches, publicBatch, taipeiTime, type PublicBatch } from '@/api/preorders'
const route = useRoute(), rows = ref<PublicBatch[]>([]), page = ref(1), total = ref(0), loading = ref(false), error = ref('')
const detail = computed(() => typeof route.params.id === 'string')
const status = { OPEN: '批次已開放', CLOSED: '已截單', EXPIRED: '已到截止時間' }
async function load() {
  loading.value = true; error.value = ''; rows.value = []
  try { if (detail.value) rows.value = [await publicBatch(String(route.params.id))]; else { const result = await publicBatches(page.value); rows.value = result.items; total.value = result.total } }
  catch (e: any) { error.value = e.message || '預購資料暫時無法載入。' }
  finally { loading.value = false }
}
watch(() => route.params.id, () => { page.value = 1; load() })
onMounted(load)
</script>

<template>
  <section class="preorders"><router-link v-if="detail" to="/shop/preorders">← 所有預購批次</router-link><h1>{{ detail ? '預購批次詳情' : '預購情報' }}</h1>
    <p>查看批次價格、截止時間與預計到貨區間。到貨區間為預估，可能調整；預購付款僅提供模擬，未付款配額會在保留期限到時釋放。</p>
    <p v-if="loading" role="status">載入中…</p><p v-if="error" role="alert" class="shop-error">{{ error }}</p><button :disabled="loading" class="shop-button" @click="load">重新載入</button>
    <div class="preorder-cards"><article v-for="b in rows" :key="b.id"><span class="badge">{{ status[b.status] }}</span><h2>{{ b.name }}</h2><p>{{ b.productTitle }} · {{ b.skuLabel }}</p><p class="price">NT$ {{ b.priceTwd.toLocaleString() }}</p><p>{{ b.description }}</p><dl><dt>截止時間（台北）</dt><dd>{{ taipeiTime(b.deadlineAt) }}</dd><dt>預計到貨</dt><dd>{{ b.arrivalFrom }} ～ {{ b.arrivalTo }}</dd><dt>批次剩餘配額</dt><dd>{{ b.availableQuota }} 件</dd></dl><router-link v-if="b.orderingEnabled" class="shop-button" :to="'/shop/preorders/' + b.id + '/checkout'">預購下單</router-link><p v-else>此批次目前無法下單</p><router-link v-if="!detail" :to="'/shop/preorders/' + b.id">查看批次詳情 →</router-link><router-link v-else :to="'/shop/products/' + b.productId">查看商品 →</router-link></article></div>
    <p v-if="!loading && !error && !rows.length">目前沒有公開的預購批次。</p>
    <div v-if="!detail" class="pagination"><button class="shop-button" :disabled="loading || page === 1" @click="page--; load()">上一頁</button><span>第 {{ page }} 頁</span><button class="shop-button" :disabled="loading || page * 12 >= total" @click="page++; load()">下一頁</button></div>
  </section>
</template>

<style scoped>
.preorders{min-width:0}.preorder-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin:28px 0}.preorder-cards article{padding:24px;background:#fffdf8;border:1px solid #dedfd1;border-radius:12px;overflow-wrap:anywhere}.preorder-cards h2{font-size:22px;margin:18px 0 10px}.badge{background:#e8eee2;color:#365545;padding:6px 10px;border-radius:5px;font-size:13px}.price{font-size:24px;color:#365545;font-weight:600}dt{font-size:13px;color:#697167;margin-top:14px}dd{margin:5px 0;font-size:15px}.pagination{display:flex;align-items:center;gap:20px}@media(max-width:650px){.preorder-cards{grid-template-columns:1fr}.preorder-cards article{padding:20px}.pagination{gap:12px}}
</style>
