import api from '@/api/api'
import type {Page} from './catalog'
export type DispatchMode='SUCCESS'|'FAIL_BEFORE'|'FAIL_AFTER_ACCEPT'
export interface Notification{id:string;eventKind:string;orderId:string;channel:'MOCK';status:string;version:number;attempts:number;cycleAttempts:number;nextAttemptAt:string|null;lastError:string|null;sentAt:string|null;createdAt:string;canDispatch:boolean;canRetry:boolean;mockAccepted:boolean}
export interface NotificationEvent{requestId:string;notificationId:string;actorId:number|null;actorUsername:string;action:string;mode:DispatchMode|null;note:string;expectedVersion:number;beforeStatus:string;afterStatus:string;afterVersion:number;attemptNumber:number;result:string;createdAt:string}
export interface NotificationDetail{message:Notification;snapshot:string;events:NotificationEvent[];mockEnabled:boolean}
export interface NotificationWrite{requestId:string;expectedVersion:number;note:string;mode?:DispatchMode}
export const notificationList=async(page=1,status='',orderId='')=>(await api.get<any,{data:Page<Notification>}>('/admin/notifications',{params:{page,pageSize:20,status:status||undefined,orderId:orderId||undefined}})).data
export const notificationDetail=async(id:string)=>(await api.get<any,{data:NotificationDetail}>(`/admin/notifications/${id}`)).data
export const notificationWrite=async(id:string,action:'mock-dispatch'|'retry',body:NotificationWrite)=>(await api.post<any,{data:{event:NotificationEvent;current:Notification;replayed:boolean}}>(`/admin/notifications/${id}/${action}`,body)).data
