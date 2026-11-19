import { customerRequest } from '@/api/customer'
export interface CartLine { skuId:string;productId:string;title:string;label:string;quantity:number;unitPriceTwd:number|null;lineTotalTwd:number|null;issue:'UNAVAILABLE'|'SOLD_OUT'|'INSUFFICIENT_STOCK'|null }
/** 購物車預購項目（以批次為鍵）。issue：UNAVAILABLE／CLOSED／EXPIRED／INSUFFICIENT_QUOTA。 */
export interface PreorderCartLine { batchId:string;productId:string;skuId:string;title:string;batchName:string;label:string;quantity:number;unitPriceTwd:number;lineTotalTwd:number;deadlineAt:string|null;arrivalFrom:string|null;arrivalTo:string|null;availableQuota:number;issue:'UNAVAILABLE'|'CLOSED'|'EXPIRED'|'INSUFFICIENT_QUOTA'|null }
/** items／subtotalTwd／ready 只計現貨；preorders 與 totalTwd／checkoutReady 是統一結帳用。 */
export interface CartView { version:number;items:CartLine[];subtotalTwd:number;ready:boolean;preorders:PreorderCartLine[];preorderSubtotalTwd:number;totalTwd:number;checkoutReady:boolean }
export interface AddressWrite { expectedVersion:number;recipientName:string;phone:string;postalCode:string;city:string;district:string;street:string }
export interface AddressView extends Omit<AddressWrite,'expectedVersion'> { id:string;version:number }
export const getCart=()=>customerRequest<CartView>('/cart')
export const setCartItem=(skuId:string,quantity:number,expectedVersion:number)=>customerRequest<CartView>(`/cart/items/${encodeURIComponent(skuId)}`,'PUT',{quantity,expectedVersion})
export const removeCartItem=(skuId:string,expectedVersion:number)=>customerRequest<CartView>(`/cart/items/${encodeURIComponent(skuId)}?expectedVersion=${expectedVersion}`,'DELETE')
export const setCartPreorder=(batchId:string,quantity:number,expectedVersion:number)=>customerRequest<CartView>(`/cart/preorders/${encodeURIComponent(batchId)}`,'PUT',{quantity,expectedVersion})
export const removeCartPreorder=(batchId:string,expectedVersion:number)=>customerRequest<CartView>(`/cart/preorders/${encodeURIComponent(batchId)}?expectedVersion=${expectedVersion}`,'DELETE')
export const preorderIssueText=(issue:PreorderCartLine['issue'])=>issue==='UNAVAILABLE'?'預購商品已下架':issue==='CLOSED'?'批次已截單或尚未開放':issue==='EXPIRED'?'已過預購截止時間':issue==='INSUFFICIENT_QUOTA'?'剩餘配額不足，請減少數量':''
export const getAddresses=()=>customerRequest<AddressView[]>('/addresses')
export const saveAddress=(id:string,input:AddressWrite)=>customerRequest<AddressView>(`/addresses/${encodeURIComponent(id)}`,'PUT',input)
export const deleteAddress=(id:string,version:number)=>customerRequest<void>(`/addresses/${encodeURIComponent(id)}?expectedVersion=${version}`,'DELETE')
export const issueText=(issue:CartLine['issue'])=>issue==='UNAVAILABLE'?'商品或款式已下架':issue==='SOLD_OUT'?'暫無庫存':issue==='INSUFFICIENT_STOCK'?'目前庫存不足，請減少數量':''
