<script setup lang="ts">
// 營運狀態（Commerce V2 Phase 7）：服務健康與待處理事項。錯誤只顯示代碼與類型，不含個資。
import { onMounted, ref } from 'vue'
import { opsStatus, type OpsStatus } from '@/api/ops'
const s = ref<OpsStatus>(), error = ref(''), loading = ref(false)
async function load() { loading.value = true; error.value = ''; try { s.value = await opsStatus() } catch (e: any) { error.value = e.response?.data?.message || e.message } finally { loading.value = false } }
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body">
  <h1>營運狀態</h1>
  <p v-if="error" role="alert">{{ error }}</p>
  <button :disabled="loading" @click="load">重新檢查</button>
  <template v-if="s">
   <ul class="grid">
    <li :class="s.database ? 'ok' : 'bad'">資料庫：{{ s.database ? '正常' : '異常' }}</li>
    <li :class="s.redis ? 'ok' : 'bad'">Redis：{{ s.redis ? '正常' : '異常' }}</li>
    <li>通知佇列：<span v-for="(n, k) in s.notifications" :key="k">{{ k }} {{ n }}　</span></li>
    <li :class="{ warn: s.warehouseOverdue > 0 }">倉庫暫存逾期：{{ s.warehouseOverdue }}</li>
    <li :class="{ warn: s.adjustmentsPending > 0 }">待審運費調整：{{ s.adjustmentsPending }}</li>
    <li :class="{ warn: s.ticketsWaiting > 0 }">待回覆客服單：{{ s.ticketsWaiting }}</li>
    <li>送審中頁面：{{ s.pagesInReview }}</li>
    <li :class="{ warn: s.serverErrors > 0 }">伺服器錯誤（本次啟動後）：{{ s.serverErrors }}</li>
   </ul>
   <h2>最近錯誤</h2>
   <p v-if="!s.recentErrors.length">沒有。</p>
   <table v-else><thead><tr><th>錯誤代碼</th><th>類型</th><th>路徑</th><th>時間</th></tr></thead><tbody>
    <tr v-for="e in s.recentErrors" :key="String(e.errorId)"><td>{{ e.errorId }}</td><td>{{ e.type }}</td><td>{{ e.path }}</td><td>{{ e.at }}</td></tr>
   </tbody></table>
   <p><small>檢查時間 {{ s.checkedAt }}。長期監控請以伺服器日誌依錯誤代碼查詢。</small></p>
  </template>
 </div></section>
</template>
<style scoped>
.grid { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; margin: 12px 0; }
.grid li { border: 1px solid #e3e5ec; border-radius: 8px; padding: 10px; }
.ok { border-color: #86efac !important; } .bad { border-color: #fca5a5 !important; background: #fef2f2; } .warn { background: #fffbeb; }
table { width: 100%; } td, th { padding: 6px 8px; }
</style>
