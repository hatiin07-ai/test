// ============================================
// 📅 냔냐 스케줄 - 공개 페이지 로직
// ============================================

const WEEKDAYS = ['일','월','화','수','목','금','토'];
const MONTHS_EN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function formatDateBlock(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    month: MONTHS_EN[d.getMonth()],
    day: d.getDate(),
    weekday: WEEKDAYS[d.getDay()] + '요일'
  };
}

function isToday(dateStr) {
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return today.getFullYear() === d.getFullYear()
    && today.getMonth() === d.getMonth()
    && today.getDate() === d.getDate();
}

function renderEventCard(ev) {
  const { month, day, weekday } = formatDateBlock(ev.date);
  const today = isToday(ev.date);
  const tags = (ev.tags || []).map((tag, i) =>
    `<span class="ev-tag${i === 0 && ev.is_special ? ' special' : ''}">${tag}</span>`
  ).join('');
  const todayBadge = today ? `<span class="ev-badge-today">오늘</span>` : '';

  return `
    <div class="event-card${today ? ' is-today' : ''}">
      <div class="event-date-block">
        <div class="ev-month">${month}</div>
        <div class="ev-day-num">${day}</div>
        <div class="ev-weekday">${weekday}</div>
      </div>
      <div class="event-divider"></div>
      <div class="event-info">
        ${ev.time ? `<div class="ev-time">${ev.time}</div>` : ''}
        <div class="ev-title">${escapeHtml(ev.title)}</div>
        ${ev.description ? `<div class="ev-desc">${escapeHtml(ev.description)}</div>` : ''}
        ${(tags || todayBadge) ? `<div class="ev-tags">${tags}${todayBadge}</div>` : ''}
      </div>
    </div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

async function loadSchedule() {
  const upcomingEl = document.getElementById('upcomingList');
  const pastEl = document.getElementById('pastList');

  try {
    const sb = initSupabase();
    const today = new Date().toISOString().slice(0, 10);

    // 다가오는 일정 (오늘 포함 이후)
    const { data: upcoming, error: e1 } = await sb
      .from('schedule_events')
      .select('*')
      .gte('date', today)
      .eq('is_hidden', false)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (e1) throw e1;

    // 지난 일정 (오늘 이전)
    const { data: past, error: e2 } = await sb
      .from('schedule_events')
      .select('*')
      .lt('date', today)
      .eq('is_hidden', false)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(10);
    if (e2) throw e2;

    // 다가오는 일정 렌더
    if (!upcoming || upcoming.length === 0) {
      upcomingEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:2rem;">📭</div>
          <p>아직 등록된 일정이 없어요</p>
        </div>`;
    } else {
      upcomingEl.innerHTML = upcoming.map(renderEventCard).join('');
    }

    // 지난 일정 렌더
    if (!past || past.length === 0) {
      pastEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:2rem;">🗂️</div>
          <p>지난 일정이 없어요</p>
        </div>`;
    } else {
      pastEl.innerHTML = past.map(ev => {
        const card = renderEventCard(ev);
        return card.replace('event-card', 'event-card" style="opacity:0.6');
      }).join('');
    }

  } catch (err) {
    console.error(err);
    upcomingEl.innerHTML = `<div class="empty-state"><p>일정을 불러오지 못했습니다</p></div>`;
    pastEl.innerHTML = `<div class="empty-state"><p>일정을 불러오지 못했습니다</p></div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadSchedule);
