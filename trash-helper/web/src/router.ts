import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/identify', component: () => import('./views/IdentifyView.vue') },
    { path: '/scan', component: () => import('./views/ScanView.vue') },
    { path: '/browse', component: () => import('./views/BrowseView.vue') },
    { path: '/item/:id', component: () => import('./views/ItemView.vue') },
    { path: '/today', component: () => import('./views/TodayView.vue') },
    { path: '/first-time', component: () => import('./views/GuideView.vue') },
  ],
})
