import { createRouter, createWebHistory } from 'vue-router'
import WorldView from '@/views/WorldView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: WorldView,
    },
  ],
})

export default router
