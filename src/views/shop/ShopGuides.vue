<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { guide, guides, type Guide } from '@/api/guides'
const route = useRoute()
const list = ref<Guide[]>([]), current = ref<Guide>(), error = ref(''), notFound = ref(false), loading = ref(false)
watch(() => route.params.slug, async slug => {
  loading.value = true; error.value = ''; notFound.value = false; current.value = undefined
  try {
    if (typeof slug === 'string' && slug) current.value = await guide(slug)
    else list.value = await guides()
  } catch (e: any) { if (e?.status === 404) notFound.value = true; else error.value = e?.message || '指南暫時無法載入' }
  finally { loading.value = false }
}, { immediate: true })
</script>
<template>
  <section class="shop-panel guide">
    <nav class="crumbs" aria-label="麵包屑"><router-link to="/shop">首頁</router-link> › <router-link v-if="current || notFound" to="/shop/guides">購物指南</router-link><span v-else>購物指南</span><template v-if="current"> › {{ current.title }}</template></nav>
    <p v-if="loading" role="status">載入中…</p>
    <p v-else-if="error" class="shop-error" role="alert">{{ error }}</p>
    <template v-else-if="notFound"><h1>找不到這篇指南</h1><p><router-link to="/shop/guides">看看所有購物指南 →</router-link></p></template>
    <article v-else-if="current">
      <h1>{{ current.title }}</h1>
      <p class="lead">{{ current.description }}</p>
      <template v-for="s in current.sections" :key="s.heading">
        <h2>{{ s.heading }}</h2>
        <p v-for="(p, i) in s.paragraphs" :key="i">{{ p }}</p>
      </template>
      <template v-if="current.faqs.length">
        <h2>常見問題</h2>
        <details v-for="f in current.faqs" :key="f.question" open><summary>{{ f.question }}</summary><p>{{ f.answer }}</p></details>
      </template>
      <p class="muted">最後更新：{{ current.updated }}</p>
    </article>
    <template v-else>
      <h1>購物指南與知識</h1>
      <ul class="guide-list"><li v-for="g in list" :key="g.slug"><router-link :to="'/shop/guides/' + g.slug">{{ g.title }}</router-link><span>{{ g.description }}</span></li></ul>
    </template>
  </section>
</template>
<style scoped>
.guide { max-width: 820px; }
.crumbs { font-size: 13px; color: #4b5060; margin-bottom: 8px; }
.lead { font-size: 16px; color: #2b2e38; }
.guide h2 { font-size: 20px; margin: 24px 0 8px; }
.guide p { line-height: 1.8; }
details { border: 1px solid #e3e5ec; border-radius: 10px; padding: 10px 14px; margin: 8px 0; background: #fff; }
summary { font-weight: 700; cursor: pointer; }
.muted { color: #6b7080; font-size: 13px; margin-top: 24px; }
.guide-list { list-style: none; padding: 0; display: grid; gap: 12px; }
.guide-list li { display: flex; flex-direction: column; gap: 4px; background: #fff; border: 1px solid #e3e5ec; border-radius: 12px; padding: 14px; }
.guide-list a { font-weight: 700; font-size: 16px; }
.guide-list span { font-size: 14px; color: #4b5060; }
</style>
