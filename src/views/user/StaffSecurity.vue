<script setup lang="ts">
// 帳號安全（Commerce V2 Phase 7）：員工自願啟用 TOTP 雙因素。密鑰只在設定當下顯示一次。
import { onMounted, ref } from 'vue'
import { mfaStatus, mfaSetup, mfaConfirm, mfaDisable, type MfaStatus } from '@/api/user'
const status = ref<MfaStatus>(), setup = ref<{ secret: string; otpauthUri: string }>(), code = ref(''), busy = ref(false), error = ref(''), message = ref('')
const failure = (e: any) => e.response?.data?.message || e.message || '暫時無法連線。'
async function load() { try { status.value = await mfaStatus() } catch (e) { error.value = failure(e) } }
async function run(fn: () => Promise<unknown>, ok: string) {
  busy.value = true; error.value = ''; message.value = ''
  try { await fn(); message.value = ok; code.value = '' } catch (e) { error.value = failure(e) } finally { busy.value = false; await load() }
}
const start = () => run(async () => { setup.value = await mfaSetup() }, '已產生密鑰，請用驗證器 App 加入後輸入驗證碼完成啟用。')
const confirm = () => run(async () => { await mfaConfirm(code.value); setup.value = undefined }, '已啟用雙因素驗證，下次登入需要驗證碼。')
const disable = () => run(() => mfaDisable(code.value), '已停用雙因素驗證。')
onMounted(load)
</script>
<template>
 <section class="card"><div class="card-body security">
  <h1>帳號安全</h1>
  <p>啟用雙因素驗證後，登入時除了密碼還需要驗證器 App（Google Authenticator、Microsoft Authenticator 等）的 6 位數驗證碼。</p>
  <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  <template v-if="status">
   <p v-if="!status.available">此環境尚未設定雙因素加密金鑰，暫時無法啟用（請洽系統管理者）。</p>
   <template v-else-if="status.enabled">
    <p><strong>雙因素驗證：已啟用</strong></p>
    <label for="mfa-off">停用前請輸入目前的驗證碼</label>
    <input id="mfa-off" v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
    <button :disabled="busy || code.length !== 6" @click="disable">停用雙因素驗證</button>
   </template>
   <template v-else>
    <p><strong>雙因素驗證：未啟用</strong></p>
    <button v-if="!setup" :disabled="busy" @click="start">{{ status.pendingSetup ? '重新產生密鑰' : '開始設定' }}</button>
    <div v-if="setup" class="setup">
     <p>在驗證器 App 選「輸入設定金鑰」，帳戶填 Figura，金鑰如下（只顯示這一次，請勿截圖分享）：</p>
     <code class="secret">{{ setup.secret.replace(/(.{4})/g, '$1 ').trim() }}</code>
     <p><small>或在支援的裝置上開啟：<a :href="setup.otpauthUri">加入驗證器</a></small></p>
     <label for="mfa-on">輸入 App 顯示的 6 位數驗證碼</label>
     <input id="mfa-on" v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
     <button :disabled="busy || code.length !== 6" @click="confirm">確認並啟用</button>
    </div>
   </template>
  </template>
 </div></section>
</template>
<style scoped>
.security { display: grid; gap: 8px; max-width: 560px; }
.secret { font-size: 18px; letter-spacing: 1px; background: #f6f7fb; padding: 8px 12px; border-radius: 6px; word-break: break-all; }
.setup { display: grid; gap: 6px; }
</style>
