// ============================================================
// WefRoulette 연동 설정 (admin "룰렛 연동" 탭)
// - 공유URL → Edge /roulette-items 로 항목 로드
// - 각 항목 드롭다운 매핑 (기존 task_type / 제외 / 2배 / 새 항목)
// - weflab_config 저장 (admin authenticated 세션으로 upbo_settings 쓰기)
// 전역 재사용: supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY, showToast (supabase-config.js)
// ============================================================

const WG_EDGE = () => `${SUPABASE_URL}/functions/v1/wef-import`;
const WG_BOOKMARKLET = "javascript:(async()=>{const e=\"https://uootyovhokziobarpeed.supabase.co/functions/v1/wef-import\",t=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvb3R5b3Zob2t6aW9iYXJwZWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTU2MDIsImV4cCI6MjA5ODQzMTYwMn0.lQm3PLyoj5ELktvcuUuVbidh4xmv8W2Oo4uUddQrJk4\",o={\"Content-Type\":\"application/json\",\"X-Import-Token\":\"j7W7edUfwOCoKa08DyyiXjtNVLtUG-HpdTTlDzRmzQg\",apikey:t,Authorization:\"Bearer \"+t};if(\"weflab.com\"!==location.hostname)return void alert(\"⚠️ weflab.com 후원관리 페이지에서 실행하세요.\");const r=(document.cookie.match(/login_idx=([^;]+)/)||[])[1];if(!r)return void alert(\"⚠️ login_idx 없음. weflab 로그인 상태인지 확인하세요.\");const n=e=>String(e).padStart(2,\"0\"),i=e=>e.getFullYear()+n(e.getMonth()+1)+n(e.getDate())+n(e.getHours())+n(e.getMinutes()),s=async(e,t)=>{const o=new URLSearchParams({type:\"alertlist_load\",pagetype:\"setup\",idx:r,pageid:\"alertlist\",preset:\"0\",\"ver[server]\":\"20240607\",\"ver[socket]\":\"20240607\",lastdate:\"\",\"filter[start]\":e,\"filter[end]\":t,\"filter[min]\":\"0\",\"filter[type]\":\"all\",\"filter[search]\":\"\"});return(await fetch(\"https://weflab.com/api/\",{method:\"POST\",credentials:\"include\",headers:{\"Content-Type\":\"application/x-www-form-urlencoded; charset=UTF-8\",\"X-Requested-With\":\"XMLHttpRequest\"},body:o.toString()})).json()};try{const t=await fetch(e+\"/cursor\",{method:\"POST\",headers:o}).then(e=>e.json());if(!t.ok)return void alert(\"커서 조회 실패: \"+(t.error||\"\"));const r=t.last_idx||0;console.log(\"[WefImport] 커서 last_idx =\",r);const n=i(new Date(Date.now()-31536e7));let a=i(new Date(Date.now()+1728e5));const l=new Map;let c=0,d=!1;for(;c<60;){c++;const e=await s(n,a);if(\"success\"!==e.result)return alert(\"⚠️ 크롤 실패 (세션 만료?). weflab에 다시 로그인 후 시도하세요.\"),void console.log(\"[WefImport] 응답:\",e);const t=e.data||[];if(!t.length)break;for(const e of t)l.set(Number(e.idx),e);const o=t[t.length-1];if(Number(o.idx)<=r){d=!0;break}if(t.length<100)break;a=o.create_time.replace(/[-: ]/g,\"\").slice(0,12)}const p=[...l.values()].filter(e=>Number(e.idx)>r);if(console.log(`[WefImport] 크롤 ${l.size}건 (${c}페이지), 신규 ${p.length}건${d?\"\":\" ⚠️커서 미도달(더 있을 수 있음)\"}`),!p.length)return void alert(\"신규 룰렛 결과가 없습니다. (last_idx=\"+r+\")\");const m=await fetch(e+\"/import\",{method:\"POST\",headers:o,body:JSON.stringify({dry_run:!0,records:p})}).then(e=>e.json());if(!m.ok)return void alert(\"미리보기 실패: \"+JSON.stringify(m));const f=m.rpc;console.log(\"=== [WefImport] 미리보기 (기입 예정) ===\"),console.table((f.rewards||[]).map(e=>({\"닉네임\":e.nickname,\"아이디\":e.user_id,\"항목\":e.item,\"개수\":e.qty,task_type:e.task_type_id}))),(f.unmapped_items||[]).length&&console.log(\"⚠️ 미매핑(무시됨):\",f.unmapped_items.join(\", \"),\"→ 기록하려면 admin 룰렛연동에서 매핑\"),(f.created_members||[]).length&&console.log(\"신규 멤버 생성 예정:\",f.created_members.map(e=>e.user_id));const u=`📋 미리보기 (상세는 콘솔 확인)\n\n크롤: ${m.raw_records}건 → 스핀 ${m.expanded_spins}개\n보상 기입 예정: ${(f.rewards||[]).length}종\n2배 적용: ${f.doubled} / 만료: ${f.doubled_expired}\n필러 제외: ${f.skipped_filler} / 2배트리거: ${f.skipped_double}\n미매핑(무시): ${(f.unmapped_items||[]).length} / 신규멤버: ${(f.created_members||[]).length}\n\n실제로 기입할까요?`;if(!confirm(u))return void console.log(\"[WefImport] 취소됨 (미기입)\");const h=await fetch(e+\"/import\",{method:\"POST\",headers:o,body:JSON.stringify({dry_run:!1,records:p})}).then(e=>e.json());if(!h.ok)return void alert(\"기입 실패: \"+JSON.stringify(h));console.log(\"=== [WefImport] 기입 완료 ===\",h.rpc),alert(`✅ 기입 완료\n\n보상 ${(h.rpc.rewards||[]).length}종\n커서: ${h.rpc.prev_last_idx} → ${h.rpc.new_last_idx}`)}catch(e){alert(\"오류: \"+e.message),console.error(\"[WefImport]\",e)}})();"; // 빌드 시 주입

let wgTaskTypes = [];   // [{id,name,category,is_active}]
let wgConfig = null;    // 현재 저장된 config

// 탭 처음 열 때 초기화 (task_types + config + 커서 + 북마클릿)
async function wgInit() {
  const sb = supabaseClient;
  // task_types
  const { data: tt } = await sb.from("upbo_task_types")
    .select("id,name,category,is_active").order("category").order("sort_order");
  wgTaskTypes = tt || [];
  // config
  const { data: cfgRow } = await sb.from("upbo_settings").select("value").eq("key", "weflab_config").maybeSingle();
  try { wgConfig = cfgRow ? JSON.parse(cfgRow.value) : null; } catch { wgConfig = null; }
  // cursor
  const { data: curRow } = await sb.from("upbo_settings").select("value").eq("key", "weflab_last_idx").maybeSingle();
  const curVal = curRow ? curRow.value : "0";
  const curEl = document.getElementById("wgCursor");
  if (curEl) curEl.textContent = curVal;
  // 시작 idx 기본값 = 현재 커서 ("여기서부터 이어서"). 더 이전부터 하려면 직접 낮추면 됨.
  const startEl = document.getElementById("wgStartIdx");
  if (startEl) startEl.value = curVal;
  // 북마클릿
  const bm = document.getElementById("wgBookmarklet");
  const bmc = document.getElementById("wgBookmarkletCode");
  if (bm) bm.setAttribute("href", WG_BOOKMARKLET);
  if (bmc) bmc.value = WG_BOOKMARKLET;
  // 공유URL 저장돼 있으면 복원
  if (wgConfig && wgConfig.share_url && document.getElementById("wgShareUrl")) {
    document.getElementById("wgShareUrl").value = wgConfig.share_url;
  }
}

// 공유페이지 항목 불러오기
async function wgLoadItems() {
  const url = (document.getElementById("wgShareUrl").value || "").trim();
  const status = document.getElementById("wgLoadStatus");
  if (!/^https:\/\/weflab\.com\/user\/[A-Za-z0-9]+$/.test(url)) {
    status.textContent = "⚠️ weflab.com/user/... 형식의 공유 URL을 입력하세요.";
    status.className = "text-sm text-red-500 mt-2";
    return;
  }
  status.textContent = "불러오는 중...";
  status.className = "text-sm text-sub mt-2";
  try {
    await wgInit(); // 최신 task_types/config 확보
    const res = await fetch(WG_EDGE() + "/roulette-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ share_url: url }),
    });
    const d = await res.json();
    if (!d.ok) { status.textContent = "❌ " + (d.error || "불러오기 실패"); status.className = "text-sm text-red-500 mt-2"; return; }
    status.textContent = `✅ 룰렛 ${d.roulette_count}개, 고유 항목 ${d.items.length}개 로드`;
    status.className = "text-sm text-green-600 mt-2";
    wgRenderMap(d.items);
  } catch (e) {
    status.textContent = "❌ 오류: " + e.message;
    status.className = "text-sm text-red-500 mt-2";
  }
}

// 매핑 테이블 렌더 (스마트 기본값)
function wgRenderMap(items) {
  const wrap = document.getElementById("wgMapTable");
  const cfg = wgConfig || { map: {}, skip: [], double: null };
  const ttByName = {};
  wgTaskTypes.forEach(t => { ttByName[t.name] = t.id; });

  // 항목명 → 기본 선택값 결정
  const defaultVal = (name) => {
    if (cfg.skip && cfg.skip.includes(name)) return "skip";
    if (cfg.double && cfg.double === name) return "double";
    if (cfg.map && cfg.map[name] != null) return "tt:" + cfg.map[name];
    if (ttByName[name] != null) return "tt:" + ttByName[name];   // 이름 일치 기존 항목
    return "new:regular";                                        // 미지정 → 새 항목(고정)
  };

  // task_type 옵션 (regular/event 그룹)
  const reg = wgTaskTypes.filter(t => t.category === "regular");
  const evt = wgTaskTypes.filter(t => t.category === "event");
  const opt = (t) => `<option value="tt:${t.id}">${t.name}${t.is_active ? "" : " (비활성)"}</option>`;
  const ttOptions =
    `<optgroup label="🔵 고정 항목">${reg.map(opt).join("")}</optgroup>` +
    `<optgroup label="🟣 이벤트 항목">${evt.map(opt).join("")}</optgroup>`;

  wrap.innerHTML = items.map(it => {
    const def = defaultVal(it.name);
    const sel = (v) => def === v ? " selected" : "";
    const ttSel = def.startsWith("tt:") ? def : "";
    return `
    <div class="flex items-center gap-3 py-2 border-b border-point/10">
      <span class="flex-1 text-sm text-txt">${it.name}
        <span class="text-xs text-sub">(${it.percents.join("/")}%)</span></span>
      <select data-item="${encodeURIComponent(it.name)}"
        class="wg-sel px-3 py-1.5 rounded-lg border border-point/30 bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
        <option value="skip"${sel("skip")}>── 제외(필러) ──</option>
        <option value="double"${sel("double")}>── 2배 트리거 ──</option>
        <option value="new:regular"${sel("new:regular")}>＋ 새 항목(고정)</option>
        <option value="new:event"${sel("new:event")}>＋ 새 항목(이벤트)</option>
        ${ttOptions.replace(`value="${ttSel}"`, `value="${ttSel}" selected`)}
      </select>
    </div>`;
  }).join("");
}

// 설정 저장
async function wgSaveConfig() {
  const sb = supabaseClient;
  const status = document.getElementById("wgSaveStatus");
  const sels = [...document.querySelectorAll(".wg-sel")];
  if (!sels.length) { status.textContent = "⚠️ 먼저 항목을 불러오세요."; status.className = "text-sm text-red-500 mt-2"; return; }

  const map = {}, skip = [], doubles = [];
  const newItems = []; // {name, category}
  for (const s of sels) {
    const name = decodeURIComponent(s.dataset.item);
    const v = s.value;
    if (v === "skip") skip.push(name);
    else if (v === "double") doubles.push(name);
    else if (v.startsWith("tt:")) map[name] = Number(v.slice(3));
    else if (v.startsWith("new:")) newItems.push({ name, category: v.slice(4) });
  }

  status.textContent = "저장 중...";
  status.className = "text-sm text-sub mt-2";
  try {
    // 새 항목 생성 (같은 이름 있으면 재사용)
    if (newItems.length) {
      // 현재 max sort_order
      const { data: mx } = await sb.from("upbo_task_types").select("sort_order").order("sort_order", { ascending: false }).limit(1);
      let nextSort = (mx && mx[0] ? mx[0].sort_order : 0) + 1;
      for (const ni of newItems) {
        const { data: ex } = await sb.from("upbo_task_types").select("id").eq("name", ni.name).maybeSingle();
        if (ex) { map[ni.name] = ex.id; continue; }
        const { data: ins, error } = await sb.from("upbo_task_types")
          .insert({ name: ni.name, category: ni.category, is_active: true, sort_order: nextSort++ })
          .select("id").single();
        if (error) throw error;
        map[ni.name] = ins.id;
      }
    }

    if (doubles.length > 1) {
      if (!confirm(`2배 트리거가 ${doubles.length}개 선택됐어요 (${doubles.join(", ")}).\n첫 번째(${doubles[0]})만 사용합니다. 계속?`)) {
        status.textContent = "취소됨"; return;
      }
    }

    const startIdx = Number(document.getElementById("wgStartIdx").value || 0);
    const shareUrl = (document.getElementById("wgShareUrl").value || "").trim();
    const config = {
      map, skip,
      double: doubles[0] || null,
      event: [],
      double_window_min: 60,
      start_idx: startIdx,
      share_url: shareUrl,
    };

    // config 저장
    const { error: e1 } = await sb.from("upbo_settings")
      .update({ value: JSON.stringify(config), updated_at: new Date().toISOString() })
      .eq("key", "weflab_config");
    if (e1) throw e1;

    // 커서를 start_idx로 (기존 것 스킵하고 여기서 시작)
    const { error: e2 } = await sb.from("upbo_settings")
      .update({ value: String(startIdx), updated_at: new Date().toISOString() })
      .eq("key", "weflab_last_idx");
    if (e2) throw e2;

    await wgInit();
    status.innerHTML = `✅ 저장 완료 — 매핑 ${Object.keys(map).length}개, 제외 ${skip.length}개, 2배 ${config.double || "없음"}, 커서 ${startIdx}<br>` +
      `<span class="text-sub">이제 weflab 후원관리 페이지에서 북마클릿을 클릭하면 이 설정대로 기입됩니다.</span>`;
    status.className = "text-sm text-green-600 mt-2";
    if (typeof showToast === "function") showToast("룰렛 연동 설정 저장됨");
  } catch (e) {
    status.textContent = "❌ 저장 실패: " + e.message;
    status.className = "text-sm text-red-500 mt-2";
  }
}

// 탭 열릴 때 자동 초기화 (switchTab 후킹)
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector('.tab-btn[data-tab="wefgen"]');
  if (btn) btn.addEventListener("click", () => setTimeout(wgInit, 50));
});
