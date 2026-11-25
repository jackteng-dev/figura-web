<script setup lang="ts">
// 備援碼一次性顯示與下載。required（系統管理員／店長）：必須下載並勾選保存確認才能繼續；其他員工可略過。
// 備援碼只存在這個元件的記憶體（props），不寫入任何 storage；離開頁面即無法再取得原始備援碼。
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { mfaBackupAck } from '@/api/user'
import { downloadRecoveryCodes, RECOVERY_FILE_NAME } from '@/utils/recoveryCodes'
const props = defineProps<{ codes: string[]; username: string; generatedAt: string; required: boolean; continueLabel?: string }>()
const emit = defineEmits<{ done: [] }>()
const downloaded = ref(false), saved = ref(false), busy = ref(false)
function download() {
  if (downloadRecoveryCodes({ codes: props.codes, username: props.username, generatedAt: props.generatedAt })) {
    downloaded.value = true
    ElMessage.success('瀏覽器已開始下載備援碼文件')
  } else ElMessage.error('無法下載，請改用手動抄寫並妥善保存')
}
async function proceed() {
  if (busy.value || (props.required && !(downloaded.value && saved.value))) return
  busy.value = true
  try { await mfaBackupAck(downloaded.value, saved.value); emit('done') }
  catch { /* API 已顯示錯誤 */ }
  finally { busy.value = false }
}
async function skip() {
  if (props.required || busy.value) return
  try { await ElMessageBox.confirm('略過後就無法再看到這組備援碼（之後可在「帳號安全」用驗證碼重新產生）。確定略過？', '略過下載備援碼', { confirmButtonText: '略過', cancelButtonText: '返回', type: 'warning' }) }
  catch { return }
  busy.value = true
  try { await mfaBackupAck(false, false); emit('done') } catch { /* API 已顯示錯誤 */ } finally { busy.value = false }
}
</script>
<template>
  <div class="recovery">
    <p>手機遺失或無法使用驗證器時，可用以下任一組備援碼登入。<strong>每組只能用一次，離開此頁後無法再次查看。</strong></p>
    <ul class="codes" aria-label="備援碼"><li v-for="c in codes" :key="c"><code>{{ c }}</code></li></ul>
    <button type="button" class="btn btn-primary" :disabled="busy" @click="download">下載備援碼（{{ RECOVERY_FILE_NAME }}）</button>
    <p v-if="downloaded" class="note" role="status">瀏覽器已開始下載。請確認檔案已存放在密碼管理工具或離線的安全位置——系統無法確認檔案是否確實保存。</p>
    <label class="check"><input v-model="saved" type="checkbox" :disabled="required && !downloaded"> 我已妥善保存備援碼</label>
    <p v-if="required && !downloaded" class="note">系統管理員與店長必須先下載備援碼並勾選確認，才能進入後台。</p>
    <div class="actions">
      <button type="button" class="btn btn-primary submit" :disabled="busy || (required ? !(downloaded && saved) : (!downloaded && !saved))" @click="proceed">{{ continueLabel || '進入後台' }}</button>
      <button v-if="!required" type="button" class="btn btn-link" :disabled="busy" @click="skip">略過</button>
    </div>
  </div>
</template>
<style scoped>
.recovery { display: grid; gap: 10px; }
.codes { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.codes code { font-size: 15px; letter-spacing: 1px; }
.note { font-size: 13px; color: #4b5060; margin: 0; }
.check { display: flex; gap: 8px; align-items: center; }
.actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
</style>
