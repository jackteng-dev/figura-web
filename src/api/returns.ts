import api from '@/api/api'
import { customerRequest } from '@/api/customer'
import type { OrderView } from '@/api/orders'
import type { FulfillmentChange } from '@/api/fulfillment'
export interface ReturnProgress { requestId:string;status:'REQUESTED'|'RECEIVED'|'REJECTED'|'REFUNDED';provider:'MOCK';reason:string;disposition:'RESTOCK'|'NO_RESTOCK'|null;requestedAt:string;receivedAt:string|null;refundedAt:string|null;rejectedAt:string|null }
export interface ReturnAudit { requestId:string;orderId:string;actorId:number;actorUsername:string;action:'RECEIVE'|'REJECT'|'REFUND';note:string;beforeVersion:number;afterVersion:number;beforeStatus:ReturnProgress['status'];afterStatus:ReturnProgress['status'];disposition:ReturnProgress['disposition'];createdAt:string }
export interface ReturnDetail { mockEnabled:boolean;canReceive:boolean;canReject:boolean;canRefund:boolean;request:ReturnProgress|null;events:ReturnAudit[] }
export interface ReturnOptions { enabled:boolean;canRequest:boolean;order:OrderView }
export interface ReturnRequest { requestId:string;expectedOrderVersion:number;reason:string }
export const returnStatus=(status:ReturnProgress['status'])=>({REQUESTED:'退貨申請待驗收',RECEIVED:'已模擬驗收，待退款',REJECTED:'申請已拒絕',REFUNDED:'退貨模擬退款完成'})[status]
export const dispositionName=(value:ReturnProgress['disposition'])=>value==='RESTOCK'?'可重新入庫（退款時回補）':value==='NO_RESTOCK'?'不回補庫存':''
export const getReturn=(id:string)=>customerRequest<ReturnOptions>(`/orders/${encodeURIComponent(id)}/mock-return`)
export const requestReturn=(id:string,body:ReturnRequest)=>customerRequest<{order:OrderView;replayed:boolean}>(`/orders/${encodeURIComponent(id)}/mock-return`,'POST',body)
export const staffReturn=async(id:string)=>(await api.get<any,{data:ReturnDetail}>(`/admin/orders/${encodeURIComponent(id)}/returns`)).data
export const changeReturn=async(id:string,action:'RETURN_RECEIVE'|'RETURN_REJECT',body:FulfillmentChange&{disposition?:string})=>(await api.post<any,{data:{event:ReturnAudit;order:OrderView;current:ReturnDetail;replayed:boolean}}>(`/admin/orders/${encodeURIComponent(id)}/${action==='RETURN_RECEIVE'?'mock-return-receipt':'mock-return-rejection'}`,body)).data
