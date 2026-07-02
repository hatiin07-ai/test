// ============================================
// 💙 업보 숙제장 - 공개 페이지 로직
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

let _allMembers = [];
let _memberTasks = {};
let _currentSeasonId = null;

// ============================================
// 시즌 탭 렌더링
// ============================================

function renderSeasonTabs(seasons, activeId) {
  const wrap = document.getElementById('seasonTabWrap');
  if (!wrap) return;

  if (!seasons || seasons.length <= 1) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'flex';
  const baseStyle = 'padding:9px 22px;border-radius:12px;font-size:0.875rem;font-weight:600;cursor:pointer;transition:all 0.2s;border:1.5px solid;';
  const inactiveStyle = baseStyle + 'color:#7C86A5;background:white;border-color:rgba(175,200,255,0.35);box-shadow:0 1px 4px rgba(110,139,255,0.06);';
  const activeStyle   = baseStyle + 'color:white;background:#6E8BFF;border-color:#6E8BFF;box-shadow:0 4px 14px rgba(110,139,255,0.35);';

  wrap.innerHTML = seasons.map(s => {
    const style = s.id === activeId ? activeStyle : inactiveStyle;
    return `<button style="${style}" data-season-id="${s.id}" onclick="switchSeason('${s.id}')">${escapeHtml(s.name)}</button>`;
  }).join('');
}

const _inactiveStyle = 'padding:9px 22px;border-radius:12px;font-size:0.875rem;font-weight:600;cursor:pointer;transition:all 0.2s;border:1.5px solid;color:#7C86A5;background:white;border-color:rgba(175,200,255,0.35);box-shadow:0 1px 4px rgba(110,139,255,0.06);';
const _activeStyle   = 'padding:9px 22px;border-radius:12px;font-size:0.875rem;font-weight:600;cursor:pointer;transition:all 0.2s;border:1.5px solid;color:white;background:#6E8BFF;border-color:#6E8BFF;box-shadow:0 4px 14px rgba(110,139,255,0.35);';

async function switchSeason(seasonId) {
  _currentSeasonId = seasonId;
  document.querySelectorAll('[data-season-id]').forEach(btn => {
    btn.style.cssText = btn.dataset.seasonId === seasonId ? _activeStyle : _inactiveStyle;
  });
  await loadUpboBySeason(seasonId);
}

// ============================================
// 데이터 로드
// ============================================

async function loadUpboData() {
  const loadingState = document.getElementById('loadingState');
  const lastUpdated = document.getElementById('lastUpdated');

  try {
    const sb = initSupabase();

    // 갱신일
    const { data: settings } = await sb
      .from('upbo_settings').select('*').eq('key', 'last_updated').single();
    if (lastUpdated) {
      lastUpdated.textContent = settings ? `갱신일: ${settings.value}` : '갱신일: -';
    }

    // 시즌 목록
    const { data: seasons } = await sb
      .from('upbo_seasons').select('*')
      .order('sort_order', { ascending: true });

    const activeSeasons = seasons || [];

    // 활성 시즌 or 첫번째 시즌
    const defaultSeason = activeSeasons.find(s => s.is_active) || activeSeasons[0] || null;
    _currentSeasonId = defaultSeason?.id || null;

    renderSeasonTabs(activeSeasons, _currentSeasonId);

    await loadUpboBySeason(_currentSeasonId);

  } catch (err) {
    console.error('Error:', err);
    if (loadingState) loadingState.style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
  }
}

async function loadUpboBySeason(seasonId) {
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const memberList = document.getElementById('memberList');
  const memberCount = document.getElementById('memberCount');
  const searchInput = document.getElementById('searchInput');

  if (loadingState) loadingState.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';
  memberList.innerHTML = '';

  try {
    const sb = initSupabase();

    // 멤버
    const { data: members, error: membersError } = await sb
      .from('upbo_members').select('*')
      .order('created_at', { ascending: true });
    if (membersError) throw membersError;

    // 숙제 — 시즌 필터
    let query = sb.from('upbo_tasks')
      .select('*, upbo_task_types(*)')
      .gt('quantity', 0);

    if (seasonId) {
      query = query.eq('season_id', seasonId);
    } else {
      query = query.is('season_id', null);
    }

    const { data: tasks, error: tasksError } = await query;
    if (tasksError) throw tasksError;

    if (loadingState) loadingState.style.display = 'none';

    const memberTasks = {};
    (tasks || []).forEach(t => {
      if (!memberTasks[t.member_id]) memberTasks[t.member_id] = [];
      memberTasks[t.member_id].push(t);
    });

    const activeMembers = (members || []).filter(m =>
      memberTasks[m.id]?.length > 0 && !m.is_hidden
    ).sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

    _allMembers = activeMembers;
    _memberTasks = memberTasks;

    if (activeMembers.length === 0) {
      emptyState.style.display = 'block';
      memberCount.classList.add('hidden');
      return;
    }

    renderMembers(activeMembers, memberTasks);

    // 검색
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      renderMembers(
        q ? _allMembers.filter(m =>
          m.nickname.toLowerCase().includes(q) ||
          m.user_id.toLowerCase().includes(q)
        ) : _allMembers,
        _memberTasks
      );
    };

  } catch (err) {
    console.error(err);
    if (loadingState) loadingState.style.display = 'none';
    emptyState.style.display = 'block';
  }
}

// ============================================
// 멤버 렌더링
// ============================================

function renderMembers(members, memberTasks) {
  const memberList = document.getElementById('memberList');
  const emptyState = document.getElementById('emptyState');
  const memberCount = document.getElementById('memberCount');

  if (members.length === 0) {
    memberList.innerHTML = '';
    emptyState.style.display = 'block';
    memberCount.classList.add('hidden');
    return;
  }

  emptyState.style.display = 'none';
  // 표시된 멤버들의 총 업보 개수 (수량 합산)
  let totalTasks = 0;
  members.forEach(m => {
    const tasks = memberTasks[m.id] || [];
    tasks.forEach(t => { totalTasks += (t.quantity || 1); });
  });
  memberCount.textContent = `총 ${members.length}명 · ${totalTasks}개`;
  memberCount.classList.remove('hidden');

  memberList.innerHTML = members.map(m => {
    const tasks = (memberTasks[m.id] || []).slice().sort((a, b) => {
      const ta = a.upbo_task_types, tb = b.upbo_task_types;
      if (!ta || !tb) return 0;
      if (ta.category !== tb.category) return ta.category === 'regular' ? -1 : 1;
      return (ta.sort_order || 0) - (tb.sort_order || 0);
    });
    const taskTags = tasks.map(t => {
      const name = escapeHtml(t.upbo_task_types.name);
      const isEvent = t.upbo_task_types.category === 'event';
      const qtyColor = isEvent ? 'color:#6D28D9' : 'color:#3B5BDB';
      const isPrepared = t.is_prepared || false;
      let tagStyle = isEvent
        ? 'background:rgba(196,180,254,0.35);border:1px solid rgba(167,139,250,0.4);color:#6D28D9;'
        : 'background:rgba(186,220,255,0.5);border:1px solid rgba(147,197,253,0.5);color:#2F3A5F;';
      if (isPrepared) tagStyle += 'border:2px solid #FB7185;box-shadow:0 0 0 1px rgba(251,113,133,0.2);';
      let tag = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs md:text-sm" style="${tagStyle}">`;
      tag += name;
      if (t.quantity > 1) tag += ` <span style="font-weight:700;${qtyColor}">×${t.quantity}</span>`;
      if (t.memo) tag += ` <span style="font-size:0.625rem;color:#7C86A5;">(${escapeHtml(t.memo)})</span>`;
      tag += '</span>';
      return tag;
    }).join('');

    return `
      <div class="rounded-2xl shadow-sm border border-point/20 p-4 md:p-5 flex gap-4 items-start hover:shadow-md transition-shadow" style="background:rgba(225,235,255,0.45);">
        <div class="flex-shrink-0 min-w-[72px] md:min-w-[100px]">
          <p class="font-semibold text-txt text-sm md:text-base leading-tight">${escapeHtml(m.nickname)}</p>
          <p class="text-sub text-xs mt-0.5">(${escapeHtml(m.user_id)})</p>
        </div>
        <div class="flex flex-wrap gap-1.5 flex-1">
          ${taskTags || '<span class="text-sub text-xs">숙제 없음</span>'}
        </div>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', loadUpboData);

// ============================================
// ✉️ 문의
// ============================================

function openInquiryModal() {
  document.getElementById('inquiryModal').classList.remove('hidden');
  document.getElementById('inquirySuccess').classList.add('hidden');
  document.getElementById('inquiryForm').classList.remove('hidden');
  document.getElementById('inquiryForm').reset();
}

function closeInquiryModal() {
  document.getElementById('inquiryModal').classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target === document.getElementById('inquiryModal')) closeInquiryModal();
});

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inquiryForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('inquiryNickname').value.trim();
    const content = document.getElementById('inquiryContent').value.trim();
    if (!nickname || !content) return;
    const sb = initSupabase();
    const { error } = await sb.from('upbo_inquiries').insert({ nickname, content });
    if (error) { alert('문의 접수 실패: ' + error.message); return; }
    form.classList.add('hidden');
    document.getElementById('inquirySuccess').classList.remove('hidden');
    setTimeout(() => closeInquiryModal(), 2000);
  });
});
