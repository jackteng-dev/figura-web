<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resetPassword } from '@/api/customer'
import PasswordField from '@/components/PasswordField.vue'
const route=useRoute(),router=useRouter(),password=ref(''),confirm=ref(''),pending=ref(false),error=ref('')
// token 放在網址 # 之後（#token=…）：不會送到伺服器，也不會出現在 Referer。讀出後立刻從網址移除。
const fromHash=new URLSearchParams(route.hash.replace(/^#/,'')).get('token')||''
const token=ref(fromHash)
onMounted(()=>{if(route.hash)router.replace({path:route.path})})
async function submit(){
 if(pending.value)return
 if(password.value!==confirm.value){error.value='兩次輸入的密碼不一致';return}
 if(new TextEncoder().encode(password.value).length>72){error.value='密碼過長，請縮短後再試';return}
 pending.value=true;error.value=''
 try{await resetPassword(token.value,password.value);password.value='';confirm.value='';await router.replace({path:'/shop/login',query:{reset:'1'}})}
 catch(e){error.value=e instanceof Error?e.message:'重設失敗，請重新申請'}
 finally{pending.value=false}
}
</script>
<template>
 <section class="shop-panel"><h1>重設密碼</h1>
  <template v-if="token">
   <p>請設定新密碼。重設後，所有裝置上的登入都會登出。</p>
   <form @submit.prevent="submit">
    <label for="reset-password">新密碼</label><PasswordField id="reset-password" v-model="password" autocomplete="new-password" required minlength="12" /><p style="font-size:12px;margin:8px 0">至少 12 個字元。</p>
    <label for="reset-confirm">再輸入一次</label><PasswordField id="reset-confirm" v-model="confirm" autocomplete="new-password" required minlength="12" />
    <p v-if="error" class="shop-error" role="alert">{{ error }}</p><button class="shop-button" :disabled="pending">{{ pending?'儲存中…':'儲存新密碼' }}</button>
   </form>
  </template>
  <p v-else class="shop-error" role="alert">連結無效或已過期，請重新申請。</p>
  <p style="margin-top:24px"><router-link to="/shop/forgot-password">重新申請重設連結</router-link>・<router-link to="/shop/login">回到登入</router-link></p>
 </section>
</template>
