// Supabase 客户端初始化
const SUPABASE_URL = 'https://hpuatpbfbfxeyljfbjgs.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzY2MzIsImV4cCI6MjEwMTU1MjYzMn0.Hd66KOtwvk1Dc0vyG12dB5nUyfhWj4_gqoRdfoyeb-8'

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 辅助：格式化金额（千元 NTD -> 亿元/万元）
function fmtAmount(val) {
  if (val == null) return '-'
  if (val >= 100000) return (val / 100000).toFixed(1) + ' 亿'
  if (val >= 1000) return (val / 1000).toFixed(1) + ' 万'
  return val.toLocaleString() + ' 千'
}

function fmtNumber(val) {
  if (val == null) return '-'
  return val.toLocaleString()
}

function fmtPercent(val) {
  if (val == null) return '-'
  return val.toFixed(2) + '%'
}

function rocDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  const roc = d.getFullYear() - 1911
  return '民' + roc + '/' + (d.getMonth() + 1).toString().padStart(2, '0')
}
