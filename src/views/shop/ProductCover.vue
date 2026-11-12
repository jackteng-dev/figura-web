<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ProductImage } from '@/api/catalog'
const props = defineProps<{ image: ProductImage | null | undefined; category?: string }>(), failed = ref(false)
watch(() => props.image?.id, () => failed.value = false)
</script>
<template>
  <div class="cover">
    <img v-if="image && !failed" :src="image.url" :alt="image.alt" loading="lazy" @error="failed = true">
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
