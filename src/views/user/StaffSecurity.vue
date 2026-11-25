<script setup lang="ts">
// 帳號安全：後台強制雙因素。查看狀態與剩餘備援碼；以目前驗證碼重新產生備援碼（舊碼立即失效）並下載。
// 系統管理員／店長若尚未完成備援碼保存確認，會被導到這裡：原始備援碼無法再次取得，只能重新產生後下載並確認。
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { mfaStatus, mfaRegenerateBackupCodes, type MfaStatus, type BackupCodes } from '@/api/user'
import RecoveryCodesPanel from '@/components/RecoveryCodesPanel.vue'
const router = useRouter()
const status = ref<MfaStatus>(), code = ref(''), batch = ref<BackupCodes>(), busy = ref(false), error = ref(''), message = ref('')
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
async function load() { try { status.value = await mfaStatus() } catch (e) { error.value = failure(e) } }
async function regenerate() {
  busy.value = true; error.value = ''; message.value = ''
  try { batch.value = await mfaRegenerateBackupCodes(code.value.trim()); code.value = '' }
  catch (e) { error.value = failure(e) } finally { busy.value = false; await load() }
}
async function done() {
  const wasPending = status.value?.backupAckPending
  batch.value = undefined   // 原始備援碼只留在記憶體到這一刻
  message.value = '已更新備援碼。舊的備援碼已全部失效。'
  await load()
  if (wasPending && !status.value?.backupAckPending) await router.push('/home')
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
   <p v-if="status.backupAckPending && !batch" class="warn" role="alert">你的帳號需要保存備援碼才能使用後台。原本的備援碼已無法再次顯示，請輸入驗證碼重新產生，下載後勾選確認。</p>
   <p v-else-if="status.backupCodesRemaining <= 3 && !batch" class="warn">備援碼所剩不多，建議重新產生。</p>
   <RecoveryCodesPanel v-if="batch" :codes="batch.codes" :username="batch.username" :generated-at="batch.generatedAt" :required="batch.required" continue-label="完成" @done="done" />
   <template v-else>
    <h2>重新產生備援碼</h2>
    <p class="hint">需要驗證器 App 目前的驗證碼（不接受備援碼）。重新產生後，舊的備援碼立即全部失效。</p>
    <label for="mfa-code">6 位數驗證碼</label>
    <input id="mfa-code" v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
    <button :disabled="busy || code.trim().length !== 6" @click="regenerate">產生新的備援碼</button>
   </template>
   <h2>換手機或遺失驗證器</h2>
   <p>無法自行停用雙因素。遺失手機時可先用備援碼登入；手機與備援碼都遺失時，請聯絡系統管理員重設，重設後下次登入需重新綁定。</p>
  </template>
 </div></section>
</template>
<style scoped>
.security { display: grid; gap: 8px; max-width: 620px; }
.warn { background: #fef3c7; padding: 8px 12px; border-radius: 6px; }
.hint { font-size: 13px; color: #4b5060; }
</style>
