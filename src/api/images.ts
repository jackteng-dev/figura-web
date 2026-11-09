import api from '@/api/api'
import type { ProductImage } from '@/api/catalog'
export interface ImageAudit { requestId:string;actorId:number;actorUsername:string;action:'UPLOAD'|'REMOVE';imageId:string;beforeVersion:number;afterVersion:number;createdAt:string }
export interface ImageDetail { enabled:boolean;productId:string;version:number;status:'DRAFT'|'PUBLISHED'|'ARCHIVED';image:ProductImage|null;events:ImageAudit[] }
export interface ImageInput {requestId:string;expectedVersion:number;alt?:string}
export interface ImageApplied {event:ImageAudit;current:ImageDetail;replayed:boolean}
export const imageDetail=async(id:string)=>(await api.get<any,{data:ImageDetail}>(`/admin/products/${encodeURIComponent(id)}/image`)).data
export async function uploadImage(id:string,input:ImageInput,file:File){const form=new FormData();form.append('requestId',input.requestId);form.append('expectedVersion',String(input.expectedVersion));form.append('alt',input.alt||'');form.append('file',file);return (await api.post<any,{data:ImageApplied}>(`/admin/products/${encodeURIComponent(id)}/image`,form)).data}
export const removeImage=async(id:string,input:ImageInput)=>(await api.delete<any,{data:ImageApplied}>(`/admin/products/${encodeURIComponent(id)}/image`,{data:input})).data
