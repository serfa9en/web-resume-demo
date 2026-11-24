import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'

import './styles/base.css'
import './styles/resume.css'

createApp(App).use(createPinia()).mount('#app')
