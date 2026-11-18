import { customerRequest } from '@/api/customer'

/** 統一訂單中心（現貨＋預購）：伺服器端篩選、排序與全域分頁；詳情與操作沿用各自頁面。 */
export type OrderKind = 'ALL' | 'STOCK' | 'PREORDER'
export type OrderStage = 'ALL' | 'PENDING_PAYMENT' | 'WAITING_ARRIVAL' | 'TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'RETURNING' | 'CANCELLED' | 'REFUNDED' | 'REVIEW'
export type OrderSort = 'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC'
export interface OrderCenterItem {
  kind: 'STOCK' | 'PREORDER'; id: string; stage: Exclude<OrderStage, 'ALL'>; status: string; createdAt: string; totalTwd: number
  title: string | null; lineCount: number; quantity: number; productId: string | null; expiresAt: string | null
  arrivalFrom: string | null; arrivalTo: string | null; arrivalStatus: string | null; fulfillmentStatus: string | null; paymentReviewRequired: boolean
}
export interface OrderCenterPage { items: OrderCenterItem[]; page: number; pageSize: number; total: number; counts: Record<OrderStage, number> }
export const getOrderCenter = (q: { kind: OrderKind; stage: OrderStage; sort: OrderSort; page: number; pageSize?: number }) =>
  customerRequest<OrderCenterPage>(`/order-center?kind=${q.kind}&stage=${q.stage}&sort=${q.sort}&page=${q.page}&pageSize=${q.pageSize ?? 10}`)

export const stageLabel: Record<OrderStage, string> = {
  ALL: '全部', PENDING_PAYMENT: '待付款', WAITING_ARRIVAL: '等待到貨', TO_SHIP: '待出貨', SHIPPED: '已出貨', COMPLETED: '已完成',
  RETURNING: '退貨處理中', CANCELLED: '已取消', REFUNDED: '已退款', REVIEW: '付款待核對'
}
/** 詳情與付款／取消／退貨等操作所在頁面。 */
export const detailLink = (o: Pick<OrderCenterItem, 'kind' | 'id'>) =>
  o.kind === 'STOCK' ? { path: '/shop/orders', query: { focus: o.id } } : { path: '/shop/preorder-orders', query: { focus: o.id } }
