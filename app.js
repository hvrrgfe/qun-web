/* 群档案前端
 *
 * 数据直接从浏览器连 Supabase。用的是 publishable key —— 它设计上就是公开的，
 * 权限由数据库侧的 RLS + 视图授权控制：
 *   能读到的只有 v_member_cards / v_group_overview 两个视图，
 *   且里面【已经剔除了】性格标签、薄弱点、LLM 摘要这些敏感字段。
 * service_role 那种真正的万能钥匙，永远不会出现在前端。
 */

const SUPA_URL = 'https://zusduayweapefdwxbygh.supabase.co';
const SUPA_KEY = 'sb_publishable_6W7sS-QvPQqbDYVpXJHJWw_w_Mz3pzt';
const GROUP_ID = '1067936907';

const $ = (id) => document.getElementById(id);

async function q(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
  });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

/* ---------------- 工具 ---------------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const initials = (s) => {
  const t = String(s || '?').trim();
  return t ? [...t][0].toUpperCase() : '?';
};

function hue(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function ago(ts) {
  if (!ts) return '—';
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
  if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
  if (d < 86400 * 30) return Math.floor(d / 86400) + ' 天前';
  return new Date(ts).toLocaleDateString('zh-CN');
}

const nfmt = (n) => Number(n || 0).toLocaleString('zh-CN');

/* ---------------- 概览 ---------------- */
function renderOverview(ov) {
  if (!ov) return;
  $('sMembers').textContent = nfmt(ov.member_count);
  $('sMessages').textContent = nfmt(ov.total_messages);
  $('sImages').textContent = nfmt(ov.total_images);
  $('groupSub').textContent = `共 ${nfmt(ov.member_count)} 位成员 · 最近活跃 ${ago(ov.last_active)}`;
}

/* ---------------- 活跃榜 ---------------- */
function renderBoard(list) {
  const top = list.slice(0, 20);
  const max = Math.max(1, ...top.map(m => m.activity_score || 0));

  // 领奖台（前三名）
  const podium = $('podium');
  podium.innerHTML = '';
  const order = [1, 0, 2]; // 银-金-铜 的视觉顺序
  const medals = ['🥇', '🥈', '🥉'];
  order.forEach(i => {
    const m = top[i];
    if (!m) return;
    const el = document.createElement('div');
    el.className = 'pd g' + (i + 1);
    el.innerHTML =
      `<div class="rank">${medals[i]}</div>` +
      `<div class="nick">${esc(m.nickname || '匿名')}</div>` +
      `<div class="score">${nfmt(m.activity_score)} 积分 · ${nfmt(m.msg_count)} 条发言</div>`;
    podium.appendChild(el);
  });

  // 完整列表
  const board = $('board');
  board.innerHTML = '';
  top.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'row';
    const pct = Math.max(4, Math.round((m.activity_score || 0) / max * 100));
    li.innerHTML =
      `<div class="idx">${i + 1}</div>` +
      `<div class="bar-wrap"><div class="bar" style="width:${pct}%"></div>` +
      `<div class="nm">${esc(m.nickname || '匿名')}</div></div>` +
      `<div class="sc">${nfmt(m.activity_score)}</div>`;
    board.appendChild(li);
  });
}

/* ---------------- 活跃时段 ---------------- */
function renderHours(list) {
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const m of list) {
    const h = m.active_hours || {};
    for (const [k, v] of Object.entries(h)) {
      const i = parseInt(k, 10);
      if (i >= 0 && i < 24) byHour[i] += Number(v) || 0;
    }
  }
  const max = Math.max(1, ...byHour);
  const box = $('hours');
  box.innerHTML = '';
  byHour.forEach((v, i) => {
    const d = document.createElement('div');
    d.className = 'h';
    d.style.height = Math.max(3, Math.round(v / max * 100)) + '%';
    d.dataset.tip = `${i}:00 · ${v} 条`;
    box.appendChild(d);
  });
  // 近7天活跃人数
  const week = Date.now() - 7 * 86400 * 1000;
  $('sActive').textContent = nfmt(list.filter(m => m.last_seen && new Date(m.last_seen).getTime() > week).length);
}

/* ---------------- 成员卡片 ---------------- */
let ALL = [];

function sparkline(hours) {
  const bars = Array.from({ length: 24 }, (_, i) => {
    const v = Number((hours || {})[String(i)]) || 0;
    return v;
  });
  const max = Math.max(1, ...bars);
  return '<div class="spark">' +
    bars.map(v => `<i style="height:${Math.max(6, Math.round(v / max * 100))}%"></i>`).join('') +
    '</div>';
}

function renderCards() {
  const kw = ($('search').value || '').trim().toLowerCase();
  const sort = $('sort').value;

  let list = ALL.filter(m =>
    !kw || String(m.nickname || '').toLowerCase().includes(kw) || String(m.qq).includes(kw));

  list = list.slice().sort((a, b) => {
    if (sort === 'last_seen') return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
    return (b[sort] || 0) - (a[sort] || 0);
  });

  $('empty').hidden = list.length > 0;

  $('cards').innerHTML = list.map(m => {
    const h = hue(m.qq);
    const tags = [];
    if (m.grade && m.grade !== '未知') tags.push(`<span class="tag infer">${esc(m.grade)} <s>推断</s></span>`);
    for (const s of (m.strengths || [])) tags.push(`<span class="tag infer">${esc(s)} <s>推断</s></span>`);

    return `<article class="card">
      <div class="top">
        <div class="av" style="background:linear-gradient(135deg,hsl(${h} 70% 58%),hsl(${(h + 50) % 360} 70% 50%))">${esc(initials(m.nickname))}</div>
        <div class="who">
          <div class="nick2">${esc(m.nickname || '匿名')}</div>
          <div class="meta">${esc(String(m.qq))} · 最近 ${ago(m.last_seen)}</div>
        </div>
      </div>
      <div class="kv">
        <div><span class="k">发言</span><span class="v">${nfmt(m.msg_count)}</span></div>
        <div><span class="k">图片</span><span class="v">${nfmt(m.image_count)}</span></div>
        <div><span class="k">被回复</span><span class="v">${nfmt(m.reply_received)}</span></div>
        <div><span class="k">被@</span><span class="v">${nfmt(m.at_received)}</span></div>
        <div><span class="k">积分</span><span class="v">${nfmt(m.activity_score)}</span></div>
        <div><span class="k">入群</span><span class="v">${m.first_seen ? new Date(m.first_seen).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '—'}</span></div>
      </div>
      ${sparkline(m.active_hours)}
      ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    </article>`;
  }).join('');
}

/* ---------------- 启动 ---------------- */
async function main() {
  try {
    const [ovRows, cards] = await Promise.all([
      q(`v_group_overview?select=*&group_id=eq.${GROUP_ID}`),
      q(`v_member_cards?select=*&group_id=eq.${GROUP_ID}&order=activity_score.desc&limit=500`),
    ]);
    ALL = cards || [];
    renderOverview(ovRows && ovRows[0]);
    renderBoard(ALL);
    renderHours(ALL);
    renderCards();

    $('search').addEventListener('input', renderCards);
    $('sort').addEventListener('change', renderCards);
  } catch (e) {
    $('groupSub').textContent = '数据加载失败：' + e.message;
    $('cards').innerHTML = `<div class="skeleton">加载失败：${esc(e.message)}<br><br>若是 401/404，可能是数据库视图还没建好。</div>`;
  }
}

main();
