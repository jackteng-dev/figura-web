import api from '@/api/api'
import type { ProductImage } from './catalog'
export type ImageType='MAIN'|'ANGLE'|'FACE'|'DETAIL'|'SCENE'|'REAR'
export interface GalleryImage extends ProductImage {type:ImageType;position:number;primary:boolean}
export interface GalleryDetail {enabled:boolean;productId:string;version:number;status:string;images:GalleryImage[];events:{requestId:string;action:string;actorUsername:string;beforeVersion:number;afterVersion:number}[]}
export interface GalleryCommand {requestId:string;expectedVersion:number;expectedActorId:number;action:'REMOVE'|'COVER'|'REORDER';imageId?:string;imageIds?:string[]}
export interface GalleryUpload {requestId:string;expectedVersion:number;expectedActorId:number;operation:'ADD'|'REPLACE';imageId?:string;type:ImageType;alt:string}
export const galleryDetail=async(id:string)=>(await api.get<any,{data:GalleryDetail}>(`/admin/products/${encodeURIComponent(id)}/image?gallery=true`)).data
export async function uploadGallery(id:string,input:GalleryUpload,file:File){
 const data=new FormData();for(const [key,value] of Object.entries(input))data.append(key,String(value));data.append('file',file)
 return (await api.post<any,{data:{current:GalleryDetail;replayed:boolean}}>(`/admin/products/${encodeURIComponent(id)}/image`,data)).data
}
export async function commandGallery(id:string,input:GalleryCommand){
 const path=`/admin/products/${encodeURIComponent(id)}/image`
 return (input.action==='REMOVE'?await api.delete<any,{data:{current:GalleryDetail;replayed:boolean}}>(path+'?gallery=true',{data:input}):await api.post<any,{data:{current:GalleryDetail;replayed:boolean}}>(path,input)).data
}
export async function publicGallery(id:string):Promise<GalleryImage[]>{
 const response=await fetch(`/api/catalog/products/${encodeURIComponent(id)}/image`,{credentials:'same-origin',signal:AbortSignal.timeout(5000)})
 const result=await response.json();if(!response.ok||result.code!==0)throw new Error('更多商品圖片暫時無法載入。')
 return result.data
}
export const imageTypeLabel:Record<ImageType,string>={MAIN:'完整主圖',ANGLE:'另一視角',FACE:'臉部特寫',DETAIL:'配件／底座特寫',SCENE:'情境展示',REAR:'已定稿背面'}
