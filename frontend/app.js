// ============================================
// App 主程序 — Vue 3 + Vue Router 初始化
// ============================================
const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path: "/", component: Dashboard },
    { path: "/bank/:id", component: BankDetail },
    { path: "/compare", component: BankCompare },
  ],
})

const app = Vue.createApp({
  template: `
  <div>
    <nav class="navbar">
      <h1>台湾銀行卡片資訊</h1>
      <div class="nav-links">
        <router-link to="/" active-class="active" exact>總覽</router-link>
        <router-link to="/compare" active-class="active">銀行對比</router-link>
      </div>
      <div class="nav-right">
        資料來源: 金管會銀行局 · 最後更新: {{ lastUpdate || "載入中..." }}
      </div>
    </nav>
    <div class="container">
      <router-view></router-view>
    </div>
  </div>`,

  setup() {
    const lastUpdate = Vue.ref("")
    Vue.onMounted(async () => {
      try {
        const { data } = await supabase
          .from("monthly_credit_stats")
          .select("report_month")
          .order("report_month", { ascending: false })
          .limit(1)
        if (data?.length) {
          lastUpdate.value = rocDate(data[0].report_month)
        }
      } catch (e) {
        console.error("App init error:", e)
      }
    })
    return { lastUpdate }
  }
})

// 全局方法
app.config.globalProperties.fmtNumber = fmtNumber
app.config.globalProperties.fmtAmount = fmtAmount
app.config.globalProperties.fmtPercent = fmtPercent

app.use(router)
app.mount("#app")
