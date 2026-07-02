// ============================================
// 📅 스케줄 Admin 로직
// ============================================

let allEvents = [];

// ============================================
// 데이터 로드
// ============================================

async function loadScheduleAdmin() {
  const sb = initSupabase();
  const { data, error } = await sb
    .from('schedule_events')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: true });

  if (error) { showToast('일정 로드 실패: ' + error.message); return; }
  allEvents = data || [];
  renderScheduleTable();
  populateEditDropdown();
}

// ============================================
// 테이블 렌더
// ============================================

function renderScheduleTable() {
  const tbody = document.getElementById('scheduleTableBody');
  if (allEvents.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="text-center py-8 text-sub text-sm">등록된 일정이 없습니다</td></tr>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  tbody.innerHTML = allEvents.map(ev => {
    const isPast = ev.date < today;
    const tags = (ev.tags || []).join(', ');
    const rowClass = isPast ? 'opacity-50' : '';
    const hiddenBadge = ev.is_hidden ? '<span class="text-xs bg-gray-200 text-sub px-1.5 py-0.5 rounded ml-1">숨김</span>' : '';
    const specialBadge = ev.is_special ? '<span class="text-xs bg-eventBg border border-eventBorder text-event px-1.5 py-0.5 rounded ml-1">이벤트</span>' : '';

    return `
      <tr class="border-b border-point/10 hover:bg-bg/50 transition-colors ${rowClass}">
        <td class="py-3 px-3 text-sm text-txt font-medium">${ev.date}</td>
        <td class="py-3 px-3 text-sm text-sub">${ev.time || '—'}</td>
        <td class="py-3 px-3 text-sm text-txt">
          ${escapeHtml(ev.title)}${hiddenBadge}${specialBadge}
        </td>
        <td class="py-3 px-3 text-xs text-sub max-w-[160px] truncate">${escapeHtml(ev.description || '')}</td>
        <td class="py-3 px-3 text-xs text-sub">${tags}</td>
        <td class="py-3 px-3">
          <div class="flex gap-1">
            <button onclick="openScheduleEdit(${ev.id})" class="btn-edit">수정</button>
            <button onclick="toggleScheduleHidden(${ev.id}, ${!ev.is_hidden})" class="btn-edit">
              ${ev.is_hidden ? '👁' : '🙈'}
            </button>
            <button onclick="deleteScheduleEvent(${ev.id})" class="btn-delete">삭제</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ============================================
// 추가
// ============================================

async function handleAddSchedule(e) {
  e.preventDefault();
  const date = document.getElementById('schDate').value;
  const time = document.getElementById('schTime').value;
  const title = document.getElementById('schTitle').value.trim();
  const description = document.getElementById('schDesc').value.trim();
  const tagsRaw = document.getElementById('schTags').value.trim();
  const is_special = document.getElementById('schSpecial').checked;

  if (!date || !title) { showToast('날짜와 제목은 필수입니다'); return; }

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const sb = initSupabase();
  const { error } = await sb.from('schedule_events').insert({
    date, time: time || null, title, description: description || null, tags, is_special
  });

  if (error) { showToast('추가 실패: ' + error.message); return; }

  e.target.reset();
  showToast(`✅ "${title}" 일정 추가 완료!`);
  await loadScheduleAdmin();
}

// ============================================
// 수정
// ============================================

function openScheduleEdit(id) {
  const ev = allEvents.find(e => e.id === id);
  if (!ev) return;

  document.getElementById('editSchId').value = id;
  document.getElementById('editSchDate').value = ev.date;
  document.getElementById('editSchTime').value = ev.time || '';
  document.getElementById('editSchTitle').value = ev.title;
  document.getElementById('editSchDesc').value = ev.description || '';
  document.getElementById('editSchTags').value = (ev.tags || []).join(', ');
  document.getElementById('editSchSpecial').checked = ev.is_special || false;
  document.getElementById('scheduleEditModal').classList.remove('hidden');
}

function closeScheduleEditModal() {
  document.getElementById('scheduleEditModal').classList.add('hidden');
}

async function handleEditSchedule(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('editSchId').value);
  const date = document.getElementById('editSchDate').value;
  const time = document.getElementById('editSchTime').value;
  const title = document.getElementById('editSchTitle').value.trim();
  const description = document.getElementById('editSchDesc').value.trim();
  const tagsRaw = document.getElementById('editSchTags').value.trim();
  const is_special = document.getElementById('editSchSpecial').checked;

  if (!date || !title) { showToast('날짜와 제목은 필수입니다'); return; }

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const sb = initSupabase();
  const { error } = await sb.from('schedule_events').update({
    date, time: time || null, title, description: description || null, tags, is_special
  }).eq('id', id);

  if (error) { showToast('수정 실패: ' + error.message); return; }

  closeScheduleEditModal();
  showToast(`✅ 일정 수정 완료!`);
  await loadScheduleAdmin();
}

// ============================================
// 숨기기 / 삭제
// ============================================

async function toggleScheduleHidden(id, hidden) {
  const sb = initSupabase();
  const { error } = await sb.from('schedule_events').update({ is_hidden: hidden }).eq('id', id);
  if (error) { showToast('변경 실패'); return; }
  showToast(hidden ? '🙈 일정 숨김 처리' : '👁 일정 표시');
  await loadScheduleAdmin();
}

async function deleteScheduleEvent(id) {
  const ev = allEvents.find(e => e.id === id);
  if (!confirm(`"${ev?.title}" 일정을 삭제하시겠습니까?`)) return;
  const sb = initSupabase();
  const { error } = await sb.from('schedule_events').delete().eq('id', id);
  if (error) { showToast('삭제 실패: ' + error.message); return; }
  showToast('🗑 일정 삭제 완료');
  await loadScheduleAdmin();
}

// 드롭다운 재사용 (미리보기용)
function populateEditDropdown() {}
