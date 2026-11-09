import { createRouter, createWebHistory } from 'vue-router'
import { useUserInfoStore } from '@/stores/userInfo'
import type { Permission } from '@/types/user'
import LayoutVue from '@/components/layout/BaseLayout.vue'
import MainVue from '@/components/layout/Main.vue'
import NotFound from '@/views/NotFound.vue'
import LoginVue from '@/views/Login.vue'
import UserResetPasswordVue from '@/views/user/UserResetPassword.vue'
import UserInfoVue from '@/views/user/UserInfo.vue'
import UserAccountVue from '@/views/account/UserAccount.vue'
import RoleListVue from '@/views/role/RoleList.vue'
import PermissionListVue from '@/views/role/PermissionList.vue'
import { getUserInfoService } from '@/api/user'
import { getCustomer } from '@/api/customer'
import { useCustomerStore } from '@/stores/customer'

const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/shop', component: () => import('@/views/shop/ShopLayout.vue'), meta: { audience: 'customer' }, children: [
    { path: '', component: () => import('@/views/shop/ShopHome.vue'), meta: { public: true } },
    { path: 'preorders', component: () => import('@/views/shop/Preorders.vue'), meta: { public: true } },
    { path: 'preorders/:id/checkout', component: () => import('@/views/shop/PreorderCheckout.vue') },
    { path: 'preorder-orders', component: () => import('@/views/shop/CustomerPreorders.vue') },
    { path: 'preorders/:id', component: () => import('@/views/shop/Preorders.vue'), meta: { public: true } },
    { path: 'products', component: () => import('@/views/shop/ProductList.vue'), meta: { public: true } },
    { path: 'products/:id', component: () => import('@/views/shop/ProductDetail.vue'), meta: { public: true } },
    { path: 'login', component: () => import('@/views/shop/CustomerLogin.vue'), meta: { public: true } },
    { path: 'register', component: () => import('@/views/shop/CustomerRegister.vue'), meta: { public: true } },
    { path: 'account', component: () => import('@/views/shop/CustomerAccount.vue') },
    { path: 'orders', component: () => import('@/views/shop/CustomerOrders.vue') },
    { path: 'cart', component: () => import('@/views/shop/CustomerCart.vue') },
    { path: 'addresses', component: () => import('@/views/shop/CustomerAddresses.vue') },
    { path: ':pathMatch(.*)*', component: NotFound, meta: { public: true } }
  ] },
  { path: '/admin/login', name: 'login', component: LoginVue, meta: { title: '員工登入' } },
  { path: '/not-found', component: NotFound },
  { path: '/', component: LayoutVue, name: 'Layout', redirect: '/home', children: [
    { path: '/home', component: MainVue, meta: { title: '工作首頁' } },
    { path: '/admin/user/resetPassword', component: UserResetPasswordVue },
    { path: '/admin/user/info', component: UserInfoVue }
  ] },
  { path: '/:pathMatch(.*)*', component: NotFound }
] })
const components = new Map<string, any>([['preorders.arrivals.read', () => import('@/views/preorders/PreorderArrivalsAdmin.vue')], ['preorder-orders.read', () => import('@/views/preorders/PreorderOrdersAdmin.vue')], ['preorders.read', () => import('@/views/preorders/PreorderAdmin.vue')], ['notifications.read', () => import('@/views/notifications/NotificationAdmin.vue')], ['masters.read', () => import('@/views/catalog/MastersAdmin.vue')], ['access.staff.read', UserAccountVue], ['access.roles.read', RoleListVue], ['access.permissions.read', PermissionListVue], ['access.audit.read', () => import('@/views/role/AccessAudit.vue')], ['catalog.read.list', () => import('@/views/catalog/ProductAdmin.vue')], ['orders.read.list', () => import('@/views/orders/StaffOrders.vue')]])
let signature = ''
let removeRoutes: (() => void)[] = []
export function addDynamicRoutes(permissions: Permission[]) {
  const nextSignature = JSON.stringify(permissions.map(p => [p.code || p.name, p.adminRouter]).sort())
  if (signature === nextSignature) return false
  removeRoutes.forEach(remove => remove()); removeRoutes = []
  permissions.forEach(permission => {
    const component = components.get(permission.code || permission.name)
    if (component && permission.adminRouter) removeRoutes.push(router.addRoute('Layout', {
      path: permission.adminRouter, name: permission.code || permission.name, component,
      meta: { title: permission.name, permission: permission.code || permission.name }
    }))
  })
  signature = nextSignature; return true
}
router.beforeEach(async (to) => {
  if (to.meta.audience === 'customer') {
    if (to.meta.public) return true
    const customer = useCustomerStore()
    try { customer.profile = await getCustomer(); return true }
    catch { customer.clear(); return '/shop/login' }
  }
  const store = useUserInfoStore()
  if (to.path === '/admin/login') {
    store.removeInfo(); removeRoutes.forEach(remove => remove()); removeRoutes = []; signature = ''
    return true
  }
  try {
    const result = await getUserInfoService()
    store.setInfo(result.data); store.setPermissions(result.data.permissions || [])
    if (addDynamicRoutes(store.permissions)) return { path: to.fullPath, replace: true }
    if (to.meta.permission && !store.permissions.some(p => (p.code || p.name) === to.meta.permission)) return '/not-found'
    return true
  } catch {
    store.removeInfo(); return '/admin/login'
  }
})
export default router
