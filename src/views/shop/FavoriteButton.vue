<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFavorites } from './useFavorites'
const props = defineProps<{ productId: string; title: string }>()
const fav = useFavorites()
const on = computed(() => fav.has(props.productId))
const error = ref('')
async function click() {
  error.value = ''
  try { await fav.toggle(props.productId) } catch (e) { error.value = e instanceof Error ? e.message : '收藏失敗，請稍後再試' }
}
</script>
<template>
  <span class="fav-wrap">
    <button type="button" class="fav" :class="{ on }" :aria-pressed="on" :disabled="fav.pending.value.has(productId)" :aria-label="(on ? '取消收藏 ' : '收藏 ') + title" @click="click">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.3 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" /></svg>
      {{ on ? '已收藏' : '收藏' }}
    </button>
    <small v-if="on && fav.guest.value" class="muted">（暫存在這台裝置，登入後會合併）</small>
    <small v-if="error" class="shop-error" role="alert">{{ error }}</small>
  </span>
</template>
<style scoped>
.fav-wrap { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fav { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #d4d7e2; background: #fff; color: #2b2e38; border-radius: 999px; padding: 8px 14px; font-weight: 700; font-size: 14px; cursor: pointer; min-height: 40px; }
.fav svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }
.fav.on { border-color: #be123c; color: #be123c; background: #fff1f2; }
.fav.on svg { fill: currentColor; }
.fav:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
.fav:disabled { opacity: .6; cursor: wait; }
.muted { color: #6b7080; }
</style>
