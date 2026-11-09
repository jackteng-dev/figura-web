import type { ReturnProgress } from '@/api/returns'
import { customerRequest } from '@/api/customer'
import type { Page } from '@/api/catalog'
export interface OrderLine { skuId:string;productId:string;title:string;label:string;quantity:number;unitPriceTwd:number;lineTotalTwd:number }
export interface FulfillmentProgress { status:'UNFULFILLED'|'SHIPPED'|'DELIVERED';provider:'MOCK';trackingId:string|null;shippedAt:string|null;deliveredAt:string|null }
export interface OrderView { id:string;status:'PENDING_PAYMENT'|'CANCELLED'|'EXPIRED'|'PAID'|'REFUNDED';version:number;subtotalTwd:number;shippingTwd:number;totalTwd:number;shipping:{recipientName:string;phone:string;postalCode:string;city:string;district:string;street:string};items:OrderLine[];createdAt:string;expiresAt:string;closedAt:string|null;paidAt:string|null;fulfillment:FulfillmentProgress;refund:{status:'REFUNDED';provider:'MOCK';amountTwd:number;refundedAt:string}|null;returnProgress:ReturnProgress|null }
export interface PlaceOrder { requestId:string;cartVersion:number;addressId:string;addressVersion:number;expectedSubtotalTwd:number }
export const placeOrder=(body:PlaceOrder)=>customerRequest<{order:OrderView;replayed:boolean}>('/orders','POST',body)
export const getOrders=(page=1)=>customerRequest<Page<OrderView>>(`/orders?page=${page}&pageSize=10`)
export const cancelOrder=(id:string,expectedVersion:number)=>customerRequest<OrderView>(`/orders/${encodeURIComponent(id)}/cancel`,'POST',{expectedVersion})
export const orderStatus=(status:OrderView['status'])=>({PENDING_PAYMENT:'待付款',CANCELLED:'已取消',EXPIRED:'已逾時',PAID:'已付款（模擬）',REFUNDED:'已退款（模擬）'})[status]

export const fulfillmentStatus=(status:FulfillmentProgress['status'])=>({UNFULFILLED:'尚未出貨',SHIPPED:'已模擬出貨',DELIVERED:'已模擬送達'})[status]
export const orderTime=(value:string)=>new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Taipei'}).format(new Date(value+'+08:00'))
