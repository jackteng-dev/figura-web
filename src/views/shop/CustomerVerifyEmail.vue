<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { verifyEmail } from '@/api/customer'
import { useCustomerStore } from '@/stores/customer'
const route=useRoute(),router=useRouter(),store=useCustomerStore()
const state=ref<'working'|'done'|'failed'>('working'),error=ref('')
onMounted(async()=>{
 // token 放在網址 # 之後（不會送到伺服器、也不會出現在 Referer），讀出後立刻從網址移除
 const token=new URLSearchParams(route.hash.replace(/^#/,'')).get('token')||''
 if(route.hash)router.replace({path:route.path})
 if(!token){state.value='failed';error.value='連結無效或已過期。';return}
 try{const view=await verifyEmail(token);if(store.profile?.id===view.id)store.profile=view;state.value='done'}
 catch(e){state.value='failed';error.value=e instanceof Error?e.message:'驗證失敗，請重新寄送驗證信'}
})
</script>
<template>
 <section class="shop-panel"><h1>Email 驗證</h1>
  <p v-if="state==='working'" role="status">正在驗證…</p>
  <p v-else-if="state==='done'" class="shop-success" role="status">Email 已完成驗證，謝謝！</p>
  <template v-else><p class="shop-error" role="alert">{{ error }}</p><p>登入後可在會員中心重新寄送驗證信。</p></template>
  <p style="margin-top:24px"><router-link to="/shop/account">前往會員中心 →</router-link></p>
 </section>
</template>
