import type { ReturnProgress } from '@/api/returns'
import { customerRequest } from '@/api/customer'
import type { Page } from '@/api/catalog'
export interface OrderLine { skuId:string;productId:string;title:string;label:string;quantity:number;unitPriceTwd:number;lineTotalTwd:number }
export interface FulfillmentProgress { status:'UNFULFILLED'|'SHIPPED'|'DELIVERED';provider:'MOCK';trackingId:string|null;shippedAt:string|null;deliveredAt:string|null }
export interface OrderView { id:string;status:'PENDING_PAYMENT'|'CANCELLED'|'EXPIRED'|'PAID'|'REFUNDED';version:number;subtotalTwd:number;shippingTwd:number;totalTwd:number;shipping:{recipientName:string;phone:string;postalCode:string;city:string;district:string;street:string};items:OrderLine[];createdAt:string;expiresAt:string;closedAt:string|null;paidAt:string|null;fulfillment:FulfillmentProgress;refund:{status:'REFUNDED';provider:'MOCK';amountTwd:number;refundedAt:string}|null;returnProgress:ReturnProgress|null }
export interface PlaceOrder { requestId:string;cartVersion:number;addressId:string;addressVersion:number;expectedSubtotalTwd:number }
export interface DirectOrder { requestId:string;productId:string;skuId:string;quantity:number;addressId:string;addressVersion:number;expectedSubtotalTwd:number }
/** 直接購買：只下單這一款，不經過也不清空購物車。 */
export const placeDirectOrder=(body:DirectOrder)=>customerRequest<{order:OrderView;replayed:boolean}>('/orders/direct','POST',body)
/** 統一結帳：分組報價（不保留庫存）與一次建立所有子訂單。 */
export interface QuoteLine { productId:string;skuId:string;batchId:string|null;title:string;label:string;quantity:number;unitPriceTwd:number;lineTotalTwd:number;issue:string|null }
export interface QuoteGroup { key:string;kind:'STOCK'|'PREORDER';title:string;batchId:string|null;arrivalFrom:string|null;arrivalTo:string|null;arrivalMonth:string|null;deadlineAt:string|null;lines:QuoteLine[];subtotalTwd:number;shippingTwd:number;totalTwd:number;payNowTwd:number;payLaterTwd:number;ready:boolean }
export interface Quote { cartVersion:number;groups:QuoteGroup[];subtotalTwd:number;shippingTwd:number;totalTwd:number;payNowTwd:number;payLaterTwd:number;ready:boolean }
export interface CheckoutPlace { requestId:string;cartVersion:number;addressId:string;addressVersion:number;expectedTotalTwd:number }
export interface PlacedOrder { kind:'STOCK'|'PREORDER';id:string;status:string;totalTwd:number;expiresAt:string|null;title:string }
export interface Placed { groupId:string;orders:PlacedOrder[];totalTwd:number;replayed:boolean }
export const getQuote=()=>customerRequest<Quote>('/checkout/quote')
export const placeCheckout=(body:CheckoutPlace)=>customerRequest<Placed>('/checkout','POST',body)
export const placeOrder=(body:PlaceOrder)=>customerRequest<{order:OrderView;replayed:boolean}>('/orders','POST',body)
export const getOrder=(id:string)=>customerRequest<OrderView>(`/orders/${encodeURIComponent(id)}`)
export const getOrders=(page=1)=>customerRequest<Page<OrderView>>(`/orders?page=${page}&pageSize=10`)
export const cancelOrder=(id:string,expectedVersion:number)=>customerRequest<OrderView>(`/orders/${encodeURIComponent(id)}/cancel`,'POST',{expectedVersion})
export const orderStatus=(status:OrderView['status'])=>({PENDING_PAYMENT:'待付款',CANCELLED:'已取消',EXPIRED:'已逾時',PAID:'已付款',REFUNDED:'已退款（模擬）'})[status]

export const fulfillmentStatus=(status:FulfillmentProgress['status'])=>({UNFULFILLED:'尚未出貨',SHIPPED:'已模擬出貨',DELIVERED:'已模擬送達'})[status]
export const orderTime=(value:string)=>new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Taipei'}).format(new Date(value+'+08:00'))
