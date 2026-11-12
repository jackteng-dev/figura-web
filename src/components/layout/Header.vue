<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useUserInfoStore } from '@/stores/userInfo'
import { adminLogoutService } from '@/api/user'
import router from '@/router'

const emit = defineEmits<{ menu: [] }>()
const route = useRoute()
const userInfoStore = useUserInfoStore()
const menuOpen = ref(false)
const menuRoot = ref<HTMLElement>()

const GROUP_OF: Record<string, string> = {
  '/admin/orders': '營運', '/admin/notifications': '營運', '/admin/products': '商品', '/admin/masters': '商品',
  '/admin/preorders': '預購', '/admin/preorder-orders': '預購', '/admin/preorder-arrivals': '預購',
  '/admin/account': '系統', '/admin/roles': '系統', '/admin/permissions': '系統', '/admin/access/audit': '系統'
}
// 頁面標題以一般文字顯示（不是 heading），避免和各頁自己的 h1 重複。
const crumb = computed(() => {
  if (route.path === '/home') return ['工作首頁']
  if (route.path === '/admin/user/info') return ['我的帳號', '基本資料']
  const title = String(route.meta.title || '')
  const group = GROUP_OF[route.path]
  return [group, title].filter(Boolean)
})
const displayName = computed(() => {
  const i = userInfoStore.info
  return [i?.firstName, i?.lastName].filter(Boolean).join('') || i?.username || '員工'
})
const initial = computed(() => displayName.value.slice(0, 1).toUpperCase())

function onDocClick(e: MouseEvent) { if (menuRoot.value && !menuRoot.value.contains(e.target as Node)) menuOpen.value = false }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') menuOpen.value = false }
onMounted(() => { document.addEventListener('click', onDocClick); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey) })

const logout = () => {
  menuOpen.value = false
  ElMessageBox.confirm('你確認要登出嗎?', '溫馨提示', { confirmButtonText: '確定', cancelButtonText: '取消', type: 'warning' })
    .then(async () => {
      await adminLogoutService()
      localStorage.removeItem('deviceId')
      userInfoStore.removeInfo()
      router.push('/admin/login')
      ElMessage({ type: 'success', message: '登出成功' })
    })
    .catch(() => { /* 使用者取消 */ })
}
</script>

<template>
  <header class="fg-topbar">
    <button type="button" class="fg-menu-btn" aria-label="開啟選單" @click="emit('menu')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
    <nav class="fg-crumb" aria-label="目前位置">
      <template v-for="(c, i) in crumb" :key="i"><span v-if="i" class="sep" aria-hidden="true">／</span><span :class="{ cur: i === crumb.length - 1 }">{{ c }}</span></template>
    </nav>
    <div ref="menuRoot" class="fg-user">
      <button type="button" class="fg-user-btn" :aria-expanded="menuOpen" aria-haspopup="menu" @click="menuOpen = !menuOpen">
        <span class="avatar" aria-hidden="true">{{ initial }}</span>
        <span class="who"><b>{{ displayName }}</b><span v-if="userInfoStore.info?.username && displayName !== userInfoStore.info?.username">{{ userInfoStore.info?.username }}</span></span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div v-if="menuOpen" class="fg-user-menu" role="menu">
        <a role="menuitem" href="/shop" target="_blank" rel="noopener" @click="menuOpen = false">前往商店 ↗</a>
        <button role="menuitem" type="button" class="danger" @click="logout">登出</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.fg-topbar { position: sticky; top: 0; z-index: 30; background: #fff; border-bottom: 1px solid #e3e5ec; padding: 10px 24px; display: flex; align-items: center; gap: 14px; min-height: 64px; box-sizing: border-box; }
.fg-menu-btn { display: none; width: 44px; height: 44px; border: 0; background: #f3f4f8; border-radius: 10px; align-items: center; justify-content: center; cursor: pointer; }
.fg-menu-btn svg, .chev { width: 22px; height: 22px; fill: none; stroke: #15161a; stroke-width: 2; }
.chev { width: 16px; height: 16px; stroke: #4b5060; }
.fg-crumb { font-size: 14px; color: #4b5060; display: flex; gap: 6px; flex-wrap: wrap; min-width: 0; }
.fg-crumb .cur { color: #15161a; font-weight: 900; font-size: 16px; }
.sep { color: #b3b7c4; }
.fg-user { margin-left: auto; position: relative; }
.fg-user-btn { display: flex; align-items: center; gap: 10px; border: 0; background: transparent; padding: 6px 8px; border-radius: 12px; cursor: pointer; font: inherit; text-align: left; }
.fg-user-btn:hover { background: #f3f4f8; }
.avatar { width: 34px; height: 34px; border-radius: 999px; background: #e8eefc; color: #1d4ed8; display: flex; align-items: center; justify-content: center; font-weight: 900; }
.who { display: flex; flex-direction: column; line-height: 1.25; font-size: 14px; color: #15161a; }
.who span { font-size: 12px; color: #4b5060; }
.fg-user-menu { position: absolute; right: 0; top: calc(100% + 6px); background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(27, 31, 59, .16); padding: 6px; min-width: 180px; display: flex; flex-direction: column; }
.fg-user-menu a, .fg-user-menu button { text-align: left; padding: 10px 12px; border-radius: 8px; font-size: 14px; color: #15161a !important; text-decoration: none; border: 0; background: transparent; font: inherit; cursor: pointer; }
.fg-user-menu a:hover, .fg-user-menu button:hover { background: #f3f4f8; }
.fg-user-menu .danger { color: #8a1c1c !important; border-top: 1px solid #eceef4; border-radius: 0 0 8px 8px; margin-top: 4px; }
@media (max-width: 991.98px) {
  .fg-topbar { padding: 10px 16px; }
  .fg-menu-btn { display: inline-flex; }
}
@media (max-width: 560px) { .who { display: none; } }
@media (min-width: 1400px) { .fg-topbar { padding: 10px 32px; } }
</style>
