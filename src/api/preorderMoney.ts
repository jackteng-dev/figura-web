import api from './api'
import { customerRequest } from './customer'
import type { Page } from './catalog'
import type { PreorderOrder } from './preorderOrders'
import type { Fulfillment } from './preorderFulfillment'
import type { PaymentStart, PaymentSimulation } from './payments'
export interface PreorderPayment {
  id: string; orderId: string; status: 'INITIATED' | 'SUCCEEDED' | 'FAILED' | 'REVIEW_REQUIRED'
  amountTwd: number; currency: 'TWD'; provider: 'MOCK'; createdAt: string; settledAt: string | null
  refund: { provider: 'MOCK'; amountTwd: number; refundedAt: string } | null
}
export interface Options { enabled: boolean; canStart: boolean; items: PreorderPayment[] }
export interface Receipt { eventId: string; disposition: string; replayed: boolean; payment: PreorderPayment; order: PreorderOrder }
export interface RefundBody { requestId: string; expectedOrderVersion: number; note: string }
export interface RefundEvent extends Omit<RefundBody, 'expectedOrderVersion'> { orderId: string; paymentId: string; actorId: number; actorUsername: string; action: string; amountTwd: number; beforeVersion: number; afterVersion: number; createdAt: string }
export interface Detail {
  order: PreorderOrder; fulfillment: Fulfillment; payments: Options; refundsEnabled: boolean; canRefund: boolean
  reviews: { paymentId: string; amountTwd: number; refunded: boolean; evidence: { eventId: string; outcome: string; disposition: string; createdAt: string }[] }[]
  refunds: RefundEvent[]
}
export type Summary = Pick<PreorderOrder, 'id' | 'batchId' | 'batchName' | 'productTitle' | 'skuLabel' | 'quantity' | 'totalTwd' | 'status' | 'version' | 'createdAt' | 'paidAt' | 'paymentReviewRequired'>
export const getPreorderPayments = (id: string) => customerRequest<Options>(`/preorders/${encodeURIComponent(id)}/mock-payments`)
export const startPreorderPayment = (id: string, body: PaymentStart) => customerRequest<{ payment: PreorderPayment; replayed: boolean }>(`/preorders/${encodeURIComponent(id)}/mock-payments`, 'POST', body)
export const simulatePreorderPayment = (id: string, body: PaymentSimulation) => customerRequest<Receipt>(`/preorder-payments/${encodeURIComponent(id)}/simulate`, 'POST', body)
export const staffPreorders = async (page: number, status: string) => (await api.get<any, { data: Page<Summary> }>('/admin/preorder-orders', { params: { page, pageSize: 20, status: status || undefined } })).data
export const staffPreorder = async (id: string) => (await api.get<any, { data: Detail }>(`/admin/preorder-orders/${encodeURIComponent(id)}`)).data
export const refundPreorder = async (id: string, payment: string | undefined, body: RefundBody) => (await api.post<any, { data: { event: RefundEvent; current: Detail; replayed: boolean } }>(`/admin/preorder-orders/${encodeURIComponent(id)}/${payment ? 'mock-review-refund/' + encodeURIComponent(payment) : 'mock-refund'}`, body)).data
