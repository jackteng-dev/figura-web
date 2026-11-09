import api from '@/api/api'
import type { Page } from '@/api/catalog'
export interface Staff { id:number;username:string;enabled:boolean;version:number;roleIds:number[] }
export interface AccessRole { id:number;name:string;description:string;enabled:boolean;version:number;permissionIds:number[] }
export interface Capability { id:number;code:string;name:string;description:string }
export interface AccessEvent { requestId:string;actorId:number;actorUsername:string;action:string;targetId:number;beforeState:string|null;afterState:string;note:string;createdAt:string }
export interface Applied { event:AccessEvent;replayed:boolean }
export type AccessMode='staff'|'roles'|'permissions'|'audit'
export const staffList=async(page=1)=>(await api.get<any,{data:Page<Staff>}>('/admin/access/staff',{params:{page,pageSize:20}})).data
export const roleList=async(page=1)=>(await api.get<any,{data:Page<AccessRole>}>('/admin/access/roles',{params:{page,pageSize:50}})).data
export const permissionCatalog=async()=>(await api.get<any,{data:Capability[]}>('/admin/access/permissions')).data
export const accessAudit=async(page=1)=>(await api.get<any,{data:Page<AccessEvent>}>('/admin/access/audit',{params:{page,pageSize:20}})).data
export const accessWrite=async(path:string,method:'POST'|'PUT',body:Record<string,unknown>)=>(await api.request<any,{data:Applied}>({url:'/admin/access/'+path,method,data:body})).data
