/**
 * Utilitários compartilhados, regras de governança multi-pastoral (N:N),
 * matriz dinâmica de permissões, contagem regressiva de datas, detecção de conflitos,
 * prazos de formulários, tags coloridas de pastorais, modais e CSV.
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

// --- Contas Compartilhadas / Familiares (Irmãos) ---

export function getAccountMembers(user) {
  if (!user) return [];
  if (Array.isArray(user.familyMembers) && user.familyMembers.length > 0) {
    return user.familyMembers;
  }
  return [{ id: user.id, name: user.name || '', birthDate: user.birthDate || '' }];
}

export function isFamilyAccount(user) {
  return getAccountMembers(user).length > 1;
}

export function renderFamilyAccountBadge(user, { compact = false } = {}) {
  const members = getAccountMembers(user);
  if (members.length <= 1) return '';
  return `
    <span class="inline-flex items-center gap-1 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'} rounded-full font-bold bg-amber-100 text-[#78350F] border border-amber-300">
      <i data-lucide="users" class="w-3 h-3"></i>
      Conta Familiar (${members.length} irmãos)
    </span>
  `;
}

export function resolveAssignedMemberName(userMap, userId, memberId) {
  const acc = userMap[userId];
  if (!acc) return 'Membro não encontrado';
  const members = getAccountMembers(acc);
  const target = members.find((m) => m.id === memberId) || members[0];
  return target?.name || acc.name;
}

export function getOpenSubstitutionsForUser(user, schedules, pastorals) {
  if (!user) return [];
  const todayISO = getTodayISO();
  const userPastoralIds = new Set(getMemberPastoralIds(user, pastorals));
  const open = [];

  schedules.forEach((sch) => {
    if (sch.date < todayISO) return;
    (sch.assignments || []).forEach((asg) => {
      if (!asg.substitutionRequested) return;
      if (asg.userId === user.id) return; // Não mostra pedidos feitos pelo próprio usuário no banner de colegas
      const pid = asg.pastoralId || sch.pastoralId;
      if (isGeneralAdmin(user) || userPastoralIds.has(pid)) {
        open.push({ schedule: sch, assignment: asg, pastoralId: pid });
      }
    });
  });

  return open.sort((a, b) =>
    `${a.schedule.date}T${a.schedule.time}`.localeCompare(`${b.schedule.date}T${b.schedule.time}`),
  );
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

export function canManageAnyOfPastorals(user, pastoralIds = []) {
  if (!user) return false;
  if (isGeneralAdmin(user)) return true;
  return (pastoralIds || []).some((pid) => canManagePastoral(user, pid));
}

export function canManageSchedule(user, schedule) {
  if (!user || !schedule) return false;
  if (isGeneralAdmin(user)) return true;
  if (canManagePastoral(user, schedule.pastoralId)) return true;
  return (schedule.assignments || []).some((a) => canManagePastoral(user, a.pastoralId));
}

// --- Matriz Dinâmica de Permissões ---

export function hasPermission(user, permKey, permissionsMatrix) {
  if (!user) return false;
  if (isGeneralAdmin(user)) return true;
  if (!permissionsMatrix) return false;
  if (isAnyCoordinator(user)) {
    return Boolean(permissionsMatrix.coordinator?.[permKey]);
  }
  return Boolean(permissionsMatrix.member?.[permKey]);
}

// --- Visibilidade Estrita por Pastoral (N:N) ---

export function isPastoralScopedItemVisible(itemPastoralIds, user, allPastorals = []) {
  if (!user) return false;
  if (isGeneralAdmin(user)) return true;
  const targets = Array.isArray(itemPastoralIds) && itemPastoralIds.length > 0 ? itemPastoralIds : ['all'];
  if (targets.includes('all')) return true;
  const userIds = new Set(getMemberPastoralIds(user, allPastorals));
  return targets.some((pid) => userIds.has(pid));
}

// --- Prazo de Formulários ---

export function isFormClosed(form) {
  if (!form) return true;
  if (!form.active) return true;
  if (form.deadline) {
    const dt = new Date(form.deadline);
    if (!Number.isNaN(dt.getTime()) && dt.getTime() <= Date.now()) {
      return true;
    }
  }
  return false;
}

export function isFormExpiredByDeadline(form) {
  if (!form?.deadline) return false;
  const dt = new Date(form.deadline);
  return !Number.isNaN(dt.getTime()) && dt.getTime() <= Date.now();
}

export function getFormTargetUsers(form, allUsers = []) {
  const targets = form?.pastoralIds || ['all'];
  return allUsers.filter((u) => {
    if (u.status !== 'Ativo' || u.isGeneralAdmin) return false;
    if (targets.includes('all')) return true;
    return getUserMemberships(u).some((m) => targets.includes(m.pastoralId));
  });
}

// --- Contagem Regressiva de Datas ---

export function getCountdownBadge(isoDate) {
  if (!isoDate) return { label: '—', cls: 'bg-stone-100 text-stone-600 border-stone-200', diffDays: 0 };
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = isoDate.split('-').map(Number);
  const targetStart = new Date(y, m - 1, d);
  const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { label: 'Hoje', cls: 'bg-[#D97706] text-white border-[#B45309] shadow-xs', diffDays };
  }
  if (diffDays === 1) {
    return { label: 'Amanhã', cls: 'bg-amber-100 text-[#92400E] border-amber-400', diffDays };
  }
  if (diffDays > 1) {
    return { label: `Em ${diffDays} dias`, cls: 'bg-[#F5EFE6] text-[#4E342E] border-[#D7C4B2]', diffDays };
  }
  return { label: 'Realizada', cls: 'bg-stone-100 text-stone-500 border-stone-200', diffDays };
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
    return `<span class="inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'} rounded-full font-bold bg-[#F5EFE6] text-[#5D4037] border border-[#E6DACE]">Toda a Paróquia</span>`;
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

export function renderPastoralPillsList(pastoralIds, pastoralMap, { compact = false } = {}) {
  const list = Array.isArray(pastoralIds) && pastoralIds.length > 0 ? pastoralIds : ['all'];
  if (list.includes('all')) return renderPastoralPill(null, { compact });
  return list.map((pid) => renderPastoralPill(pastoralMap[pid], { compact })).join('');
}

// --- Detecção Amigável de Conflitos de Horário ---

export function buildUserTimeSlotIndex(schedules) {
  const counts = {};
  schedules.forEach((sch) => {
    (sch.assignments || []).forEach((asg) => {
      const personKey = asg.memberId || asg.userId;
      const key = `${personKey}|${sch.date}|${sch.time}`;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

export function hasTimeConflict(slotIndex, personId, date, time) {
  return (slotIndex[`${personId}|${date}|${time}`] || 0) > 1;
}

export function findConflictsForMember(schedules, personId, date, time, excludeScheduleId = null) {
  if (!personId || !date || !time) return [];
  const matches = [];
  schedules.forEach((sch) => {
    if (excludeScheduleId && sch.id === excludeScheduleId) return;
    if (sch.date !== date || sch.time !== time) return;
    (sch.assignments || []).forEach((asg) => {
      const asgPerson = asg.memberId || asg.userId;
      if (asgPerson === personId) {
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

export function cleanPhoneForWhatsApp(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
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

export function buildSyncedAgendaItems(user, { schedules, events, roles, pastorals, includeManagedSchedules = false }) {
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const slotIndex = buildUserTimeSlotIndex(schedules);
  const memberPastoralIds = new Set(getMemberPastoralIds(user, pastorals));
  const items = [];

  const isFam = isFamilyAccount(user);
  const myAccountMembers = getAccountMembers(user);

  schedules.forEach((sch) => {
    const myAssignments = (sch.assignments || []).filter((a) => a.userId === user.id);

    if (myAssignments.length > 0) {
      myAssignments.forEach((asg) => {
        const pastoral = pastoralMap[asg.pastoralId] || pastoralMap[sch.pastoralId];
        const roleName = roleMap[asg.roleId] || 'Função';
        const assignedMember = myAccountMembers.find((m) => m.id === asg.memberId) || myAccountMembers[0];
        const memberFirst = getFirstName(assignedMember?.name || user.name);
        const personKey = asg.memberId || asg.userId;
        items.push({
          id: `sync_${sch.id}_${asg.id}`,
          sourceId: sch.id,
          sourceType: 'schedule',
          isPersonalSchedule: true,
          date: sch.date,
          time: sch.time,
          title: `${sch.celebrationType} • ${sch.location}`,
          shortTag: isFam
            ? `${sch.time} - ${memberFirst} (${roleName})`
            : `${sch.time} - ${sch.location} (${roleName})`,
          roleNames: isFam ? `${roleName} • Escalado: ${assignedMember?.name || user.name}` : roleName,
          location: sch.location,
          pastoral,
          pastoralId: pastoral?.id || sch.pastoralId,
          eventType: 'Minha Escala',
          description: sch.notes || (isFam ? `Escalado: ${assignedMember?.name} (${roleName})` : `Escalado(a) como ${roleName}`),
          hasSubRequest: Boolean(asg.substitutionRequested),
          hasConflict: hasTimeConflict(slotIndex, personKey, sch.date, sch.time),
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
