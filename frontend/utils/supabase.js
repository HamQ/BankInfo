// Supabase 客户端初始化
const SUPABASE_URL = "https://hpuatpbfbfxeyljfbjgs.supabase.co"
// 临时使用 service_role key（anon 尚待 GRANT 授权后切回）
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdWF0cGJmYmZ4ZXlsamZiamdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTk3NjYzMiwiZXhwIjoyMTAxNTUyNjMyfQ.evBVkkGaUCrYe0pd4rEcm9-U-xNfg822gFXSSH85ChY"

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

// 辅助：格式化金额（千元 NTD -> 亿元/万元）
function fmtAmount(val) {
  if (val == null) return "-"
  if (val >= 100000) return (val / 100000).toFixed(1) + " 亿"
  if (val >= 1000) return (val / 1000).toFixed(1) + " 万"
  return val.toLocaleString() + " 千"
}

function fmtNumber(val) {
  if (val == null) return "-"
  return val.toLocaleString()
}

function fmtPercent(val) {
  if (val == null) return "-"
  return val.toFixed(2) + "%"
}

function rocDate(isoDate) {
  const d = new Date(isoDate + "T00:00:00")
  const roc = d.getFullYear() - 1911
  return "民" + roc + "/" + (d.getMonth() + 1).toString().padStart(2, "0")
}
