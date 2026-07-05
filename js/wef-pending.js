// ============================================================
// 입력 확인 탭 — weflab_pending 검토 후 승인 → upbo_tasks
// 전역 재사용: supabaseClient, showToast
// ============================================================

let wpData = [];  // 현재 대기 목록

async function wpLoad() {
  const sb = supabaseClient;
  const wrap = document.getElementById("wpList");
  const cntEl = document.getElementById("wpCount");
  wrap.innerHTML = '<p class="text-sub text-sm">불러오는 중...</p>';

  // 시즌명 매핑용
  const { data: seasons } = await sb.from("upbo_seasons").select("id,name");
  const seasonName = {};
  (seasons || []).forEach(s => { seasonName[s.id] = s.name; });

  const { data, error } = await sb.from("weflab_pending")
    .select("*").order("nickname").order("task_name");
  if (error) { wrap.innerHTML = `<p class="text-red-500 text-sm">불러오기 실패: ${error.message}</p>`; return; }
  wpData = data || [];
  if (cntEl) cntEl.textContent = wpData.length;

  if (!wpData.length) {
    wrap.innerHTML = '<p class="text-sub text-sm">입력 대기 중인 항목이 없습니다. weflab에서 북마클릿을 실행하면 여기 쌓입니다.</p>';
    return;
  }

  // 시청자별 그룹
  const byUser = {};
  for (const p of wpData) {
    (byUser[p.user_id] = byUser[p.user_id] || { nickname: p.nickname, rows: [] }).rows.push(p);
  }

  let html = `
    <div class="flex items-center gap-3 mb-3 pb-3 border-b border-point/10">
      <label class="flex items-center gap-2 text-sm text-txt cursor-pointer">
        <input type="checkbox" id="wpAll" onchange="wpToggleAll(this)" class="w-4 h-4"> 전체 선택
      </label>
      <span class="text-xs text-sub">시즌: ${wpData[0] ? (seasonName[wpData[0].season_id] || "?") : "-"}</span>
    </div>`;

  for (const uid in byUser) {
    const g = byUser[uid];
    html += `<div class="mb-4">
      <div class="text-sm font-semibold text-txt mb-1">${g.nickname} <span class="text-xs text-sub font-normal">(${uid})</span></div>
      <div class="space-y-1 pl-2">`;
    for (const r of g.rows) {
      html += `
        <div class="flex items-center gap-3 py-1">
          <input type="checkbox" class="wp-chk w-4 h-4" data-id="${r.id}" checked>
          <span class="flex-1 text-sm text-txt">${r.task_name || r.item}
            ${r.unmapped ? '<span class="text-xs text-red-500">(미매핑)</span>' : ''}</span>
          <input type="number" class="wp-qty w-20 px-2 py-1 rounded-lg border border-point/30 bg-bg text-sm text-center"
            data-id="${r.id}" value="${r.qty}" min="0">
        </div>`;
    }
    html += `</div></div>`;
  }
  wrap.innerHTML = html;
}

function wpToggleAll(el) {
  document.querySelectorAll(".wp-chk").forEach(c => { c.checked = el.checked; });
}

// 체크된 것 수집: [{id, qty}]
function wpCollectChecked() {
  const qtyById = {};
  document.querySelectorAll(".wp-qty").forEach(q => { qtyById[q.dataset.id] = Number(q.value); });
  const items = [];
  document.querySelectorAll(".wp-chk:checked").forEach(c => {
    items.push({ id: Number(c.dataset.id), qty: qtyById[c.dataset.id] });
  });
  return items;
}

// 승인 → upbo_tasks 기입
async function wpApprove() {
  const items = wpCollectChecked();
  if (!items.length) { alert("선택된 항목이 없습니다."); return; }
  const status = document.getElementById("wpStatus");
  status.textContent = "승인 처리 중...";
  status.className = "text-sm text-sub mt-2";
  try {
    const { data, error } = await supabaseClient.rpc("approve_pending", { p_items: items });
    if (error) throw error;
    status.textContent = `✅ ${data.applied}건 기입 완료 (숙제 반영됨)`;
    status.className = "text-sm text-green-600 mt-2";
    if (typeof showToast === "function") showToast(`${data.applied}건 승인·기입`);
    await wpLoad();
  } catch (e) {
    status.textContent = "❌ 승인 실패: " + e.message;
    status.className = "text-sm text-red-500 mt-2";
  }
}

// 선택 삭제 (기입 안 하고 대기열에서 제거)
async function wpDelete() {
  const ids = [...document.querySelectorAll(".wp-chk:checked")].map(c => Number(c.dataset.id));
  if (!ids.length) { alert("선택된 항목이 없습니다."); return; }
  if (!confirm(`선택한 ${ids.length}개를 대기열에서 삭제할까요? (기입 안 됨)`)) return;
  const status = document.getElementById("wpStatus");
  try {
    const { error } = await supabaseClient.from("weflab_pending").delete().in("id", ids);
    if (error) throw error;
    status.textContent = `🗑️ ${ids.length}개 삭제됨`;
    status.className = "text-sm text-sub mt-2";
    await wpLoad();
  } catch (e) {
    status.textContent = "❌ 삭제 실패: " + e.message;
    status.className = "text-sm text-red-500 mt-2";
  }
}

// 탭 열릴 때 로드 + 진입 시 뱃지 갱신
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector('.tab-btn[data-tab="wefpending"]');
  if (btn) btn.addEventListener("click", () => setTimeout(wpLoad, 50));
  // 초기 대기 개수 뱃지
  if (typeof supabaseClient !== "undefined") {
    supabaseClient.from("weflab_pending").select("id", { count: "exact", head: true }).then(({ count }) => {
      const b = document.getElementById("wpBadge");
      if (b && count) { b.textContent = count; b.classList.remove("hidden"); }
    });
  }
});
