import { customerRequest } from '@/api/customer'
import type { OrderView } from '@/api/orders'
export interface MockPayment { id:string;orderId:string;status:'INITIATED'|'SUCCEEDED'|'FAILED'|'REVIEW_REQUIRED';amountTwd:number;currency:'TWD';provider:'MOCK'|'ECPAY';createdAt:string;settledAt:string|null;refund:OrderView['refund'] }
export interface PaymentOptions { enabled:boolean;canStart:boolean;items:MockPayment[];ecpayCanStart?:boolean }
export interface EcpayStarted { payment:MockPayment;replayed:boolean;checkout:{action:string;fields:Record<string,string>}|null }
export interface PaymentStart { requestId:string;expectedOrderVersion:number }
export interface PaymentSimulation { eventId:string;outcome:'SUCCESS'|'FAILURE' }
export interface PaymentReceipt { eventId:string;disposition:string;replayed:boolean;payment:MockPayment;order:OrderView }
export const getPayments=(orderId:string)=>customerRequest<PaymentOptions>(`/orders/${encodeURIComponent(orderId)}/mock-payments`)
export const startPayment=(orderId:string,body:PaymentStart)=>customerRequest<{payment:MockPayment;replayed:boolean}>(`/orders/${encodeURIComponent(orderId)}/mock-payments`,'POST',body)
export const simulatePayment=(id:string,body:PaymentSimulation)=>customerRequest<PaymentReceipt>(`/mock-payments/${encodeURIComponent(id)}/simulate`,'POST',body)
export const startEcpayPayment=(orderId:string,body:PaymentStart)=>customerRequest<EcpayStarted>(`/orders/${encodeURIComponent(orderId)}/ecpay-payments`,'POST',body)
export const ECPAY_STAGE_ORIGIN='https://payment-stage.ecpay.com.tw'
/** 以一般表單 POST 前往綠界測試付款頁；只接受綠界測試網域。 */
export function submitEcpay(checkout:{action:string;fields:Record<string,string>}){
 const url=new URL(checkout.action);if(url.origin!==ECPAY_STAGE_ORIGIN)throw new Error('付款網址不正確')
 const form=document.createElement('form');form.method='POST';form.action=url.href;form.style.display='none'
 for(const [name,value] of Object.entries(checkout.fields)){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input)}
 document.body.appendChild(form);form.submit()
}
export const paymentStatus=(status:MockPayment['status'])=>({INITIATED:'等待模擬結果',SUCCEEDED:'模擬成功',FAILED:'模擬失敗',REVIEW_REQUIRED:'待人工核對'})[status]
export const ecpayStatus=(status:MockPayment['status'])=>({INITIATED:'等待綠界付款結果',SUCCEEDED:'綠界付款成功（測試環境）',FAILED:'未完成或已改用新付款',REVIEW_REQUIRED:'待人工核對'})[status]
