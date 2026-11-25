/**
 * Utilitários compartilhados, regras de governança multi-pastoral (N:N),
 * detecção de conflitos de horário, tags coloridas de pastorais, modais e CSV.
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Governança & Isolamento Multi-Pastoral (N:N) ---

export function isGeneralAdmin(user) {
  return Boolean(user?.isGeneralAdmin);
}

export function getUserMemberships(user) {
  return Array.isArray(user?.memberships) ? user.memberships : [];
}

export function getCoordinatedPastoralIds(user, allPastorals = []) {
  if (!user) return [];
  if (isGeneralAdmin(user)) return allPastorals.map((p) => p.id);
  return getUserMemberships(user)
    .filter((m) => m.role === 'Coordenador')
    .map((m) => m.pastoralId);
}

export function getMemberPastoralIds(user, allPastorals = []) {
  if (!user) return [];
  if (isGeneralAdmin(user)) return allPastorals.map((p) => p.id);
  return Array.from(new Set(getUserMemberships(user).map((m) => m.pastoralId)));
}

export function isAnyCoordinator(user) {
  if (!user) return false;
  return isGeneralAdmin(user) || getUserMemberships(user).some((m) => m.role === 'Coordenador');
}

export function canManagePastoral(user, pastoralId) {
  if (!user) return false;
  if (isGeneralAdmin(user)) return true;
  if (!pastoralId || pastoralId === 'all') return false;
  return getUserMemberships(user).some((m) => m.pastoralId === pastoralId && m.role === 'Coordenador');
}

export function canManageSchedule(user, schedule) {
  if (!user || !schedule) return false;
  if (isGeneralAdmin(user)) return true;
  if (canManagePastoral(user, schedule.pastoralId)) return true;
  return (schedule.assignments || []).some((a) => canManagePastoral(user, a.pastoralId));
}

export function getUserRoleSummary(user, pastorals = []) {
  if (!user) return { label: '', badgeClass: 'bg-[#F5EFE6] text-[#5D4037] border-[#E6DACE]' };
  if (isGeneralAdmin(user)) {
    return {
      label: 'Coordenação Geral',
      badgeClass: 'bg-amber-100 text-[#92400E] border-amber-400',
    };
  }
  const coordIds = getCoordinatedPastoralIds(user, pastorals);
  if (coordIds.length > 0) {
    const first = getFirstName(user.name).toLowerCase();
    const title = first.endsWith('a') ? 'Coordenadora' : 'Coordenador';
    return {
      label: coordIds.length === 1 ? title : `${title} (${coordIds.length})`,
      badgeClass: 'bg-[#4E342E] text-amber-300 border-[#3E2723]',
    };
  }
  const memberCount = getUserMemberships(user).length;
  return {
    label: memberCount > 1 ? `Membro (${memberCount} pastorais)` : 'Membro',
    badgeClass: 'bg-[#F5EFE6] text-[#4E342E] border-[#D7C4B2]',
  };
}

export function renderPastoralPill(pastoral, { compact = false } = {}) {
  if (!pastoral) {
    return `<span class="inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'} rounded-full font-bold bg-[#F5EFE6] text-[#5D4037] border border-[#E6DACE]">Geral</span>`;
  }
  const color = pastoral.color || '#5D4037';
  const label = pastoral.shortName || pastoral.name;
  return `
    <span class="inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'} rounded-full font-bold border"
      style="background-color: ${escapeHtml(color)}18; color: ${escapeHtml(color)}; border-color: ${escapeHtml(color)}44;">
      <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: ${escapeHtml(color)};"></span>
      ${escapeHtml(label)}
    </span>
  `;
}

// --- Detecção Amigável de Conflitos de Horário ---

/**
 * Retorna um mapa { `${userId}|${date}|${time}`: count } para identificar
 * automaticamente múltiplas escalas no mesmo dia e horário.
 */
export function buildUserTimeSlotIndex(schedules) {
  const counts = {};
  schedules.forEach((sch) => {
    (sch.assignments || []).forEach((asg) => {
      const key = `${asg.userId}|${sch.date}|${sch.time}`;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

export function hasTimeConflict(slotIndex, userId, date, time) {
  return (slotIndex[`${userId}|${date}|${time}`] || 0) > 1;
}

export function findConflictsForMember(schedules, userId, date, time, excludeScheduleId = null) {
  if (!userId || !date || !time) return [];
  const matches = [];
  schedules.forEach((sch) => {
    if (excludeScheduleId && sch.id === excludeScheduleId) return;
    if (sch.date !== date || sch.time !== time) return;
    (sch.assignments || []).forEach((asg) => {
      if (asg.userId === userId) {
        matches.push({ schedule: sch, assignment: asg });
      }
    });
  });
  return matches;
}

// --- Formatação e UI ---

export function getFirstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || 'Usuário';
}

export function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateBR(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(isoDateTime) {
  if (!isoDateTime) return '—';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatWeekdayBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const label = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Ativo':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Inativo':
      return 'bg-stone-100 text-stone-600 border-stone-200';
    case 'Bloqueado':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-stone-100 text-stone-700 border-stone-200';
  }
}

export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const palette = {
    success: 'bg-[#3E2723] text-white border-amber-500/70',
    error: 'bg-red-800 text-white border-red-400',
    info: 'bg-[#4E342E] text-white border-amber-400/60',
  };
  const icon = type === 'error' ? 'alert-circle' : type === 'info' ? 'info' : 'check-circle-2';
  const iconColor = type === 'error' ? 'text-white' : 'text-amber-400';

  const el = document.createElement('div');
  el.className = `pointer-events-auto animate-toast-in flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${palette[type] || palette.success}`;
  el.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 shrink-0 ${iconColor}"></i>
    <span class="leading-snug">${escapeHtml(message)}</span>
  `;
  container.appendChild(el);
  refreshIcons();

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 3400);
}

export function openModal({ title, bodyHtml, maxWidth = 'max-w-xl', onMount }) {
  const root = document.getElementById('modal-root');
  const dialog = document.getElementById('modal-dialog');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  if (!root || !dialog || !titleEl || !bodyEl) return;

  dialog.className = `bg-[#FDFBF7] rounded-2xl shadow-2xl border border-[#E6DACE] w-full ${maxWidth} my-8 overflow-hidden animate-modal-in`;
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;

  root.classList.remove('hidden');
  root.classList.add('flex');
  refreshIcons();

  if (typeof onMount === 'function') {
    onMount(bodyEl);
  }
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.classList.add('hidden');
  root.classList.remove('flex');
}

export function exportToCSV(filename, headers, rows) {
  const escapeCell = (val) => {
    const text = String(val ?? '').replace(/"/g, '""');
    return `"${text}"`;
  };
  const csvLines = [
    headers.map(escapeCell).join(';'),
    ...rows.map((row) => row.map(escapeCell).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Sincronização automática entre Escalas Multi-Pastoral e Agenda:
 * Unifica todas as escalas do usuário com a tag colorida da pastoral + função,
 * respeitando estritamente o isolamento de gestão dos coordenadores.
 */
export function buildSyncedAgendaItems(user, { schedules, events, roles, pastorals, includeManagedSchedules = false }) {
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const slotIndex = buildUserTimeSlotIndex(schedules);
  const memberPastoralIds = new Set(getMemberPastoralIds(user, pastorals));
  const items = [];

  schedules.forEach((sch) => {
    const myAssignments = (sch.assignments || []).filter((a) => a.userId === user.id);

    if (myAssignments.length > 0) {
      myAssignments.forEach((asg) => {
        const pastoral = pastoralMap[asg.pastoralId] || pastoralMap[sch.pastoralId];
        const roleName = roleMap[asg.roleId] || 'Função';
        items.push({
          id: `sync_${sch.id}_${asg.id}`,
          sourceId: sch.id,
          sourceType: 'schedule',
          isPersonalSchedule: true,
          date: sch.date,
          time: sch.time,
          title: `${sch.celebrationType} • ${sch.location}`,
          shortTag: `${sch.time} - ${sch.location} (${roleName})`,
          roleNames: roleName,
          location: sch.location,
          pastoral,
          pastoralId: pastoral?.id || sch.pastoralId,
          eventType: 'Minha Escala',
          description: sch.notes || `Escalado(a) como ${roleName}`,
          hasSubRequest: Boolean(asg.substitutionRequested),
          hasConflict: hasTimeConflict(slotIndex, user.id, sch.date, sch.time),
        });
      });
    } else if (includeManagedSchedules && canManageSchedule(user, sch)) {
      const pastoral = pastoralMap[sch.pastoralId];
      items.push({
        id: `sync_mgmt_${sch.id}`,
        sourceId: sch.id,
        sourceType: 'schedule',
        isPersonalSchedule: false,
        date: sch.date,
        time: sch.time,
        title: `${sch.celebrationType} • ${pastoral?.shortName || 'Pastoral'}`,
        shortTag: `${sch.time} - ${sch.location}`,
        roleNames: '',
        location: sch.location,
        pastoral,
        pastoralId: sch.pastoralId,
        eventType: 'Escala da Pastoral',
        description: sch.notes || '',
        hasSubRequest: (sch.assignments || []).some((a) => a.substitutionRequested),
        hasConflict: false,
      });
    }
  });

  events.forEach((evt) => {
    const visibleToUser =
      isGeneralAdmin(user) ||
      evt.pastoralId === 'all' ||
      memberPastoralIds.has(evt.pastoralId);
    if (!visibleToUser) return;

    const pastoral = evt.pastoralId === 'all' ? null : pastoralMap[evt.pastoralId];
    items.push({
      id: evt.id,
      sourceId: evt.id,
      sourceType: 'event',
      isPersonalSchedule: false,
      date: evt.date,
      time: evt.time,
      title: evt.title,
      shortTag: `${evt.time} - ${evt.title}`,
      roleNames: '',
      location: evt.location,
      pastoral,
      pastoralId: evt.pastoralId,
      eventType: evt.type,
      description: evt.description || '',
      canEdit: isGeneralAdmin(user) || canManagePastoral(user, evt.pastoralId),
      rawEvent: evt,
    });
  });

  return items.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}
