<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserInfoStore } from '@/stores/userInfo'
import type { Permission } from '@/types/user'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const route = useRoute()
const store = useUserInfoStore()

// 選單仍由權限決定；這裡只負責把已授權的頁面分組與排序。
const GROUPS: { label: string; paths: string[] }[] = [
  { label: '營運', paths: ['/admin/orders', '/admin/notifications'] },
  { label: '商品', paths: ['/admin/products', '/admin/masters'] },
  { label: '預購', paths: ['/admin/preorders', '/admin/preorder-orders', '/admin/preorder-arrivals'] },
  { label: '系統', paths: ['/admin/account', '/admin/roles', '/admin/permissions', '/admin/access/audit'] }
]
const groups = computed(() => {
  const pages = store.permissions.filter((p: Permission) => p.adminRouter)
  const used = new Set<string>()
  const result = GROUPS.map(g => {
    const items = g.paths.map(path => pages.find(p => p.adminRouter === path)).filter((p): p is Permission => !!p)
    items.forEach(p => used.add(p.adminRouter))
    return { label: g.label, items }
  }).filter(g => g.items.length)
  const rest = pages.filter(p => !used.has(p.adminRouter))
  if (rest.length) result.push({ label: '其他', items: rest })
  return result
})
const active = (path: string) => route.path === path || route.path.startsWith(path + '/')
</script>

<template>
  <nav class="fg-sidebar" :class="{ open }" aria-label="後台選單">
    <router-link to="/home" class="fg-brand" @click="emit('close')">
      <span class="mark" aria-hidden="true">F</span>
      <span class="words"><span class="name">Figura<span>.</span></span><span class="sub">員工後台</span></span>
    </router-link>
    <div class="fg-nav">
      <div class="fg-group">
        <router-link to="/home" class="fg-link" :class="{ on: route.path === '/home' }" @click="emit('close')">工作首頁</router-link>
      </div>
      <div v-for="g in groups" :key="g.label" class="fg-group">
        <span class="fg-group-label" aria-hidden="true">{{ g.label }}</span>
        <router-link v-for="item in g.items" :key="item.id" :to="item.adminRouter" class="fg-link" :class="{ on: active(item.adminRouter) }" @click="emit('close')">{{ item.name }}</router-link>
      </div>
    </div>
    <a href="/shop" class="fg-shop-link" target="_blank" rel="noopener">前往商店 ↗</a>
  </nav>
</template>

<style scoped>
.fg-sidebar { width: 248px; flex: none; background: #1b1f3b; color: #c9cce0; padding: 20px 14px; display: flex; flex-direction: column; gap: 18px; position: sticky; top: 0; height: 100vh; overflow-y: auto; box-sizing: border-box; z-index: 40; }
.fg-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px; color: #fff !important; text-decoration: none; }
.mark { width: 36px; height: 36px; background: #ffd23f; color: #1b1f3b; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; }
.words { display: flex; flex-direction: column; line-height: 1.2; }
.name { font-weight: 900; font-size: 19px; }
.name span { color: #ffd23f; }
.sub { font-size: 11px; color: #9aa0c4; letter-spacing: 1px; }
.fg-nav { display: flex; flex-direction: column; gap: 16px; flex: 1; }
.fg-group { display: flex; flex-direction: column; gap: 2px; }
.fg-group-label { font-size: 11px; letter-spacing: 2px; color: #8f96bd; padding: 0 12px 6px; }
.fg-link { display: block; text-decoration: none; font-size: 14px; padding: 10px 12px; border-radius: 10px; color: #c9cce0 !important; }
.fg-link:hover { background: rgba(255, 255, 255, .06); color: #fff !important; }
.fg-link.on { background: #2a2f57; color: #fff !important; font-weight: 700; box-shadow: inset 3px 0 0 #ffd23f; }
.fg-shop-link { font-size: 13px; color: #c9cce0 !important; text-decoration: none; padding: 10px 12px; border: 1px solid #3a4070; border-radius: 10px; text-align: center; }
.fg-shop-link:hover { color: #fff !important; border-color: #ffd23f; }
@media (max-width: 1024px) {
  .fg-sidebar { position: fixed; left: 0; top: 0; transform: translateX(-100%); visibility: hidden; transition: transform .2s, visibility .2s; }
  .fg-sidebar.open { transform: none; visibility: visible; box-shadow: 8px 0 24px rgba(0, 0, 0, .2); }
}
</style>
