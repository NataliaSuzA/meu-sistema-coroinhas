/**
 * Módulo 11: Presença Multi-Pastoral Individualizada (inclui irmãos de Contas Familiares)
 * - Coordenadores registram chamadas por integrante individual (memberId) apenas nas
 *   pastorais que coordenam (Coordenação Geral vê todas).
 * - Contas Familiares veem a frequência e histórico separados por irmão.
 */

import { dataService } from '../services/dataService.js';
import {
  MONTHS_PT,
  addDaysToTodayISO,
  canManagePastoral,
  escapeHtml,
  formatDateBR,
  formatWeekdayBR,
  getAccountMembers,
  getCoordinatedPastoralIds,
  getTodayISO,
  getUserMemberships,
  hasPermission,
  isFamilyAccount,
  isGeneralAdmin,
  refreshIcons,
  renderFamilyAccountBadge,
  renderPastoralPill,
  resolveAssignedMemberName,
  showToast,
} from '../utils/helpers.js';

let selectedSessionId = null;
let sessionPastoralFilter = 'all';
let sessionPeriodFilter = 'all';
let sessionDateFilter = '';
let summaryPastoralFilter = 'all';

function memberBelongsToPastoral(user, member, pastoralId) {
  if (!pastoralId || pastoralId === 'all') return true;
  if (Array.isArray(member?.pastoralIds) && member.pastoralIds.length > 0) {
    return member.pastoralIds.includes(pastoralId);
  }
  if (member?.pastoralId) {
    return member.pastoralId === pastoralId;
  }
  return getUserMemberships(user).some((ms) => ms.pastoralId === pastoralId);
}

function getMemberScopedMemberships(user, member, { generalAdmin, managedIds }) {
  const accMemberships = getUserMemberships(user).filter((x) => generalAdmin || managedIds.has(x.pastoralId));
  if (Array.isArray(member?.pastoralIds) && member.pastoralIds.length > 0) {
    const set = new Set(member.pastoralIds);
    return accMemberships.filter((x) => set.has(x.pastoralId));
  }
  if (member?.pastoralId) {
    return accMemberships.filter((x) => x.pastoralId === member.pastoralId);
  }
  return accMemberships;
}

function buildAttendanceSessions(schedules, events, users, pastoralMap) {
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const activeUsers = users.filter((u) => u.status === 'Ativo');
  const sessions = [];

  schedules.forEach((sch) => {
    const seen = new Set();
    const participants = [];
    (sch.assignments || []).forEach((a) => {
      const pid = a.memberId || a.userId;
      if (seen.has(pid)) return;
      seen.add(pid);
      const acc = userMap[a.userId];
      participants.push({
        participantId: pid,
        userId: a.userId,
        name: resolveAssignedMemberName(userMap, a.userId, a.memberId),
        isFamily: isFamilyAccount(acc),
      });
    });

    const p = pastoralMap[sch.pastoralId];
    const pastoralIds = Array.from(
      new Set([sch.pastoralId, ...(sch.assignments || []).map((a) => a.pastoralId)].filter(Boolean)),
    );
    sessions.push({
      id: sch.id,
      kind: 'Missa / Escala',
      pastoralId: sch.pastoralId,
      pastoralIds,
      pastoral: p,
      title: `${sch.celebrationType} — ${sch.location}`,
      date: sch.date,
      time: sch.time,
      location: sch.location,
      participants,
    });
  });

  events.forEach((evt) => {
    const targetPid = evt.pastoralId;
    const isAllPastorals = !targetPid || targetPid === 'all';
    const participants = [];
    const seen = new Set();

    activeUsers.forEach((u) => {
      const isFam = isFamilyAccount(u);
      getAccountMembers(u).forEach((m) => {
        if (seen.has(m.id)) return;
        if (!isAllPastorals && !memberBelongsToPastoral(u, m, targetPid)) return;
        seen.add(m.id);
        participants.push({
          participantId: m.id,
          userId: u.id,
          name: m.name,
          isFamily: isFam,
        });
      });
    });

    participants.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    sessions.push({
      id: evt.id,
      kind: evt.type,
      pastoralId: evt.pastoralId,
      pastoralIds: isAllPastorals ? ['all'] : [evt.pastoralId],
      pastoral: isAllPastorals ? null : pastoralMap[evt.pastoralId],
      title: evt.title,
      date: evt.date,
      time: evt.time,
      location: evt.location,
      participants,
    });
  });

  return sessions.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

function partitionAndSortSessions(sessions, todayISO) {
  const upcoming = sessions
    .filter((s) => s.date >= todayISO)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const past = sessions
    .filter((s) => s.date < todayISO)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  return { upcoming, past };
}

function pickDefaultSession(upcoming, past, todayISO) {
  const todayMatch = upcoming.find((s) => s.date === todayISO);
  if (todayMatch) return todayMatch;
  if (upcoming.length > 0) return upcoming[0];
  if (past.length > 0) return past[0];
  return null;
}

function formatMonthPeriodLabel(ym) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m || !MONTHS_PT[m - 1]) return ym;
  return `${MONTHS_PT[m - 1]}/${y}`;
}

function computeParticipantStats(participantId, allowedSessionIds, attendanceMap) {
  let present = 0;
  let justified = 0;
  let absent = 0;

  allowedSessionIds.forEach((sid) => {
    const status = attendanceMap[sid]?.[participantId];
    if (status === 'Presente') present += 1;
    else if (status === 'Falta Justificada') justified += 1;
    else if (status === 'Falta') absent += 1;
  });

  const total = present + justified + absent;
  const percentage = total === 0 ? null : Math.round((present / total) * 100);
  return { present, justified, absent, total, percentage };
}

export function renderAttendance(container, { user, permissions }) {
  const canLaunchAttendance = hasPermission(user, 'attendance_manage', permissions);
  const generalAdmin = isGeneralAdmin(user);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const users = dataService.getUsers();
  const schedules = dataService.getSchedules();
  const events = dataService.getEvents();
  const attendanceMap = dataService.getAttendanceMap();

  const allSessions = buildAttendanceSessions(schedules, events, users, pastoralMap);

  if (!canLaunchAttendance) {
    renderMemberAttendanceView(container, { user, sessions: allSessions, attendanceMap });
    return;
  }

  const todayISO = getTodayISO();
  const weekEndISO = addDaysToTodayISO(7);
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const managedPastorals = pastorals.filter((p) => managedIds.has(p.id));
  const managedSessions = allSessions.filter(
    (s) =>
      generalAdmin ||
      canManagePastoral(user, s.pastoralId) ||
      (s.pastoralIds || []).some((pid) => canManagePastoral(user, pid)),
  );

  // Pastorais disponíveis na barra de filtros (apenas as gerenciadas com sessões ou Coroinhas/Acólitos)
  const sessionPastoralIdsPresent = new Set();
  managedSessions.forEach((s) => {
    (s.pastoralIds || []).forEach((pid) => {
      if (pid && pid !== 'all') sessionPastoralIdsPresent.add(pid);
    });
  });
  const filterablePastorals = managedPastorals.filter(
    (p) => sessionPastoralIdsPresent.has(p.id) || managedPastorals.length <= 3,
  );

  if (sessionPastoralFilter !== 'all' && !managedIds.has(sessionPastoralFilter)) {
    sessionPastoralFilter = 'all';
  }
  if (summaryPastoralFilter !== 'all' && !managedIds.has(summaryPastoralFilter)) {
    summaryPastoralFilter = 'all';
  }

  // Meses disponíveis ordenados cronologicamente para o seletor de período
  const availableMonths = Array.from(
    new Set(managedSessions.map((s) => String(s.date || '').slice(0, 7)).filter((ym) => /^\d{4}-\d{2}$/.test(ym))),
  ).sort();
  if (
    sessionPeriodFilter !== 'all' &&
    sessionPeriodFilter !== 'this_week' &&
    !availableMonths.includes(sessionPeriodFilter)
  ) {
    sessionPeriodFilter = 'all';
  }

  // Aplica filtros rápidos (Pastoral, Período/Mês e Data específica)
  const filteredSessions = managedSessions.filter((s) => {
    if (sessionPastoralFilter !== 'all') {
      const matchesPastoral =
        s.pastoralId === sessionPastoralFilter ||
        s.pastoralId === 'all' ||
        (s.pastoralIds || []).includes(sessionPastoralFilter);
      if (!matchesPastoral) return false;
    }
    if (sessionDateFilter) {
      return s.date === sessionDateFilter;
    }
    if (sessionPeriodFilter === 'this_week') {
      return s.date >= todayISO && s.date <= weekEndISO;
    }
    if (sessionPeriodFilter !== 'all') {
      return String(s.date || '').startsWith(sessionPeriodFilter);
    }
    return true;
  });

  const { upcoming: upcomingSessions, past: pastSessions } = partitionAndSortSessions(filteredSessions, todayISO);
  const orderedFilteredSessions = [...upcomingSessions, ...pastSessions];

  if (!selectedSessionId || !orderedFilteredSessions.some((s) => s.id === selectedSessionId)) {
    selectedSessionId = pickDefaultSession(upcomingSessions, pastSessions, todayISO)?.id || null;
  }

  const activeSession = orderedFilteredSessions.find((s) => s.id === selectedSessionId) || null;
  const sessionRecord = activeSession ? attendanceMap[activeSession.id] || {} : {};
  const hasActiveSessionFilter =
    sessionPastoralFilter !== 'all' || sessionPeriodFilter !== 'all' || Boolean(sessionDateFilter);

  const renderSessionOption = (s) => {
    const pLabel = s.pastoral?.shortName || 'Geral';
    const todayPrefix = s.date === todayISO ? '★ HOJE • ' : '';
    return `<option value="${s.id}" ${s.id === selectedSessionId ? 'selected' : ''}>${todayPrefix}${formatDateBR(s.date)} ${s.time} • [${pLabel}] ${escapeHtml(s.title)}</option>`;
  };

  const sessionSelectOptionsHtml = [
    upcomingSessions.length > 0
      ? `<optgroup label="Hoje e Próximas (${upcomingSessions.length})">${upcomingSessions.map(renderSessionOption).join('')}</optgroup>`
      : '',
    pastSessions.length > 0
      ? `<optgroup label="Anteriores (${pastSessions.length})">${pastSessions.map(renderSessionOption).join('')}</optgroup>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const summarySessions =
    summaryPastoralFilter === 'all'
      ? managedSessions
      : managedSessions.filter((s) => s.pastoralId === summaryPastoralFilter);
  const summarySessionIds = summarySessions.map((s) => s.id);

  // Desdobra contas em integrantes individuais para o indicador de frequência (filtro estrito por membro)
  const summaryParticipants = [];
  const managedIdList = Array.from(managedIds);
  users.forEach((u) => {
    if (u.isGeneralAdmin) return;
    const isFam = isFamilyAccount(u);
    getAccountMembers(u).forEach((m) => {
      const inScope =
        summaryPastoralFilter !== 'all'
          ? memberBelongsToPastoral(u, m, summaryPastoralFilter)
          : generalAdmin || managedIdList.some((pid) => memberBelongsToPastoral(u, m, pid));
      if (!inScope) return;
      summaryParticipants.push({
        participantId: m.id,
        name: m.name,
        isFamily: isFam,
        memberships: getMemberScopedMemberships(u, m, { generalAdmin, managedIds }),
      });
    });
  });
  summaryParticipants.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h3 class="text-xl font-extrabold text-[#3E2723]">Controle de Presença &amp; Frequência</h3>
        <p class="text-sm text-[#6D4C41] mt-0.5">
          ${
            generalAdmin
              ? 'Registre chamadas individuais (inclusive por irmão em contas familiares) em todas as celebrações e ensaios.'
              : `Gerencie chamadas e frequência apenas nas pastorais sob sua coordenação (${managedPastorals.map((p) => p.shortName).join(', ')}).`
          }
        </p>
      </div>

      <!-- Chamada da Sessão -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="px-5 sm:px-6 py-4 bg-[#3E2723] text-white space-y-3">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-amber-400">Lista de Chamada</p>
              <h4 class="text-base font-bold mt-0.5">Registrar presença por celebração ou ensaio</h4>
            </div>
            ${
              orderedFilteredSessions.length > 0
                ? `
              <div class="flex items-center gap-2 w-full lg:w-auto">
                <select id="attendance-session-select" aria-label="Selecionar celebração ou evento"
                  class="flex-1 lg:w-[400px] max-w-full px-3.5 py-2 rounded-xl bg-[#2B1B18] border border-amber-500/35 text-white text-xs sm:text-sm font-semibold outline-none focus:border-amber-400">
                  ${sessionSelectOptionsHtml}
                </select>
                <span class="hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-lg bg-white/10 text-amber-200 text-[11px] font-bold shrink-0">
                  ${orderedFilteredSessions.length} ${orderedFilteredSessions.length === 1 ? 'opção' : 'opções'}
                </span>
              </div>
            `
                : `
              <span class="text-xs font-semibold text-amber-200/90 bg-white/10 px-3 py-1.5 rounded-xl self-start lg:self-center">
                Nenhuma celebração encontrada no filtro
              </span>
            `
            }
          </div>
        </div>

        <!-- Barra Compacta de Filtros Rápidos -->
        <div id="attendance-filters-bar" class="attendance-filter-bar px-5 sm:px-6 py-3 bg-[#FDFBF7] border-b border-[#E6DACE]/80 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <!-- Filtro de Pastoral (Pílulas) -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#8D6E63] mr-1">Pastoral:</span>
            ${
              filterablePastorals.length > 1 || generalAdmin
                ? `
              <button type="button" data-att-pastoral="all"
                class="attendance-filter-pill ${sessionPastoralFilter === 'all' ? 'attendance-filter-pill-active' : ''}">
                Todas
              </button>
            `
                : ''
            }
            ${filterablePastorals
              .map(
                (p) => `
              <button type="button" data-att-pastoral="${p.id}"
                class="attendance-filter-pill ${sessionPastoralFilter === p.id ? 'attendance-filter-pill-active' : ''}">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: ${sessionPastoralFilter === p.id ? '#FEF3C7' : escapeHtml(p.color || '#B45309')};"></span>
                ${escapeHtml(p.shortName)}
              </button>
            `,
              )
              .join('')}
          </div>

          <!-- Filtro de Mês / Período + Data Específica -->
          <div class="flex items-center gap-2 flex-wrap">
            <select id="attendance-period-filter" aria-label="Filtrar por período ou mês"
              class="px-3 py-1.5 rounded-xl border border-[#E6DACE] bg-white text-xs font-bold text-[#3E2723] outline-none focus:border-[#B45309]">
              <option value="all" ${sessionPeriodFilter === 'all' && !sessionDateFilter ? 'selected' : ''}>Todos os períodos</option>
              <option value="this_week" ${sessionPeriodFilter === 'this_week' && !sessionDateFilter ? 'selected' : ''}>Esta Semana</option>
              ${availableMonths
                .map(
                  (ym) =>
                    `<option value="${ym}" ${sessionPeriodFilter === ym && !sessionDateFilter ? 'selected' : ''}>${escapeHtml(formatMonthPeriodLabel(ym))}</option>`,
                )
                .join('')}
            </select>

            <div class="inline-flex items-center gap-1.5 bg-white border border-[#E6DACE] rounded-xl px-2.5 py-1">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-[#B45309] shrink-0"></i>
              <input id="attendance-date-filter" type="date" value="${escapeHtml(sessionDateFilter)}" aria-label="Filtrar por data específica"
                class="text-xs font-bold text-[#3E2723] bg-transparent outline-none">
            </div>

            ${
              hasActiveSessionFilter
                ? `
              <button id="attendance-clear-filters" type="button"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#92400E] bg-amber-50 hover:bg-amber-100 border border-amber-300 transition">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                Limpar
              </button>
            `
                : ''
            }
          </div>
        </div>

        <div class="p-5">
          ${
            !activeSession
              ? `
            <div class="text-center py-8 space-y-2.5">
              <p class="text-sm font-semibold text-[#6D4C41]">Nenhuma celebração ou ensaio encontrado para os filtros selecionados.</p>
              ${
                hasActiveSessionFilter
                  ? `<button type="button" id="attendance-empty-clear" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#3E2723] hover:bg-[#5D4037] text-white transition">Limpar filtros</button>`
                  : ''
              }
            </div>
          `
              : activeSession.participants.length === 0
                ? `<p class="text-sm text-[#8D6E63] text-center py-6">Nenhum integrante vinculado a esta celebração ou ensaio.</p>`
                : `
            <div class="mb-4 flex items-center justify-between flex-wrap gap-2 text-xs text-[#6D4C41]">
              <div class="flex items-center gap-2 flex-wrap">
                ${renderPastoralPill(activeSession.pastoral, { compact: true })}
                ${
                  activeSession.date === todayISO
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D97706] text-white">HOJE</span>`
                    : ''
                }
                <span><strong>Local:</strong> ${escapeHtml(activeSession.location)} • <strong>Data:</strong> ${formatDateBR(activeSession.date)} (${escapeHtml(formatWeekdayBR(activeSession.date))}) às ${escapeHtml(activeSession.time)}</span>
              </div>
              <span class="font-bold text-[#3E2723]">${activeSession.participants.length} ${activeSession.participants.length === 1 ? 'integrante' : 'integrantes'} na chamada</span>
            </div>
            <div class="divide-y divide-[#E6DACE]/70 border border-[#E6DACE] rounded-xl overflow-hidden">
              ${activeSession.participants
                .map((p) => {
                  const currentStatus = sessionRecord[p.participantId] || '';
                  return `
                    <div class="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-[#FAF6F0]/80">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-sm text-[#3E2723]">${escapeHtml(p.name)}</span>
                        ${
                          p.isFamily
                            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-[#78350F] border border-amber-300">
                                <i data-lucide="users" class="w-3 h-3"></i>
                                Conta Familiar
                              </span>`
                            : ''
                        }
                      </div>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${['Presente', 'Falta Justificada', 'Falta']
                          .map((st) => {
                            const active = currentStatus === st;
                            const activeStyles =
                              st === 'Presente'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : st === 'Falta Justificada'
                                  ? 'bg-[#D97706] text-white border-[#D97706]'
                                  : 'bg-red-700 text-white border-red-700';
                            return `
                              <button type="button" data-mark-pid="${p.participantId}" data-mark-status="${st}"
                                class="px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                  active ? activeStyles : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#F5EFE6]'
                                }">
                                ${st}
                              </button>
                            `;
                          })
                          .join('')}
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </div>
      </section>

      <!-- Indicador Percentual por Integrante -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-[#E6DACE]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FDFBF7]">
          <div>
            <h4 class="text-base font-bold text-[#3E2723]">Indicador de Frequência Individual</h4>
            <p class="text-xs text-[#6D4C41]">Percentual calculado individualmente para cada integrante</p>
          </div>
          <select id="attendance-pastoral-filter"
            class="px-3 py-1.5 rounded-xl border border-[#E6DACE] bg-white text-xs font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
            <option value="all" ${summaryPastoralFilter === 'all' ? 'selected' : ''}>${generalAdmin ? 'Todas as Pastorais' : 'Todas que Coordeno'}</option>
            ${managedPastorals
              .map((p) => `<option value="${p.id}" ${summaryPastoralFilter === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`)
              .join('')}
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-[#FDFBF7] border-b border-[#E6DACE] text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">
                <th class="px-5 py-3">Integrante</th>
                <th class="px-4 py-3 text-center">Presente</th>
                <th class="px-4 py-3 text-center">Justificada</th>
                <th class="px-4 py-3 text-center">Falta</th>
                <th class="px-5 py-3 min-w-[180px]">Frequência</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E6DACE]/60">
              ${summaryParticipants
                .map((m) => {
                  const st = computeParticipantStats(m.participantId, summarySessionIds, attendanceMap);
                  const barColor =
                    st.percentage === null
                      ? 'bg-stone-300'
                      : st.percentage >= 75
                        ? 'bg-emerald-600'
                        : st.percentage >= 50
                          ? 'bg-[#D97706]'
                          : 'bg-red-600';
                  return `
                    <tr class="hover:bg-[#FAF6F0]/80">
                      <td class="px-5 py-3">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <p class="font-bold text-[#3E2723]">${escapeHtml(m.name)}</p>
                          ${
                            m.isFamily
                              ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-[#78350F] border border-amber-300">Conta Familiar</span>`
                              : ''
                          }
                        </div>
                        <div class="flex items-center gap-1 flex-wrap mt-1">
                          ${m.memberships.map((x) => renderPastoralPill(pastoralMap[x.pastoralId], { compact: true })).join('')}
                        </div>
                      </td>
                      <td class="px-4 py-3 text-center font-bold text-emerald-700">${st.present}</td>
                      <td class="px-4 py-3 text-center font-bold text-[#B45309]">${st.justified}</td>
                      <td class="px-4 py-3 text-center font-bold text-red-700">${st.absent}</td>
                      <td class="px-5 py-3">
                        <div class="flex items-center gap-2.5">
                          <div class="flex-1 h-2 rounded-full bg-[#F5EFE6] overflow-hidden">
                            <div class="h-full rounded-full ${barColor}" style="width: ${st.percentage ?? 0}%"></div>
                          </div>
                          <span class="text-xs font-extrabold text-[#3E2723] w-10 text-right">
                            ${st.percentage === null ? '—' : `${st.percentage}%`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  container.querySelector('#attendance-session-select')?.addEventListener('change', (e) => {
    selectedSessionId = e.target.value;
    renderAttendance(container, { user, permissions });
  });

  container.querySelectorAll('[data-att-pastoral]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sessionPastoralFilter = btn.dataset.attPastoral || 'all';
      selectedSessionId = null;
      renderAttendance(container, { user, permissions });
    });
  });

  container.querySelector('#attendance-period-filter')?.addEventListener('change', (e) => {
    sessionPeriodFilter = e.target.value || 'all';
    sessionDateFilter = '';
    selectedSessionId = null;
    renderAttendance(container, { user, permissions });
  });

  container.querySelector('#attendance-date-filter')?.addEventListener('change', (e) => {
    sessionDateFilter = e.target.value || '';
    if (sessionDateFilter) sessionPeriodFilter = 'all';
    selectedSessionId = null;
    renderAttendance(container, { user, permissions });
  });

  const resetSessionFilters = () => {
    sessionPastoralFilter = 'all';
    sessionPeriodFilter = 'all';
    sessionDateFilter = '';
    selectedSessionId = null;
    renderAttendance(container, { user, permissions });
  };
  container.querySelector('#attendance-clear-filters')?.addEventListener('click', resetSessionFilters);
  container.querySelector('#attendance-empty-clear')?.addEventListener('click', resetSessionFilters);

  container.querySelector('#attendance-pastoral-filter')?.addEventListener('change', (e) => {
    summaryPastoralFilter = e.target.value;
    renderAttendance(container, { user, permissions });
  });

  container.querySelectorAll('[data-mark-pid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!activeSession) return;
      dataService.setAttendanceStatus(activeSession.id, btn.dataset.markPid, btn.dataset.markStatus);
      showToast(`Presença registrada: ${btn.dataset.markStatus}.`);
      renderAttendance(container, { user, permissions });
    });
  });

  refreshIcons();
}

function renderMemberAttendanceView(container, { user, sessions, attendanceMap }) {
  const allIds = sessions.map((s) => s.id);
  const members = getAccountMembers(user);
  const isFam = isFamilyAccount(user);

  const memberBlocks = members.map((member) => {
    const stats = computeParticipantStats(member.id, allIds, attendanceMap);
    const history = sessions
      .map((s) => {
        const status = attendanceMap[s.id]?.[member.id];
        if (!status) return null;
        return { ...s, status };
      })
      .filter(Boolean);
    return { member, stats, history };
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-xl font-extrabold text-[#3E2723]">${isFam ? 'Frequência da Família' : 'Minha Frequência'}</h3>
            ${renderFamilyAccountBadge(user)}
          </div>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${
              isFam
                ? 'Acompanhe individualmente a frequência de cada irmão vinculado a esta conta.'
                : 'Acompanhe sua participação consolidada em todas as pastorais em que atua.'
            }
          </p>
        </div>
      </div>

      ${memberBlocks
        .map(({ member, stats, history }) => {
          return `
            <div class="space-y-4 ${isFam ? 'p-5 rounded-2xl bg-[#FAF6F0]/70 border border-[#E6DACE]' : ''}">
              ${
                isFam
                  ? `<div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-[#B45309]"></span>
                      <h4 class="text-base font-extrabold text-[#3E2723]">${escapeHtml(member.name)}</h4>
                    </div>`
                  : ''
              }

              <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div class="bg-[#3E2723] text-white rounded-2xl p-5 shadow-sm">
                  <p class="text-xs font-bold uppercase tracking-wider text-amber-400">Frequência Geral</p>
                  <p class="text-3xl font-extrabold mt-2">${stats.percentage === null ? '—' : `${stats.percentage}%`}</p>
                  <div class="mt-3 h-2 rounded-full bg-white/15 overflow-hidden">
                    <div class="h-full rounded-full bg-amber-400" style="width: ${stats.percentage ?? 0}%"></div>
                  </div>
                </div>
                <div class="bg-white rounded-2xl border border-emerald-200 p-5">
                  <p class="text-xs font-bold uppercase tracking-wider text-emerald-800">Presenças</p>
                  <p class="text-3xl font-extrabold text-[#3E2723] mt-2">${stats.present}</p>
                </div>
                <div class="bg-white rounded-2xl border border-amber-300 p-5">
                  <p class="text-xs font-bold uppercase tracking-wider text-[#B45309]">Faltas Justificadas</p>
                  <p class="text-3xl font-extrabold text-[#3E2723] mt-2">${stats.justified}</p>
                </div>
                <div class="bg-white rounded-2xl border border-red-200 p-5">
                  <p class="text-xs font-bold uppercase tracking-wider text-red-700">Faltas</p>
                  <p class="text-3xl font-extrabold text-[#3E2723] mt-2">${stats.absent}</p>
                </div>
              </div>

              <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
                <div class="px-6 py-3.5 border-b border-[#E6DACE]/80 bg-[#FDFBF7]">
                  <h4 class="text-sm font-bold text-[#3E2723]">Histórico de Chamadas ${isFam ? `— ${escapeHtml(member.name)}` : ''}</h4>
                </div>
                <div class="divide-y divide-[#E6DACE]/60">
                  ${
                    history.length === 0
                      ? `<p class="p-6 text-center text-sm text-[#8D6E63]">Nenhuma chamada registrada ainda para ${escapeHtml(member.name)}.</p>`
                      : history
                          .map((h) => {
                            const badge =
                              h.status === 'Presente'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : h.status === 'Falta Justificada'
                                  ? 'bg-amber-50 text-[#92400E] border-amber-300'
                                  : 'bg-red-50 text-red-700 border-red-200';
                            return `
                              <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div class="space-y-1">
                                  <div class="flex items-center gap-2 flex-wrap">
                                    ${renderPastoralPill(h.pastoral, { compact: true })}
                                    <span class="text-sm font-bold text-[#3E2723]">${escapeHtml(h.title)}</span>
                                  </div>
                                  <p class="text-xs text-[#6D4C41]">${escapeHtml(formatDateBR(h.date))} às ${escapeHtml(h.time)} • ${escapeHtml(h.location)}</p>
                                </div>
                                <span class="self-start sm:self-center inline-flex px-3 py-1 rounded-full text-xs font-bold border ${badge}">
                                  ${escapeHtml(h.status)}
                                </span>
                              </div>
                            `;
                          })
                          .join('')
                  }
                </div>
              </section>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  refreshIcons();
}
