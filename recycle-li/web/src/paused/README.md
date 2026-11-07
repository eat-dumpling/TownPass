# 暫停的功能

依 2026-11-07 的決定（孩童版收斂成「掃描 → 回饋與獎勵 → 蓋里 → 任務與成就」），下面這些畫面從路由拿掉、不參與型別檢查與建置：

- FactoryView（舊版回收工廠；已由 `views/BuildView.vue` 取代，工廠長建議仍用 OR② `solvers/factory.ts`）
- MissionsView（舊版；已由 `views/MissionsView.vue` 取代）
- （QuizView 已改寫成破關版，回到 src/views/QuizView.vue 與 LevelMapView.vue）
- RouteGameView（清運大作戰，OR③ TSPTW）
- TonightView、ParentView（今晚任務、家長確認：收斂後不做倒垃圾）
- ReportView（本週家庭報告）

求解器（`src/solvers/factory.ts`、`tsptw.ts`、`chase.ts`）與它們的測試都還在、都會跑。
要恢復時：搬回 `src/views/`、加回 `src/router.ts`，並把畫面裡的 emoji 換成 `<AppIcon>`（資料欄位已從 `emoji` 改成 `icon`）。
