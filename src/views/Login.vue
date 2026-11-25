<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { adminLoginService, adminMfaLogin } from '@/api/user'
import type { LoginData } from '@/types/user'
import PasswordField from '@/components/PasswordField.vue'
const router = useRouter()
const pending = ref(false)
const registerData = ref<LoginData>({ username: '', password: '', rememberMe: false, deviceId: '' })
async function login() {
  if (pending.value) return
  if (!registerData.value.username.trim() || !registerData.value.password) { ElMessage.error('請輸入帳號與密碼'); return }
  if (registerData.value.username.length > 64 || new TextEncoder().encode(registerData.value.password).length > 72) { ElMessage.error('帳號或密碼過長'); return }
  registerData.value.deviceId = localStorage.getItem('deviceId') || crypto.randomUUID()
  localStorage.setItem('deviceId', registerData.value.deviceId)
  pending.value = true
  try {
    const r: any = await adminLoginService(registerData.value)
    // 已啟用雙因素：密碼正確只拿到 challenge，需再輸入驗證碼
    if (r?.data?.mfaRequired) { challenge.value = r.data.mfaChallenge; registerData.value.password = ''; return }
    ElMessage.success('登入成功'); await router.push('/home')
  }
  catch { /* API 已顯示錯誤，保留畫面供重試。 */ }
  finally { pending.value = false }
}
const challenge = ref(''), code = ref('')
async function verify() {
  if (pending.value || !/^\d{6}$/.test(code.value)) return
  pending.value = true
  try { await adminMfaLogin(challenge.value, code.value); ElMessage.success('登入成功'); await router.push('/home') }
  catch { code.value = '' /* 錯誤由 API 顯示；連錯 5 次需重新登入 */ }
  finally { pending.value = false }
}
function restart() { challenge.value = ''; code.value = '' }
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
      <form v-if="challenge" class="login-card" @submit.prevent="verify">
        <h1>雙因素驗證</h1>
        <p>請輸入驗證器 App 顯示的 6 位數驗證碼（5 分鐘內有效）。</p>
        <div>
          <label class="form-label" for="login-mfa">驗證碼</label>
          <input id="login-mfa" v-model="code" class="form-control" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\d{6}" required>
        </div>
        <button type="submit" class="btn btn-primary submit" :disabled="pending || code.length !== 6">驗證並登入</button>
        <button type="button" class="btn btn-link" @click="restart">重新輸入帳號密碼</button>
      </form>
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
@media (max-width: 860px) {
  .brand-side { padding: 28px 24px; gap: 20px; flex-basis: 100%; }
  .big { font-size: 28px; }
  .back { display: none; }
}
</style>
