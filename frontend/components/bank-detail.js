// ============================================
// BankDetail 组件 — 银行详情页
// ============================================
const BankDetail = {
  template: `
  <div v-if="bank">
    <!-- 银行标题 -->
    <div class="card" style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <h2 style="margin:0">{{ bank.name }}</h2>
        <div style="font-size:12px;color:var(--gray-400);margin-top:4px">
          <span v-if="bank.notes">📌 {{ bank.notes }} · </span>
          <a :href="bank.website" target="_blank" v-if="bank.website">官网</a>
        </div>
      </div>
      <div style="text-align:right" v-if="latest">
        <div style="font-size:12px;color:var(--gray-400)">最新数据: {{ latestMonth }}</div>
        <div style="font-size:12px;color:var(--gray-400);margin-top:2px">
          来源: <a :href="latest.source_url" target="_blank" v-if="latest.source_url">金管局</a>
        </div>
      </div>
    </div>

    <!-- 指标卡 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">流通卡数</div>
        <div class="value">{{ fmtNumber(latest?.cards_in_circulation) }}</div>
        <div class="change" :class="trendDir('cards_in_circulation')">{{ trendChange('cards_in_circulation') }}</div>
      </div>
      <div class="metric-card">
        <div class="label">有效卡率</div>
        <div class="value">{{ fmtPercent(latest?.active_ratio) }}</div>
        <div class="change" :class="trendDir('active_ratio')">{{ trendChange('active_ratio') }}</div>
      </div>
      <div class="metric-card">
        <div class="label">当月签帐金额</div>
        <div class="value">{{ fmtAmount(latest?.transaction_volume) }}</div>
        <div class="change" :class="trendDir('transaction_volume')">{{ trendChange('transaction_volume') }}</div>
      </div>
      <div class="metric-card">
        <div class="label">循环信用余额</div>
        <div class="value">{{ fmtAmount(latest?.revolving_balance) }}</div>
        <div class="change" :class="trendDir('revolving_balance')">{{ trendChange('revolving_balance') }}</div>
      </div>
    </div>

    <!-- 趋势图 -->
    <div class="card">
      <h2>📊 月度趋势</h2>
      <div class="filter-bar">
        <button class="btn" :class="activeChart==='cards' ? 'btn-primary' : 'btn-outline'" @click="activeChart='cards'">卡数趋势</button>
        <button class="btn" :class="activeChart==='volume' ? 'btn-primary' : 'btn-outline'" @click="activeChart='volume'">签帐金额</button>
        <button class="btn" :class="activeChart==='risk' ? 'btn-primary' : 'btn-outline'" @click="activeChart='risk'">风险指标</button>
      </div>
      <div class="chart-box" id="bank-chart"></div>
    </div>

    <!-- 卡产品 -->
    <div class="card" v-if="products.length">
      <h2>💳 卡片产品 ({{ products.length }})</h2>
      <div class="product-grid">
        <div class="product-card" v-for="p in products" :key="p.id">
          <div class="p-name">{{ p.name }}</div>
          <div class="p-tags">
            <span v-if="p.network" class="p-tag" :class="p.network.toLowerCase()">{{ p.network }}</span>
            <span v-if="p.card_level" class="p-tag">{{ p.card_level }}</span>
            <span v-if="p.is_cobrand" class="p-tag">联名: {{ p.co_brand_partner }}</span>
          </div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:4px" v-if="p.key_benefits">{{ p.key_benefits?.substring(0, 80) }}{{ p.key_benefits?.length > 80 ? '...' : '' }}</div>
        </div>
      </div>
    </div>

    <!-- 洞察 -->
    <div class="card" v-if="bankInsights.length">
      <h2>📡 相关洞察</h2>
      <div v-for="ins in bankInsights" :key="ins.id" class="insight-item" :class="ins.category">
        <div>{{ ins.content }}</div>
        <div class="meta">{{ new Date(ins.created_at).toLocaleDateString('zh-TW') }}</div>
      </div>
    </div>
  </div>
  <div v-else class="loading">加载中...</div>`,

  setup() {
    const route = VueRouter.useRoute()
    const bank = Vue.ref(null)
    const latest = Vue.ref(null)
    const allStats = Vue.ref([])
    const products = Vue.ref([])
    const bankInsights = Vue.ref([])
    const activeChart = Vue.ref('cards')

    Vue.onMounted(async () => {
      const bankId = route.params.id

      // 银行基础信息
      const { data: bd } = await supabase.from('banks').select('*').eq('id', bankId).single()
      if (bd) bank.value = bd

      // 全量月报（按日期升序）
      const { data: sd } = await supabase
        .from('monthly_credit_stats')
        .select('*')
        .eq('bank_id', bankId)
        .order('report_month', { ascending: true })

      if (sd) {
        sd.forEach(s => {
          s.active_ratio = s.cards_in_circulation > 0
            ? parseFloat(((s.active_cards / s.cards_in_circulation) * 100).toFixed(2))
            : null
        })
        allStats.value = sd
        latest.value = sd[sd.length - 1]
      }

      // 卡产品
      const { data: pd } = await supabase
        .from('card_products')
        .select('*')
        .eq('bank_id', bankId)
        .order('name')
      if (pd) products.value = pd

      // 洞察
      const { data: ind } = await supabase
        .from('insights')
        .select('*')
        .eq('bank_id', bankId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (ind) bankInsights.value = ind

      Vue.nextTick(() => renderChart())
    })

    // 监听 chart 类型切换
    Vue.watch(activeChart, () => Vue.nextTick(() => renderChart()))

    function renderChart() {
      const el = document.getElementById('bank-chart')
      if (!el || !allStats.value.length) return
      let chart = echarts.getInstanceByDom(el) || echarts.init(el)
      const d = allStats.value

      if (activeChart.value === 'cards') {
        chart.setOption({
          tooltip: { trigger: 'axis' },
          legend: { data: ['流通卡数', '有效卡数', '有效卡率'], top: 0 },
          grid: { left: 60, right: 60, top: 50, bottom: 30 },
          xAxis: { type: 'category', data: d.map(s => rocDate(s.report_month)), axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: [
            { type: 'value', name: '张数', axisLabel: { formatter: v => (v/10000).toFixed(0)+'万' } },
            { type: 'value', name: '%', axisLabel: { formatter: v => v+'%' } }
          ],
          series: [
            { name: '流通卡数', type: 'line', data: d.map(s => s.cards_in_circulation), smooth: true, lineStyle: { width: 2 } },
            { name: '有效卡数', type: 'line', data: d.map(s => s.active_cards), smooth: true, lineStyle: { width: 2 } },
            { name: '有效卡率', type: 'line', yAxisIndex: 1, data: d.map(s => s.active_ratio), smooth: true, lineStyle: { type: 'dashed' } }
          ]
        })
      } else if (activeChart.value === 'volume') {
        chart.setOption({
          tooltip: { trigger: 'axis' },
          legend: { data: ['当月签帐金额', '预借现金金额'], top: 0 },
          grid: { left: 80, right: 20, top: 50, bottom: 30 },
          xAxis: { type: 'category', data: d.map(s => rocDate(s.report_month)), axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: { type: 'value', name: '千元 NTD', axisLabel: { formatter: v => (v/100000).toFixed(1)+'亿' } },
          series: [
            { name: '当月签帐金额', type: 'bar', data: d.map(s => s.transaction_volume), itemStyle: { color: '#3b82f6' } },
            { name: '预借现金金额', type: 'bar', data: d.map(s => s.cash_advance_volume), itemStyle: { color: '#f59e0b' } }
          ]
        })
      } else {
        chart.setOption({
          tooltip: { trigger: 'axis' },
          legend: { data: ['逾期3月+比率', '逾期6月+比率', '备抵呆帐提足率'], top: 0 },
          grid: { left: 60, right: 60, top: 50, bottom: 30 },
          xAxis: { type: 'category', data: d.map(s => rocDate(s.report_month)), axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: { type: 'value', name: '%', axisLabel: { formatter: v => v+'%' } },
          series: [
            { name: '逾期3月+比率', type: 'line', data: d.map(s => s.delinquency_3m_ratio), smooth: true, lineStyle: { color: '#ef4444' } },
            { name: '逾期6月+比率', type: 'line', data: d.map(s => s.delinquency_6m_ratio), smooth: true, lineStyle: { color: '#f59e0b' } },
            { name: '备抵呆帐提足率', type: 'line', data: d.map(s => s.bad_debt_coverage_ratio), smooth: true, lineStyle: { color: '#8b5cf6' } }
          ]
        })
      }
    }

    function trendChange(field) {
      if (allStats.value.length < 2) return ''
      const prev = allStats.value[allStats.value.length - 2]
      const curr = allStats.value[allStats.value.length - 1]
      if (prev == null || curr == null) return ''
      let prevVal, currVal
      if (field === 'active_ratio') {
        prevVal = prev.cards_in_circulation > 0 ? (prev.active_cards / prev.cards_in_circulation * 100) : 0
        currVal = curr.cards_in_circulation > 0 ? (curr.active_cards / curr.cards_in_circulation * 100) : 0
      } else {
        prevVal = prev[field] || 0
        currVal = curr[field] || 0
      }
      if (prevVal === 0) return ''
      const pct = ((currVal - prevVal) / prevVal * 100)
      return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
    }

    function trendDir(field) {
      const c = trendChange(field)
      if (!c) return ''
      return c.startsWith('+') ? 'up' : 'down'
    }

    const latestMonth = Vue.computed(() => {
      if (!allStats.value.length) return ''
      return rocDate(allStats.value[allStats.value.length - 1].report_month)
    })

    return {
      bank, latest, allStats, products, bankInsights, activeChart,
      latestMonth, trendChange, trendDir,
      fmtNumber, fmtAmount, fmtPercent
    }
  }
}
