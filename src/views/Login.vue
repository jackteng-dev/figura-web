<script setup lang="ts">
// 員工登入（強制雙因素）：密碼正確後，已綁定者輸入驗證碼或備援碼；未綁定者必須先完成綁定。完成前不發 session。
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { adminLoginService, adminMfaLogin, adminMfaSetup, adminMfaEnroll } from '@/api/user'
import type { LoginData } from '@/types/user'
import PasswordField from '@/components/PasswordField.vue'
import { qrSvg } from '@/utils/qrcode'
import RecoveryCodesPanel from '@/components/RecoveryCodesPanel.vue'
import { sandboxConfig, createMfaDemoAccount, type MfaDemoAccount } from '@/api/sandbox'
import { NO_SANDBOX, hasSandboxEntries, type SandboxConfig } from '@/utils/sandbox'
const router = useRouter()
// 公開沙盒入口：只有 API 回報沙盒模式時才顯示（正式環境設定端點 404 → 不顯示）。沒有任何「略過 MFA」的選項。
const sandbox = ref<SandboxConfig>(NO_SANDBOX), quickHelp = ref(false), demoAccount = ref<MfaDemoAccount>(), demoFlow = ref(false)
onMounted(async () => { sandbox.value = await sandboxConfig() })
const pending = ref(false)
const registerData = ref<LoginData>({ username: '', password: '', rememberMe: false, deviceId: '' })
type Step = 'password' | 'verify' | 'enroll' | 'codes' | 'demo'
const step = ref<Step>('password'), challenge = ref(''), setupToken = ref(''), code = ref(''), secret = ref(''), otpauth = ref(''), backup = ref<{ codes: string[]; username: string; generatedAt: string; required: boolean; batchId: string }>()
async function login() {
  if (pending.value) return
  if (!registerData.value.username.trim() || !registerData.value.password) { ElMessage.error('請輸入帳號與密碼'); return }
  if (registerData.value.username.length > 64 || new TextEncoder().encode(registerData.value.password).length > 72) { ElMessage.error('帳號或密碼過長'); return }
  registerData.value.deviceId = localStorage.getItem('deviceId') || crypto.randomUUID()
  localStorage.setItem('deviceId', registerData.value.deviceId)
  pending.value = true
  try {
    const r: any = await adminLoginService(registerData.value)
    registerData.value.password = ''
    if (r?.data?.mfaRequired) { challenge.value = r.data.mfaChallenge; step.value = 'verify'; return }
    // 公開沙盒共用展示帳號：API 依伺服器設定直接發 session（正式環境不會出現這個回應）
    if (r?.data?.accountKind === 'SANDBOX_SHARED') { ElMessage.success('已登入共用展示帳號'); await router.push('/home'); return }
    if (r?.data?.mfaSetupRequired) {
      setupToken.value = r.data.mfaSetupToken
      const s = await adminMfaSetup(setupToken.value)
      secret.value = s.secret; otpauth.value = s.otpauthUri; step.value = 'enroll'; return
    }
    // 伺服器不會在沒有雙因素的情況下發 session；收到其他回應視為異常
    ElMessage.error('登入流程異常，請重新登入'); restart()
  }
  catch { /* API 已顯示錯誤，保留畫面供重試。 */ }
  finally { pending.value = false }
}
const codeOk = () => /^\d{6}$/.test(code.value.trim()) || /^[A-Za-z2-9]{5}-?[A-Za-z2-9]{5}$/.test(code.value.trim())
async function verify() {
  if (pending.value || !codeOk()) return
  pending.value = true
  try { await adminMfaLogin(challenge.value, code.value.trim()); ElMessage.success('登入成功'); await router.push('/home') }
  catch { code.value = '' /* 錯誤由 API 顯示；同一次登入最多 5 次，過期請重新登入 */ }
  finally { pending.value = false }
}
async function enroll() {
  if (pending.value || !/^\d{6}$/.test(code.value.trim())) return
  pending.value = true
  try {
    const r = await adminMfaEnroll(setupToken.value, code.value.trim())
    secret.value = ''; otpauth.value = ''; code.value = ''
    // 備援碼只放在記憶體；完成後清除
    backup.value = { codes: r?.backupCodes || [], username: r?.username || registerData.value.username, generatedAt: r?.backupCodesGeneratedAt || new Date().toISOString(), required: !!r?.backupCodesRequired, batchId: r?.backupBatchId || '' }
    step.value = 'codes'
  }
  catch { code.value = '' }
  finally { pending.value = false }
}
async function finish() {
  backup.value = undefined; ElMessage.success('已完成雙因素綁定')
  if (demoFlow.value) ElMessage.info({ message: '可以登出後重新登入，試試輸入驗證碼，或用一組備援碼登入（每組只能用一次）。', duration: 8000 })
  await router.push('/home')
}
async function startDemo() {
  if (pending.value) return
  pending.value = true
  try { demoAccount.value = await createMfaDemoAccount(); step.value = 'demo' }
  catch { /* API 已顯示錯誤（例如建立數量已達上限） */ }
  finally { pending.value = false }
}
async function useDemo() {
  if (!demoAccount.value) return
  registerData.value.username = demoAccount.value.username
  registerData.value.password = demoAccount.value.password
  demoFlow.value = true; step.value = 'password'
  await login()
}
function copyText(text: string, label: string) { navigator.clipboard?.writeText(text).then(() => ElMessage.success('已複製' + label), () => ElMessage.error('無法複製，請手動記下')) }
const demoExpires = computed(() => demoAccount.value ? new Date(demoAccount.value.expiresAt).toLocaleString('zh-TW', { hour12: false }) : '')
// QR code 在瀏覽器本機產生（不送到任何外部服務）；金鑰預設隱藏，按「手動輸入」才顯示
const qr = computed(() => otpauth.value ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg(otpauth.value, 'M')) : '')
const showSecret = ref(false)
const groupedSecret = computed(() => secret.value.replace(/(.{4})/g, '$1 ').trim())
function copySecret() { navigator.clipboard?.writeText(secret.value).then(() => ElMessage.success('已複製金鑰'), () => ElMessage.error('無法複製，請手動輸入')) }
function restart() { demoAccount.value = undefined; step.value = 'password'; challenge.value = ''; setupToken.value = ''; code.value = ''; secret.value = ''; otpauth.value = ''; showSecret.value = false }
</script>
<template>
  <div class="fg-admin fg-login">
    <section class="brand-side" aria-label="Figura 員工後台">
      <div class="logo"><span class="mark" aria-hidden="true">F</span><span class="name">Figura<span>.</span></span></div>
      <div class="pitch">
        <span class="pill">員工後台</span>
        <p class="big">商品、訂單、預購<br>都在這裡處理</p>
        <p class="small">選單依你的權限顯示。所有寫入都會留下稽核紀錄；付款、配送與退款目前為模擬演練。</p>
      </div>
      <router-link to="/shop" class="back">← 回到商店</router-link>
    </section>
    <section class="form-side">
      <form v-if="step === 'verify'" class="login-card" @submit.prevent="verify">
        <h1>雙因素驗證</h1>
        <p>請輸入驗證器 App 顯示的 6 位數驗證碼。手機不在身邊時，可輸入一組備援碼（每組只能用一次）。</p>
        <div>
          <label class="form-label" for="login-mfa">驗證碼或備援碼</label>
          <input id="login-mfa" v-model="code" class="form-control" autocomplete="one-time-code" maxlength="11" required>
        </div>
        <button type="submit" class="btn btn-primary submit" :disabled="pending || !codeOk()">驗證並登入</button>
        <button type="button" class="btn btn-link" @click="restart">重新輸入帳號密碼</button>
        <p class="muted">遺失手機與備援碼時，請聯絡系統管理員重設雙因素。</p>
      </form>
      <form v-else-if="step === 'enroll'" class="login-card" @submit.prevent="enroll">
        <h1>設定雙因素驗證</h1>
        <p>後台規定所有員工都要綁定驗證器 App（Google Authenticator、Microsoft Authenticator 等），完成後才能進入後台。</p>
        <ol class="steps">
          <li>用驗證器 App 掃描 QR code（請勿截圖或分享）：
            <img v-if="qr" :src="qr" class="qr" width="200" height="200" alt="雙因素驗證設定 QR code，請用驗證器 App 掃描">
            <button v-if="!showSecret" type="button" class="btn btn-link manual" :aria-expanded="showSecret" aria-controls="manual-secret" @click="showSecret = true">無法掃描？手動輸入金鑰</button>
            <div v-else id="manual-secret" class="manual-box">
              <span class="hint">在 App 選「輸入設定金鑰」，帳戶名稱填 Figura，類型選「以時間為準」：</span>
              <div class="secret-row"><code class="secret" aria-label="設定金鑰">{{ groupedSecret }}</code><button type="button" class="btn btn-outline-secondary btn-sm" @click="copySecret">複製</button></div>
              <button type="button" class="btn btn-link manual" @click="showSecret = false">隱藏金鑰</button>
            </div>
          </li>
          <li>輸入 App 顯示的 6 位數驗證碼。</li>
        </ol>
        <div>
          <label class="form-label" for="enroll-code">驗證碼</label>
          <input id="enroll-code" v-model="code" class="form-control" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\d{6}" required>
        </div>
        <button type="submit" class="btn btn-primary submit" :disabled="pending || code.trim().length !== 6">完成綁定</button>
        <button type="button" class="btn btn-link" @click="restart">取消並重新登入</button>
      </form>
      <div v-else-if="step === 'demo' && demoAccount" class="login-card">
        <h1>MFA 展示帳號</h1>
        <p>這是公開沙盒的臨時員工帳號，<strong>只顯示這一次</strong>。請先複製或記下密碼，稍後登出再登入時會用到。</p>
        <dl class="demo-cred">
          <dt>帳號</dt><dd><code>{{ demoAccount.username }}</code><button type="button" class="btn btn-outline-secondary btn-sm" @click="copyText(demoAccount.username, '帳號')">複製</button></dd>
          <dt>密碼</dt><dd><code>{{ demoAccount.password }}</code><button type="button" class="btn btn-outline-secondary btn-sm" @click="copyText(demoAccount.password, '密碼')">複製</button></dd>
          <dt>到期</dt><dd>{{ demoExpires }}（約 {{ demoAccount.ttlMinutes }} 分鐘後自動刪除）</dd>
        </dl>
        <p class="muted">接下來會走正式的雙因素流程：用驗證器 App 掃 QR code、輸入 6 位數驗證碼、下載並確認保存備援碼。此帳號只能瀏覽工作首頁與報表，不能操作商品、訂單或其他帳號。</p>
        <button type="button" class="btn btn-primary submit" :disabled="pending" @click="useDemo">用這個帳號開始綁定</button>
        <button type="button" class="btn btn-link" @click="restart">取消</button>
      </div>
      <div v-else-if="step === 'codes'" class="login-card">
        <h1>保存備援碼</h1>
        <RecoveryCodesPanel v-if="backup" :codes="backup.codes" :username="backup.username" :generated-at="backup.generatedAt" :required="backup.required" :batch-id="backup.batchId" @done="finish" />
      </div>
      <form v-else class="login-card" @submit.prevent="login">
        <h1>員工登入</h1>
        <div>
          <label class="form-label" for="login-username">使用者</label>
          <input id="login-username" type="text" class="form-control" placeholder="請輸入用戶名" autocomplete="username"
            :class="{ 'is-invalid': registerData.username && (registerData.username.length > 64) }"
            v-model="registerData.username">
          <div class="invalid-feedback">用戶名最多 64 個字元</div>
        </div>
        <div>
          <label class="form-label" for="login-password">密碼</label>
          <PasswordField id="login-password" class="form-control" placeholder="請輸入密碼" autocomplete="current-password"
            v-model="registerData.password" />
          <div class="invalid-feedback">密碼過長</div>
        </div>
        <div class="row-between">
          <label class="check"><input id="customCheckc1" type="checkbox" v-model="registerData.rememberMe"> 保持登入</label>
          <span class="muted">忘記密碼請洽店長重設</span>
        </div>
        <button type="submit" class="btn btn-primary submit" :disabled="pending">Login</button>
        <section v-if="hasSandboxEntries(sandbox)" class="sandbox" aria-label="公開沙盒展示">
          <h2>公開沙盒展示</h2>
          <template v-if="sandbox.quickDemo">
            <button type="button" class="btn btn-outline-primary" :aria-expanded="quickHelp" aria-controls="quick-help" @click="quickHelp = !quickHelp">快速體驗後台</button>
            <p v-if="quickHelp" id="quick-help" class="muted">共用展示帳號與密碼請見本站的沙盒說明框。共用帳號免雙因素，可直接瀏覽與操作展示資料，但已停用所有安全設定變更。</p>
          </template>
          <template v-if="sandbox.mfaDemo">
            <button type="button" class="btn btn-outline-primary" :disabled="pending" @click="startDemo">體驗 MFA 安全設計</button>
            <p class="muted">建立一個{{ sandbox.mfaDemoTtlMinutes ? ` ${sandbox.mfaDemoTtlMinutes} 分鐘` : '' }}的臨時帳號，完整體驗綁定、驗證碼與備援碼流程。</p>
          </template>
        </section>
      </form>
    </section>
  </div>
</template>

<style scoped>
.fg-login { min-height: 100vh; display: flex; flex-wrap: wrap; background: #1b1f3b; }
.brand-side { flex: 1 1 420px; min-width: 0; padding: 56px; display: flex; flex-direction: column; justify-content: space-between; gap: 40px; color: #fff; box-sizing: border-box; }
.logo { display: flex; align-items: center; gap: 12px; }
.mark { width: 44px; height: 44px; background: #ffd23f; color: #1b1f3b; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px; }
.name { font-weight: 900; font-size: 26px; }
.name span { color: #ffd23f; }
.pitch { display: flex; flex-direction: column; gap: 16px; max-width: 460px; }
.pill { align-self: flex-start; background: #ffd23f; color: #15161a; font-weight: 900; font-size: 13px; padding: 5px 12px; border-radius: 999px; }
.big { font-size: 40px; font-weight: 900; line-height: 1.25; margin: 0; color: #fff; }
.small { font-size: 15px; color: #c9cce0; line-height: 1.8; margin: 0; }
.back { color: #c9cce0 !important; font-size: 14px; text-decoration: none; }
.back:hover { color: #fff !important; }
.form-side { flex: 1 1 420px; min-width: 0; background: #f3f4f8; display: flex; align-items: center; justify-content: center; padding: 40px 20px; box-sizing: border-box; }
.login-card { width: 100%; max-width: 400px; background: #fff; border-radius: 18px; padding: 36px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box; }
.login-card h1 { margin: 0; font-size: 26px; }
.row-between { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.check { display: flex; align-items: center; gap: 8px; font-weight: 400 !important; font-size: 14px !important; margin: 0; cursor: pointer; }
.check input { width: 18px; height: 18px; }
.muted { font-size: 12px; color: #4b5060; }
.submit { padding: 14px; font-size: 16px; font-weight: 900; }
.steps { padding-left: 20px; display: grid; gap: 8px; }
.secret { display: block; flex: 1; font-size: 17px; letter-spacing: 1px; background: #f6f7fb; padding: 8px 10px; border-radius: 6px; word-break: break-all; margin: 0; }
.qr { display: block; width: 200px; height: 200px; margin: 10px auto; image-rendering: pixelated; border: 1px solid #e3e5ec; border-radius: 8px; }
.manual { padding: 0; font-size: 14px; }
.manual-box { display: grid; gap: 6px; margin-top: 6px; }
.manual-box .hint { font-size: 13px; color: #4b5060; }
.secret-row { display: flex; gap: 8px; align-items: center; }
.sandbox { border-top: 1px dashed #c9cce0; padding-top: 14px; display: grid; gap: 8px; }
.sandbox h2 { font-size: 15px; margin: 0; }
.demo-cred { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; margin: 0; align-items: center; }
.demo-cred dt { font-weight: 700; }
.demo-cred dd { margin: 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-width: 0; }
.demo-cred code { font-size: 15px; word-break: break-all; background: #f6f7fb; padding: 4px 8px; border-radius: 6px; }
.codes { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.codes code { font-size: 15px; letter-spacing: 1px; }
@media (max-width: 860px) {
  .brand-side { padding: 28px 24px; gap: 20px; flex-basis: 100%; }
  .big { font-size: 28px; }
  .back { display: none; }
}
</style>
