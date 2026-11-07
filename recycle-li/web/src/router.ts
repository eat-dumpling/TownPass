import { createRouter, createWebHashHistory } from 'vue-router'

// Hash 路由：靜態部署（Firebase Hosting）與 WebView 重新整理都不會 404。
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue'), meta: { title: '回收小里長', dock: true } },
    { path: '/scan', component: () => import('./views/ScanView.vue'), meta: { title: '掃一掃' } },
    { path: '/pick', component: () => import('./views/PickView.vue'), meta: { title: '它是哪一種？' } },
    { path: '/catch/:id', component: () => import('./views/CatchView.vue'), meta: { title: '怎麼丟' } },
    { path: '/quiz', component: () => import('./views/LevelMapView.vue'), meta: { title: '考考你', dock: true } },
    { path: '/quiz/:id', name: 'quiz-level', component: () => import('./views/QuizView.vue'), meta: { title: '考考你' } },
    { path: '/build', component: () => import('./views/BuildView.vue'), meta: { title: '蓋我的里', dock: true } },
    { path: '/missions', component: () => import('./views/MissionsView.vue'), meta: { title: '任務與成就', dock: true } },
    { path: '/guide', component: () => import('./views/GuideView.vue'), meta: { title: '分類指南' } },
    { path: '/guide/:id', component: () => import('./views/ItemView.vue'), meta: { title: '品項卡' } },
    { path: '/codex/:id', component: () => import('./views/CardView.vue'), meta: { title: '分辨卡' } },
    { path: '/codex', component: () => import('./views/CodexView.vue'), meta: { title: '圖鑑', dock: true } },
    // 辨識測試室只給開發用，App 內建版與線上版都沒有
    ...(import.meta.env.DEV ? [{ path: '/lab', component: () => import('./views/LabView.vue'), meta: { title: '辨識測試室' } }] : []),
  ],
})
