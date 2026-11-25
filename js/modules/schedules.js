/**
 * Módulo 2: Escalas Multi-Pastoral com Isolamento Estrito + Aba Padrão "Minhas Datas"
 * - Aba padrão: "Minhas Datas" (reutiliza renderMyDatesContent com contagem regressiva)
 * - Usuário só visualiza escalas/abas das pastorais das quais faz parte (Membro ou Coordenador)
 * - Dentro das suas pastorais, vê a escala completa da equipe para saber com quem vai servir
 * - Respeita permissão dinâmica 'schedules_manage' da Matriz de Permissões
 */

import { dataService } from '../services/dataService.js';
import { renderMyDatesContent } from './myDates.js';
import {
  buildUserTimeSlotIndex,
  canManagePastoral,
  canManageSchedule,
  closeModal,
  escapeHtml,
  findConflictsForMember,
  formatDateBR,
  formatWeekdayBR,
  getCoordinatedPastoralIds,
  getCountdownBadge,
  getMemberPastoralIds,
  getTodayISO,
  hasPermission,
  hasTimeConflict,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

const CELEBRATION_TYPES = [
  'Missa Dominical',
  'Solenidade',
  'Tríduo',
  'Missa Semanal',
  'Adoração ao Santíssimo',
  'Celebração Especial',
];

const DEFAULT_LOCATIONS = [
  'Matriz Santa Teresa',
  'Igreja São Francisco',
  'Capela Santa Teresinha',
];

let activeTab = 'my_dates';

export function resetSchedulesTab() {
  activeTab = 'my_dates';
}

export function renderSchedules(container, { user, setHeaderContext, permissions }) {
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const coordPastoralIds = getCoordinatedPastoralIds(user, pastorals);
  const accessiblePastoralIds = getMemberPastoralIds(user, pastorals);
  const accessiblePastorals = pastorals.filter((p) => accessiblePastoralIds.includes(p.id));
  const generalAdmin = isGeneralAdmin(user);
  const canCreateEdit = hasPermission(user, 'schedules_manage', permissions) && coordPastoralIds.length > 0;

  const schedules = dataService
    .getSchedules()
    .slice()
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const users = dataService.getUsers();
  const roles = dataService.getRoles();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));
  const slotIndex = buildUserTimeSlotIndex(schedules);

  if (activeTab !== 'my_dates' && activeTab !== 'all_managed' && !accessiblePastoralIds.includes(activeTab)) {
    activeTab = 'my_dates';
  }
  if (activeTab === 'all_managed' && !generalAdmin) {
    activeTab = 'my_dates';
  }

  const selectedPastoral = pastoralMap[activeTab] || null;
  const dynamicTitle = selectedPastoral ? selectedPastoral.name : 'Visão Geral das Pastorais';
  setHeaderContext?.('Escalas', dynamicTitle);

  const tabs = [
    { id: 'my_dates', label: 'Minhas Datas', icon: 'calendar-clock', managed: false },
    ...(generalAdmin ? [{ id: 'all_managed', label: 'Todas as Pastorais', icon: 'layers', managed: true }] : []),
    ...accessiblePastorals.map((p) => ({
      id: p.id,
      label: p.shortName,
      color: p.color,
      managed: canCreateEdit && canManagePastoral(user, p.id),
    })),
  ];

  const myAssignmentsCount = schedules.reduce(
    (sum, s) => sum + (s.assignments || []).filter((a) => a.userId === user.id).length,
    0,
  );

  const filtered = schedules.filter((sch) => {
    if (activeTab === 'all_managed') return true;
    return sch.pastoralId === activeTab || (sch.assignments || []).some((a) => a.pastoralId === activeTab);
  });

  const pendingSubCount = canCreateEdit
    ? schedules.reduce(
        (sum, s) =>
          sum +
          (s.assignments || []).filter(
            (a) => a.substitutionRequested && canManagePastoral(user, a.pastoralId || s.pastoralId),
          ).length,
        0,
      )
    : 0;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full mb-1.5">
            <i data-lucide="layers" class="w-3 h-3"></i>
            ${escapeHtml(dynamicTitle)}
          </span>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Escalas das Minhas Pastorais</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Você visualiza apenas as escalas das pastorais em que participa, com a equipe completa de cada celebração.
          </p>
        </div>

        ${
          canCreateEdit
            ? `
          <button id="btn-new-schedule" type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition shrink-0">
            <i data-lucide="plus-circle" class="w-4 h-4 text-amber-400"></i>
            Nova Escala
          </button>
        `
            : ''
        }
      </div>

      ${
        pendingSubCount > 0
          ? `
        <div class="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3.5 flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0">
            <i data-lucide="alert-triangle" class="w-4 h-4"></i>
          </div>
          <p class="text-sm text-[#4E342E] font-medium">
            Há <strong>${pendingSubCount}</strong> ${pendingSubCount === 1 ? 'solicitação de substituição pendente' : 'solicitações de substituição pendentes'} nas pastorais sob sua coordenação.
          </p>
        </div>
      `
          : ''
      }

      <!-- Abas Isoladas por Pastoral -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        ${tabs
          .map((t) => {
            const isActive = activeTab === t.id;
            const count =
              t.id === 'my_dates'
                ? myAssignmentsCount
                : t.id === 'all_managed'
                  ? schedules.length
                  : schedules.filter((s) => s.pastoralId === t.id || (s.assignments || []).some((a) => a.pastoralId === t.id)).length;

            return `
              <button type="button" data-tab="${t.id}"
                class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap border transition ${
                  isActive
                    ? 'bg-[#3E2723] text-white border-[#3E2723] shadow-sm'
                    : 'bg-white text-[#5D4037] border-[#E6DACE] hover:border-[#D7C4B2] hover:bg-[#FDFBF7]'
                }">
                ${
                  t.color
                    ? `<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color:${escapeHtml(t.color)};"></span>`
                    : `<i data-lucide="${t.icon}" class="w-4 h-4 ${isActive ? 'text-amber-400' : 'text-[#8D6E63]'}"></i>`
                }
                ${escapeHtml(t.label)}
                ${
                  t.id !== 'my_dates' && t.id !== 'all_managed' && !generalAdmin
                    ? `<span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                        t.managed
                          ? isActive
                            ? 'bg-amber-500/25 text-amber-300'
                            : 'bg-amber-50 text-[#B45309] border border-amber-200'
                          : isActive
                            ? 'bg-white/15 text-amber-100'
                            : 'bg-[#F5EFE6] text-[#6D4C41]'
                      }">${t.managed ? 'Gestão' : 'Equipe'}</span>`
                    : ''
                }
                <span class="px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                  isActive ? 'bg-amber-500/25 text-amber-300' : 'bg-[#F5EFE6] text-[#5D4037]'
                }">${count}</span>
              </button>
            `;
          })
          .join('')}
      </div>

      <!-- Conteúdo da Aba -->
      <div id="schedules-tab-body"></div>
    </div>
  `;

  const tabBody = container.querySelector('#schedules-tab-body');

  if (activeTab === 'my_dates') {
    renderMyDatesContent(tabBody, {
      user,
      compactHeader: true,
      onChanged: () => renderSchedules(container, { user, setHeaderContext, permissions }),
    });
  } else if (filtered.length === 0) {
    tabBody.innerHTML = `
      <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
        <i data-lucide="calendar-x" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
        <h4 class="text-base font-bold text-[#3E2723]">Nenhuma escala cadastrada para esta pastoral ainda</h4>
      </div>
    `;
  } else {
    tabBody.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        ${filtered
          .map((sch) => renderScheduleCard(sch, { user, canCreateEdit, userMap, roleMap, pastoralMap, slotIndex }))
          .join('')}
      </div>
    `;
  }

  container.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderSchedules(container, { user, setHeaderContext, permissions });
    });
  });

  container.querySelector('#btn-new-schedule')?.addEventListener('click', () => {
    const defaultPastoralId = coordPastoralIds.includes(activeTab) ? activeTab : coordPastoralIds[0];
    openScheduleModal(null, { user, defaultPastoralId }, () =>
      renderSchedules(container, { user, setHeaderContext, permissions }),
    );
  });

  tabBody.querySelectorAll('[data-edit-schedule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sch = dataService.getScheduleById(btn.dataset.editSchedule);
      if (sch && canCreateEdit && canManageSchedule(user, sch)) {
        openScheduleModal(sch, { user, defaultPastoralId: sch.pastoralId }, () =>
          renderSchedules(container, { user, setHeaderContext, permissions }),
        );
      }
    });
  });

  tabBody.querySelectorAll('[data-delete-schedule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sch = dataService.getScheduleById(btn.dataset.deleteSchedule);
      if (!sch || !canCreateEdit || !canManageSchedule(user, sch)) return;
      if (!confirm('Deseja realmente excluir esta escala? Ela também será removida da Agenda sincronizada.')) return;
      dataService.deleteSchedule(sch.id);
      showToast('Escala excluída com sucesso.');
      renderSchedules(container, { user, setHeaderContext, permissions });
    });
  });

  tabBody.querySelectorAll('[data-request-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openSubstitutionModal(btn.dataset.scheduleId, btn.dataset.requestSub, () =>
        renderSchedules(container, { user, setHeaderContext, permissions }),
      );
    });
  });

  tabBody.querySelectorAll('[data-reassign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openReassignModal(btn.dataset.scheduleId, btn.dataset.reassign, user, () =>
        renderSchedules(container, { user, setHeaderContext, permissions }),
      );
    });
  });

  refreshIcons();
}

function renderScheduleCard(sch, { user, canCreateEdit, userMap, roleMap, pastoralMap, slotIndex }) {
  const isUserAssigned = (sch.assignments || []).some((a) => a.userId === user.id);
  const canEdit = canCreateEdit && canManageSchedule(user, sch);
  const countdown = getCountdownBadge(sch.date);
  const isPast = countdown.diffDays < 0;
  const mainPastoral = pastoralMap[sch.pastoralId];
  const userHasConflictHere = isUserAssigned && hasTimeConflict(slotIndex, user.id, sch.date, sch.time);

  return `
    <article class="bg-white rounded-2xl border-2 ${
      isUserAssigned ? 'user-schedule-card' : 'border-[#E6DACE]'
    } overflow-hidden flex flex-col justify-between transition">
      <div>
        <div class="px-5 py-4 border-b ${
          isUserAssigned ? 'bg-gradient-to-r from-amber-50/90 via-[#FDFBF7] to-white border-amber-200' : 'bg-[#FDFBF7] border-[#E6DACE]/80'
        }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1.5">
                ${
                  isUserAssigned
                    ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#D97706] text-white shadow-xs">
                        <i data-lucide="star" class="w-3 h-3"></i>
                        Sua Escala
                      </span>`
                    : ''
                }
                ${renderPastoralPill(mainPastoral)}
                <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${countdown.cls}">
                  ${escapeHtml(countdown.label)}
                </span>
              </div>
              <h4 class="text-base font-extrabold text-[#3E2723]">${escapeHtml(sch.celebrationType)}</h4>
              <div class="flex items-center gap-3 flex-wrap text-xs text-[#5D4037] mt-1.5">
                <span class="inline-flex items-center gap-1 font-semibold text-[#4E342E]">
                  <i data-lucide="calendar" class="w-3.5 h-3.5 text-[#B45309]"></i>
                  ${escapeHtml(formatDateBR(sch.date))} (${escapeHtml(formatWeekdayBR(sch.date))})
                </span>
                <span class="inline-flex items-center gap-1 font-extrabold text-[#3E2723]">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-[#D97706]"></i>
                  ${escapeHtml(sch.time)}
                </span>
              </div>
              <p class="inline-flex items-center gap-1 text-xs text-[#6D4C41] mt-1">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-[#B45309]"></i>
                ${escapeHtml(sch.location)}
              </p>
            </div>

            ${
              canEdit
                ? `
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-edit-schedule="${sch.id}" title="Editar escala"
                  class="p-2 rounded-lg text-[#6D4C41] hover:text-[#3E2723] hover:bg-[#F5EFE6] transition">
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" data-delete-schedule="${sch.id}" title="Excluir escala"
                  class="p-2 rounded-lg text-[#6D4C41] hover:text-red-700 hover:bg-red-50 transition">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            `
                : ''
            }
          </div>

          ${
            userHasConflictHere
              ? `
            <div class="mt-3 rounded-xl bg-amber-100/90 border border-amber-300 px-3 py-2 text-xs text-amber-950 font-medium flex items-center gap-2">
              <i data-lucide="clock-alert" class="w-4 h-4 text-[#B45309] shrink-0"></i>
              <span><strong>Atenção amigável:</strong> Você possui outra escala neste mesmo dia e horário.</span>
            </div>
          `
              : ''
          }
        </div>

        <div class="p-5 space-y-2.5">
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#8D6E63]">Equipe Escalada</p>
          ${(sch.assignments || [])
            .map((asg) => {
              const member = userMap[asg.userId];
              const role = roleMap[asg.roleId];
              const asgPastoral = pastoralMap[asg.pastoralId] || mainPastoral;
              const isMine = asg.userId === user.id;
              const canReassign = canCreateEdit && canManagePastoral(user, asg.pastoralId || sch.pastoralId);

              return `
                <div class="rounded-xl p-3 border ${
                  asg.substitutionRequested
                    ? 'bg-red-50/70 border-red-200'
                    : isMine
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-[#FAF6F0] border-[#E6DACE]'
                }">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="min-w-0 space-y-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${renderPastoralPill(asgPastoral, { compact: true })}
                        <span class="text-[11px] font-bold uppercase tracking-wider ${isMine ? 'text-[#B45309]' : 'text-[#5D4037]'}">
                          ${escapeHtml(role?.name || 'Função')}
                        </span>
                      </div>
                      <p class="text-sm font-bold text-[#3E2723] flex items-center gap-1.5 flex-wrap">
                        ${escapeHtml(member?.name || 'Membro não encontrado')}
                        ${isMine ? '<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200 text-[#78350F]">Você</span>' : ''}
                      </p>
                    </div>

                    <div class="flex items-center gap-1.5 flex-wrap">
                      ${
                        asg.substitutionRequested
                          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                              <i data-lucide="alert-circle" class="w-3 h-3"></i>
                              Substituição Solicitada
                            </span>`
                          : ''
                      }
                      ${
                        isMine && !asg.substitutionRequested && !isPast
                          ? `<button type="button" data-request-sub="${asg.id}" data-schedule-id="${sch.id}"
                              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#92400E] bg-white hover:bg-amber-50 border border-amber-300 transition">
                              <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                              Solicitar Substituição
                            </button>`
                          : ''
                      }
                      ${
                        canReassign && asg.substitutionRequested
                          ? `<button type="button" data-reassign="${asg.id}" data-schedule-id="${sch.id}"
                              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#3E2723] hover:bg-[#5D4037] transition">
                              <i data-lucide="user-check" class="w-3 h-3 text-amber-400"></i>
                              Reatribuir
                            </button>`
                          : ''
                      }
                    </div>
                  </div>
                  ${
                    asg.substitutionRequested && asg.substitutionReason
                      ? `<p class="mt-2 text-xs text-red-800 bg-white/85 rounded-lg px-2.5 py-1.5 border border-red-200">
                          <strong>Motivo:</strong> ${escapeHtml(asg.substitutionReason)}
                        </p>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      ${
        sch.notes
          ? `
        <div class="px-5 py-3 bg-[#FDFBF7] border-t border-[#E6DACE]/80 text-xs text-[#6D4C41] flex items-start gap-2">
          <i data-lucide="info" class="w-3.5 h-3.5 text-[#8D6E63] shrink-0 mt-0.5"></i>
          <span>${escapeHtml(sch.notes)}</span>
        </div>
      `
          : ''
      }
    </article>
  `;
}

function openScheduleModal(existing, { user, defaultPastoralId }, onSaved) {
  const allPastorals = dataService.getActivePastorals();
  const managedIds = new Set(getCoordinatedPastoralIds(user, allPastorals));
  const managedPastorals = allPastorals.filter((p) => managedIds.has(p.id));

  if (managedPastorals.length === 0) {
    showToast('Você não possui pastorais sob sua coordenação para criar escalas.', 'error');
    return;
  }

  const allSchedules = dataService.getSchedules();
  const pastoralMap = Object.fromEntries(allPastorals.map((p) => [p.id, p]));
  const roleMap = Object.fromEntries(dataService.getRoles().map((r) => [r.id, r]));

  openModal({
    title: existing ? 'Editar Escala' : 'Nova Escala Multi-Pastoral',
    maxWidth: 'max-w-3xl',
    bodyHtml: `
      <form id="schedule-form" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Data *</label>
            <input id="sch-date-input" name="date" type="date" required value="${escapeHtml(existing?.date || getTodayISO())}"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Horário *</label>
            <input id="sch-time-input" name="time" type="time" required value="${escapeHtml(existing?.time || '19:00')}"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Local / Igreja *</label>
            <input name="location" list="church-locations" required value="${escapeHtml(existing?.location || 'Matriz Santa Teresa')}"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
            <datalist id="church-locations">
              ${DEFAULT_LOCATIONS.map((loc) => `<option value="${escapeHtml(loc)}"></option>`).join('')}
            </datalist>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Tipo de Celebração *</label>
            <select name="celebrationType" required class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm bg-white focus:border-[#B45309] outline-none">
              ${CELEBRATION_TYPES.map((type) => `<option value="${escapeHtml(type)}" ${existing?.celebrationType === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="schedule-conflict-banner" class="hidden rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 space-y-1"></div>

        <div class="pt-2 border-t border-[#E6DACE]/80">
          <div class="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <div>
              <label class="text-xs font-bold uppercase tracking-wider text-[#3E2723]">Posições da Escala</label>
              <p class="text-[11px] text-[#6D4C41]">Escolha primeiro a <strong>Pastoral</strong>, depois a <strong>Função</strong> e o <strong>Membro ativo</strong>.</p>
            </div>
            <button id="btn-add-position-row" type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-[#92400E] border border-amber-300 transition">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              Adicionar Posição
            </button>
          </div>
          <div id="positions-list" class="space-y-2.5"></div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Observações</label>
          <textarea name="notes" rows="2" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.notes || '')}</textarea>
        </div>

        <div class="flex justify-end gap-2.5 pt-3 border-t border-[#E6DACE]/80">
          <button type="button" id="cancel-modal-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">${existing ? 'Salvar Alterações' : 'Publicar Escala'}</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const listEl = bodyEl.querySelector('#positions-list');
      const dateInput = bodyEl.querySelector('#sch-date-input');
      const timeInput = bodyEl.querySelector('#sch-time-input');
      const conflictBanner = bodyEl.querySelector('#schedule-conflict-banner');

      function updateConflictWarnings() {
        const date = dateInput.value;
        const time = timeInput.value;
        const warnings = [];
        const pickedInForm = {};

        listEl.querySelectorAll('.position-row').forEach((row) => {
          const uid = row.querySelector('.pos-user').value;
          if (!uid) return;
          const memberName = dataService.getUserById(uid)?.name || 'Membro';
          pickedInForm[uid] = (pickedInForm[uid] || 0) + 1;
          if (pickedInForm[uid] === 2) {
            warnings.push(`<strong>${escapeHtml(memberName)}</strong> foi selecionado(a) em mais de uma posição nesta mesma escala.`);
          }
          const external = findConflictsForMember(allSchedules, uid, date, time, existing?.id);
          if (external.length > 0) {
            const detail = external
              .map((c) => `${pastoralMap[c.assignment.pastoralId]?.shortName || 'outra pastoral'} (${roleMap[c.assignment.roleId]?.name || 'função'})`)
              .join(', ');
            warnings.push(`<strong>${escapeHtml(memberName)}</strong> já possui escala em ${formatDateBR(date)} às ${escapeHtml(time)} em: ${escapeHtml(detail)}.`);
          }
        });

        if (warnings.length > 0) {
          conflictBanner.innerHTML = `
            <div class="flex items-start gap-2">
              <i data-lucide="clock-alert" class="w-4 h-4 text-[#B45309] shrink-0 mt-0.5"></i>
              <div class="space-y-0.5">
                <p class="font-bold text-[#92400E]">Aviso amigável de conflito de horário (permitido salvar):</p>
                ${warnings.map((w) => `<p>• ${w}</p>`).join('')}
              </div>
            </div>
          `;
          conflictBanner.classList.remove('hidden');
          refreshIcons();
        } else {
          conflictBanner.classList.add('hidden');
        }
      }

      function populateRolesAndMembers(row, pastoralId, presetRoleId = '', presetUserId = '') {
        const activeRoles = dataService.getActiveRolesByPastoral(pastoralId);
        const activeMembers = dataService.getActiveUsersByPastoral(pastoralId);
        row.querySelector('.pos-role').innerHTML = `
          <option value="">2. Função ativa...</option>
          ${activeRoles.map((r) => `<option value="${r.id}" ${presetRoleId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
        `;
        row.querySelector('.pos-user').innerHTML = `
          <option value="">3. Membro ativo...</option>
          ${activeMembers.map((u) => `<option value="${u.id}" ${presetUserId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
        `;
      }

      function addPositionRow(preset = null) {
        const rowPastoralId =
          preset?.pastoralId && managedIds.has(preset.pastoralId)
            ? preset.pastoralId
            : managedIds.has(defaultPastoralId)
              ? defaultPastoralId
              : managedPastorals[0].id;

        const row = document.createElement('div');
        row.className = 'position-row grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#FAF6F0] p-2.5 rounded-xl border border-[#E6DACE]';
        row.dataset.asgId = preset?.id || '';
        row.dataset.subReq = preset?.substitutionRequested ? '1' : '0';
        row.dataset.subReason = preset?.substitutionReason || '';

        row.innerHTML = `
          <div class="sm:col-span-4">
            <select class="pos-pastoral w-full px-2.5 py-2 rounded-lg border border-[#E6DACE] bg-white text-xs font-semibold text-[#3E2723] outline-none focus:border-[#B45309]" required>
              ${managedPastorals.map((p) => `<option value="${p.id}" ${rowPastoralId === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`).join('')}
            </select>
          </div>
          <div class="sm:col-span-3">
            <select class="pos-role w-full px-2.5 py-2 rounded-lg border border-[#E6DACE] bg-white text-xs font-medium outline-none focus:border-[#B45309]" required></select>
          </div>
          <div class="sm:col-span-4">
            <select class="pos-user w-full px-2.5 py-2 rounded-lg border border-[#E6DACE] bg-white text-xs font-medium outline-none focus:border-[#B45309]" required></select>
          </div>
          <div class="sm:col-span-1 flex justify-end">
            <button type="button" class="remove-pos-btn p-1.5 rounded-lg text-[#8D6E63] hover:text-red-700 hover:bg-red-50 transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        `;

        populateRolesAndMembers(row, rowPastoralId, preset?.roleId || '', preset?.userId || '');
        row.querySelector('.pos-pastoral').addEventListener('change', (e) => {
          populateRolesAndMembers(row, e.target.value);
          updateConflictWarnings();
        });
        row.querySelector('.pos-user').addEventListener('change', updateConflictWarnings);
        row.querySelector('.remove-pos-btn').addEventListener('click', () => {
          row.remove();
          updateConflictWarnings();
        });

        listEl.appendChild(row);
        refreshIcons();
        updateConflictWarnings();
      }

      if (existing?.assignments?.length) {
        existing.assignments.filter((a) => managedIds.has(a.pastoralId || existing.pastoralId)).forEach((a) => addPositionRow(a));
      } else {
        addPositionRow();
      }

      dateInput.addEventListener('change', updateConflictWarnings);
      timeInput.addEventListener('change', updateConflictWarnings);
      bodyEl.querySelector('#btn-add-position-row').addEventListener('click', () => addPositionRow());
      bodyEl.querySelector('#cancel-modal-btn').addEventListener('click', closeModal);

      bodyEl.querySelector('#schedule-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const edited = [];
        listEl.querySelectorAll('.position-row').forEach((row) => {
          const pastoralId = row.querySelector('.pos-pastoral').value;
          const roleId = row.querySelector('.pos-role').value;
          const userId = row.querySelector('.pos-user').value;
          if (pastoralId && roleId && userId) {
            edited.push({
              id: row.dataset.asgId || undefined,
              pastoralId,
              roleId,
              userId,
              substitutionRequested: row.dataset.subReq === '1',
              substitutionReason: row.dataset.subReason || '',
            });
          }
        });

        const preserved = (existing?.assignments || []).filter((a) => !managedIds.has(a.pastoralId || existing.pastoralId));
        const finalAssignments = [...preserved, ...edited];
        if (finalAssignments.length === 0) {
          showToast('Adicione pelo menos uma posição.', 'error');
          return;
        }

        dataService.saveSchedule({
          id: existing?.id,
          date: fd.get('date'),
          time: fd.get('time'),
          location: String(fd.get('location')).trim(),
          celebrationType: fd.get('celebrationType'),
          pastoralId: existing?.pastoralId || finalAssignments[0].pastoralId,
          notes: String(fd.get('notes') || '').trim(),
          assignments: finalAssignments,
        });

        closeModal();
        showToast(existing ? 'Escala atualizada!' : 'Escala publicada e sincronizada com a Agenda!');
        onSaved();
      });
    },
  });
}

function openSubstitutionModal(scheduleId, assignmentId, onDone) {
  openModal({
    title: 'Solicitar Substituição',
    bodyHtml: `
      <form id="sub-form" class="space-y-4">
        <p class="text-sm text-[#5D4037]">Informe o motivo da sua indisponibilidade para que a coordenação possa reatribuir outro membro.</p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1.5">Motivo *</label>
          <textarea name="reason" rows="3" required class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-sub-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037]">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold">Confirmar</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-sub-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#sub-form').addEventListener('submit', (e) => {
        e.preventDefault();
        dataService.requestSubstitution(scheduleId, assignmentId, String(new FormData(e.target).get('reason')));
        closeModal();
        showToast('Substituição solicitada!');
        onDone();
      });
    },
  });
}

function openReassignModal(scheduleId, assignmentId, user, onDone) {
  const sch = dataService.getScheduleById(scheduleId);
  if (!sch) return;
  const asg = sch.assignments.find((a) => a.id === assignmentId);
  if (!asg) return;
  const pastoralId = asg.pastoralId || sch.pastoralId;
  if (!canManagePastoral(user, pastoralId)) return;

  const pastoral = dataService.getPastoralById(pastoralId);
  const role = dataService.getRoleById(asg.roleId);
  const currentUser = dataService.getUserById(asg.userId);
  const candidates = dataService.getActiveUsersByPastoral(pastoralId);

  openModal({
    title: 'Reatribuir Membro na Escala',
    bodyHtml: `
      <form id="reassign-form" class="space-y-4">
        <div class="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-[#4E342E] space-y-1">
          <p><strong>Pastoral:</strong> ${escapeHtml(pastoral?.name || '—')}</p>
          <p><strong>Função:</strong> ${escapeHtml(role?.name || '—')}</p>
          <p><strong>Escalado atual:</strong> ${escapeHtml(currentUser?.name || '—')}</p>
          <p><strong>Motivo:</strong> ${escapeHtml(asg.substitutionReason || '—')}</p>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1.5">Novo Membro Ativo *</label>
          <select name="newUserId" required class="w-full px-3 py-2.5 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
            ${candidates.map((c) => `<option value="${c.id}" ${c.id === asg.userId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-reassign-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold">Salvar Reatribuição</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-reassign-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#reassign-form').addEventListener('submit', (e) => {
        e.preventDefault();
        dataService.reassignScheduleMember(scheduleId, assignmentId, String(new FormData(e.target).get('newUserId')));
        closeModal();
        showToast('Membro reatribuído com sucesso!');
        onDone();
      });
    },
  });
}
