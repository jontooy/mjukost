import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { usePrivateModeStore } from './stores/privateMode'
import './assets/main.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  await useAuthStore().init()
  usePrivateModeStore().init()
  app.use(router)
  app.mount('#app')
}

bootstrap()
