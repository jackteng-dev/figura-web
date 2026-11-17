<script setup lang="ts">
// 模擬寄信：顧客的 Email 驗證信與重設密碼信不會真的寄出，內容存在這裡供展示。
// 連結是一次性的，點開就等於「收信後點連結」。
import { onMounted, ref } from 'vue'
import api from '@/api/api'
interface MockEmail { id: string; purpose: 'VERIFY' | 'RESET'; recipient: string; subject: string; link: string; expiresAt: string; createdAt: string }
const rows = ref<MockEmail[]>([]), page = ref(1), total = ref(0), loading = ref(false), error = ref('')
async function load() {
  loading.value = true; error.value = ''
  try {
    const r = (await api.get<any, { data: { items: MockEmail[]; total: number } }>('/admin/notifications/mock-emails', { params: { page: page.value, pageSize: 10 } })).data
    rows.value = r.items; total.value = r.total
  } catch (e: any) { error.value = e?.message || '讀取失敗' } finally { loading.value = false }
}
const fmt = (v: string) => v.replace('T', ' ').slice(0, 16)
const expired = (v: string) => new Date(v).getTime() < Date.now()
onMounted(load)
</script>
<template>
  <section class="card mock-mail" aria-labelledby="mock-mail-title"><div class="card-body">
    <div class="head"><h2 id="mock-mail-title">模擬信件（Email 驗證／重設密碼）</h2><button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading" @click="load">重新整理</button></div>
    <p class="text-muted">展示站不實際寄信。顧客註冊、重寄驗證信或忘記密碼時，信件內容會出現在這裡；點連結即可完成驗證或重設密碼（連結只能用一次）。</p>
    <p v-if="error" class="alert alert-danger">{{ error }}</p>
    <p v-if="!loading && !rows.length" class="text-muted">目前沒有模擬信件。</p>
    <table v-if="rows.length" class="table">
      <thead><tr><th>時間</th><th>收件人</th><th>主旨</th><th>連結</th></tr></thead>
      <tbody>
        <tr v-for="m in rows" :key="m.id">
          <td>{{ fmt(m.createdAt) }}</td><td>{{ m.recipient }}</td><td>{{ m.subject }}</td>
          <td><a v-if="!expired(m.expiresAt)" :href="m.link" target="_blank" rel="noopener noreferrer">{{ m.purpose === 'VERIFY' ? '開啟驗證連結' : '開啟重設連結' }} ↗</a><span v-else class="text-muted">已過期</span></td>
        </tr>
      </tbody>
    </table>
    <div v-if="total > 10" class="pager"><button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || page === 1" @click="page--; load()">上一頁</button><span>第 {{ page }} 頁</span><button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || page * 10 >= total" @click="page++; load()">下一頁</button></div>
  </div></section>
</template>
<style scoped>
.mock-mail { margin-top: 24px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.head h2 { font-size: 18px; margin: 0; }
.table td, .table th { font-size: 13px; overflow-wrap: anywhere; }
.pager { display: flex; gap: 12px; align-items: center; }
</style>
