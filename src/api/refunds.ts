import api from '@/api/api'
import type { OrderView } from '@/api/orders'
import type { FulfillmentChange } from '@/api/fulfillment'
export interface RefundReview { paymentId:string;amountTwd:number;currency:string;detectedAt:string;resolved:boolean;notifications:{eventId:string;outcome:'SUCCESS'|'FAILURE';disposition:string;receivedAt:string}[] }
export interface RefundAudit { requestId:string;orderId:string;paymentId:string;actorId:number;actorUsername:string;action:'ORDER_REFUND'|'REVIEW_REFUND'|'RETURN_REFUND';note:string;amountTwd:number;beforeVersion:number;afterVersion:number;createdAt:string }
export interface RefundDetail { mockEnabled:boolean;canRefund:boolean;reviews:RefundReview[];events:RefundAudit[] }
export const refundDetail=async(id:string)=>(await api.get<any,{data:RefundDetail}>(`/admin/orders/${encodeURIComponent(id)}/refunds`)).data
export const refundOrder=async(id:string,body:FulfillmentChange,payment?:string,returned=false)=>(await api.post<any,{data:{event:RefundAudit;order:OrderView;current:RefundDetail;replayed:boolean}}>(`/admin/orders/${encodeURIComponent(id)}/${returned?'mock-return-refund':payment?'mock-review-refund/'+encodeURIComponent(payment):'mock-refund'}`,body)).data
