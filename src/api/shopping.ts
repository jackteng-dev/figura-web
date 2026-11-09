import { customerRequest } from '@/api/customer'
export interface CartLine { skuId:string;productId:string;title:string;label:string;quantity:number;unitPriceTwd:number|null;lineTotalTwd:number|null;issue:'UNAVAILABLE'|'SOLD_OUT'|'INSUFFICIENT_STOCK'|null }
export interface CartView { version:number;items:CartLine[];subtotalTwd:number;ready:boolean }
export interface AddressWrite { expectedVersion:number;recipientName:string;phone:string;postalCode:string;city:string;district:string;street:string }
export interface AddressView extends Omit<AddressWrite,'expectedVersion'> { id:string;version:number }
export const getCart=()=>customerRequest<CartView>('/cart')
export const setCartItem=(skuId:string,quantity:number,expectedVersion:number)=>customerRequest<CartView>(`/cart/items/${encodeURIComponent(skuId)}`,'PUT',{quantity,expectedVersion})
export const removeCartItem=(skuId:string,expectedVersion:number)=>customerRequest<CartView>(`/cart/items/${encodeURIComponent(skuId)}?expectedVersion=${expectedVersion}`,'DELETE')
export const getAddresses=()=>customerRequest<AddressView[]>('/addresses')
export const saveAddress=(id:string,input:AddressWrite)=>customerRequest<AddressView>(`/addresses/${encodeURIComponent(id)}`,'PUT',input)
export const deleteAddress=(id:string,version:number)=>customerRequest<void>(`/addresses/${encodeURIComponent(id)}?expectedVersion=${version}`,'DELETE')
export const issueText=(issue:CartLine['issue'])=>issue==='UNAVAILABLE'?'商品或款式已下架':issue==='SOLD_OUT'?'暫無庫存':issue==='INSUFFICIENT_STOCK'?'目前庫存不足，請減少數量':''
