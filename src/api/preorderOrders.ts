import { customerRequest } from './customer'
import type { Page } from './catalog'
import type { OrderView } from './orders'
export interface PreorderOrder {
  fulfillment: { allocatedQuantity: number; allocatedAt: string | null; provider: string; trackingNumber: string | null; shippedAt: string | null; deliveredAt: string | null }
  id: string; batchId: string; batchName: string; productTitle: string; skuLabel: string
  unitPriceTwd: number; quantity: number; subtotalTwd: number; shippingTwd: number; totalTwd: number
  shipping: OrderView['shipping']; deadlineAt: string; arrivalFrom: string; arrivalTo: string
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED'; version: number
  createdAt: string; expiresAt: string; closedAt: string | null; paidAt: string | null; arrivalStatus: string; fulfillmentStatus: string; paymentReviewRequired: boolean; refund: { provider: string; amountTwd: number; refundedAt: string } | null
}
export interface PreorderPlace {
  requestId: string; batchId: string; quantity: number; addressId: string; addressVersion: number; expectedSubtotalTwd: number
}
export interface PreorderCancel { requestId: string; expectedVersion: number }
export interface Applied { order: PreorderOrder; replayed: boolean }
export const placePreorder = (body: PreorderPlace) => customerRequest<Applied>('/preorders', 'POST', body)
export const preorderOrders = (page = 1) => customerRequest<Page<PreorderOrder>>(`/preorders?page=${page}&pageSize=10`)
export const preorderOrder = (id: string) => customerRequest<PreorderOrder>(`/preorders/${encodeURIComponent(id)}`)
export const cancelPreorder = (id: string, body: PreorderCancel) => customerRequest<Applied>(`/preorders/${encodeURIComponent(id)}/cancel`, 'POST', body)
export const preorderStatus = { PAID: '已模擬付款', REFUNDED: '已模擬退款', PENDING: '配額保留中', CANCELLED: '已取消', EXPIRED: '保留已逾時' }
