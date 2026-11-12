<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'

// 新版後台外框：不再使用 Mantis 的 pc-* 版型與 pcoded.js，側欄與使用者選單由 Vue 自行控制。
const route = useRoute()
const navOpen = ref(false)
watch(() => route.fullPath, () => { navOpen.value = false })
</script>

<template>
  <div class="fg-admin fg-shell">
    <a class="fg-skip" href="#fg-main">跳到主要內容</a>
    <Sidebar :open="navOpen" @close="navOpen = false" />
    <div v-if="navOpen" class="fg-scrim" aria-hidden="true" @click="navOpen = false"></div>
    <div class="fg-body">
      <Header @menu="navOpen = true" />
      <main id="fg-main" class="fg-main"><router-view /></main>
    </div>
  </div>
</template>

<style scoped>
.fg-shell { display: flex; min-height: 100vh; }
.fg-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fg-main { padding: 16px 12px 40px; flex: 1; min-width: 0; }
@media (min-width: 576px) { .fg-main { padding: 20px 16px 40px; } }
@media (min-width: 992px) { .fg-main { padding: 24px 24px 48px; } }
@media (min-width: 1400px) { .fg-main { padding: 28px 32px 56px; } }
.fg-skip { position: absolute; left: -9999px; top: 8px; z-index: 100; background: #1b1f3b; color: #fff !important; padding: 10px 16px; border-radius: 8px; }
.fg-skip:focus { left: 8px; }
.fg-scrim { position: fixed; inset: 0; background: rgba(21, 22, 26, .45); z-index: 35; }
</style>
