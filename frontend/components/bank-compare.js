// ============================================
// BankCompare 组件 — 銀行對比页 v2 (雷达图 + 趨勢 + 指標表)
// ============================================
const BankCompare = {
  template: `
  <div>
    <div class="card">
      <h2>📊 銀行對比</h2>
      <div class="compare-selector">
        <select v-model="selectedBanks" multiple style="height:140px;min-width:260px">
          <option v-for="b in banks" :value="b.id" :key="b.id">{{ b.short_name || b.name }}</option>
        </select>
        <div style="font-size:11px;color:var(--text-muted);margin-left:12px">
          <div>按住 Ctrl/Cmd 點選選擇 2~4 家</div>
          <div style="margin-top:4px">已选: <b style="color:var(--accent)">{{ selectedBanks.length }}</b></div>
          <div v-if="selectedBanks.length > 4" style="color:var(--amber);margin-top:4px">建议不超过4家，雷达图更清晰</div>
        </div>
      </div>
    </div>

    <template v-if="selectedBanks.length >= 2">
      <!-- 雷达图 -->
      <div class="card">
        <h2>🎯 最新月份雷达對比</h2>
        <div class="chart-box" id="radar-chart" style="height:480px"></div>
      </div>

      <!-- 指標對比表 -->
      <div class="card">
        <h2>📋 关键指標一览 ({{ latestMonth }})</h2>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>指標</th>
                <th v-for="b in compareData" :key="b.bank_id" class="number">{{ b.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in metricRows" :key="r.key">
                <td>{{ r.label }}</td>
                <td v-for="b in compareData" :key="b.bank_id" class="number" :style="r.style(b)">
                  {{ r.fmt(b[r.key]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 趨勢對比 -->
      <div class="card">
        <h2>📈 历史趨勢對比</h2>
        <div class="filter-bar">
          <button class="btn" :class="cmpMetric==='cards' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='cards'">流通卡數</button>
          <button class="btn" :class="cmpMetric==='active' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='active'">有效卡率</button>
          <button class="btn" :class="cmpMetric==='volume' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='volume'">簽帳金額</button>
          <button class="btn" :class="cmpMetric==='revolving' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='revolving'">循環信用餘額</button>
          <button class="btn" :class="cmpMetric==='risk' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='risk'">逾期3月+比率</button>
        </div>
        <div class="chart-box" id="trend-chart"></div>
      </div>
    </template>
    <div v-else class="card empty">请選擇至少 2 家銀行进行對比</div>
  </div>`,

  setup() {
    const banks = Vue.ref([])
    const selectedBanks = Vue.ref([])
    const cmpMetric = Vue.ref('cards')
    const compareData = Vue.ref([])

    const metricRows = Vue.computed(() => [
      { key: 'cards_in_circulation', label: '流通卡數', fmt: v => v ? (v/10000).toFixed(0)+'万' : '-',
        style: b => ({}) },
      { key: 'active_cards', label: '有效卡數', fmt: v => v ? (v/10000).toFixed(0)+'万' : '-',
        style: b => ({}) },
      { key: 'active_ratio', label: '有效卡率', fmt: v => v != null ? v.toFixed(1)+'%' : '-',
        style: b => b.active_ratio != null ? { color: b.active_ratio < 50 ? 'var(--red)' : b.active_ratio < 65 ? 'var(--amber)' : 'var(--green)' } : {} },
      { key: 'transaction_volume', label: '當月簽帳金額', fmt: v => v ? (v/1e8).toFixed(2)+'亿' : '-',
        style: b => ({}) },
      { key: 'revolving_balance', label: '循環信用餘額', fmt: v => v ? (v/1e8).toFixed(2)+'亿' : '-',
        style: b => ({}) },
      { key: 'cash_advance_volume', label: '预借现金', fmt: v => v ? (v/1e8).toFixed(2)+'亿' : '-',
        style: b => ({}) },
      { key: 'delinquency_3m_ratio', label: '逾期3月+比率', fmt: v => v != null ? v.toFixed(2)+'%' : '-',
        style: b => b.delinquency_3m_ratio > 1 ? { color: 'var(--red)' } : b.delinquency_3m_ratio > 0.5 ? { color: 'var(--amber)' } : { color: 'var(--green)' } },
      { key: 'delinquency_6m_ratio', label: '逾期6月+比率', fmt: v => v != null ? v.toFixed(2)+'%' : '-',
        style: b => ({}) },
      { key: 'bad_debt_coverage_ratio', label: '呆帐覆蓋率', fmt: v => v != null ? v.toFixed(1)+'%' : '-',
        style: b => ({}) },
    ])

    const latestMonth = Vue.computed(() => {
      if (!compareData.value.length) return ''
      const d = new Date(compareData.value[0].report_month + 'T00:00:00')
      const roc = d.getFullYear() - 1911
      return '民国'+roc+'年'+(d.getMonth()+1)+'月 (公元'+d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+')'
    })

    Vue.onMounted(async () => {
      const { data: bd } = await supabase.from('banks').select('*').order('code')
      if (bd) banks.value = bd
    })

    Vue.watch([selectedBanks, cmpMetric], () => {
      Vue.nextTick(() => loadAndRender())
    }, { deep: true })

    async function loadAndRender() {
      if (selectedBanks.value.length < 2) return

      // Latest data for radar + table
      const latestPromises = selectedBanks.value.map(id =>
        supabase.from('monthly_credit_stats')
          .select('*, banks(short_name)')
          .eq('bank_id', id)
          .order('report_month', { ascending: false })
          .limit(1)
      )
      const latestResults = await Promise.all(latestPromises)
      const cd = []
      for (let i = 0; i < latestResults.length; i++) {
        if (latestResults[i].data && latestResults[i].data.length) {
          const s = latestResults[i].data[0]
          s.name = s.banks?.short_name || banks.value.find(b => b.id === selectedBanks.value[i])?.short_name || ''
          s.active_ratio = s.cards_in_circulation > 0 ? parseFloat((s.active_cards / s.cards_in_circulation * 100).toFixed(2)) : null
          cd.push(s)
        }
      }
      compareData.value = cd
      await Vue.nextTick()
      renderRadar()

      // History for trend
      const trendPromises = selectedBanks.value.map(id =>
        supabase.from('monthly_credit_stats').select('*').eq('bank_id', id).order('report_month', { ascending: true })
      )
      const trendResults = await Promise.all(trendPromises)
      const byBank = {}
      for (let i = 0; i < trendResults.length; i++) {
        byBank[selectedBanks.value[i]] = trendResults[i].data || []
      }
      await Vue.nextTick()
      renderTrend(byBank)
    }

    function renderRadar() {
      const el = document.getElementById('radar-chart')
      if (!el || !compareData.value.length) return
      const chart = echarts.getInstanceByDom(el) || echarts.init(el)

      const metrics = [
        { key: 'cards_in_circulation', label: '流通卡數', max: 1e7 },
        { key: 'active_ratio', label: '有效卡率', max: 100 },
        { key: 'transaction_volume', label: '簽帳金額', max: 1e10 },
        { key: 'revolving_balance', label: '循環信用', max: 5e9 },
        { key: 'delinquency_3m_ratio', label: '逾期比率↓', max: 3, invert: true },
      ]

      const indicator = metrics.map(m => ({ name: m.label, max: 100 }))
      const colors = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c']
      const seriesData = compareData.value.map((b, i) => ({
        name: b.name,
        value: metrics.map(m => {
          let raw = b[m.key] || 0
          if (m.invert) raw = m.max - Math.min(raw, m.max)
          return Math.round(Math.min(raw / m.max * 100, 100))
        }),
        itemStyle: { color: colors[i % colors.length] },
        lineStyle: { color: colors[i % colors.length] },
        areaStyle: { color: colors[i % colors.length] + '20' }
      }))

      chart.setOption({
        tooltip: {},
        legend: { data: seriesData.map(s => s.name), bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
        radar: {
          indicator,
          center: ['50%', '46%'],
          radius: '62%',
          axisName: { color: '#94a3b8', fontSize: 10 }
        },
        series: [{ type: 'radar', data: seriesData }]
      }, true)
    }

    function renderTrend(byBank) {
      const el = document.getElementById('trend-chart')
      if (!el) return
      const chart = echarts.getInstanceByDom(el) || echarts.init(el)

      const metricMap = {
        cards: { key: 'cards_in_circulation', name: '流通卡數' },
        active: { key: 'active_ratio', name: '有效卡率' },
        volume: { key: 'transaction_volume', name: '簽帳金額' },
        revolving: { key: 'revolving_balance', name: '循環信用餘額' },
        risk: { key: 'delinquency_3m_ratio', name: '逾期3月+比率' },
      }
      const m = metricMap[cmpMetric.value]

      const monthSet = new Set()
      Object.values(byBank).forEach(arr => arr.forEach(s => monthSet.add(s.report_month)))
      const months = [...monthSet].sort()
      const colors = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c']

      const series = selectedBanks.value.map((id, i) => {
        const name = banks.value.find(b => b.id === id)?.short_name || ''
        const dataMap = {}
        byBank[id].forEach(s => {
          let val = s[m.key]
          if (m.key === 'active_ratio' && s.cards_in_circulation > 0) {
            val = parseFloat((s.active_cards / s.cards_in_circulation * 100).toFixed(2))
          }
          dataMap[s.report_month] = val
        })
        return {
          name, type: 'line',
          data: months.map(mo => dataMap[mo] ?? null),
          smooth: true,
          symbol: 'circle', symbolSize: 4,
          lineStyle: { width: 2, color: colors[i % colors.length] },
          itemStyle: { color: colors[i % colors.length] }
        }
      })

      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: series.map(s => s.name), bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
        grid: { left: 80, right: 40, top: 20, bottom: 40 },
        xAxis: { type: 'category', data: months.map(mo => rocDate(mo)), axisLabel: { rotate: 45, fontSize: 10, color: '#94a3b8' } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94a3b8' } },
        series
      }, true)
    }

    return { banks, selectedBanks, cmpMetric, compareData, metricRows, latestMonth }
  }
}