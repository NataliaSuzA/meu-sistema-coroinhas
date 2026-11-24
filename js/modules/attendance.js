/**
 * Módulo 11: Presença
 * - Lista de chamadas vinculadas às missas/escalas e ensaios/eventos
 * - Coordenação marca Presente, Falta Justificada ou Falta -> gera percentual por membro
 * - Acólitos e Coroinhas visualizam sua própria frequência e histórico detalhado
 */

import { dataService } from '../services/dataService.js';
import {
  escapeHtml,
  formatDateBR,
  getCategoryBadgeClass,
  isCoordinator,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

let selectedSessionId = null;
let summaryCategoryFilter = 'Todas';

function buildAttendanceSessions(schedules, events, users) {
  const activeUsers = users.filter((u) => u.status === 'Ativo');
  const sessions = [];

  schedules.forEach((sch) => {
    const memberIds = Array.from(new Set(sch.assignments.map((a) => a.userId)));
    sessions.push({
      id: sch.id,
      kind: 'Missa / Escala',
      title: `${sch.celebrationType} — ${sch.location} (${sch.category})`,
      date: sch.date,
      time: sch.time,
      location: sch.location,
      memberIds,
    });
  });

  events.forEach((evt) => {
    const invited = activeUsers
      .filter((u) => evt.audience === 'Todos' || u.category === evt.audience)
      .map((u) => u.id);
    sessions.push({
      id: evt.id,
      kind: evt.type,
      title: evt.title,
      date: evt.date,
      time: evt.time,
      location: evt.location,
      memberIds: invited,
    });
  });

  return sessions.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

function computeMemberStats(userId, attendanceMap) {
  let present = 0;
  let justified = 0;
  let absent = 0;

  Object.values(attendanceMap).forEach((sessionRecord) => {
    const status = sessionRecord?.[userId];
    if (status === 'Presente') present += 1;
    else if (status === 'Falta Justificada') justified += 1;
    else if (status === 'Falta') absent += 1;
  });

  const total = present + justified + absent;
  const percentage = total === 0 ? null : Math.round((present / total) * 100);
  return { present, justified, absent, total, percentage };
}

export function renderAttendance(container, { user }) {
  const coord = isCoordinator(user);
  const users = dataService.getUsers();
  const schedules = dataService.getSchedules();
  const events = dataService.getEvents();
  const attendanceMap = dataService.getAttendanceMap();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const sessions = buildAttendanceSessions(schedules, events, users);

  if (!coord) {
    renderMemberAttendanceView(container, { user, sessions, attendanceMap });
    return;
  }

  if (!selectedSessionId || !sessions.some((s) => s.id === selectedSessionId)) {
    selectedSessionId = sessions[0]?.id || null;
  }

  const activeSession = sessions.find((s) => s.id === selectedSessionId) || null;
  const sessionRecord = activeSession ? attendanceMap[activeSession.id] || {} : {};

  const filteredSummaryUsers = users.filter(
    (u) => summaryCategoryFilter === 'Todas' || u.category === summaryCategoryFilter,
  );

  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h3 class="text-xl font-extrabold text-[#0F172A]">Controle de Presença &amp; Frequência</h3>
        <p class="text-sm text-slate-500 mt-0.5">
          Registre chamadas nas missas escaladas e ensaios para acompanhar o índice de frequência da pastoral.
        </p>
      </div>

      <!-- Chamada da Sessão Selecionada -->
      <section class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="px-6 py-4 bg-[#0F172A] text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wider text-amber-400">Lista de Chamada</p>
            <h4 class="text-base font-bold mt-0.5">Registrar presença por celebração ou ensaio</h4>
          </div>
          <select id="attendance-session-select"
            class="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm font-semibold outline-none focus:border-amber-400 max-w-md">
            ${sessions
              .map(
                (s) => `<option value="${s.id}" ${s.id === selectedSessionId ? 'selected' : ''}>${formatDateBR(s.date)} ${s.time} • [${s.kind}] ${escapeHtml(s.title)}</option>`,
              )
              .join('')}
          </select>
        </div>

        <div class="p-5">
          ${
            !activeSession || activeSession.memberIds.length === 0
              ? `<p class="text-sm text-slate-500 text-center py-6">Nenhum membro vinculado a esta celebração ou evento.</p>`
              : `
            <div class="mb-4 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
              <span><strong>Local:</strong> ${escapeHtml(activeSession.location)} • <strong>Data:</strong> ${formatDateBR(activeSession.date)} às ${escapeHtml(activeSession.time)}</span>
              <span>${activeSession.memberIds.length} membros na lista</span>
            </div>
            <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              ${activeSession.memberIds
                .map((uid) => {
                  const member = userMap[uid];
                  if (!member) return '';
                  const currentStatus = sessionRecord[uid] || '';
                  return `
                    <div class="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/80">
                      <div class="flex items-center gap-2.5">
                        <span class="font-bold text-sm text-[#0F172A]">${escapeHtml(member.name)}</span>
                        <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(member.category)}">${escapeHtml(member.category)}</span>
                      </div>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${['Presente', 'Falta Justificada', 'Falta']
                          .map((st) => {
                            const active = currentStatus === st;
                            const activeStyles =
                              st === 'Presente'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : st === 'Falta Justificada'
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-red-600 text-white border-red-600';
                            return `
                              <button type="button" data-mark-uid="${uid}" data-mark-status="${st}"
                                class="px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                  active ? activeStyles : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
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

      <!-- Indicador Percentual de Frequência por Membro -->
      <section class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h4 class="text-base font-bold text-[#0F172A]">Indicador de Frequência por Membro</h4>
            <p class="text-xs text-slate-500">Percentual calculado automaticamente com base nas chamadas registradas</p>
          </div>
          <select id="attendance-cat-filter"
            class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-[#1E3A8A]">
            ${['Todas', 'Coordenador', 'Acólito', 'Coroinha']
              .map((c) => `<option value="${c}" ${summaryCategoryFilter === c ? 'selected' : ''}>Categoria: ${c}</option>`)
              .join('')}
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th class="px-5 py-3">Membro</th>
                <th class="px-4 py-3 text-center">Presente</th>
                <th class="px-4 py-3 text-center">Justificada</th>
                <th class="px-4 py-3 text-center">Falta</th>
                <th class="px-5 py-3 min-w-[180px]">Frequência</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${filteredSummaryUsers
                .map((m) => {
                  const st = computeMemberStats(m.id, attendanceMap);
                  const barColor =
                    st.percentage === null
                      ? 'bg-slate-300'
                      : st.percentage >= 75
                        ? 'bg-emerald-500'
                        : st.percentage >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500';
                  return `
                    <tr class="hover:bg-slate-50/80">
                      <td class="px-5 py-3">
                        <p class="font-bold text-[#0F172A]">${escapeHtml(m.name)}</p>
                        <span class="inline-flex mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(m.category)}">${escapeHtml(m.category)}</span>
                      </td>
                      <td class="px-4 py-3 text-center font-bold text-emerald-700">${st.present}</td>
                      <td class="px-4 py-3 text-center font-bold text-amber-700">${st.justified}</td>
                      <td class="px-4 py-3 text-center font-bold text-red-600">${st.absent}</td>
                      <td class="px-5 py-3">
                        <div class="flex items-center gap-2.5">
                          <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div class="h-full rounded-full ${barColor}" style="width: ${st.percentage ?? 0}%"></div>
                          </div>
                          <span class="text-xs font-extrabold text-[#0F172A] w-10 text-right">
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
    renderAttendance(container, { user });
  });

  container.querySelector('#attendance-cat-filter')?.addEventListener('change', (e) => {
    summaryCategoryFilter = e.target.value;
    renderAttendance(container, { user });
  });

  container.querySelectorAll('[data-mark-uid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!activeSession) return;
      dataService.setAttendanceStatus(activeSession.id, btn.dataset.markUid, btn.dataset.markStatus);
      showToast(`Presença registrada: ${btn.dataset.markStatus}.`);
      renderAttendance(container, { user });
    });
  });

  refreshIcons();
}

function renderMemberAttendanceView(container, { user, sessions, attendanceMap }) {
  const stats = computeMemberStats(user.id, attendanceMap);
  const myHistory = sessions
    .map((s) => {
      const status = attendanceMap[s.id]?.[user.id];
      if (!status) return null;
      return { ...s, status };
    })
    .filter(Boolean);

  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h3 class="text-xl font-extrabold text-[#0F172A]">Minha Frequência</h3>
        <p class="text-sm text-slate-500 mt-0.5">
          Acompanhe sua participação nas missas escaladas e ensaios da pastoral.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="bg-[#0F172A] text-white rounded-2xl p-5 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-wider text-amber-400">Frequência Geral</p>
          <p class="text-3xl font-extrabold mt-2">${stats.percentage === null ? '—' : `${stats.percentage}%`}</p>
          <div class="mt-3 h-2 rounded-full bg-white/15 overflow-hidden">
            <div class="h-full rounded-full bg-amber-400" style="width: ${stats.percentage ?? 0}%"></div>
          </div>
        </div>
        <div class="bg-white rounded-2xl border border-emerald-200 p-5">
          <p class="text-xs font-bold uppercase tracking-wider text-emerald-700">Presenças</p>
          <p class="text-3xl font-extrabold text-[#0F172A] mt-2">${stats.present}</p>
        </div>
        <div class="bg-white rounded-2xl border border-amber-200 p-5">
          <p class="text-xs font-bold uppercase tracking-wider text-amber-700">Faltas Justificadas</p>
          <p class="text-3xl font-extrabold text-[#0F172A] mt-2">${stats.justified}</p>
        </div>
        <div class="bg-white rounded-2xl border border-red-200 p-5">
          <p class="text-xs font-bold uppercase tracking-wider text-red-600">Faltas</p>
          <p class="text-3xl font-extrabold text-[#0F172A] mt-2">${stats.absent}</p>
        </div>
      </div>

      <section class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <h4 class="text-base font-bold text-[#0F172A]">Histórico de Chamadas</h4>
        </div>
        <div class="divide-y divide-slate-100">
          ${
            myHistory.length === 0
              ? `<p class="p-8 text-center text-sm text-slate-500">Nenhuma chamada registrada ainda para o seu perfil.</p>`
              : myHistory
                  .map((h) => {
                    const badge =
                      h.status === 'Presente'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : h.status === 'Falta Justificada'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200';
                    return `
                      <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p class="text-sm font-bold text-[#0F172A]">${escapeHtml(h.title)}</p>
                          <p class="text-xs text-slate-500">${escapeHtml(formatDateBR(h.date))} às ${escapeHtml(h.time)} • ${escapeHtml(h.location)}</p>
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

  refreshIcons();
}
