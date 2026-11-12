<script setup lang="ts">
import { computed } from 'vue'
import ProductCover from './ProductCover.vue'
import { money, type PublicProduct } from '@/api/catalog'
import { batchesByProduct, inStock, minPrice, shortDate } from './useCatalog'
// compact：商品頁「相關商品」使用，不顯示庫存文字，避免與主商品的款式庫存文字重複。
const props = defineProps<{ product: PublicProduct; compact?: boolean }>()
const batch = computed(() => batchesByProduct.value.get(props.product.id)?.[0])
const available = computed(() => inStock(props.product))
const badge = computed(() => batch.value ? { text: '預購', cls: 'pre' } : available.value ? { text: '現貨', cls: 'stock' } : { text: '售完', cls: 'out' })
const price = computed(() => {
  const min = minPrice(props.product), multi = new Set(props.product.skus.map(s => s.priceTwd)).size > 1
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
      <span :class="available ? 'ok' : 'none'">{{ available ? '有庫存' : '暫無庫存' }}</span>
      <template v-if="batch"> ・預購 {{ shortDate(batch.deadlineAt) }} 截單</template>
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
.state .ok { color: #1e3a8a; } .state .none { color: #6b7080; }
</style>
