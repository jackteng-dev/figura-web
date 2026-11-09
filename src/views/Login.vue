<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { adminLoginService } from '@/api/user'
import type { LoginData } from '@/types/user'
const router = useRouter()
const pending = ref(false)
const registerData = ref<LoginData>({ username: '', password: '', rememberMe: false, deviceId: '' })
onMounted(async () => { const { initPcoded } = await import('@/assets/js/pcoded.js'); initPcoded() })
async function login() {
  if (pending.value) return
  if (!registerData.value.username.trim() || !registerData.value.password) { ElMessage.error('請輸入帳號與密碼'); return }
  if (registerData.value.username.length > 64 || new TextEncoder().encode(registerData.value.password).length > 72) { ElMessage.error('帳號或密碼過長'); return }
  registerData.value.deviceId = localStorage.getItem('deviceId') || crypto.randomUUID()
  localStorage.setItem('deviceId', registerData.value.deviceId)
  pending.value = true
  try { await adminLoginService(registerData.value); ElMessage.success('登入成功'); await router.push('/home') }
  catch { /* API 已顯示錯誤，保留畫面供重試。 */ }
  finally { pending.value = false }
}
</script>
<template>
  <div class="loader-bg">
    <div class="loader-track">
      <div class="loader-fill"></div>
    </div>
  </div>
  <div class="auth-main">
    <div class="auth-wrapper v3">
      <div class="auth-form">
        <div class="auth-header">
          <a href="#"><img src="@/brand/figura-logo.svg" alt="Figura"></a>
        </div>
        <div class="card my-5">
          <div class="card-body">
            <div class="d-flex justify-content-center align-items-end mb-4">
              <h3 class="mb-0"><b>後台管理系統</b></h3>
            </div>
            <div class="form-group mb-3">
              <label class="form-label">使用者</label>
              <input type="text" class="form-control" placeholder="請輸入用戶名"
                :class="{ 'is-invalid': registerData.username && (registerData.username.length > 64) }"
                v-model="registerData.username">
              <div class="invalid-feedback">
                用戶名最多 64 個字元
              </div>
            </div>
            <div class="form-group mb-3">
              <label class="form-label">密碼</label>
              <input type="password" class="form-control" placeholder="請輸入密碼"

                v-model="registerData.password">
              <div class="invalid-feedback">
                密碼過長
              </div>
            </div>
            <div class="d-flex mt-1 justify-content-between">
              <div class="form-check">
                <input class="form-check-input input-primary" type="checkbox" id="customCheckc1"
                  v-model="registerData.rememberMe">
                <label class="form-check-label text-muted" for="customCheckc1">保持登入</label>
              </div>
              <span class="text-muted">密碼重設待實作</span>
            </div>
            <div class="d-grid mt-4">
              <button type="button" class="btn btn-primary" @click="login" :disabled="pending">Login</button>
            </div>
          </div>
        </div>
        <div class="auth-footer row">
          <!-- <div class=""> -->
          <div class="col my-1">
            <p class="m-0">Copyright © <a href="#">Codedthemes</a></p>
          </div>
          <div class="col-auto my-1">
            <ul class="list-inline footer-link mb-0">
              <li class="list-inline-item"><a href="#">Home</a></li>
              <li class="list-inline-item"><a href="#">Privacy Policy</a></li>
              <li class="list-inline-item"><a href="#">Contact us</a></li>
            </ul>
          </div>
          <!-- </div> -->
        </div>
      </div>
    </div>
  </div>
</template>
