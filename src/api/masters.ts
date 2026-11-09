import api from '@/api/api'
import type { Page } from './catalog'
export type MasterKind='BRAND'|'WORK'|'CATEGORY'
export interface Master{id:string;kind:MasterKind;name:string;description:string;enabled:boolean;version:number}
export interface MasterEvent{requestId:string;actorId:number;actorUsername:string;kind:MasterKind;action:string;targetId:string;beforeState:string|null;afterState:string;note:string;createdAt:string}
export interface MasterWrite{name:string;description:string;enabled:boolean;expectedVersion:number;requestId:string;note:string}
export const masterList=async(kind:MasterKind,page=1)=>(await api.get<any,{data:Page<Master>}>('/admin/masters',{params:{kind,page,pageSize:20}})).data
export async function masterOptions(kind:MasterKind){const all:Master[]=[];let page=1;while(true){const r=(await api.get<any,{data:Page<Master>}>('/admin/masters/options',{params:{kind,page:page++,pageSize:50}})).data;all.push(...r.items);if(all.length>=r.total)return all;if(!r.items.length||page>100000)throw Error('主檔選項未完整載入，請重讀。')}}
export const masterAudit=async(page=1)=>(await api.get<any,{data:Page<MasterEvent>}>('/admin/masters/audit',{params:{page,pageSize:20}})).data
export const masterSave=async(kind:MasterKind,id:string|undefined,body:MasterWrite)=>(id?await api.put<any,{data:{event:MasterEvent;current:Master;replayed:boolean}}>(`/admin/masters/${kind}/${id}`,body):await api.post<any,{data:{event:MasterEvent;current:Master;replayed:boolean}}>(`/admin/masters/${kind}`,body)).data
