<script setup lang="ts">
import { computed } from 'vue'
import ProductCover from './ProductCover.vue'
import { money, type PublicProduct } from '@/api/catalog'
import { buyState, minPrice, shortDate } from './useCatalog'
// compact：商品頁「相關商品」使用，不顯示狀態文字，避免與主商品的款式庫存文字重複。
const props = defineProps<{ product: PublicProduct; compact?: boolean }>()
// 預購商品看配額與截單日，不顯示現貨庫存；只有現貨才顯示「有庫存／暫無庫存」。
const state = computed(() => buyState(props.product))
const badge = computed(() => {
  switch (state.value.kind) {
    case 'stock': case 'stock-pre': return { text: '現貨', cls: 'stock' }
    case 'pre': return { text: '預購', cls: 'pre' }
    case 'pre-full': return { text: '額滿', cls: 'out' }
    default: return { text: '售完', cls: 'out' }
  }
})
const price = computed(() => {
  const s = state.value
  if (s.kind === 'pre' || s.kind === 'pre-full') return money(s.batch.priceTwd)
  const min = minPrice(props.product), multi = new Set(props.product.skus.map(x => x.priceTwd)).size > 1
  return money(min) + (multi ? ' 起' : '')
})
</script>
<template>
  <router-link :to="'/shop/products/' + product.id" class="product-card">
    <div class="art">
      <ProductCover :image="product.image" :category="product.category" />
      <span class="badge" :class="badge.cls">{{ badge.text }}</span>
    </div>
    <span class="meta">{{ product.brand }}<template v-if="product.work">・{{ product.work }}</template></span>
    <span class="title">{{ product.title }}</span>
    <strong class="price">{{ price }}</strong>
    <span v-if="!compact" class="state">
      <template v-if="state.kind === 'pre'"><span class="pre">預購中</span>・{{ shortDate(state.batch.deadlineAt) }} 截單</template>
      <template v-else-if="state.kind === 'pre-full'"><span class="none">預購額滿</span></template>
      <template v-else-if="state.kind === 'stock-pre'"><span class="ok">有庫存</span>・另有預購 {{ shortDate(state.batch.deadlineAt) }} 截單</template>
      <span v-else :class="state.kind === 'stock' ? 'ok' : 'none'">{{ state.kind === 'stock' ? '有庫存' : '暫無庫存' }}</span>
    </span>
  </router-link>
</template>
<style scoped>
.product-card { display: flex; flex-direction: column; gap: 6px; background: #fff; border-radius: 14px; padding: 12px; color: #15161a !important; min-width: 0; transition: box-shadow .15s, transform .15s; }
.product-card:hover { box-shadow: 0 6px 20px rgba(27, 31, 59, .10); transform: translateY(-2px); }
.product-card:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 3px; }
.art { position: relative; margin-bottom: 4px; }
.badge { position: absolute; top: 8px; left: 8px; font-size: 12px; font-weight: 900; padding: 4px 9px; border-radius: 6px; color: #fff; }
.badge.pre { background: #c2410c; } .badge.stock { background: #1d4ed8; } .badge.out { background: #4b5060; }
.meta { font-size: 12px; color: #6b7080; overflow-wrap: anywhere; }
.title { font-size: 14px; line-height: 1.5; font-weight: 500; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 42px; }
.price { font-size: 18px; font-weight: 900; color: #c2410c; }
.state { font-size: 12px; color: #4b5060; }
.state .ok { color: #1e3a8a; } .state .none { color: #6b7080; } .state .pre { color: #9a3412; font-weight: 700; }
</style>
