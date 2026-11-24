/**
 * Utilitários compartilhados: formatação de datas, segurança HTML,
 * badges, modais, toasts e exportação CSV compatível com Excel.
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isCoordinator(user) {
  return user?.category === 'Coordenador';
}

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

export function getCategoryDisplayLabel(category, userName = '') {
  if (category === 'Coordenador') {
    const first = getFirstName(userName).toLowerCase();
    return first.endsWith('a') ? 'Coordenadora' : 'Coordenador';
  }
  return category || '';
}

export function getCategoryBadgeClass(category) {
  switch (category) {
    case 'Coordenador':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'Acólito':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'Coroinha':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Ativo':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Inativo':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'Bloqueado':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
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
    success: 'bg-[#0F172A] text-white border-amber-500/60',
    error: 'bg-red-700 text-white border-red-400',
    info: 'bg-[#1E3A8A] text-white border-blue-400',
  };
  const icon = type === 'error' ? 'alert-circle' : type === 'info' ? 'info' : 'check-circle-2';
  const iconColor = type === 'success' ? 'text-amber-400' : 'text-white';

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

  dialog.className = `bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${maxWidth} my-8 overflow-hidden animate-modal-in`;
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
 * Sincronização automática entre Escalas e Agenda:
 * Retorna todos os compromissos (escalas vinculadas ao usuário + eventos gerais)
 * ordenados por data/hora.
 */
export function buildSyncedAgendaItems(user, { schedules, events, roles, includeAllSchedules = false }) {
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const items = [];

  schedules.forEach((sch) => {
    const myAssignments = sch.assignments.filter((a) => a.userId === user.id);
    if (myAssignments.length > 0) {
      const myRoleNames = myAssignments.map((a) => roleMap[a.roleId] || 'Função').join(', ');
      items.push({
        id: `sync_${sch.id}`,
        sourceId: sch.id,
        sourceType: 'schedule',
        isPersonalSchedule: true,
        date: sch.date,
        time: sch.time,
        title: `${sch.celebrationType} • ${sch.location}`,
        shortTag: `${sch.time} - ${sch.location} (${myRoleNames})`,
        roleNames: myRoleNames,
        location: sch.location,
        category: sch.category,
        eventType: 'Minha Escala',
        description: sch.notes || `Escalado(a) como ${myRoleNames}`,
        hasSubRequest: myAssignments.some((a) => a.substitutionRequested),
      });
    } else if (includeAllSchedules) {
      items.push({
        id: `sync_all_${sch.id}`,
        sourceId: sch.id,
        sourceType: 'schedule',
        isPersonalSchedule: false,
        date: sch.date,
        time: sch.time,
        title: `${sch.celebrationType} (${sch.category})`,
        shortTag: `${sch.time} - ${sch.location}`,
        roleNames: '',
        location: sch.location,
        category: sch.category,
        eventType: 'Missa / Escala',
        description: sch.notes || '',
        hasSubRequest: sch.assignments.some((a) => a.substitutionRequested),
      });
    }
  });

  events.forEach((evt) => {
    const visibleToUser =
      isCoordinator(user) ||
      evt.audience === 'Todos' ||
      evt.audience === user.category;
    if (!visibleToUser) return;

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
      category: evt.audience,
      eventType: evt.type,
      description: evt.description || '',
      rawEvent: evt,
    });
  });

  return items.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}
