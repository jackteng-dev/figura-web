<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ProductImage } from '@/api/catalog'
// eager：首頁輪播等一開始就會輪到的圖片，不延遲載入，避免換張時閃空白。
const props = defineProps<{ image: ProductImage | null | undefined; category?: string; eager?: boolean; priority?:boolean; sizes?:string }>(), failed = ref(false)
const srcset=computed(()=>props.image?.variants?.length?[...props.image.variants.map(v=>`${v.url} ${v.width}w`),`${props.image.url} ${props.image.width}w`].join(', '):undefined)
const alt=computed(()=>{const text=props.image?.alt||'';return /AI\s*生成/.test(text)&&!text.includes('AI 生成示意圖')?`${text}（AI 生成示意圖）`:text})
watch(() => props.image?.url, () => failed.value = false)
</script>
<template>
  <div class="cover">
    <img v-if="image && !failed" :src="image.url" :srcset="srcset" :sizes="sizes || '(max-width: 600px) 45vw, 300px'" :width="image.width" :height="image.height" :alt="alt" :loading="eager ? 'eager' : 'lazy'" :fetchpriority="priority ? 'high' : 'auto'" decoding="async" @error="failed = true">
    <div v-else class="cover-empty" aria-hidden="false">
      <span class="mark" aria-hidden="true">F</span>
      <small>{{ failed ? '商品圖片暫時無法載入' : (category ? category + '・圖片準備中' : '圖片準備中') }}</small>
    </div>
  </div>
</template>
<style scoped>
.cover { background: #eceef4; border-radius: 12px; overflow: hidden; aspect-ratio: 1 / 1; width: 100%; }
.cover img { display: block; width: 100%; height: 100%; object-fit: contain; }
.cover-empty { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; color: #6b7080; text-align: center; padding: 12px; }
.mark { width: 48px; height: 48px; border-radius: 12px; background: #dfe2ec; color: #9096ab; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 24px; }
.cover-empty small { font-size: 12px; }
</style>
