<script setup lang="ts">
// 訂單詳情裡的出貨單（Phase 5）：配送方式、目的地、合併寄送的其他訂單、進度與測試貨件號。
import { computed } from 'vue'
import { money } from '@/api/catalog'
import { taipeiTime } from '@/api/preorders'
import { shipmentStatus, waitingText, type Shipment } from '@/api/shipping'
const props = defineProps<{ shipment: Shipment | null | undefined; orderId: string }>()
const others = computed(() => props.shipment?.orders.filter(o => o.id !== props.orderId) || [])
</script>
<template>
 <section v-if="shipment" class="shipment" data-testid="shipment-info">
  <h3>配送</h3>
  <p><strong>{{ shipment.methodName }}</strong> · {{ shipmentStatus[shipment.status] }}<template v-if="shipment.status === 'WAITING' && shipment.waitingFor">（{{ waitingText[shipment.waitingFor] }}）</template></p>
  <p v-if="shipment.destination.type === 'CVS'">取貨門市：{{ shipment.destination.storeBrand }} {{ shipment.destination.storeName }}（{{ shipment.destination.storeAddress }}）<span class="tag">測試門市</span></p>
  <p v-else>寄送地址：{{ shipment.destination.postalCode }} {{ shipment.destination.city }}{{ shipment.destination.district }}{{ shipment.destination.street }}</p>
  <p>收件人：{{ shipment.destination.recipientName }} · {{ shipment.destination.phone }}</p>
  <p>這個包裹運費 {{ money(shipment.feeTwd) }}<template v-if="shipment.feeTwd === 0">（免運）</template></p>
  <p v-if="others.length" data-testid="shipment-combined">與另外 {{ others.length }} 張訂單合併寄送：{{ others.map(o => (o.kind === 'PREORDER' ? '預購・' : '現貨・') + o.title).join('、') }}。全部可出貨後才一起寄出。</p>
  <p v-if="shipment.trackingNumber">測試貨件號：{{ shipment.trackingNumber }}（測試物流，沒有實際寄送）</p>
  <p v-if="shipment.shippedAt">出貨：{{ taipeiTime(shipment.shippedAt) }}</p><p v-if="shipment.deliveredAt">送達：{{ taipeiTime(shipment.deliveredAt) }}</p>
 </section>
</template>
<style scoped>
.shipment{border-top:1px solid #e3e5ec;margin-top:16px;padding-top:12px;overflow-wrap:anywhere}.shipment h3{font-size:17px;margin:0 0 6px}.shipment p{margin:4px 0}.tag{margin-left:6px;font-size:12px;background:#fef3c7;color:#92400e;border-radius:999px;padding:2px 8px}
</style>
