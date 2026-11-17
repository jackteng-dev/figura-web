<script setup lang="ts">
import { nextTick,onBeforeUnmount,onMounted,ref } from 'vue'
import { useRoute,useRouter } from 'vue-router'
import { CustomerApiError } from '@/api/customer'
import { getOrders,getOrder,cancelOrder,orderStatus,fulfillmentStatus,type OrderView } from '@/api/orders'
import CustomerReturnPanel from '@/views/shop/CustomerReturnPanel.vue'
import MockPaymentPanel from '@/views/shop/MockPaymentPanel.vue'
import { money,type Page } from '@/api/catalog'
const route=useRoute(),router=useRouter(),returned=ref(''),returnNotice=ref(''),orders=ref<Page<OrderView>>(),page=ref(1),busy=ref(false),error=ref('')
const time=(value:string)=>new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Taipei'}).format(new Date(value+'+08:00'))
async function failure(e:unknown){error.value=e instanceof Error?e.message:'操作失敗';if(!left&&e instanceof CustomerApiError&&e.status===401)await router.replace('/shop/login')}
async function load(next=page.value){if(busy.value)return;busy.value=true;error.value='';try{orders.value=await getOrders(next);page.value=next}catch(e){await failure(e)}finally{busy.value=false}}
async function cancel(order:OrderView){if(busy.value||!window.confirm('取消這筆訂單並釋放保留庫存？'))return;busy.value=true;error.value='';try{const result=await cancelOrder(order.id,order.version);if(orders.value)orders.value.items=orders.value.items.map(o=>o.id===result.id?result:o)}catch(e){await failure(e);if(!(e instanceof CustomerApiError))error.value='取消結果未確認，請重新核對訂單。再次取消同一筆不會重複釋放庫存。'}finally{busy.value=false}}
function updateOrder(order:OrderView){if(orders.value)orders.value.items=orders.value.items.map(o=>o.id===order.id?order:o)}
// 要落點的訂單：讀取成功才清掉網址參數；失敗時「重新核對訂單」會再試一次
const payTarget=ref('')
async function landOnPayment(id:string){
 let order=orders.value?.items.find(o=>o.id===id)
 if(!order){try{const found=await getOrder(id);order=found;orders.value=orders.value?{...orders.value,items:[found,...orders.value.items.filter(o=>o.id!==id)]}:{items:[found],page:1,pageSize:10,total:1}}catch(e){await failure(e);return}}
 await nextTick();const panel=document.querySelector(`[data-testid="payment-panel-${id}"]`)
 if(!panel)return
 panel.scrollIntoView({block:'center',behavior:'instant'})
 // 付款區確實出現在畫面上才清除目標與網址參數
 payTarget.value='';if(route.query.pay)await router.replace({path:route.path,query:{}})
 returnNotice.value=order.status==='PENDING_PAYMENT'?`訂單已建立，請在 ${time(order.expiresAt)}（台北時間）前完成付款。`:`這筆訂單目前狀態：${orderStatus(order.status)}。`
}
async function reload(){await load();if(payTarget.value)await landOnPayment(payTarget.value)}
let returnTimer:number|undefined,left=false
/** 從綠界返回只代表瀏覽器回來了；付款結果以綠界伺服器通知為準，這裡只重新讀取狀態。 */
async function checkReturn(attempt=0){
 if(left)return
 const order=orders.value?.items.find(o=>o.id===returned.value)
 if(!order){returnNotice.value='已從綠界返回，請在下方核對訂單付款狀態。';return}
 if(order.status!=='PENDING_PAYMENT'){returnNotice.value=order.status==='PAID'?'綠界付款已確認，訂單已付款。':'訂單狀態已更新，請核對下方內容。';return}
 if(attempt>=6){returnNotice.value='尚未收到綠界付款通知。若已付款請稍後按「重新核對訂單」；未完成可再次前往綠界付款。';return}
 returnNotice.value='已從綠界返回，正在等待綠界付款通知…'
 returnTimer=window.setTimeout(async()=>{if(left)return;await load();await checkReturn(attempt+1)},3000)
}
onMounted(async()=>{
 const pick=(v:unknown)=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v)?v:''
 const id=pick(route.query.ecpay),pay=pick(route.query.pay)
 if(id)await router.replace({path:route.path,query:{}})
 await load()
 // 直接購買下單後：捲到該筆訂單的付款區；不在目前這頁時，單獨讀取這筆本人訂單放在最上面
 if(pay){payTarget.value=pay;await landOnPayment(pay);return}
 if(!id)return
 returned.value=id;await nextTick();document.querySelector(`[data-testid="order-${id}"]`)?.scrollIntoView({block:'start',behavior:'instant'});await checkReturn()
})
onBeforeUnmount(()=>{left=true;window.clearTimeout(returnTimer)})
</script>
<template><section><h1>我的訂單</h1><p>價格、商品與收件資料保存下單時的快照。待付款保留 30 分鐘，到期後系統釋放庫存；付款可使用綠界測試環境或付款模擬，都不會實際收款。</p>
<p v-if="returnNotice" role="status" class="shop-success" data-testid="ecpay-return">{{ returnNotice }}</p>
<p v-if="error" role="alert" class="shop-error">{{ error }}</p><button class="shop-button" :disabled="busy" @click="reload">重新核對訂單</button>
<p v-if="orders&&!orders.items.length" data-testid="orders-empty">目前沒有訂單。</p>
<article v-for="order in orders?.items" :key="order.id" class="order-card" :data-testid="'order-'+order.id"><h2>{{ orderStatus(order.status) }}</h2><p class="order-number">訂單編號：{{ order.id }}</p><p>建立：{{ time(order.createdAt) }}<br>保留期限：{{ time(order.expiresAt) }}（台北時間）</p>
<p v-if="order.paidAt">付款時間：{{ time(order.paidAt) }}（台北時間）</p><ul><li v-for="line in order.items" :key="line.skuId">{{ line.title }} · {{ line.label }} × {{ line.quantity }} · {{ money(line.unitPriceTwd) }}／件 · {{ money(line.lineTotalTwd) }}</li></ul>
<p>收件人：{{ order.shipping.recipientName }} · {{ order.shipping.phone }}<br>{{ order.shipping.postalCode }} {{ order.shipping.city }}{{ order.shipping.district }}{{ order.shipping.street }}</p>
<p>商品小計 {{ money(order.subtotalTwd) }} ＋ 配送費 {{ money(order.shippingTwd) }}<br><strong>總額 {{ money(order.totalTwd) }}</strong></p>
<section v-if="(order.status==='PAID'||order.status==='REFUNDED')" class="fulfillment-progress" :data-testid="'fulfillment-'+order.id"><h3>配送進度</h3><p>{{ fulfillmentStatus(order.fulfillment.status) }}</p><p v-if="order.fulfillment.trackingId">模擬貨件編號 {{ order.fulfillment.trackingId }}</p><p v-if="order.fulfillment.shippedAt">模擬出貨時間：{{ time(order.fulfillment.shippedAt) }}</p><p v-if="order.fulfillment.deliveredAt">模擬送達時間：{{ time(order.fulfillment.deliveredAt) }}</p><p>此為配送演練，不會建立真實物流託運。按「重新核對訂單」更新進度。</p></section>
<section v-if="order.refund" :data-testid="'refund-'+order.id"><h3>模擬退款已完成</h3><p>退款金額 {{ money(order.refund.amountTwd) }} · {{ time(order.refund.refundedAt) }}（台北時間）</p><p>這是退款演練，不會實際轉帳。</p></section>
<button v-if="order.status==='PENDING_PAYMENT'" class="shop-button" :disabled="busy" @click="cancel(order)">取消訂單</button><CustomerReturnPanel v-if="order.fulfillment.status!=='UNFULFILLED'" :order="order" @changed="updateOrder" /><MockPaymentPanel :order="order" @changed="updateOrder" /></article>
<nav v-if="orders&&orders.total>10" aria-label="訂單分頁"><button :disabled="busy||page===1" @click="load(page-1)">上一頁</button><span>第 {{ page }} 頁</span><button :disabled="busy||page*10>=orders.total" @click="load(page+1)">下一頁</button></nav>
<p><router-link to="/shop/cart">回到購物車 →</router-link></p></section></template>
<style scoped>.order-card{margin-top:24px;padding:24px;background:#ffffff;border:1px solid #e3e5ec;border-radius:10px;overflow-wrap:anywhere}.fulfillment-progress{margin-top:24px;border-top:1px solid #e3e5ec;padding-top:20px}.fulfillment-progress h3{font-size:19px}.order-card h2{font-size:22px}.order-card li{margin:12px 0;color:#15161a}.order-number{font-size:13px}nav{display:flex;gap:16px;margin-top:20px}@media(max-width:600px){.order-card{padding:18px}}</style>
