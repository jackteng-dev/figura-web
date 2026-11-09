import api from '@/api/api'
import type { OrderView, FulfillmentProgress } from '@/api/orders'
import type { Page } from '@/api/catalog'
export interface OrderSummary { id:string;status:OrderView['status'];version:number;totalTwd:number;fulfillmentStatus:FulfillmentProgress['status'];createdAt:string;paidAt:string|null }
export interface StaffOrder { order:OrderView;mockEnabled:boolean;canShip:boolean;canDeliver:boolean }
export interface FulfillmentChange { requestId:string;expectedOrderVersion:number;note:string }
export interface FulfillmentAudit { requestId:string;orderId:string;actorId:number;actorUsername:string;action:'SHIP'|'DELIVER';note:string;beforeVersion:number;afterVersion:number;beforeStatus:FulfillmentProgress['status'];afterStatus:FulfillmentProgress['status'];trackingId:string;createdAt:string }
export const staffOrders=async(page=1,status='',fulfillmentStatus='')=>(await api.get<any,{data:Page<OrderSummary>}>('/admin/orders',{params:{page,pageSize:10,status,fulfillmentStatus}})).data
export const staffOrder=async(id:string)=>(await api.get<any,{data:StaffOrder}>(`/admin/orders/${encodeURIComponent(id)}`)).data
export const fulfillmentEvents=async(id:string)=>(await api.get<any,{data:FulfillmentAudit[]}>(`/admin/orders/${encodeURIComponent(id)}/fulfillment-events`)).data
export const changeFulfillment=async(id:string,action:FulfillmentAudit['action'],body:FulfillmentChange)=>(await api.post<any,{data:{event:FulfillmentAudit;current:StaffOrder;replayed:boolean}}>(`/admin/orders/${encodeURIComponent(id)}/${action==='SHIP'?'mock-shipment':'mock-delivery'}`,body)).data
