<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/userInfo'
import { staffList, roleList, permissionCatalog, accessAudit, accessWrite, type Staff, type AccessRole, type Capability, type AccessEvent, type AccessMode } from '@/api/access'
const props=defineProps<{mode:AccessMode}>()
const user=useUserInfoStore(), page=ref(1), total=ref(0), loading=ref(false), error=ref(''), message=ref('')
const staff=ref<Staff[]>([]), roles=ref<AccessRole[]>([]), options=ref<AccessRole[]>([]), capabilities=ref<Capability[]>([]), events=ref<AccessEvent[]>([])
const has=(code:string)=>user.permissions.some(p=>p.code===code)
const manager=computed(()=>['access.staff.read','access.staff.create','access.staff.update','access.roles.read','access.roles.create','access.roles.update','access.permissions.read','access.audit.read'].every(has))
const ready=ref(false), editing=ref(false), editId=ref<number>(), version=ref(0), enabled=ref(true), username=ref(''), password=ref(''), name=ref(''), description=ref(''), note=ref(''), selected=ref<number[]>([])
type Pending={path:string;method:'POST'|'PUT';body:Record<string,unknown>}
const pending=ref<Pending>(), sending=ref(false)
const title=computed(()=>({staff:'員工管理',roles:'角色管理',permissions:'權限目錄',audit:'存取稽核'})[props.mode])
function failure(e:any){return e.response?.data?.message||e.message||'無法連線，請稍後核對。'}
async function load(){loading.value=true;error.value='';ready.value=false;try{
 if(props.mode==='staff'){const result=await staffList(page.value);staff.value=result.items;total.value=result.total}
 if(props.mode==='roles'){const result=await roleList(page.value);roles.value=result.items;total.value=result.total}
 if(props.mode==='permissions')capabilities.value=await permissionCatalog()
 if(props.mode==='audit'){const result=await accessAudit(page.value);events.value=result.items;total.value=result.total}
 if(manager.value&&props.mode==='staff'){const all:AccessRole[]=[];let p=1;while(true){const result=await roleList(p++);all.push(...result.items);if(all.length>=result.total)break;if(!result.items.length)throw Error('角色清單未完整載入，請重讀。')}options.value=all}
 if(manager.value&&props.mode==='roles')capabilities.value=await permissionCatalog()
 ready.value=true
 }catch(e){error.value=failure(e)}finally{loading.value=false}}
function begin(row?:Staff|AccessRole){if(pending.value||!manager.value||!ready.value)return;editing.value=true;editId.value=row?.id;version.value=row?.version||0;enabled.value=row?.enabled??true;username.value=row&&'username'in row?row.username:'';password.value='';name.value=row&&'name'in row?row.name:'';description.value=row&&'description'in row?row.description:'';selected.value=row?('roleIds'in row?[...row.roleIds]:[...row.permissionIds]):[];note.value='';message.value='';error.value=''}
async function send(){if(sending.value)return;
 if(!pending.value){if(!manager.value||!ready.value)return;
   const body:Record<string,unknown>={enabled:enabled.value,requestId:crypto.randomUUID(),note:note.value.trim()}
   if(props.mode==='staff'){body.roleIds=[...selected.value].sort((a,b)=>a-b);if(editId.value)body.expectedVersion=version.value;else{body.username=username.value;body.password=password.value}}
   else{body.name=name.value.trim();body.description=description.value.trim();body.permissionIds=[...selected.value].sort((a,b)=>a-b);body.expectedVersion=version.value}
   pending.value={path:props.mode+(editId.value?'/'+editId.value:''),method:editId.value?'PUT':'POST',body}
 }
 sending.value=true;error.value='';try{const result=await accessWrite(pending.value.path,pending.value.method,pending.value.body);pending.value=undefined;password.value='';editing.value=false;message.value=result.replayed?'操作已核對，沒有重複套用。':'已保存並記錄稽核。授權有變更的員工需重新登入。';await load()}
 catch(e:any){const status=e.response?.status;if(status&&status>=400&&status<500){pending.value=undefined;error.value=failure(e)+(status===409?'；先重讀資料並重新開啟編輯，不會自動覆寫。':'')}else error.value='結果尚未確認。請使用「重試同一操作」核對，表單暫時凍結。'}finally{sending.value=false}
}
function roleNames(ids:number[]){return ids.map(id=>options.value.find(r=>r.id===id)?.name||'#'+id).join('、')}
function pretty(value:string|null){if(!value)return '—';try{return JSON.stringify(JSON.parse(value),null,2)}catch{return value}}
onMounted(load)
</script>
<template>
 <section class="access-panel card"><div class="card-body">
  <h1>{{ title }}</h1>
  <p v-if="mode==='staff'">員工與顧客帳號分開管理。啟停或角色改動會撤銷舊登入；員工需重新登入。</p>
  <p v-if="mode==='roles'">從固定權限目錄指派權限。角色停用會立即停止授權；不刪除歷史指派與稽核。</p>
  <p v-if="mode==='permissions'">權限由程式與資料庫版本定義。此頁唯讀，不能自行設定 API 路徑或建立通用授權。</p>
  <p v-if="mode==='audit'">唯讀操作紀錄。時間為 Asia/Taipei；不包含密碼。重整後請先核對紀錄與目前狀態。</p>
  <p v-if="!manager&&(mode==='staff'||mode==='roles')">目前為唯讀；修改存取設定需要完整的存取管理權限。</p>
  <p role="alert" v-if="error" class="text-danger">{{ error }}</p><p role="status" v-if="message">{{ message }}</p>
  <div class="access-actions"><button type="button" @click="load" :disabled="loading||sending">重讀資料</button><button v-if="manager&&(mode==='staff'||mode==='roles')" type="button" @click="begin()" :disabled="!ready||!!pending">{{ mode==='staff'?'新增員工':'新增角色' }}</button></div>
  <form v-if="editing" @submit.prevent="send" class="access-form">
   <h2>{{ editId?'編輯':'新增' }}{{ mode==='staff'?'員工':'角色' }} <span v-if="editId">#{{ editId }} · v{{ version }}</span></h2>
   <fieldset :disabled="!!pending||sending">
    <template v-if="mode==='staff'"><label>員工帳號<input v-model="username" :disabled="!!editId" required pattern="[a-zA-Z0-9_]{3,64}" autocomplete="off" maxlength="64"></label><label v-if="!editId">初始密碼<input v-model="password" type="password" required minlength="12" maxlength="72" autocomplete="new-password"></label><p v-if="!editId">至少12字元、UTF-8最多72 bytes。由你私下交給員工；此頁不寄送通知。</p></template>
    <template v-else><label>角色名稱<input v-model="name" required maxlength="64"></label><label>角色說明<textarea v-model="description" maxlength="255" /></label></template>
    <label><input type="checkbox" v-model="enabled">啟用{{ mode==='staff'?'員工':'角色' }}</label>
    <fieldset><legend>{{ mode==='staff'?'指派角色':'指派權限' }}</legend><template v-if="mode==='staff'"><label v-for="role in options" :key="role.id"><input type="checkbox" :value="role.id" v-model="selected">{{ role.name }} (#{{ role.id }}){{ role.enabled?'':'（停用）' }}</label></template><template v-else><label v-for="cap in capabilities" :key="cap.id"><input type="checkbox" :value="cap.id" v-model="selected">{{ cap.name }} · {{ cap.code }}</label></template></fieldset>
    <label>異動原因<textarea v-model="note" required maxlength="500" /></label>
   </fieldset>
   <p>必須保留至少一位啟用且具有全部存取管理權限的管理員。版本衝突需重讀後重新編輯。</p>
   <button type="submit" :disabled="sending||(!pending&&mode==='staff'&&!selected.length)">{{ pending?'重試同一操作':'保存設定' }}</button><button type="button" @click="editing=false;password=''" :disabled="!!pending||sending">關閉編輯</button>
   <p v-if="pending">待核對操作：{{ pending.body.requestId }}。重試使用原內容，請勿重整後直接另送一筆。</p>
  </form>
  <div class="access-table" v-if="mode==='staff'"><table><thead><tr><th>員工</th><th>狀態</th><th>角色</th><th>版本</th><th>操作</th></tr></thead><tbody><tr v-for="u in staff" :key="u.id"><td>{{ u.username }} (#{{u.id}})</td><td>{{u.enabled?'啟用':'停用'}}</td><td>{{roleNames(u.roleIds)}}</td><td>{{u.version}}</td><td><button v-if="manager" @click="begin(u)" :disabled="!!pending||!ready">編輯 {{u.username}}</button></td></tr></tbody></table></div>
  <div class="access-table" v-if="mode==='roles'"><table><thead><tr><th>角色</th><th>說明</th><th>狀態</th><th>權限數</th><th>版本</th><th>操作</th></tr></thead><tbody><tr v-for="r in roles" :key="r.id"><td>{{r.name}} (#{{r.id}})</td><td>{{r.description}}</td><td>{{r.enabled?'啟用':'停用'}}</td><td>{{r.permissionIds.length}}</td><td>{{r.version}}</td><td><button v-if="manager" @click="begin(r)" :disabled="!!pending||!ready">編輯 {{r.name}}</button></td></tr></tbody></table></div>
  <ul v-if="mode==='permissions'" class="capabilities"><li v-for="c in capabilities" :key="c.id"><strong>{{c.name}}</strong> · {{c.code}}<p>{{c.description}}</p></li></ul>
  <div v-if="mode==='audit'"><details v-for="e in events" :key="e.requestId" class="audit-event"><summary>{{e.createdAt}} · {{e.actorUsername}} · {{e.action}} #{{e.targetId}}</summary><p>操作 ID：{{e.requestId}}</p><p>原因：{{e.note}}</p><h3>修改前</h3><pre>{{pretty(e.beforeState)}}</pre><h3>修改後</h3><pre>{{pretty(e.afterState)}}</pre></details></div>
  <div class="access-actions" v-if="mode!=='permissions'"><button @click="page--;load()" :disabled="page===1||loading||sending">上一頁</button><span>第 {{page}} 頁 · 共 {{total}} 筆</span><button @click="page++;load()" :disabled="page*(mode==='roles'?50:20)>=total||loading||sending">下一頁</button></div>
 </div></section>
</template>
<style scoped>
.access-panel{min-width:0}.access-panel h1{font-size:1.5rem}.access-panel h2{font-size:1.2rem}.access-panel h3{font-size:1rem}.access-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.7rem;margin:1rem 0}.access-panel button{border:1px solid #385a61;border-radius:5px;background:#fff;padding:.5rem .7rem;color:#173e46}.access-panel button:disabled{opacity:.5}.access-form{border:1px solid #ccd5d8;padding:1rem;margin:1rem 0}.access-form label{display:block;margin:.5rem 0}.access-form input:not([type=checkbox]),textarea{display:block;width:100%;max-width:32rem;padding:.5rem;border:1px solid #aab8bd;border-radius:4px}.access-form fieldset{min-width:0}.access-form fieldset fieldset{border:1px solid #ccd5d8;padding:.6rem;max-height:22rem;overflow:auto}.access-table{overflow-x:auto}.access-panel table{width:100%;border-collapse:collapse}.access-panel th,.access-panel td{text-align:left;padding:.7rem;border-bottom:1px solid #ddd;overflow-wrap:anywhere}.capabilities{padding-left:1.3rem}.capabilities li{margin:1rem 0;overflow-wrap:anywhere}.audit-event{padding:.8rem;border-bottom:1px solid #ddd;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}.access-panel p{overflow-wrap:anywhere}
</style>
