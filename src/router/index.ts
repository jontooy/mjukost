import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UpdatePasswordView from '@/views/UpdatePasswordView.vue'
import WorldView from '@/views/WorldView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: WorldView,
    },
    {
      path: '/account/update-password',
      name: 'update-password',
      component: UpdatePasswordView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.ready) {
    await auth.init()
  }

  if (auth.passwordRecovery && auth.isAuthenticated && to.name !== 'update-password') {
    return { name: 'update-password' }
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'home' }
  }
})

export default router
