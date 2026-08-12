// ============================================
// BankDetail 组件 — 銀行详情页 v2
// ============================================
const BankDetail = {
  template: `
  <div v-if="bank">
    <!-- 銀行标题 -->
    <div class="card" style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <h2 style="margin:0">{{ bank.name }}</h2>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
          <span v-if="bank.notes">📌 {{ bank.notes }} · </span>
          <a :href="bank.website" target="_blank" v-if="bank.website">官網</a>
        </div>
      </div>
      <div style="text-align:right" v-if="latest">
        <div style="font-size:12px;color:var(--text-muted)">最新資料: {{ latestMonth }}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
          來源: <a :href="sourcePdfUrl" target="_blank" v-if="latest.source_url">金管局 PDF</a>
        </div>
      </div>
    </div>

    <!-- 指標卡 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">流通卡數</div>
        <div class="value">{{ fmtNumber(latest?.cards_in_circulation) }}</div>
        <div class="change" :class="trendDir('cards_in_circulation')">{{ trendChange('cards_in_circulation') }}</div>
      </div>
      <div class="metric-card">
        <div class="label">有效卡率</div>
        <div class="value">{{ fmtPercent(latest?.active_ratio) }}</div>
        <div class="change" :class="trendDir('active_ratio')">{{ trendChange('active_ratio') }}</div>
      </div>
      <div class="metric-card">
        <div class="label">當月簽帳金額</div>
        <div class="value">{{ fmtAmount(latest?.transaction_volume) }}</div>
        <div class="change" :class="trendDir('transaction_volume')">{{ trendChange('transaction_volume') }}</div>
      </div>
      <div class="metric-card">
        <div class="label">循環信用餘額</div>
        <div class="value">{{ fmtAmount(latest?.revolving_balance) }}</div>
        <div class="change" :class="trendDir('revolving_balance')">{{ trendChange('revolving_balance') }}</div>
      </div>
    </div>

    <!-- 趨勢图 -->
    <div class="card">
      <h2>📊 月度趨勢</h2>
      <div class="filter-bar">
        <button class="btn" :class="activeChart==='cards' ? 'btn-primary' : 'btn-outline'" @click="activeChart='cards'">卡数趨勢</button>
        <button class="btn" :class="activeChart==='volume' ? 'btn-primary' : 'btn-outline'" @click="activeChart='volume'">簽帳金額</button>
        <button class="btn" :class="activeChart==='risk' ? 'btn-primary' : 'btn-outline'" @click="activeChart='risk'">風險指標</button>
      </div>
      <div class="chart-box" id="bank-chart"></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">💡 點選圖表上的資料点可直接跳转至金管局对应月份的 PDF 原始档案</div>
    </div>

    <!-- 卡产品 -->
    <div class="card" v-if="products.length">
      <h2>💳 卡片產品 ({{ filteredProducts.length }} / {{ products.length }})</h2>

      <!-- Network 快速篩選標籤 -->
      <div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap">
        <span class="p-tag" style="cursor:pointer" :style="productFilter===''?{opacity:1,outline:'2px solid var(--accent)'}:{opacity:0.5}" @click="productFilter=''">全部 {{ products.length }}</span>
        <span v-for="n in networkCounts" :key="n.name" class="p-tag" :class="n.name.toLowerCase()" style="cursor:pointer" :style="productFilter===n.name?{opacity:1,outline:'2px solid var(--accent)'}:{opacity:0.5}" @click="productFilter = (productFilter===n.name ? '' : n.name)">{{ n.name }} {{ n.count }}</span>
      </div>

      <!-- 卡種快速篩選標籤 -->
      <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap">
        <span v-for="t in typeCounts" :key="t.name" class="p-tag" style="cursor:pointer;font-size:11px" :style="typeFilter===t.name?{opacity:1,outline:'2px solid var(--accent)'}:{opacity:0.6}" @click="typeFilter=(typeFilter===t.name?'':t.name)">
          {{ t.label }} {{ t.count }}
        </span>
      </div>

      <!-- 搜尋 + 排序 -->
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input v-model="productSearch" placeholder="🔍 搜尋卡片名稱..." style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);flex:1;min-width:150px;font-size:13px">
        <select v-model="productSort" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
          <option value="name">按名稱排序</option>
          <option value="network">按 Network 分組</option>
        </select>
      </div>

      <div class="product-grid">
        <div class="product-card" v-for="p in filteredProducts" :key="p.id">
          <div class="p-name">{{ p.name }}</div>
          <div class="p-tags">
            <span v-if="p.network" class="p-tag" :class="p.network.toLowerCase()">{{ p.network }}</span>
            <span v-if="p.card_type && p.card_type!=='personal'" class="p-tag" style="background:var(--accent);color:white">{{ typeLabel(p.card_type) }}</span>
            <span v-if="p.card_level" class="p-tag">{{ p.card_level }}</span>
            <span v-if="p.is_cobrand" class="p-tag">聯名: {{ p.co_brand_partner }}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px" v-if="p.key_benefits">{{ p.key_benefits?.substring(0, 80) }}{{ p.key_benefits?.length > 80 ? '...' : '' }}</div>
          <div style="font-size:11px;margin-top:4px" v-if="p.source_page"><a :href="p.source_page" target="_blank" style="color:var(--accent);text-decoration:none">🔗 來源</a></div>
        </div>
      </div>
      <div v-if="!filteredProducts.length" style="text-align:center;padding:20px;color:var(--text-muted)">沒有匹配的卡片</div>
    </div>

    <!-- 数位存款帐户 (季度) -->
    <div class="card" v-if="digitalData.length">
      <h2>📱 数位存款帐户 (季度)
        <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:8px" v-if="digitalData[digitalData.length-1]?.source_url">
          來源: <a :href="digitalData[digitalData.length-1].source_url" target="_blank" style="color:var(--accent)">金管局</a>
        </span>
      </h2>
      <div class="chart-box" id="digital-chart" style="height:300px"></div>
    </div>

    <!-- 逾放资料 (季度) -->
    <div class="card" v-if="nplData.length">
      <h2>⚠️ 逾放资料 (季度)
        <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:8px" v-if="nplData[nplData.length-1]?.source_url">
          來源: <a :href="nplData[nplData.length-1].source_url" target="_blank" style="color:var(--accent)">金管局</a>
        </span>
      </h2>
      <div class="chart-box" id="npl-chart" style="height:300px"></div>
    </div>

    <!-- 洞察 -->
    <div class="card" v-if="bankInsights.length">
      <h2>📡 相關洞察</h2>
      <div v-for="ins in bankInsights" :key="ins.id" class="insight-item" :class="ins.category">
        <div>{{ ins.content }}</div>
        <div class="meta">{{ new Date(ins.created_at).toLocaleDateString('zh-TW') }}</div>
      </div>
    </div>
  </div>
  <div v-else class="loading">載入中...</div>`,

  setup() {
    const route = VueRouter.useRoute()
    const bank = Vue.ref(null)
    const latest = Vue.ref(null)
    const allStats = Vue.ref([])
    const products = Vue.ref([])
    const bankInsights = Vue.ref([])
    const digitalData = Vue.ref([])
    const productFilter = Vue.ref('')
    const typeFilter = Vue.ref('')
    const productSearch = Vue.ref('')
    const productSort = Vue.ref('name')
    const nplData = Vue.ref([])
    const activeChart = Vue.ref('cards')

    const typeCounts = Vue.computed(() => {
      const counts = {}
      products.value.forEach(p => {
        const t = p.card_type || 'personal'
        counts[t] = (counts[t] || 0) + 1
      })
      const labels = { personal:'👤 個人', business:'🏢 商務', cobrand:'🤝 聯名', debit:'💳 簽帳', commercial:'💼 企業' }
      return Object.entries(counts).map(([name, count]) => ({ name, label: labels[name] || name, count })).sort((a,b) => b.count - a.count)
    })

    const networkCounts = Vue.computed(() => {
      const counts = {}
      products.value.forEach(p => {
        const n = p.network || 'Unknown'
        counts[n] = (counts[n] || 0) + 1
      })
      return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count)
    })

    const filteredProducts = Vue.computed(() => {
      let list = [...products.value]
      if (productFilter.value) {
        list = list.filter(p => (p.network || 'Unknown') === productFilter.value)
      }
      if (typeFilter.value) {
        list = list.filter(p => (p.card_type || 'personal') === typeFilter.value)
      }
      if (productSearch.value) {
        const q = productSearch.value.toLowerCase()
        list = list.filter(p => p.name.toLowerCase().includes(q))
      }
      if (productSort.value === 'network') {
        list.sort((a,b) => (a.network||'').localeCompare(b.network||''))
      } else {
        list.sort((a,b) => a.name.localeCompare(b.name))
      }
      return list
    })

    Vue.onMounted(async () => {
      const bankId = route.params.id

      const { data: bd } = await supabase.from('banks').select('*').eq('id', bankId).single()
      if (bd) bank.value = bd

      const { data: sd } = await supabase
        .from('monthly_credit_stats').select('*').eq('bank_id', bankId).order('report_month', { ascending: true })
      if (sd) {
        sd.forEach(s => {
          s.active_ratio = s.cards_in_circulation > 0 ? parseFloat((s.active_cards / s.cards_in_circulation * 100).toFixed(2)) : null
        })
        allStats.value = sd
        latest.value = sd[sd.length - 1]
      }

      const { data: pd } = await supabase.from('card_products').select('*').eq('bank_id', bankId).order('name')
      if (pd) products.value = pd

      const { data: ind } = await supabase.from('insights').select('*').eq('bank_id', bankId).order('created_at', { ascending: false }).limit(10)
      if (ind) bankInsights.value = ind

      const { data: dd } = await supabase.from('quarterly_digital_acct_stats').select('*').eq('bank_id', bankId).order('report_quarter', { ascending: true })
      if (dd) digitalData.value = dd

      const { data: nd } = await supabase.from('quarterly_npl_stats').select('*').eq('bank_id', bankId).order('report_quarter', { ascending: true })
      if (nd) nplData.value = nd

      Vue.nextTick(() => { renderChart(); renderQuarterlyCharts() })
    })

    Vue.watch(activeChart, () => Vue.nextTick(() => renderChart()))

    function renderChart() {
      const el = document.getElementById('bank-chart')
      if (!el || !allStats.value.length) return
      let chart = echarts.getInstanceByDom(el) || echarts.init(el)
      const d = allStats.value

      if (activeChart.value === 'cards') {
        chart.setOption({
          tooltip: { trigger: 'axis', formatter: function(params) { var h = params.map(p => '<b>'+p.seriesName+'</b>: '+ (p.seriesName.includes('率') ? p.value?.toFixed(1)+'%' : (p.value||0).toLocaleString())).join('<br/>'); return h + '<br/><span style="color:#94a3b8;font-size:10px">🖱️ 點選跳转金管局 PDF 原始档案</span>'; } },
          legend: { data: ['流通卡數', '有效卡數', '有效卡率'], top: 0 },
          grid: { left: 60, right: 60, top: 50, bottom: 30 },
          xAxis: { type: 'category', data: d.map(s => westernDate(s.report_month)), axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: [
            { type: 'value', name: '张数', axisLabel: { formatter: v => (v/10000).toFixed(0)+'万' } },
            { type: 'value', name: '%', axisLabel: { formatter: v => v+'%' } }
          ],
          series: [
            { name: '流通卡數', type: 'line', data: d.map(s => s.cards_in_circulation), smooth: true, lineStyle: { width: 2 } },
            { name: '有效卡數', type: 'line', data: d.map(s => s.active_cards), smooth: true, lineStyle: { width: 2 } },
            { name: '有效卡率', type: 'line', yAxisIndex: 1, data: d.map(s => s.active_ratio), smooth: true, lineStyle: { type: 'dashed' } }
          ]
        })
      } else if (activeChart.value === 'volume') {
        chart.setOption({
          tooltip: { trigger: 'axis', formatter: function(params) { var h = params.map(p => '<b>'+p.seriesName+'</b>: '+ ((p.value||0)/1000).toLocaleString()+'千元').join('<br/>'); return h + '<br/><span style="color:#94a3b8;font-size:10px">🖱️ 點選跳转金管局 PDF 原始档案</span>'; } },
          legend: { data: ['當月簽帳金額', '预借现金金額'], top: 0 },
          grid: { left: 80, right: 20, top: 50, bottom: 30 },
          xAxis: { type: 'category', data: d.map(s => westernDate(s.report_month)), axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: { type: 'value', name: '千元 NTD', axisLabel: { formatter: v => (v/100000).toFixed(1)+'亿' } },
          series: [
            { name: '當月簽帳金額', type: 'bar', data: d.map(s => s.transaction_volume), itemStyle: { color: '#3b82f6' } },
            { name: '预借现金金額', type: 'bar', data: d.map(s => s.cash_advance_volume), itemStyle: { color: '#f59e0b' } }
          ]
        })
      } else {
        chart.setOption({
          tooltip: { trigger: 'axis', formatter: function(params) { var h = params.map(p => '<b>'+p.seriesName+'</b>: '+ (p.value||0).toFixed(2)+'%').join('<br/>'); return h + '<br/><span style="color:#94a3b8;font-size:10px">🖱️ 點選跳转金管局 PDF 原始档案</span>'; } },
          legend: { data: ['逾期3月+比率', '逾期6月+比率', '备抵呆帐提足率'], top: 0 },
          grid: { left: 60, right: 60, top: 50, bottom: 30 },
          xAxis: { type: 'category', data: d.map(s => westernDate(s.report_month)), axisLabel: { rotate: 45, fontSize: 11 } },
          yAxis: { type: 'value', name: '%', axisLabel: { formatter: v => v+'%' } },
          series: [
            { name: '逾期3月+比率', type: 'line', data: d.map(s => s.delinquency_3m_ratio), smooth: true, lineStyle: { color: '#ef4444' } },
            { name: '逾期6月+比率', type: 'line', data: d.map(s => s.delinquency_6m_ratio), smooth: true, lineStyle: { color: '#f59e0b' } },
            { name: '备抵呆帐提足率', type: 'line', data: d.map(s => s.bad_debt_coverage_ratio), smooth: true, lineStyle: { color: '#8b5cf6' } }
          ]
        })
      }

      chart.off('click')
      chart.on('click', function(params) {
        if (params.dataIndex != null && allStats.value[params.dataIndex]) {
          var src = allStats.value[params.dataIndex].source_url
          if (src) window.open(src.replace('.zip','.pdf'), '_blank')
        }
      })
    }

    function renderQuarterlyCharts() {
      const del = document.getElementById('digital-chart')
      if (del && digitalData.value.length) {
        const dc = echarts.getInstanceByDom(del) || echarts.init(del, 'dark')
        dc.setOption({
          tooltip: { trigger: "axis" },
          legend: { data: ["第一类","第二类","第三类"], bottom: 0, textStyle: { color: "#94a3b8", fontSize: 10 } },
          grid: { left: 70, right: 20, top: 20, bottom: 40 },
          xAxis: { type: "category", data: digitalData.value.map(s => { const dt = new Date(s.report_quarter + "T00:00:00"); return (dt.getFullYear()-1911)+"Q"+(Math.floor(dt.getMonth()/3)+1) }), axisLabel: { fontSize: 10, color: "#94a3b8" } },
          yAxis: { type: "value", name: "户数", axisLabel: { formatter: v => (v/10000).toFixed(0)+"万", fontSize: 10, color: "#94a3b8" } },
          series: [
            { name: "第一类", type: "bar", stack: "total", data: digitalData.value.map(s => s.type1_accounts), itemStyle: { color: "#38bdf8" } },
            { name: "第二类", type: "bar", stack: "total", data: digitalData.value.map(s => s.type2_accounts), itemStyle: { color: "#34d399" } },
            { name: "第三类", type: "bar", stack: "total", data: digitalData.value.map(s => s.type3_accounts), itemStyle: { color: "#a78bfa" } },
          ]
        }, true);
        dc.off("click"); dc.on("click", function(params) {
          if (params.dataIndex != null && digitalData.value[params.dataIndex]) {
            var src = digitalData.value[params.dataIndex].source_url;
            if (src) window.open(src, "_blank");
          }
        })
      }

      const nel = document.getElementById('npl-chart')
      if (nel && nplData.value.length) {
        const nc = echarts.getInstanceByDom(nel) || echarts.init(nel, 'dark')
        nc.setOption({
          tooltip: { trigger: "axis" },
          legend: { data: ["逾放比率","覆蓋率"], bottom: 0, textStyle: { color: "#94a3b8", fontSize: 10 } },
          grid: { left: 60, right: 60, top: 20, bottom: 40 },
          xAxis: { type: "category", data: nplData.value.map(s => { const dt = new Date(s.report_quarter + "T00:00:00"); return (dt.getFullYear()-1911)+"."+(dt.getMonth()+1).toString().padStart(2,"0") }), axisLabel: { fontSize: 10, color: "#94a3b8" } },
          yAxis: { type: "value", name: "%", axisLabel: { formatter: v => v+"%", fontSize: 10, color: "#94a3b8" } },
          series: [
            { name: "逾放比率", type: "line", data: nplData.value.map(s => s.npl_ratio), smooth: true, lineStyle: { color: "#f87171", width: 2 }, itemStyle: { color: "#f87171" } },
            { name: "覆蓋率", type: "line", data: nplData.value.map(s => s.coverage_ratio), smooth: true, lineStyle: { color: "#38bdf8", width: 2 }, itemStyle: { color: "#38bdf8" } },
          ]
        }, true);
        nc.off("click"); nc.on("click", function(params) {
          if (params.dataIndex != null && nplData.value[params.dataIndex]) {
            var src = nplData.value[params.dataIndex].source_url;
            if (src) window.open(src, "_blank");
          }
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

    const sourcePdfUrl = Vue.computed(() => {
      const src = latest.value?.source_url
      return src ? src.replace('.zip','.pdf') : ''
    })
    // typeLabel helper for card_type display
    const TYPE_LABELS = { personal: '👤 個人', business: '🏢 商務', cobrand: '🤝 聯名', debit: '💳 簽帳', commercial: '💼 企業', corporate: '🏢 企業' }
    function typeLabel(cardType) {
      if (!cardType || cardType === 'personal') return ''
      return TYPE_LABELS[cardType] || cardType
    }
    return {
      bank, latest, allStats, products, bankInsights, digitalData, nplData, activeChart, productFilter, typeFilter, productSearch, productSort, networkCounts, typeCounts, filteredProducts,
      latestMonth, trendChange, trendDir, sourcePdfUrl,
      fmtNumber, fmtAmount, fmtPercent, typeLabel
    }
  }
}

