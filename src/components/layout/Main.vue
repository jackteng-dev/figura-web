<script setup lang="ts">
import { useUserInfoStore } from '@/stores/userInfo'
const user = useUserInfoStore()
</script>
<template>
  <div class="page-header"><h4>Figura 工作首頁</h4></div>
  <div class="card"><div class="card-body">
    <h5>公仔與收藏品商店</h5>
    <p>{{ user.info?.username }}，員工登入已完成。左側入口依目前授權顯示。</p>
    <p>目前完成登入與開發基準；員工與角色管理已開放，支援啟停、固定權限指派與操作稽核；顧客會員與商品管理已開放，支援商品主圖上傳、替換與移除。品牌／作品／分類主檔已開放，商品以固定主檔選項指派；員工可編輯草稿，店長可上架；購物車、下單與模擬付款已開放，訂單管理可查詢、記錄模擬出貨／送達、未出貨退款、已出貨退貨驗收與異常付款核對；不會實際收款或建立物流託運。訂單通知可核對交易佇列、mock 派送與失敗重試，不會寄送真人訊息。預購批次、顧客下單、獨立配額保留與取消／逾時釋放已開放；預購整筆模擬付款、未到貨退款與晚到付款核對已開放；預購到貨登記、整筆分配與模擬出貨／送達已開放；顧客 App 為下一階段。</p>
    <p><router-link to="/shop">前往顧客入口 →</router-link></p>
    <p class="text-muted mb-0">此頁不顯示尚未建立的營收或訂單統計。</p>
  </div></div>
</template>
