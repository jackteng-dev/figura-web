<script setup lang="ts">
// 密碼輸入框＋顯示／隱藏切換（眼睛按鈕）。其他屬性（id、class、placeholder、autocomplete、required…）
// 都傳給 <input>，所以原本的 <label for> 與 smoke 的 getByLabel／getByPlaceholder 不受影響。
import { ref } from 'vue'
defineOptions({ inheritAttrs: false })
const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>

<template>
  <span class="pw-field">
    <input v-bind="$attrs" v-model="model" :type="visible ? 'text' : 'password'" autocapitalize="off" spellcheck="false">
    <button type="button" class="pw-toggle" :aria-label="visible ? '隱藏密碼' : '顯示密碼'" :aria-pressed="visible" :title="visible ? '隱藏密碼' : '顯示密碼'" @click="visible = !visible">
      <svg v-if="!visible" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
    </button>
  </span>
</template>

<style scoped>
.pw-field { position: relative; display: block; width: 100%; }
.pw-field input { width: 100%; box-sizing: border-box; padding-right: 48px !important; }
.pw-toggle { position: absolute; top: 50%; right: 6px; transform: translateY(-50%); width: 38px; height: 38px; border: 0; border-radius: 8px; background: transparent; color: #4b5060; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.pw-toggle:hover { background: #f3f4f8; color: #15161a; }
.pw-toggle:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 1px; }
.pw-toggle svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
