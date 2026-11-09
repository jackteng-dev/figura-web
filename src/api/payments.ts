import { customerRequest } from '@/api/customer'
import type { OrderView } from '@/api/orders'
export interface MockPayment { id:string;orderId:string;status:'INITIATED'|'SUCCEEDED'|'FAILED'|'REVIEW_REQUIRED';amountTwd:number;currency:'TWD';provider:'MOCK';createdAt:string;settledAt:string|null;refund:OrderView['refund'] }
export interface PaymentOptions { enabled:boolean;canStart:boolean;items:MockPayment[] }
export interface PaymentStart { requestId:string;expectedOrderVersion:number }
export interface PaymentSimulation { eventId:string;outcome:'SUCCESS'|'FAILURE' }
export interface PaymentReceipt { eventId:string;disposition:string;replayed:boolean;payment:MockPayment;order:OrderView }
export const getPayments=(orderId:string)=>customerRequest<PaymentOptions>(`/orders/${encodeURIComponent(orderId)}/mock-payments`)
export const startPayment=(orderId:string,body:PaymentStart)=>customerRequest<{payment:MockPayment;replayed:boolean}>(`/orders/${encodeURIComponent(orderId)}/mock-payments`,'POST',body)
export const simulatePayment=(id:string,body:PaymentSimulation)=>customerRequest<PaymentReceipt>(`/mock-payments/${encodeURIComponent(id)}/simulate`,'POST',body)
export const paymentStatus=(status:MockPayment['status'])=>({INITIATED:'等待模擬結果',SUCCEEDED:'模擬成功',FAILED:'模擬失敗',REVIEW_REQUIRED:'待人工核對'})[status]
