import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CustomerView } from '@/api/customer'
export const useCustomerStore = defineStore('customer', () => {
  const profile = ref<CustomerView | null>(null)
  return { profile, clear: () => { profile.value = null } }
})
