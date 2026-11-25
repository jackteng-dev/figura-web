<script setup lang="ts">
// 帳號安全：後台強制雙因素。可查看狀態與剩餘備援碼、以目前驗證碼重新產生備援碼。不能自行停用；換手機請聯絡管理員重設。
import { onMounted, ref } from 'vue'
import { mfaStatus, mfaRegenerateBackupCodes, type MfaStatus } from '@/api/user'
const status = ref<MfaStatus>(), code = ref(''), codes = ref<string[]>([]), busy = ref(false), error = ref(''), message = ref('')
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
async function load() { try { status.value = await mfaStatus() } catch (e) { error.value = failure(e) } }
async function regenerate() {
  busy.value = true; error.value = ''; message.value = ''
  try { codes.value = await mfaRegenerateBackupCodes(code.value.trim()); code.value = ''; message.value = '已產生新的備援碼，舊的備援碼全部失效。' }
  catch (e) { error.value = failure(e) } finally { busy.value = false; await load() }
}
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body security">
  <h1>帳號安全</h1>
  <p>後台規定所有員工使用雙因素驗證：每次登入都需要驗證器 App 的 6 位數驗證碼（或一組備援碼）。</p>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  <template v-if="status">
   <p><strong>雙因素驗證：{{ status.enabled ? '已綁定' : '未綁定' }}</strong>　剩餘備援碼 {{ status.backupCodesRemaining }} 組</p>
   <p v-if="status.backupCodesRemaining <= 3" class="warn">備援碼所剩不多，建議重新產生。</p>
   <h2>重新產生備援碼</h2>
   <label for="mfa-code">輸入驗證器 App 目前的 6 位數驗證碼</label>
   <input id="mfa-code" v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
   <button :disabled="busy || code.trim().length !== 6" @click="regenerate">產生新的備援碼</button>
   <div v-if="codes.length" class="codes">
    <p><strong>這是唯一一次顯示</strong>，請存放在密碼管理工具或安全的地方：</p>
    <ul><li v-for="c in codes" :key="c"><code>{{ c }}</code></li></ul>
   </div>
   <h2>換手機或遺失驗證器</h2>
   <p>無法自行停用雙因素。遺失手機時可先用備援碼登入；手機與備援碼都遺失時，請聯絡系統管理員重設，重設後下次登入需重新綁定。</p>
  </template>
 </div></section>
</template>
<style scoped>
.security { display: grid; gap: 8px; max-width: 600px; }
.warn { background: #fef3c7; padding: 6px 10px; border-radius: 6px; }
.codes ul { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.codes code { font-size: 15px; letter-spacing: 1px; }
</style>
