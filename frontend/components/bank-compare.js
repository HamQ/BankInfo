// ============================================
// BankCompare 组件 — 银行对比页
// ============================================
const BankCompare = {
  template: `
  <div>
    <div class="card">
      <h2>银行对比</h2>
      <div class="compare-selector">
        <select v-model="selectedBanks" multiple style="height:150px;min-width:240px">
          <option v-for="b in banks" :value="b.id" :key="b.id">{{ b.name }}</option>
        </select>
        <div style="font-size:12px;color:var(--gray-400)">
          <div>Ctrl/Cmd + 点击选择 2~4 家</div>
          <div style="margin-top:4px">已选: {{ selectedBanks.length }}</div>
        </div>
      </div>
      <div class="filter-bar" style="margin-top:16px">
        <button class="btn" :class="cmpMetric==='cards' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='cards'">流通卡数</button>
        <button class="btn" :class="cmpMetric==='active' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='active'">有效卡率</button>
        <button class="btn" :class="cmpMetric==='volume' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='volume'">签帐金额</button>
        <button class="btn" :class="cmpMetric==='risk' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='risk'">逾期比率</button>
        <button class="btn" :class="cmpMetric==='revolving' ? 'btn-primary' : 'btn-outline'" @click="cmpMetric='revolving'">循环信用余额</button>
      </div>
      <div class="chart-box" id="compare-chart"></div>
      <div v-if="selectedBanks.length < 2" class="empty">请选择至少 2 家银行进行对比</div>
    </div>
  </div>`,

  setup() {
    const banks = Vue.ref([])
    const selectedBanks = Vue.ref([])
    const cmpMetric = Vue.ref('cards')
    const allData = Vue.ref({})

    Vue.onMounted(async () => {
      const { data: bd } = await supabase.from('banks').select('*').order('code')
      if (bd) banks.value = bd
    })

    Vue.watch([selectedBanks, cmpMetric], () => {
      Vue.nextTick(() => loadAndRender())
    }, { deep: true })

    async function loadAndRender() {
      if (selectedBanks.value.length < 2) return
      const el = document.getElementById('compare-chart')
      if (!el) return

      // 加载每家银行的数据
      const promises = selectedBanks.value.map(id =>
        supabase.from('monthly_credit_stats')
          .select('*')
          .eq('bank_id', id)
          .order('report_month', { ascending: true })
      )
      const results = await Promise.all(promises)

      const metricMap = {
        cards: 'cards_in_circulation',
        active: 'active_ratio',
        volume: 'transaction_volume',
        risk: 'delinquency_3m_ratio',
        revolving: 'revolving_balance'
      }
      const metric = metricMap[cmpMetric.value]
      const unitMap = {
        cards: { name: '张数', fmt: v => (v/10000).toFixed(0)+'万' },
        active: { name: '%', fmt: v => v.toFixed(1)+'%' },
        volume: { name: '千元', fmt: v => (v/100000).toFixed(1)+'亿' },
        risk: { name: '%', fmt: v => v.toFixed(2)+'%' },
        revolving: { name: '千元', fmt: v => (v/100000).toFixed(1)+'亿' },
      }
      const unit = unitMap[cmpMetric.value]
      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

      // 找到所有月份的共同集合
      const monthSet = new Set()
      results.forEach((r, i) => {
        if (r.data) r.data.forEach(s => monthSet.add(s.report_month))
      })
      const months = [...monthSet].sort()

      const series = results.map((r, i) => {
        const name = banks.value.find(b => b.id === selectedBanks.value[i])?.short_name || '银行' + (i+1)
        const dataMap = {}
        if (r.data) r.data.forEach(s => {
          let val = s[metric]
          if (metric === 'active_ratio' && s.cards_in_circulation > 0) {
            val = parseFloat(((s.active_cards / s.cards_in_circulation) * 100).toFixed(2))
          }
          dataMap[s.report_month] = val
        })
        return {
          name, type: 'line',
          data: months.map(m => dataMap[m] ?? null),
          smooth: true,
          lineStyle: { width: 2, color: colors[i % colors.length] },
          itemStyle: { color: colors[i % colors.length] }
        }
      })

      const chart = echarts.getInstanceByDom(el) || echarts.init(el)
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: series.map(s => s.name), top: 0 },
        grid: { left: 80, right: 40, top: 50, bottom: 30 },
        xAxis: { type: 'category', data: months.map(m => rocDate(m)), axisLabel: { rotate: 45, fontSize: 11 } },
        yAxis: { type: 'value', name: unit.name, axisLabel: { formatter: unit.fmt } },
        series
      })
    }

    return { banks, selectedBanks, cmpMetric }
  }
}
