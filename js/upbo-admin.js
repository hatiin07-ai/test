// ============================================
// 🔐 업보 숙제장 - Admin 로직
// ============================================

let allMembers = [];
let allTaskTypes = [];
let allTasks = [];

// ============================================
// 초기화 & 인증
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const sb = initSupabase();

  // 세션 체크
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
    await loadAdminData();
  }

  // 로그인 폼
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 시청자 추가 폼
  document.getElementById('addMemberForm').addEventListener('submit', handleAddMember);

  // 항목 추가 폼
  document.getElementById('addTypeForm').addEventListener('submit', handleAddType);

  // 시청자 수정 폼
  document.getElementById('editMemberForm').addEventListener('submit', handleEditMember);

  // 시즌 추가 폼
  const addSeasonForm = document.getElementById('addSeasonForm');
  if (addSeasonForm) addSeasonForm.addEventListener('submit', handleAddSeason);

  // 시청자 선택 변경
  document.getElementById('seasonSelect').addEventListener('change', onSeasonChange);

  // 시청자 검색창 이벤트
  const searchInput = document.getElementById('memberSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => { _memberListIdx = -1; filterMemberList(searchInput.value); });
    searchInput.addEventListener('focus', () => filterMemberList(searchInput.value));
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        const list = document.getElementById('memberDropList');
        if (list) list.style.display = 'none';
        _memberListIdx = -1;
      }, 150);
    });
    searchInput.addEventListener('keydown', (e) => {
      const list = document.getElementById('memberDropList');
      if (!list || list.style.display === 'none') return;
      const items = list.querySelectorAll('[data-member-idx]');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _memberListIdx = Math.min(_memberListIdx + 1, items.length - 1);
        updateMemberListHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _memberListIdx = Math.max(_memberListIdx - 1, 0);
        updateMemberListHighlight(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_memberListIdx >= 0 && items[_memberListIdx]) {
          items[_memberListIdx].dispatchEvent(new MouseEvent('mousedown'));
        }
      } else if (e.key === 'Escape') {
        list.style.display = 'none';
        _memberListIdx = -1;
      }
    });
  }

  // 기본 드롭다운도 유지
  document.getElementById('memberSelect').addEventListener('change', handleMemberSelect);
});

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const sb = initSupabase();

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = '로그인 실패: ' + error.message;
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminScreen').style.display = 'block';
  await loadAdminData();
}

async function handleLogout() {
  const sb = initSupabase();
  await sb.auth.signOut();
  location.reload();
}

// ============================================
// 데이터 로드
// ============================================

async function loadAdminData() {
  const sb = initSupabase();

  // 갱신일
  const { data: settings } = await sb
    .from('upbo_settings')
    .select('*')
    .eq('key', 'last_updated')
    .single();

  if (settings) {
    document.getElementById('currentDate').textContent = `갱신일: ${settings.value}`;
  }

  // 숙제 항목
  const { data: types } = await sb
    .from('upbo_task_types')
    .select('*')
    .order('sort_order', { ascending: true });
  allTaskTypes = types || [];

  // 시청자
  const { data: members } = await sb
    .from('upbo_members')
    .select('*')
    .order('created_at', { ascending: true });
  allMembers = members || [];

  // 숙제
  const { data: tasks } = await sb
    .from('upbo_tasks')
    .select('*, upbo_task_types(*)')
    .order('task_type_id', { ascending: true });
  allTasks = tasks || [];

  // UI 렌더링 — 시즌 먼저 로드 후 Overview 렌더
  renderMemberSelect();
  renderMemberTable();
  renderTypeTable();
  await loadInquiries();
  await loadSeasons();     // 시즌 데이터 먼저
  renderMemberSelect();    // 활성 시즌 기준으로 숙제 개수 정렬 재적용
  renderOverview();        // 시즌 데이터 있는 상태에서 렌더

  // 스케줄 탭도 함께 로드
  if (typeof loadScheduleAdmin === 'function') {
    await loadScheduleAdmin();
  }
}

// ============================================
// 탭 전환
// ============================================

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabId}`);
  });
}

// ============================================
// 날짜 갱신
// ============================================

async function updateDate() {
  const sb = initSupabase();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const dateStr = `${y}.${m}.${d}`;

  const { error } = await sb
    .from('upbo_settings')
    .upsert({ key: 'last_updated', value: dateStr, updated_at: new Date().toISOString() });

  if (error) {
    showToast('갱신 실패: ' + error.message);
    return;
  }
  document.getElementById('currentDate').textContent = `갱신일: ${dateStr}`;
  showToast('📅 갱신일이 업데이트되었습니다!');
}

// ============================================
// 시청자 관리
// ============================================

// 특정 시즌에서 시청자의 숙제 총량 (수량 합)
function memberTaskCount(memberId, seasonId) {
  return allTasks
    .filter(t => String(t.member_id) === String(memberId) &&
                 (seasonId ? t.season_id === seasonId : !t.season_id) &&
                 t.quantity > 0)
    .reduce((s, t) => s + t.quantity, 0);
}

function renderMemberSelect() {
  const select = document.getElementById('memberSelect');
  const seasonId = document.getElementById('seasonSelect')?.value || null;
  const withCount = allMembers.map(m => ({ m, cnt: memberTaskCount(m.id, seasonId) }));
  // 숙제 있는 사람 먼저 → 개수 많은 순 → 닉네임
  withCount.sort((a, b) => {
    if ((b.cnt > 0) !== (a.cnt > 0)) return (b.cnt > 0) - (a.cnt > 0);
    if (b.cnt !== a.cnt) return b.cnt - a.cnt;
    return (a.m.nickname || '').localeCompare(b.m.nickname || '');
  });
  select.innerHTML = '<option value="">-- 시청자 선택 --</option>' +
    withCount.map(({ m, cnt }) => {
      const hidden = m.is_hidden ? ' [숨김]' : '';
      const badge = cnt > 0 ? ` · 숙제 ${cnt}` : '';
      return `<option value="${m.id}">${escapeHtml(m.nickname)} (${escapeHtml(m.user_id)})${badge}${hidden}</option>`;
    }).join('');
}

// 시즌 변경 시: 드롭다운 재정렬(선택 유지) 후 숙제 렌더
function onSeasonChange() {
  const sel = document.getElementById('memberSelect');
  const cur = sel.value;
  renderMemberSelect();
  sel.value = cur;
  handleMemberSelect();
}

let _memberListIdx = -1;

function updateMemberListHighlight(items) {
  items.forEach((el, i) => {
    el.style.background = i === _memberListIdx ? '#E4EDFF' : 'white';
    if (i === _memberListIdx) el.scrollIntoView({ block: 'nearest' });
  });
}

function filterMemberList(q = '') {
  const list = document.getElementById('memberDropList');
  if (!list) return;
  const query = q.toLowerCase().trim();
  const filtered = query
    ? allMembers.filter(m =>
        m.nickname.toLowerCase().includes(query) ||
        m.user_id.toLowerCase().includes(query)
      )
    : allMembers;

  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:12px 16px;font-size:0.8125rem;color:#7C86A5;">검색 결과 없음</div>';
  } else {
    list.innerHTML = filtered.map((m, i) => `
      <div data-member-idx="${i}" onmousedown="selectMember('${m.id}', '${m.nickname.replace(/'/g,"\\'")}', '${m.user_id.replace(/'/g,"\\'")}')"
        style="padding:10px 16px;font-size:0.8125rem;cursor:pointer;border-bottom:1px solid rgba(175,200,255,0.15);transition:background 0.15s;"
        onmouseover="this.style.background='#F0F4FF'"
        onmouseout="this.style.background='white'">
        <span style="font-weight:600;color:#2F3A5F;">${escapeHtml(m.nickname)}</span>
        <span style="color:#7C86A5;margin-left:6px;font-size:0.75rem;">(${escapeHtml(m.user_id)})</span>
      </div>`).join('');
  }
  list.style.display = 'block';
}

function selectMember(id, nickname, userId) {
  document.getElementById('memberSearchInput').value = `${nickname} (${userId})`;
  document.getElementById('memberDropList').style.display = 'none';
  const sel = document.getElementById('memberSelect');
  if (!sel.querySelector(`option[value="${id}"]`)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${nickname} (${userId})`;
    sel.appendChild(opt);
  }
  sel.value = id;
  handleMemberSelect();
}

function renderMemberTable() {
  const container = document.getElementById('memberTable');
  if (allMembers.length === 0) {
    container.innerHTML = '<p class="text-sub text-sm">등록된 시청자가 없습니다.</p>';
    return;
  }

  container.innerHTML = allMembers.map(m => {
    const taskCount = allTasks.filter(t => t.member_id === m.id && t.quantity > 0).length;
    return `
      <div class="flex items-center justify-between p-3 rounded-xl bg-bg border border-point/10 hover:border-point/30 transition-colors">
        <div>
          <span class="font-semibold text-txt text-sm">${escapeHtml(m.nickname)}</span>
          <span class="text-sub text-xs ml-1">(${escapeHtml(m.user_id)})</span>
          ${m.is_hidden ? '<span class="ml-2 text-xs bg-gray-200 text-sub px-1.5 py-0.5 rounded">숨김</span>' : ''}
          ${taskCount > 0 ? `<span class="ml-2 text-xs text-accent">숙제 ${taskCount}개</span>` : ''}
        </div>
        <div class="flex gap-1">
          <button onclick="toggleMemberHidden(${m.id}, ${!m.is_hidden})" class="btn-edit">${m.is_hidden ? '👁 보이기' : '🙈 숨기기'}</button>
          <button onclick="openEditMemberModal(${m.id})" class="btn-edit">수정</button>
          <button onclick="deleteMember(${m.id})" class="btn-delete">삭제</button>
        </div>
      </div>`;
  }).join('');
}

async function handleAddMember(e) {
  e.preventDefault();
  const nickname = document.getElementById('inputNickname').value.trim();
  const userId = document.getElementById('inputUserId').value.trim();
  if (!nickname || !userId) return;

  const sb = initSupabase();
  const { error } = await sb.from('upbo_members').insert({ nickname, user_id: userId });

  if (error) {
    showToast('추가 실패: ' + error.message);
    return;
  }

  document.getElementById('inputNickname').value = '';
  document.getElementById('inputUserId').value = '';
  showToast(`✅ ${nickname} 추가 완료!`);
  await loadAdminData();
}

function openEditMemberModal(id) {
  const member = allMembers.find(m => m.id === id);
  if (!member) return;

  document.getElementById('editMemberId').value = id;
  document.getElementById('editNickname').value = member.nickname;
  document.getElementById('editUserId').value = member.user_id;
  document.getElementById('editMemberModal').classList.remove('hidden');
}

function closeEditMemberModal() {
  document.getElementById('editMemberModal').classList.add('hidden');
}

async function handleEditMember(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('editMemberId').value);
  const nickname = document.getElementById('editNickname').value.trim();
  const userId = document.getElementById('editUserId').value.trim();

  const sb = initSupabase();
  const { error } = await sb.from('upbo_members').update({ nickname, user_id: userId }).eq('id', id);

  if (error) {
    showToast('수정 실패: ' + error.message);
    return;
  }

  closeEditMemberModal();
  showToast(`✅ ${nickname} 수정 완료!`);
  await loadAdminData();
}

async function toggleMemberHidden(id, hidden) {
  const sb = initSupabase();
  const { error } = await sb.from('upbo_members').update({ is_hidden: hidden }).eq('id', id);
  if (error) {
    showToast('변경 실패: ' + error.message);
    return;
  }
  const member = allMembers.find(m => m.id === id);
  showToast(hidden ? `🙈 ${member?.nickname} 숨김 처리` : `👁 ${member?.nickname} 다시 표시`);
  await loadAdminData();
}

async function deleteMember(id) {
  const member = allMembers.find(m => m.id === id);
  if (!confirm(`"${member?.nickname}" 시청자를 삭제하시겠습니까?\n연결된 숙제도 모두 삭제됩니다.`)) return;

  const sb = initSupabase();
  const { error } = await sb.from('upbo_members').delete().eq('id', id);

  if (error) {
    showToast('삭제 실패: ' + error.message);
    return;
  }

  showToast(`🗑 ${member?.nickname} 삭제 완료`);
  await loadAdminData();
}

// ============================================
// 숙제 배정
// ============================================

function handleMemberSelect() {
  const memberId = document.getElementById('memberSelect').value;
  const taskGrid = document.getElementById('taskGrid');
  const assignBtns = document.getElementById('assignBtns');

  if (!memberId) {
    taskGrid.classList.add('hidden');
    if (assignBtns) assignBtns.style.display = 'none';
    document.getElementById('assignMemo').value = '';
    return;
  }

  taskGrid.classList.remove('hidden');
  if (assignBtns) assignBtns.style.display = 'flex';
  renderTaskCheckboxes(memberId);

  // 해당 시청자 메모 불러오기
  const member = allMembers.find(m => String(m.id) === String(memberId));
  document.getElementById('assignMemo').value = member?.memo || '';
}

function renderTaskCheckboxes(memberId) {
  const container = document.getElementById('taskCheckboxes');
  const seasonId = document.getElementById('seasonSelect')?.value || null;
  const memberTasks = allTasks.filter(t =>
    String(t.member_id) === String(memberId) &&
    (seasonId ? t.season_id === seasonId : !t.season_id)
  );
  const qtyOf = (id) => { const e = memberTasks.find(t => t.task_type_id === id); return e ? e.quantity : 0; };
  const activeTypes = allTaskTypes.filter(t => t.is_active)
    .sort((a, b) => {
      // 보유중(수량>0) 먼저 → 카테고리(고정 먼저) → sort_order 순
      const ca = qtyOf(a.id) > 0 ? 0 : 1;
      const cb = qtyOf(b.id) > 0 ? 0 : 1;
      if (ca !== cb) return ca - cb;
      if (a.category !== b.category) return a.category === 'regular' ? -1 : 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

  container.innerHTML = activeTypes.map(type => {
    const existing = memberTasks.find(t => t.task_type_id === type.id);
    const qty = existing ? existing.quantity : 0;
    const memo = existing ? (existing.memo || '') : '';
    const checked = qty > 0;
    const prepared = existing ? (existing.is_prepared || false) : false;
    const isEvent = type.category === 'event';
    const borderClass = isEvent ? 'border-eventBorder bg-eventBg/30' : 'border-point/20 bg-bg';
    const labelClass = isEvent ? 'text-event' : 'text-txt';

    return `
      <div class="flex items-center gap-3 p-3 rounded-xl border ${borderClass}" data-type-id="${type.id}">
        <input type="checkbox" id="chk_${type.id}" ${checked ? 'checked' : ''}
          onchange="toggleTaskRow(${type.id})"
          class="w-4 h-4 rounded accent-accent cursor-pointer">
        <label for="chk_${type.id}" class="flex-1 text-sm ${labelClass} cursor-pointer">
          ${isEvent ? '🟣' : '🔵'} ${escapeHtml(type.name)}
        </label>
        <input type="number" id="qty_${type.id}" value="${qty}" min="0" max="999"
          class="w-16 px-2 py-1 rounded-lg border border-point/30 bg-white text-center text-sm
          focus:outline-none focus:ring-2 focus:ring-accent/30"
          ${!checked ? 'disabled' : ''}>
        <input type="text" id="memo_${type.id}" value="${escapeHtml(memo)}" placeholder="메모"
          class="w-24 md:w-32 px-2 py-1 rounded-lg border border-point/30 bg-white text-xs
          focus:outline-none focus:ring-2 focus:ring-accent/30"
          ${!checked ? 'disabled' : ''}>
        <label title="준비완료" style="display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;">
          <input type="checkbox" id="prep_${type.id}" ${prepared ? 'checked' : ''}
            style="width:16px;height:16px;accent-color:#F43F5E;cursor:pointer;">
          <span style="font-size:0.625rem;color:#F43F5E;font-weight:600;">준비</span>
        </label>
      </div>`;
  }).join('');
}

function toggleTaskRow(typeId) {
  const chk = document.getElementById(`chk_${typeId}`);
  const qty = document.getElementById(`qty_${typeId}`);
  const memo = document.getElementById(`memo_${typeId}`);

  if (chk.checked) {
    qty.disabled = false;
    memo.disabled = false;
    if (parseInt(qty.value) === 0) qty.value = 1;
  } else {
    qty.disabled = true;
    memo.disabled = true;
    qty.value = 0;
  }
}

async function saveTasks() {
  const memberId = document.getElementById('memberSelect').value;
  if (!memberId) return;

  const seasonId = document.getElementById('seasonSelect')?.value || null;
  const sb = initSupabase();
  const activeTypes = allTaskTypes.filter(t => t.is_active);

  // 현재 시즌 기준 tasks만
  const memberTasks = allTasks.filter(t =>
    String(t.member_id) === String(memberId) &&
    (seasonId ? t.season_id === seasonId : !t.season_id)
  );

  let successCount = 0;
  let errorCount = 0;

  for (const type of activeTypes) {
    const chk = document.getElementById(`chk_${type.id}`);
    const qtyInput = document.getElementById(`qty_${type.id}`);
    const memoInput = document.getElementById(`memo_${type.id}`);

    if (!chk) continue;

    const qty = parseInt(qtyInput.value) || 0;
    const memo = memoInput.value.trim();
    const existing = memberTasks.find(t => t.task_type_id === type.id);

    const prepChk = document.getElementById(`prep_${type.id}`);
    const isPrepared = prepChk ? prepChk.checked : false;

    if (chk.checked && qty > 0) {
      if (existing) {
        const { error } = await sb.from('upbo_tasks')
          .update({ quantity: qty, memo, is_prepared: isPrepared })
          .eq('id', existing.id);
        if (error) errorCount++; else successCount++;
      } else {
        const { error } = await sb.from('upbo_tasks')
          .insert({ member_id: memberId, task_type_id: type.id, quantity: qty, memo, is_prepared: isPrepared, season_id: seasonId || null });
        if (error) errorCount++; else successCount++;
      }
    } else {
      // 체크 해제 → 현재 시즌 데이터만 삭제
      if (existing) {
        const { error } = await sb.from('upbo_tasks').delete().eq('id', existing.id);
        if (error) errorCount++; else successCount++;
      }
    }
  }

  if (errorCount > 0) {
    showToast(`⚠️ ${errorCount}개 항목 저장 실패`);
  } else {
    showToast('💾 숙제가 저장되었습니다!');
  }

  // 시청자 메모 저장
  const memoVal = document.getElementById('assignMemo')?.value.trim() || '';
  await sb.from('upbo_members').update({ memo: memoVal }).eq('id', memberId);

  await loadAdminData();
  // 선택된 멤버 유지
  document.getElementById('memberSelect').value = memberId;
  handleMemberSelect();
}

async function deleteAllTasksForMember() {
  const memberId = document.getElementById('memberSelect').value;
  if (!memberId) return;

  const member = allMembers.find(m => String(m.id) === String(memberId));
  if (!confirm(`"${member?.nickname}"의 모든 숙제를 삭제하시겠습니까?`)) return;

  const sb = initSupabase();
  const { error } = await sb.from('upbo_tasks').delete().eq('member_id', memberId);

  if (error) {
    showToast('삭제 실패: ' + error.message);
    return;
  }

  showToast(`🗑 ${member?.nickname}의 숙제 전체 삭제 완료`);
  await loadAdminData();
  document.getElementById('memberSelect').value = memberId;
  handleMemberSelect();
}

// ============================================
// 전체 현황 (미리보기)
// ============================================

let _overviewSeasonId = null;

function renderOverviewSeasonTabs() {
  const wrap = document.getElementById('overviewSeasonTabs');
  if (!wrap) return;
  if (allSeasons.length === 0) { wrap.innerHTML = ''; return; }

  // 기본값: 활성 시즌
  if (_overviewSeasonId === null) {
    const active = allSeasons.find(s => s.is_active) || allSeasons[0];
    _overviewSeasonId = active?.id || null;
  }

  const tabStyle = (id) => id === _overviewSeasonId
    ? 'padding:5px 16px;border-radius:8px;font-size:0.8125rem;font-weight:600;cursor:pointer;background:#6E8BFF;color:white;border:1.5px solid #6E8BFF;'
    : 'padding:5px 16px;border-radius:8px;font-size:0.8125rem;font-weight:500;cursor:pointer;background:white;color:#7C86A5;border:1.5px solid rgba(175,200,255,0.35);';

  wrap.innerHTML = allSeasons.map(s =>
    `<button style="${tabStyle(s.id)}" onclick="switchOverviewSeason('${s.id}')">${escapeHtml(s.name)}</button>`
  ).join('');
}

function switchOverviewSeason(seasonId) {
  _overviewSeasonId = seasonId;
  renderOverviewSeasonTabs();
  renderOverview();
}

function renderOverview() {
  const container = document.getElementById('overviewList');
  const wrap = document.getElementById('overviewSeasonTabs');
  if (wrap) wrap.innerHTML = ''; // 탭 숨김

  const membersWithTasks = allMembers.filter(m =>
    allTasks.some(t => t.member_id === m.id && t.quantity > 0)
  ).sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

  if (membersWithTasks.length === 0) {
    container.innerHTML = '<p class="text-sub text-sm">배정된 숙제가 없습니다.</p>';
    return;
  }

  container.innerHTML = membersWithTasks.map(m => {
    const allMemberTasks = allTasks.filter(t => t.member_id === m.id && t.quantity > 0);
    if (allMemberTasks.length === 0) return '';

    // 시즌별 그룹핑
    const seasonMap = {};
    allMemberTasks.forEach(t => {
      const sid = t.season_id || '__none__';
      if (!seasonMap[sid]) seasonMap[sid] = [];
      seasonMap[sid].push(t);
    });

    // 시즌 순서대로 섹션 렌더
    const seasonOrder = [
      ...allSeasons.map(s => s.id),
      '__none__'
    ];

    const seasonBlocks = seasonOrder
      .filter(sid => seasonMap[sid])
      .map(sid => {
        const season = allSeasons.find(s => s.id === sid);
        const label = season ? escapeHtml(season.name) : null;
        const tags = seasonMap[sid].map(t => {
          const isEvent = t.upbo_task_types?.category === 'event';
          const isPrepared = t.is_prepared || false;
          let style = isEvent
            ? 'background:rgba(196,180,254,0.35);border:1px solid rgba(167,139,250,0.4);color:#6D28D9;'
            : 'background:rgba(186,220,255,0.5);border:1px solid rgba(147,197,253,0.5);color:#2F3A5F;';
          if (isPrepared) style += 'border:2px solid #FB7185;';
          return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs" style="${style}">
            ${escapeHtml(t.upbo_task_types?.name)}${t.quantity > 1 ? ` ×${t.quantity}` : ''}${isPrepared ? ' ✓' : ''}
          </span>`;
        }).join('');

        return `
          <div class="flex items-start gap-2 flex-wrap">
            ${label ? `<span style="font-size:0.625rem;font-weight:700;color:#6E8BFF;background:#E4EDFF;padding:2px 8px;border-radius:20px;flex-shrink:0;margin-top:2px;">${label}</span>` : ''}
            ${tags}
          </div>`;
      }).join('<div style="height:4px;"></div>');

    return `
      <div class="flex items-start gap-3 p-3 rounded-xl bg-bg border border-point/10">
        <div class="flex-shrink-0 min-w-[80px]">
          <p class="font-semibold text-txt text-xs">${escapeHtml(m.nickname)}</p>
          <p class="text-sub text-[10px]">(${escapeHtml(m.user_id)})</p>
        </div>
        <div class="flex flex-col gap-1 flex-1">${seasonBlocks}</div>
      </div>`;
  }).filter(Boolean).join('');
}

// ============================================
// 항목 관리
// ============================================

function renderTypeTable() {
  const container = document.getElementById('typeTable');
  if (allTaskTypes.length === 0) {
    container.innerHTML = '<p class="text-sub text-sm">등록된 항목이 없습니다.</p>';
    return;
  }

  const regularTypes = allTaskTypes.filter(t => t.category === 'regular').sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const eventTypes = allTaskTypes.filter(t => t.category === 'event').sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));

  let html = '';

  if (regularTypes.length > 0) {
    html += '<p class="text-xs font-semibold text-sub mb-2 mt-2">🔵 고정 항목 (룰렛) <span class="text-sub/60">— 드래그로 순서 변경</span></p>';
    html += `<div class="type-drag-group" data-category="regular">` + regularTypes.map(t => renderTypeRow(t)).join('') + `</div>`;
  }

  if (eventTypes.length > 0) {
    html += '<p class="text-xs font-semibold text-event mb-2 mt-4">🟣 이벤트 항목 <span class="text-sub/60">— 드래그로 순서 변경</span></p>';
    html += `<div class="type-drag-group" data-category="event">` + eventTypes.map(t => renderTypeRow(t)).join('') + `</div>`;
  }

  container.innerHTML = html;
  attachTypeDragHandlers();
}

function renderTypeRow(type) {
  const isEvent = type.category === 'event';
  const bgClass = isEvent ? 'bg-eventBg/30 border-eventBorder/50' : 'bg-bg border-point/10';
  const activeClass = type.is_active ? '' : 'opacity-50';

  return `
    <div class="type-row flex items-center justify-between p-3 rounded-xl border ${bgClass} ${activeClass} hover:border-point/30 transition-colors mb-1"
      draggable="true" data-type-id="${type.id}" data-category="${type.category}">
      <div class="flex items-center gap-2">
        <span class="drag-handle" style="cursor:grab;color:#AFC8FF;font-size:1rem;user-select:none;">⠿</span>
        <span class="text-sm text-txt">${isEvent ? '🟣' : '🔵'} ${escapeHtml(type.name)}</span>
        ${!type.is_active ? '<span class="text-xs text-sub bg-gray-100 px-1.5 py-0.5 rounded">비활성</span>' : ''}
      </div>
      <div class="flex gap-1">
        <button onclick="toggleTypeActive(${type.id}, ${!type.is_active})"
          class="px-2 py-1 text-xs rounded-lg border ${type.is_active ? 'border-sub/30 text-sub hover:bg-yellow-50 hover:text-yellow-600' : 'border-green-300 text-green-600 hover:bg-green-50'}">
          ${type.is_active ? '비활성화' : '활성화'}
        </button>
        <button onclick="deleteType(${type.id})"
          class="btn-delete">삭제</button>
      </div>
    </div>`;
}

let _dragTypeEl = null;

function attachTypeDragHandlers() {
  document.querySelectorAll('.type-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      _dragTypeEl = row;
      row.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '';
      _dragTypeEl = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!_dragTypeEl || _dragTypeEl === row) return;
      // 같은 카테고리 내에서만
      if (_dragTypeEl.dataset.category !== row.dataset.category) return;
      const rect = row.getBoundingClientRect();
      const next = (e.clientY - rect.top) / rect.height > 0.5;
      row.parentNode.insertBefore(_dragTypeEl, next ? row.nextSibling : row);
    });
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      await saveTypeOrder(row.dataset.category);
    });
  });
}

async function saveTypeOrder(category) {
  const group = document.querySelector(`.type-drag-group[data-category="${category}"]`);
  if (!group) return;
  const rows = group.querySelectorAll('.type-row');
  const sb = initSupabase();
  const updates = [];
  rows.forEach((row, idx) => {
    const id = parseInt(row.dataset.typeId);
    updates.push(sb.from('upbo_task_types').update({ sort_order: idx + 1 }).eq('id', id));
  });
  await Promise.all(updates);
  showToast('✅ 항목 순서 변경됨');
  await loadAdminData();
}

async function handleAddType(e) {
  e.preventDefault();
  const name = document.getElementById('inputTypeName').value.trim();
  const category = document.getElementById('inputTypeCategory').value;
  if (!name) return;

  // sort_order 자동 설정 (마지막 + 1)
  const maxOrder = allTaskTypes.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);

  const sb = initSupabase();
  const { error } = await sb.from('upbo_task_types')
    .insert({ name, category, sort_order: maxOrder + 1 });

  if (error) {
    showToast('추가 실패: ' + error.message);
    return;
  }

  document.getElementById('inputTypeName').value = '';
  showToast(`✅ "${name}" 항목 추가 완료!`);
  await loadAdminData();
}

async function toggleTypeActive(id, newActive) {
  const sb = initSupabase();
  const { error } = await sb.from('upbo_task_types')
    .update({ is_active: newActive })
    .eq('id', id);

  if (error) {
    showToast('변경 실패: ' + error.message);
    return;
  }

  showToast(newActive ? '✅ 항목 활성화 완료' : '🙈 항목 비활성화 완료');
  await loadAdminData();
}

async function deleteType(id) {
  const type = allTaskTypes.find(t => t.id === id);
  const linkedTasks = allTasks.filter(t => t.task_type_id === id);

  if (linkedTasks.length > 0) {
    if (!confirm(`"${type?.name}" 항목에 연결된 숙제 ${linkedTasks.length}개가 있습니다.\n정말 삭제하시겠습니까? (연결된 숙제도 함께 삭제됩니다)`)) return;
  } else {
    if (!confirm(`"${type?.name}" 항목을 삭제하시겠습니까?`)) return;
  }

  const sb = initSupabase();
  const { error } = await sb.from('upbo_task_types').delete().eq('id', id);

  if (error) {
    showToast('삭제 실패: ' + error.message);
    return;
  }

  showToast(`🗑 "${type?.name}" 삭제 완료`);
  await loadAdminData();
}

// ============================================
// 유틸리티
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// ============================================
// ✉️ 문의 관리
// ============================================

let allInquiries = [];

async function loadInquiries() {
  const sb = initSupabase();
  const { data } = await sb
    .from('upbo_inquiries')
    .select('*')
    .order('created_at', { ascending: false });
  allInquiries = data || [];
  renderInquiries();
  updateInquiryBadge();
}

function updateInquiryBadge() {
  const badge = document.getElementById('inquiryBadge');
  const unchecked = allInquiries.filter(i => !i.is_checked).length;
  if (unchecked > 0) {
    badge.textContent = unchecked;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderInquiries() {
  const container = document.getElementById('inquiryList');
  if (allInquiries.length === 0) {
    container.innerHTML = '<p class="text-sub text-sm">문의가 없습니다.</p>';
    return;
  }

  container.innerHTML = allInquiries.map(inq => {
    const date = new Date(inq.created_at);
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
    const checkedClass = inq.is_checked ? 'opacity-50' : '';
    const checkIcon = inq.is_checked ? '✅' : '⬜';

    return `
      <div class="flex items-start gap-3 p-3 rounded-xl bg-bg border border-point/10 ${checkedClass}">
        <button onclick="toggleInquiryCheck(${inq.id}, ${!inq.is_checked})" class="text-lg mt-0.5 cursor-pointer">${checkIcon}</button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-txt text-sm">${escapeHtml(inq.nickname)}</span>
            <span class="text-sub text-[10px]">${dateStr}</span>
          </div>
          <p class="text-txt text-sm whitespace-pre-wrap break-words">${escapeHtml(inq.content)}</p>
        </div>
        <button onclick="deleteInquiry(${inq.id})" class="btn-delete flex-shrink-0">삭제</button>
      </div>`;
  }).join('');
}

async function toggleInquiryCheck(id, checked) {
  const sb = initSupabase();
  await sb.from('upbo_inquiries').update({ is_checked: checked }).eq('id', id);
  await loadInquiries();
}

async function deleteInquiry(id) {
  if (!confirm('이 문의를 삭제하시겠습니까?')) return;
  const sb = initSupabase();
  await sb.from('upbo_inquiries').delete().eq('id', id);
  showToast('🗑 문의 삭제 완료');
  await loadInquiries();
}

async function deleteCheckedInquiries() {
  const checked = allInquiries.filter(i => i.is_checked);
  if (checked.length === 0) {
    showToast('체크된 문의가 없습니다');
    return;
  }
  if (!confirm(`체크된 ${checked.length}개 문의를 삭제하시겠습니까?`)) return;
  const sb = initSupabase();
  for (const inq of checked) {
    await sb.from('upbo_inquiries').delete().eq('id', inq.id);
  }
  showToast(`🗑 ${checked.length}개 문의 삭제 완료`);
  await loadInquiries();
}

// ============================================
// 🗂️ 시즌 관리
// ============================================

let allSeasons = [];

async function loadSeasons() {
  const sb = initSupabase();
  const { data } = await sb
    .from('upbo_seasons').select('*')
    .order('sort_order', { ascending: true });
  allSeasons = data || [];
  renderSeasonList();
  renderSeasonSelect();
}

function renderSeasonSelect() {
  const sel = document.getElementById('seasonSelect');
  if (!sel) return;
  // 활성 시즌 맨 위, 나머지 sort_order 순
  const sorted = [
    ...allSeasons.filter(s => s.is_active),
    ...allSeasons.filter(s => !s.is_active)
  ];
  sel.innerHTML = sorted.map(s =>
    `<option value="${s.id}" ${s.is_active ? 'selected' : ''}>${escapeHtml(s.name)}${s.is_active ? ' ★' : ''}</option>`
  ).join('');
}

function renderSeasonList() {
  const container = document.getElementById('seasonList');
  if (!container) return;
  if (allSeasons.length === 0) {
    container.innerHTML = '<p class="text-sub text-sm">등록된 시즌이 없습니다.</p>';
    return;
  }
  container.innerHTML = allSeasons.map((s, i) => `
    <div class="flex items-center gap-3 p-3 rounded-xl bg-bg border border-point/10 hover:border-point/30 transition-colors">
      <div class="flex gap-1 flex-shrink-0">
        <button onclick="moveSeasonOrder('${s.id}', -1)" ${i === 0 ? 'disabled' : ''}
          class="w-7 h-7 rounded-lg border border-point/20 text-sub text-xs hover:bg-thead disabled:opacity-30">▲</button>
        <button onclick="moveSeasonOrder('${s.id}', 1)" ${i === allSeasons.length-1 ? 'disabled' : ''}
          class="w-7 h-7 rounded-lg border border-point/20 text-sub text-xs hover:bg-thead disabled:opacity-30">▼</button>
      </div>
      <span class="flex-1 font-semibold text-txt text-sm">${escapeHtml(s.name)}</span>
      ${s.is_active ? '<span class="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-semibold">활성</span>' : ''}
      <div class="flex gap-1">
        <button onclick="setActiveSeason('${s.id}')"
          class="px-3 py-1 text-xs rounded-lg border ${s.is_active ? 'border-sub/20 text-sub' : 'border-accent/30 text-accent hover:bg-accent/5'}">
          ${s.is_active ? '활성 중' : '활성 설정'}
        </button>
        <button onclick="deleteSeason('${s.id}')" class="btn-delete">삭제</button>
      </div>
    </div>`).join('');
}

async function handleAddSeason(e) {
  e.preventDefault();
  const name = document.getElementById('inputSeasonName').value.trim();
  if (!name) return;
  const maxOrder = allSeasons.reduce((max, s) => Math.max(max, s.sort_order || 0), 0);
  const sb = initSupabase();
  const { error } = await sb.from('upbo_seasons').insert({ name, sort_order: maxOrder + 1 });
  if (error) { showToast('추가 실패: ' + error.message); return; }
  document.getElementById('inputSeasonName').value = '';
  showToast(`✅ "${name}" 시즌 추가 완료!`);
  await loadSeasons();
}

async function setActiveSeason(id) {
  const sb = initSupabase();
  // 전체 비활성 후 해당 시즌 활성
  await sb.from('upbo_seasons').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('upbo_seasons').update({ is_active: true }).eq('id', id);
  showToast('✅ 활성 시즌 변경 완료!');
  await loadSeasons();
}

async function moveSeasonOrder(id, dir) {
  const idx = allSeasons.findIndex(s => s.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= allSeasons.length) return;

  const sb = initSupabase();
  const a = allSeasons[idx];
  const b = allSeasons[swapIdx];
  await sb.from('upbo_seasons').update({ sort_order: b.sort_order }).eq('id', a.id);
  await sb.from('upbo_seasons').update({ sort_order: a.sort_order }).eq('id', b.id);
  await loadSeasons();
}

async function deleteSeason(id) {
  const s = allSeasons.find(s => s.id === id);
  if (!confirm(`"${s?.name}" 시즌을 삭제하시겠습니까?\n해당 시즌의 숙제는 시즌 미지정 상태로 변경됩니다.`)) return;
  const sb = initSupabase();
  // 연결된 tasks season_id null로
  await sb.from('upbo_tasks').update({ season_id: null }).eq('season_id', id);
  const { error } = await sb.from('upbo_seasons').delete().eq('id', id);
  if (error) { showToast('삭제 실패: ' + error.message); return; }
  showToast(`🗑 "${s?.name}" 시즌 삭제 완료`);
  await loadSeasons();
}
