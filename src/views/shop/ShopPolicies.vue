<script setup lang="ts">
// 政策與說明（Commerce V2 Phase 6）：只顯示已審核發布的內容；未發布顯示「條款審核中」，不顯示草稿或推測內容。
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { sitePage, sitePages, type PublicPage } from '@/api/support'
const route = useRoute()
const list = ref<PublicPage[]>([]), current = ref<PublicPage>(), error = ref(''), notFound = ref(false), loading = ref(false)
watch(() => route.params.slug, async slug => {
  loading.value = true; error.value = ''; notFound.value = false; current.value = undefined
  try { if (typeof slug === 'string' && slug) current.value = await sitePage(slug); else list.value = await sitePages() }
  catch (e: any) { if (e?.status === 404) notFound.value = true; else error.value = e?.message || '頁面暫時無法載入' }
  finally { loading.value = false }
}, { immediate: true })
const date = (v: string | null) => v ? new Date(v).toLocaleDateString('zh-TW') : ''
</script>
<template>
  <section class="shop-panel policy">
    <nav class="crumbs" aria-label="麵包屑"><router-link to="/shop">首頁</router-link> › <router-link v-if="current || notFound" to="/shop/pages">政策與說明</router-link><span v-else>政策與說明</span><template v-if="current"> › {{ current.title }}</template></nav>
    <p v-if="loading" role="status">載入中…</p>
    <p v-else-if="error" class="shop-error" role="alert">{{ error }}</p>
    <template v-else-if="notFound"><h1>找不到頁面</h1><p><router-link to="/shop/pages">看看所有政策與說明 →</router-link></p></template>
    <article v-else-if="current">
      <h1>{{ current.title }}</h1>
      <template v-if="current.published">
        <div class="body">{{ current.body }}</div>
        <p class="muted">最後更新：{{ date(current.publishedAt) }}（第 {{ current.revision }} 版）</p>
      </template>
      <p v-else class="pending" role="status">條款審核中。正式內容經審核後會公布在這裡；在此之前請以訂單頁顯示的資訊為準，或到 <router-link to="/shop/support">客服中心</router-link> 詢問。</p>
    </article>
    <template v-else>
      <h1>政策與說明</h1>
      <ul class="page-list"><li v-for="p in list" :key="p.slug"><router-link :to="'/shop/pages/' + p.slug">{{ p.title }}</router-link><span v-if="!p.published" class="tag">審核中</span></li></ul>
      <p class="muted">購物流程、預購規則與材質知識請看 <router-link to="/shop/guides">購物指南</router-link>。</p>
    </template>
  </section>
</template>
<style scoped>
.policy { max-width: 820px; }
.crumbs { font-size: 13px; color: #4b5060; margin-bottom: 8px; }
.body { white-space: pre-wrap; line-height: 1.9; }
.muted { color: #6b7080; font-size: 13px; margin-top: 20px; }
.pending { background: #fef3c7; color: #78350f; border-radius: 10px; padding: 12px 14px; }
.page-list { list-style: none; padding: 0; display: grid; gap: 8px; }
.page-list li { background: #fff; border: 1px solid #e3e5ec; border-radius: 10px; padding: 12px 14px; display: flex; gap: 8px; align-items: center; }
.page-list a { font-weight: 700; }
.tag { font-size: 12px; background: #eceef4; border-radius: 999px; padding: 2px 8px; color: #4b5060; }
</style>
