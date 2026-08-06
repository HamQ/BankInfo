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
      <h1>🏦 台湾信用卡情报雷达</h1>
      <div class="nav-links">
        <router-link to="/" active-class="active" exact>总览</router-link>
        <router-link to="/compare" active-class="active">银行对比</router-link>
      </div>
      <div class="nav-right">
        数据源: 金管会银行局 · 最后更新: {{ lastUpdate }}
      </div>
    </nav>
    <div class="container">
      <router-view></router-view>
    </div>
  </div>`,

  setup() {
    const lastUpdate = Vue.ref('')
    Vue.onMounted(async () => {
      const { data } = await supabase
        .from('monthly_credit_stats')
        .select('report_month')
        .order('report_month', { ascending: false })
        .limit(1)
      if (data?.length) {
        const d = new Date(data[0].report_month + 'T00:00:00')
        lastUpdate.value = rocDate(data[0].report_month)
      }
    })
    return { lastUpdate }
  }
})

// 全局过滤器/方法
app.config.globalProperties.fmtNumber = fmtNumber
app.config.globalProperties.fmtAmount = fmtAmount
app.config.globalProperties.fmtPercent = fmtPercent

app.use(router)
app.mount("#app")
