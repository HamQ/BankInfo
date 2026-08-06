// ============================================
// Dashboard 组件 — 首页总览 (信用卡 / 现金卡)
// ============================================
const Dashboard = {
  template: `
  <div>
    <!-- 类型切换 -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{active: cardType==='credit'}" @click="switchType('credit')">💳 信用卡</button>
      <button class="tab-btn" :class="{active: cardType==='cash'}" @click="switchType('cash')">💰 現金卡</button>
    </div>

    <!-- 信用卡视图 -->
    <template v-if="cardType==='credit'">
      <div class="rank-grid">
        <div class="rank-card">
          <h3>🏆 信用卡流通卡数 Top 5</h3>
          <div v-if="topCards.length">
            <div class="rank-item" v-for="(b, i) in topCards.slice(0,5)" :key="b.id">
              <span class="pos" :class="{gold:i===0,silver:i===1,bronze:i===2}">{{ i+1 }}</span>
              <span class="name"><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></span>
              <span class="val">{{ fmtNumber(b.cards_in_circulation) }}</span>
            </div>
          </div>
          <div v-else class="loading">加载中...</div>
        </div>
        <div class="rank-card">
          <h3>📈 信用卡签帐金额 Top 5</h3>
          <div v-if="topVolume.length">
            <div class="rank-item" v-for="(b, i) in topVolume.slice(0,5)" :key="b.id">
              <span class="pos" :class="{gold:i===0,silver:i===1,bronze:i===2}">{{ i+1 }}</span>
              <span class="name"><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></span>
              <span class="val">{{ fmtAmount(b.transaction_volume) }}</span>
            </div>
          </div>
        </div>
        <div class="rank-card">
          <h3>⚠️ 信用卡有效卡率 Bottom 5</h3>
          <div v-if="bottomActive.length">
            <div class="rank-item" v-for="(b, i) in bottomActive.slice(0,5)" :key="b.id">
              <span class="pos">{{ i+1 }}</span>
              <span class="name"><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></span>
              <span class="val" :style="{color: b.active_ratio < 50 ? 'var(--red)' : 'var(--amber)'}">{{ b.active_ratio?.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>💳 信用卡 — 全部银行一览 ({{ latestCreditMonth }})</h2>
        <div class="filter-bar">
          <input type="text" v-model="searchText" placeholder="搜索银行..." style="width:200px"/>
          <select v-model="sortKey">
            <option value="cards_in_circulation">流通卡数</option>
            <option value="active_ratio">有效卡率</option>
            <option value="transaction_volume">签帐金额</option>
            <option value="revolving_balance">循环信用余额</option>
          </select>
          <select v-model="sortDir">
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:180px">银行</th>
              <th class="number" style="width:110px">流通卡数</th>
              <th class="number" style="width:110px">有效卡数</th>
              <th class="number" style="width:90px">有效卡率</th>
              <th class="number" style="width:130px">当月签帐金额</th>
              <th class="number" style="width:130px">循环信用余额</th>
              <th class="number" style="width:90px">逾期3M+</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in filteredCreditBanks" :key="b.id">
              <td><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></td>
              <td class="number">{{ fmtNumber(b.cards_in_circulation) }}</td>
              <td class="number">{{ fmtNumber(b.active_cards) }}</td>
              <td class="number">
                <span v-if="b.active_ratio != null" class="ratio-bar" :style="{width: Math.min(b.active_ratio, 100)+'px', background: b.active_ratio < 50 ? 'var(--red)' : b.active_ratio < 65 ? 'var(--amber)' : 'var(--green)'}"></span>
                {{ fmtPercent(b.active_ratio) }}
              </td>
              <td class="number">{{ fmtAmount(b.transaction_volume) }}</td>
              <td class="number">{{ fmtAmount(b.revolving_balance) }}</td>
              <td class="number">{{ fmtPercent(b.delinquency_3m_ratio) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredCreditBanks.length === 0 && !loading" class="empty">无匹配结果</div>
      </div>
    </template>

    <!-- 现金卡视图 -->
    <template v-if="cardType==='cash'">
      <div class="rank-grid">
        <div class="rank-card">
          <h3>🏆 現金卡已動用卡數 Top 5</h3>
          <div v-if="topCashDrawn.length">
            <div class="rank-item" v-for="(b, i) in topCashDrawn.slice(0,5)" :key="b.id">
              <span class="pos" :class="{gold:i===0,silver:i===1,bronze:i===2}">{{ i+1 }}</span>
              <span class="name"><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></span>
              <span class="val">{{ fmtNumber(b.drawn_cards) }}</span>
            </div>
          </div>
          <div v-else class="loading">加载中...</div>
        </div>
        <div class="rank-card">
          <h3>📈 現金卡放款餘額 Top 5</h3>
          <div v-if="topCashLoan.length">
            <div class="rank-item" v-for="(b, i) in topCashLoan.slice(0,5)" :key="b.id">
              <span class="pos" :class="{gold:i===0,silver:i===1,bronze:i===2}">{{ i+1 }}</span>
              <span class="name"><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></span>
              <span class="val">{{ fmtAmount(b.loan_balance) }}</span>
            </div>
          </div>
        </div>
        <div class="rank-card">
          <h3>⚠️ 現金卡逾放比率</h3>
          <div v-if="topCashDelinq.length">
            <div class="rank-item" v-for="(b, i) in topCashDelinq.slice(0,5)" :key="b.id">
              <span class="pos">{{ i+1 }}</span>
              <span class="name"><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></span>
              <span class="val" :style="{color: b.delinquency_ratio > 3 ? 'var(--red)' : 'var(--amber)'}">{{ fmtPercent(b.delinquency_ratio) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>💰 現金卡 — 全部银行一览 ({{ latestCashMonth }})</h2>
        <table>
          <thead>
            <tr>
              <th style="width:150px">银行</th>
              <th class="number" style="width:110px">已動用卡數</th>
              <th class="number" style="width:110px">未動用卡數</th>
              <th class="number" style="width:130px">契約限額(千元)</th>
              <th class="number" style="width:130px">可用額度(千元)</th>
              <th class="number" style="width:130px">放款餘額(千元)</th>
              <th class="number" style="width:90px">逾放比率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in cashStats" :key="b.id">
              <td><router-link :to="'/bank/'+b.bank_id">{{ b.banks?.short_name || b.banks?.name }}</router-link></td>
              <td class="number">{{ fmtNumber(b.drawn_cards) }}</td>
              <td class="number">{{ fmtNumber(b.undrawn_cards) }}</td>
              <td class="number">{{ fmtNumber(b.contract_limit) }}</td>
              <td class="number">{{ fmtNumber(b.available_limit) }}</td>
              <td class="number">{{ fmtNumber(b.loan_balance) }}</td>
              <td class="number">{{ fmtPercent(b.delinquency_ratio) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="cashStats.length === 0 && !loading" class="empty">暂无现金卡数据</div>
      </div>
    </template>

    <div v-if="loading" class="loading">加载中...</div>
  </div>`,

  setup() {
    const cardType = Vue.ref("credit")
    const stats = Vue.ref([])
    const cashStats = Vue.ref([])
    const searchText = Vue.ref("")
    const sortKey = Vue.ref("cards_in_circulation")
    const sortDir = Vue.ref("desc")
    const loading = Vue.ref(true)

    async function loadCreditData() {
      // 加载最新信用卡月报
      const { data: statsData } = await supabase
        .from("monthly_credit_stats")
        .select("*, banks!inner(id, name, short_name)")
        .order("report_month", { ascending: false })
        .limit(1000)

      if (statsData && statsData.length) {
        const latest = statsData[0]?.report_month
        stats.value = statsData.filter(s => s.report_month === latest)
        stats.value.forEach(s => {
          s.active_ratio = s.cards_in_circulation > 0
            ? (s.active_cards / s.cards_in_circulation * 100)
            : null
        })
      }
    }

    async function loadCashData() {
      const { data: cd } = await supabase
        .from("monthly_cash_stats")
        .select("*, banks!inner(id, name, short_name)")
        .order("report_month", { ascending: false })
        .limit(200)
      if (cd && cd.length) {
        const latest = cd[0]?.report_month
        cashStats.value = cd.filter(s => s.report_month === latest)
      }
    }

    Vue.onMounted(async () => {
      try {
        await Promise.all([loadCreditData(), loadCashData()])
      } catch (e) {
        console.error("Dashboard load error:", e)
      }
      loading.value = false
    })

    function switchType(type) {
      cardType.value = type
    }

    // -- 信用卡 computed --
    const topCards = Vue.computed(() => {
      return [...stats.value].sort((a,b) => (b.cards_in_circulation||0) - (a.cards_in_circulation||0))
    })
    const topVolume = Vue.computed(() => {
      return [...stats.value].sort((a,b) => (b.transaction_volume||0) - (a.transaction_volume||0))
    })
    const bottomActive = Vue.computed(() => {
      return [...stats.value]
        .filter(s => s.active_ratio != null && s.cards_in_circulation > 50000)
        .sort((a,b) => (a.active_ratio||0) - (b.active_ratio||0))
    })
    const latestCreditMonth = Vue.computed(() => {
      if (!stats.value.length) return ""
      const d = new Date(stats.value[0].report_month + "T00:00:00")
      const roc = d.getFullYear() - 1911
      return "民国" + roc + "年" + (d.getMonth()+1) + "月 (公元" + d.getFullYear() + "-" + (d.getMonth()+1).toString().padStart(2,"0") + ")"
    })
    const filteredCreditBanks = Vue.computed(() => {
      let arr = [...stats.value]
      if (searchText.value) {
        const q = searchText.value.toLowerCase()
        arr = arr.filter(s =>
          (s.banks?.name || "").toLowerCase().includes(q) ||
          (s.banks?.short_name || "").toLowerCase().includes(q)
        )
      }
      const key = sortKey.value
      const dir = sortDir.value === "asc" ? 1 : -1
      arr.sort((a,b) => ((a[key]||0) - (b[key]||0)) * dir)
      return arr
    })

    // -- 现金卡 computed --
    const topCashDrawn = Vue.computed(() => {
      return [...cashStats.value].sort((a,b) => (b.drawn_cards||0) - (a.drawn_cards||0))
    })
    const topCashLoan = Vue.computed(() => {
      return [...cashStats.value].sort((a,b) => (b.loan_balance||0) - (a.loan_balance||0))
    })
    const topCashDelinq = Vue.computed(() => {
      return [...cashStats.value].sort((a,b) => (b.delinquency_ratio||0) - (a.delinquency_ratio||0))
    })
    const latestCashMonth = Vue.computed(() => {
      if (!cashStats.value.length) return ""
      const d = new Date(cashStats.value[0].report_month + "T00:00:00")
      const roc = d.getFullYear() - 1911
      return "民国" + roc + "年" + (d.getMonth()+1) + "月 (公元" + d.getFullYear() + "-" + (d.getMonth()+1).toString().padStart(2,"0") + ")"
    })

    return {
      cardType, switchType,
      stats, cashStats, searchText, sortKey, sortDir,
      topCards, topVolume, bottomActive, latestCreditMonth, filteredCreditBanks,
      topCashDrawn, topCashLoan, topCashDelinq, latestCashMonth,
      loading, fmtNumber, fmtAmount, fmtPercent
    }
  }
}
