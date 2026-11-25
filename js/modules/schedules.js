/**
 * Módulo 2: Escalas Multi-Pastoral v5
 * - Suporte individualizado a Contas Familiares (cada irmão pode ser escalado separadamente)
 * - Fluxo Completo de Aceite e Cancelamento de Substituição de Escala:
 *   * Banner "Pedidos de Substituição em Aberto" no topo de Escalas (apenas pastorais do usuário)
 *   * Botão verde "Assumir / Aceitar Substituição" com modal de confirmação (e seleção de irmão se Conta Familiar)
 *   * Troca automática do titular, selo "Substituição Confirmada", histórico "Substituindo [Nome]" e notificações
 *   * Botão "Cancelar Pedido de Substituição" para quem solicitou enquanto não aceito
 */

import { dataService } from '../services/dataService.js';
import { liturgyService } from '../services/liturgyService.js';
import { EUCHARISTIC_PRAYERS, getEucharisticPrayerById } from '../services/eucharisticPrayers.js';
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
  getAccountMembers,
  getCoordinatedPastoralIds,
  getCountdownBadge,
  getFirstName,
  getMemberPastoralIds,
  getOpenSubstitutionsForUser,
  getTodayISO,
  hasPermission,
  hasTimeConflict,
  isFamilyAccount,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderPastoralPill,
  resolveAssignedMemberName,
  showToast,
} from '../utils/helpers.js';

let activeTab = 'my_dates';

export function resetSchedulesTab() {
  activeTab = 'my_dates';
}

export function setSchedulesTab(tabId) {
  activeTab = tabId || 'my_dates';
}

export function renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged }) {
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const coordPastoralIds = getCoordinatedPastoralIds(user, pastorals);
  const accessiblePastoralIds = getMemberPastoralIds(user, pastorals);
  const accessiblePastoralSet = new Set(accessiblePastoralIds);
  const accessiblePastorals = pastorals.filter((p) => accessiblePastoralSet.has(p.id));
  const generalAdmin = isGeneralAdmin(user);
  const canCreateEdit = hasPermission(user, 'schedules_manage', permissions) && coordPastoralIds.length > 0;

  const schedules = dataService
    .getSchedules()
    .slice()
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const users = dataService.getUsers();
  const roles = dataService.getRoles();
  const celebrationTypes = dataService.getCelebrationTypes();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));
  const ctMap = Object.fromEntries(celebrationTypes.map((c) => [c.id, c]));
  const slotIndex = buildUserTimeSlotIndex(schedules);

  if (activeTab !== 'my_dates' && activeTab !== 'all_managed' && !accessiblePastoralSet.has(activeTab)) {
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

  // Pedidos de substituição abertos feitos por colegas das pastorais do usuário
  const openSubstitutions = getOpenSubstitutionsForUser(user, schedules, pastorals);

  const rerender = () => {
    onNotificationsChanged?.();
    renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged });
  };

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
            Escalas integradas à Liturgia Diária Paulus, Contas Familiares e substituições com aceite rápido.
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

      <!-- Banner: Pedidos de Substituição em Aberto (colegas da mesma pastoral) -->
      ${
        openSubstitutions.length > 0
          ? `
        <section class="rounded-2xl bg-gradient-to-r from-amber-50 via-[#FDFBF7] to-emerald-50/40 border-2 border-amber-400 p-4 sm:p-5 space-y-3 shadow-xs">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0">
                <i data-lucide="hand-helping" class="w-4 h-4"></i>
              </div>
              <div>
                <h4 class="text-sm font-extrabold text-[#3E2723]">Pedidos de Substituição em Aberto (${openSubstitutions.length})</h4>
                <p class="text-xs text-[#6D4C41]">Colegas da sua pastoral precisando de cobertura. Clique em aceitar para assumir a escala automaticamente.</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            ${openSubstitutions
              .map(({ schedule: sch, assignment: asg, pastoralId }) => {
                const p = pastoralMap[pastoralId];
                const roleName = roleMap[asg.roleId]?.name || 'Função';
                const requesterName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
                return `
                  <div class="rounded-xl bg-white border border-amber-300 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="space-y-1 min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${renderPastoralPill(p, { compact: true })}
                        <span class="text-xs font-extrabold text-[#B45309]">${escapeHtml(roleName)}</span>
                      </div>
                      <p class="text-xs font-bold text-[#3E2723]">
                        ${escapeHtml(requesterName)} • ${escapeHtml(formatDateBR(sch.date))} às ${escapeHtml(sch.time)}
                      </p>
                      <p class="text-[11px] text-[#6D4C41]">${escapeHtml(sch.celebrationType)} — ${escapeHtml(sch.location)}</p>
                      ${
                        asg.substitutionReason
                          ? `<p class="text-[11px] text-red-800 italic">“${escapeHtml(asg.substitutionReason)}”</p>`
                          : ''
                      }
                    </div>
                    <button type="button" data-accept-sub="${asg.id}" data-schedule-id="${sch.id}"
                      class="shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-xs transition">
                      <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                      Assumir / Aceitar Substituição
                    </button>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
      `
          : ''
      }

      <!-- Abas -->
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

      <div id="schedules-tab-body"></div>
    </div>
  `;

  const tabBody = container.querySelector('#schedules-tab-body');

  if (activeTab === 'my_dates') {
    renderMyDatesContent(tabBody, {
      user,
      compactHeader: true,
      openLiturgyFor,
      onChanged: rerender,
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
          .map((sch) =>
            renderScheduleCard(sch, {
              user,
              canCreateEdit,
              accessiblePastoralSet,
              userMap,
              roleMap,
              pastoralMap,
              ctMap,
              slotIndex,
            }),
          )
          .join('')}
      </div>
    `;
  }

  container.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged });
    });
  });

  container.querySelector('#btn-new-schedule')?.addEventListener('click', () => {
    const defaultPastoralId = coordPastoralIds.includes(activeTab) ? activeTab : coordPastoralIds[0];
    openScheduleModal(null, { user, defaultPastoralId }, rerender);
  });

  // Botões de "Assumir / Aceitar Substituição" (tanto no Banner do topo quanto dentro dos cards!)
  container.querySelectorAll('[data-accept-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAcceptSubstitutionModal(btn.dataset.scheduleId, btn.dataset.acceptSub, user, rerender);
    });
  });

  // Botões de "Cancelar Pedido de Substituição" dentro dos cards
  tabBody.querySelectorAll('[data-cancel-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.cancelSubstitutionRequest(btn.dataset.scheduleId, btn.dataset.cancelSub);
      showToast('Pedido de substituição cancelado. Você permanece confirmado(a) na escala.');
      rerender();
    });
  });

  tabBody.querySelectorAll('[data-open-liturgy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openLiturgyFor?.(btn.dataset.litDate, btn.dataset.openLiturgy);
    });
  });

  tabBody.querySelectorAll('[data-edit-schedule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sch = dataService.getScheduleById(btn.dataset.editSchedule);
      if (sch && canCreateEdit && canManageSchedule(user, sch)) {
        openScheduleModal(sch, { user, defaultPastoralId: sch.pastoralId }, rerender);
      }
    });
  });

  tabBody.querySelectorAll('[data-delete-schedule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sch = dataService.getScheduleById(btn.dataset.deleteSchedule);
      if (!sch || !canCreateEdit || !canManageSchedule(user, sch)) return;
      if (!confirm('Deseja realmente excluir esta escala?')) return;
      dataService.deleteSchedule(sch.id);
      showToast('Escala excluída com sucesso.');
      rerender();
    });
  });

  tabBody.querySelectorAll('[data-request-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openSubstitutionModal(btn.dataset.scheduleId, btn.dataset.requestSub, rerender);
    });
  });

  tabBody.querySelectorAll('[data-reassign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openReassignModal(btn.dataset.scheduleId, btn.dataset.reassign, user, rerender);
    });
  });

  refreshIcons();
}

function renderScheduleCard(sch, { user, canCreateEdit, accessiblePastoralSet, userMap, roleMap, pastoralMap, ctMap, slotIndex }) {
  const myAssignmentsHere = (sch.assignments || []).filter((a) => a.userId === user.id);
  const isUserAssigned = myAssignmentsHere.length > 0;
  const canEdit = canCreateEdit && canManageSchedule(user, sch);
  const countdown = getCountdownBadge(sch.date);
  const isPast = countdown.diffDays < 0;
  const mainPastoral = pastoralMap[sch.pastoralId];
  const ctObj = ctMap[sch.celebrationTypeId];
  const oe = getEucharisticPrayerById(sch.eucharisticPrayerId);
  const hasSpecialScript = Boolean(sch.celebrantScript || sch.eucharisticPrayerSource === 'custom');
  const userHasConflictHere = myAssignmentsHere.some((a) =>
    hasTimeConflict(slotIndex, a.memberId || a.userId, sch.date, sch.time),
  );

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
              <div class="flex items-center gap-1.5 flex-wrap mb-1.5">
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
                ${
                  hasSpecialScript
                    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#3E2723] text-amber-300">
                        <i data-lucide="scroll-text" class="w-3 h-3"></i>
                        Roteiro do Padre
                      </span>`
                    : ''
                }
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-base font-extrabold text-[#3E2723]">${escapeHtml(sch.celebrationType)}</h4>
                ${
                  ctObj
                    ? `<span class="w-2.5 h-2.5 rounded-full" style="background-color:${escapeHtml(ctObj.color)};" title="${escapeHtml(ctObj.name)}"></span>`
                    : ''
                }
              </div>

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
              <span><strong>Atenção amigável:</strong> Há outra escala no mesmo dia e horário para este integrante.</span>
            </div>
          `
              : ''
          }
        </div>

        <div class="p-5 space-y-2.5">
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#8D6E63]">Equipe Escalada</p>
          ${(sch.assignments || [])
            .map((asg) => {
              const memberAccount = userMap[asg.userId];
              const assignedName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
              const isFamAcc = isFamilyAccount(memberAccount);
              const role = roleMap[asg.roleId];
              const asgPastoralId = asg.pastoralId || sch.pastoralId;
              const asgPastoral = pastoralMap[asgPastoralId] || mainPastoral;
              const isMine = asg.userId === user.id;
              const canReassign = canCreateEdit && canManagePastoral(user, asgPastoralId);
              const canAcceptThis =
                !isPast &&
                !isMine &&
                asg.substitutionRequested &&
                (isGeneralAdmin(user) || accessiblePastoralSet.has(asgPastoralId));

              return `
                <div class="rounded-xl p-3 border ${
                  asg.substitutionRequested
                    ? 'bg-red-50/70 border-red-200'
                    : asg.substitutionAccepted
                      ? 'bg-emerald-50/50 border-emerald-300'
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
                        ${escapeHtml(assignedName)}
                        ${isMine ? '<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200 text-[#78350F]">Você</span>' : ''}
                        ${isFamAcc ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/80 text-[#78350F] border border-amber-300">Conta Familiar</span>' : ''}
                      </p>
                      ${
                        asg.substitutionAccepted && asg.substitutedFromName
                          ? `<p class="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                              <i data-lucide="arrow-left-right" class="w-3 h-3"></i>
                              Substituindo ${escapeHtml(getFirstName(asg.substitutedFromName))}
                            </p>`
                          : ''
                      }
                    </div>

                    <div class="flex items-center gap-1.5 flex-wrap">
                      ${
                        asg.substitutionRequested
                          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                              <i data-lucide="alert-circle" class="w-3 h-3"></i>
                              Substituição Solicitada
                            </span>`
                          : asg.substitutionAccepted
                            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <i data-lucide="check-circle-2" class="w-3 h-3"></i>
                                Substituição Confirmada
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
                        isMine && asg.substitutionRequested && !isPast
                          ? `<button type="button" data-cancel-sub="${asg.id}" data-schedule-id="${sch.id}"
                              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#5D4037] bg-white hover:bg-[#FAF6F0] border border-[#D7C4B2] transition">
                              <i data-lucide="x-circle" class="w-3 h-3 text-red-600"></i>
                              Cancelar Pedido de Substituição
                            </button>`
                          : ''
                      }

                      ${
                        canAcceptThis
                          ? `<button type="button" data-accept-sub="${asg.id}" data-schedule-id="${sch.id}"
                              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs transition">
                              <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                              Assumir / Aceitar Substituição
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

      <!-- Rodapé Litúrgico + Botão Ver Liturgia Completa -->
      <div class="px-5 py-3 bg-[#FDFBF7] border-t border-[#E6DACE]/80 space-y-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-[11px] font-semibold text-[#5D4037]">
            <strong>${escapeHtml(oe.shortName)}</strong>
            <span class="text-[#8D6E63]">(${sch.eucharisticPrayerSource === 'custom' ? 'Roteiro do Celebrante' : 'Padrão do Dia'})</span>
          </span>
          <button type="button" data-open-liturgy="${sch.id}" data-lit-date="${escapeHtml(sch.date)}"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 text-xs font-bold transition">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
            Ver Liturgia Completa
          </button>
        </div>
        ${
          sch.notes
            ? `<p class="text-xs text-[#6D4C41] flex items-start gap-1.5"><i data-lucide="info" class="w-3.5 h-3.5 text-[#8D6E63] shrink-0 mt-0.5"></i><span>${escapeHtml(sch.notes)}</span></p>`
            : ''
        }
      </div>
    </article>
  `;
}

/**
 * Modal de Confirmação Rápida para Assumir / Aceitar Substituição (exportado para Dashboard e Escalas)
 */
export function openAcceptSubstitutionModal(scheduleId, assignmentId, user, onDone) {
  const sch = dataService.getScheduleById(scheduleId);
  if (!sch) return;
  const asg = sch.assignments.find((a) => a.id === assignmentId);
  if (!asg || !asg.substitutionRequested) {
    showToast('Este pedido de substituição já foi atendido ou cancelado.', 'info');
    onDone?.();
    return;
  }

  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const role = dataService.getRoleById(asg.roleId);
  const pastoral = dataService.getPastoralById(asg.pastoralId || sch.pastoralId);
  const requesterName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
  const isFam = isFamilyAccount(user);
  const familyMembers = getAccountMembers(user);

  openModal({
    title: 'Confirmar Aceite de Substituição',
    maxWidth: 'max-w-lg',
    bodyHtml: `
      <form id="accept-sub-form" class="space-y-4">
        <div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2 text-sm text-[#3E2723]">
          <div class="flex items-center gap-2 flex-wrap">
            ${renderPastoralPill(pastoral, { compact: true })}
            <span class="text-xs font-bold text-emerald-800">${escapeHtml(sch.celebrationType)}</span>
          </div>
          <p class="leading-relaxed">
            Deseja assumir a função de <strong class="text-[#B45309]">${escapeHtml(role?.name || 'Função')}</strong>
            no lugar de <strong>${escapeHtml(requesterName)}</strong>
            na missa de <strong>${escapeHtml(formatDateBR(sch.date))} às ${escapeHtml(sch.time)}</strong> (${escapeHtml(sch.location)})?
          </p>
          ${
            asg.substitutionReason
              ? `<p class="text-xs text-[#5D4037] bg-white/80 rounded-lg px-3 py-1.5 border border-emerald-200/80">
                  <strong>Motivo informado:</strong> ${escapeHtml(asg.substitutionReason)}
                </p>`
              : ''
          }
        </div>

        ${
          isFam
            ? `
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Qual integrante da família assumirá esta escala? *</label>
            <select name="acceptorMemberId" required class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] bg-white text-sm font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
              ${familyMembers.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>
        `
            : ''
        }

        <p class="text-xs text-[#6D4C41]">
          Ao confirmar, seu nome entrará automaticamente na escala e em <strong>Minhas Datas</strong>, e tanto ${escapeHtml(getFirstName(requesterName))} quanto a Coordenação receberão a confirmação no sino de notificações.
        </p>

        <div class="flex justify-end gap-2 pt-2 border-t border-[#E6DACE]/80">
          <button type="button" id="cancel-accept-sub" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold shadow-xs transition">
            <i data-lucide="check-circle-2" class="w-4 h-4"></i>
            Confirmar e Assumir Escala
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-accept-sub').addEventListener('click', closeModal);
      bodyEl.querySelector('#accept-sub-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const chosenMemberId = isFam ? String(fd.get('acceptorMemberId')) : familyMembers[0]?.id || user.id;
        const result = dataService.acceptSubstitution(scheduleId, assignmentId, user.id, chosenMemberId);
        closeModal();
        if (result) {
          showToast(
            `Substituição confirmada! ${result.newMemberName} assumiu ${role?.name || 'a função'} no lugar de ${getFirstName(result.prevMemberName)}.`,
          );
        }
        onDone?.();
      });
    },
  });
}

function openScheduleModal(existing, { user, defaultPastoralId }, onSaved) {
  const allActivePastorals = dataService.getActivePastorals();
  const managedIds = new Set(getCoordinatedPastoralIds(user, allActivePastorals));
  const managedPastorals = allActivePastorals.filter((p) => managedIds.has(p.id));
  const activeLocations = dataService.getActiveLocations();
  const activeCelebrationTypes = dataService.getActiveCelebrationTypes();

  if (managedPastorals.length === 0) {
    showToast('Você não possui pastorais ativas sob sua coordenação para criar escalas.', 'error');
    return;
  }

  const allSchedules = dataService.getSchedules();
  const pastoralMap = Object.fromEntries(allActivePastorals.map((p) => [p.id, p]));
  const roleMap = Object.fromEntries(dataService.getRoles().map((r) => [r.id, r]));
  const userMap = Object.fromEntries(dataService.getUsers().map((u) => [u.id, u]));

  const initialOEId = existing?.eucharisticPrayerId || 'oe_2';
  let oeSource = existing?.eucharisticPrayerSource || 'default';

  openModal({
    title: existing ? 'Editar Escala & Roteiro Litúrgico' : 'Nova Escala Multi-Pastoral',
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
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Local (Apenas Ativos) *</label>
            <select name="locationId" required class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm bg-white focus:border-[#B45309] outline-none">
              ${activeLocations
                .map(
                  (loc) =>
                    `<option value="${loc.id}" ${existing?.locationId === loc.id || (!existing?.locationId && existing?.location === loc.name) ? 'selected' : ''}>${escapeHtml(loc.name)} (${escapeHtml(loc.type)})</option>`,
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Tipo de Celebração *</label>
            <select name="celebrationTypeId" required class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm bg-white focus:border-[#B45309] outline-none">
              ${activeCelebrationTypes
                .map(
                  (ct) =>
                    `<option value="${ct.id}" ${existing?.celebrationTypeId === ct.id || (!existing?.celebrationTypeId && existing?.celebrationType === ct.name) ? 'selected' : ''}>${escapeHtml(ct.name)} (${ct.durationMin} min)</option>`,
                )
                .join('')}
            </select>
          </div>
        </div>

        <!-- Bloco Integrado: Liturgia do Dia + Oração Eucarística + Roteiro do Celebrante -->
        <div class="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E6DACE] space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <i data-lucide="book-open" class="w-4 h-4 text-[#B45309]"></i>
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#3E2723]">Liturgia &amp; Roteiro do Celebrante</span>
            </div>
            <span id="sch-oe-badge" class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              oeSource === 'custom'
                ? 'bg-amber-100 text-[#92400E] border-amber-400'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }">
              ${oeSource === 'custom' ? 'Escolhida no Roteiro do Celebrante' : 'Padrão da Liturgia Diária'}
            </span>
          </div>

          <p id="sch-liturgy-preview" class="text-xs text-[#6D4C41] bg-white rounded-xl border border-[#E6DACE] px-3 py-2">
            Consultando liturgia da data selecionada...
          </p>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Oração Eucarística</label>
            <select id="sch-oe-select" name="eucharisticPrayerId" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm font-medium outline-none focus:border-[#B45309]">
              ${EUCHARISTIC_PRAYERS.map(
                (oe) => `<option value="${oe.id}" ${initialOEId === oe.id ? 'selected' : ''}>${escapeHtml(oe.name)}</option>`,
              ).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Roteiro / Orientações do Celebrante</label>
            <textarea name="celebrantScript" rows="2" placeholder="Ex: Entrada solene com incenso, bênção especial após a homilia, avisos no altar..."
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.celebrantScript || '')}</textarea>
          </div>
        </div>

        <div id="schedule-conflict-banner" class="hidden rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 space-y-1"></div>

        <!-- Vinculação Dinâmica em Cascata: Pastoral -> Função -> Integrante (inclui irmãos individualmente) -->
        <div class="pt-2 border-t border-[#E6DACE]/80">
          <div class="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <div>
              <label class="text-xs font-bold uppercase tracking-wider text-[#3E2723]">Posições da Escala (Filtro Cascata)</label>
              <p class="text-[11px] text-[#6D4C41]">1. <strong>Pastoral</strong> → 2. <strong>Função ativa</strong> → 3. <strong>Integrante ativo</strong> (irmãos de contas familiares listados individualmente).</p>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Observações da Equipe</label>
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
      const oeSelect = bodyEl.querySelector('#sch-oe-select');
      const oeBadge = bodyEl.querySelector('#sch-oe-badge');
      const litPreview = bodyEl.querySelector('#sch-liturgy-preview');
      const conflictBanner = bodyEl.querySelector('#schedule-conflict-banner');

      function updateOEBadge() {
        if (oeSource === 'custom') {
          oeBadge.textContent = 'Escolhida no Roteiro do Celebrante';
          oeBadge.className = 'inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-amber-100 text-[#92400E] border-amber-400';
        } else {
          oeBadge.textContent = 'Padrão da Liturgia Diária';
          oeBadge.className = 'inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200';
        }
      }

      async function syncLiturgyForDate(isoDate, overwriteOE = true) {
        if (!isoDate) return;
        litPreview.textContent = `Carregando liturgia de ${formatDateBR(isoDate)}...`;
        const lit = await liturgyService.fetchLiturgyByDate(isoDate);
        litPreview.innerHTML = `<strong>${escapeHtml(lit.liturgiaTitle)}</strong> • Cor: <strong>${escapeHtml(lit.liturgicalColor)}</strong> • <span class="text-[#B45309]">${escapeHtml(lit.sourceLabel)}</span>`;
        if (overwriteOE) {
          oeSelect.value = lit.defaultEucharisticPrayerId;
          oeSource = 'default';
          updateOEBadge();
        }
      }

      oeSelect.addEventListener('change', () => {
        oeSource = 'custom';
        updateOEBadge();
      });

      syncLiturgyForDate(dateInput.value, !existing);

      function updateConflictWarnings() {
        const date = dateInput.value;
        const time = timeInput.value;
        const warnings = [];
        const pickedInForm = {};

        listEl.querySelectorAll('.position-row').forEach((row) => {
          const val = row.querySelector('.pos-user').value;
          if (!val) return;
          const [accountId, memberId] = val.split('::');
          const personKey = memberId || accountId;
          const memberName = resolveAssignedMemberName(userMap, accountId, memberId);
          pickedInForm[personKey] = (pickedInForm[personKey] || 0) + 1;
          if (pickedInForm[personKey] === 2) {
            warnings.push(`<strong>${escapeHtml(memberName)}</strong> foi selecionado(a) em mais de uma posição nesta mesma escala.`);
          }
          const external = findConflictsForMember(allSchedules, personKey, date, time, existing?.id);
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

      function populateRolesAndMembers(row, pastoralId, presetRoleId = '', presetUserId = '', presetMemberId = '') {
        const activeRoles = dataService.getActiveRolesByPastoral(pastoralId);
        const participants = dataService.getActiveParticipantsByPastoral(pastoralId);
        const targetKey = presetUserId ? `${presetUserId}::${presetMemberId || presetUserId}` : '';

        row.querySelector('.pos-role').innerHTML = `
          <option value="">2. Função ativa...</option>
          ${activeRoles.map((r) => `<option value="${r.id}" ${presetRoleId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
        `;
        row.querySelector('.pos-user').innerHTML = `
          <option value="">3. Integrante ativo...</option>
          ${participants
            .map((p) => {
              const val = `${p.accountId}::${p.memberId}`;
              const selected = val === targetKey || (!presetMemberId && p.accountId === presetUserId);
              return `<option value="${val}" ${selected ? 'selected' : ''}>${escapeHtml(p.name)}${p.isFamily ? ' (Conta Familiar)' : ''}</option>`;
            })
            .join('')}
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
        row.dataset.subAccepted = preset?.substitutionAccepted ? '1' : '0';
        row.dataset.subFrom = preset?.substitutedFromName || '';
        row.dataset.subAt = preset?.substitutedAt || '';

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

        populateRolesAndMembers(row, rowPastoralId, preset?.roleId || '', preset?.userId || '', preset?.memberId || '');
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

      dateInput.addEventListener('change', () => {
        syncLiturgyForDate(dateInput.value, true);
        updateConflictWarnings();
      });
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
          const userVal = row.querySelector('.pos-user').value;
          if (pastoralId && roleId && userVal) {
            const [userId, memberId] = userVal.split('::');
            edited.push({
              id: row.dataset.asgId || undefined,
              pastoralId,
              roleId,
              userId,
              memberId: memberId || userId,
              substitutionRequested: row.dataset.subReq === '1',
              substitutionReason: row.dataset.subReason || '',
              substitutionAccepted: row.dataset.subAccepted === '1',
              substitutedFromName: row.dataset.subFrom || '',
              substitutedAt: row.dataset.subAt || null,
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
          locationId: fd.get('locationId'),
          celebrationTypeId: fd.get('celebrationTypeId'),
          pastoralId: existing?.pastoralId || finalAssignments[0].pastoralId,
          eucharisticPrayerId: fd.get('eucharisticPrayerId'),
          eucharisticPrayerSource: oeSource,
          celebrantScript: String(fd.get('celebrantScript') || '').trim(),
          notes: String(fd.get('notes') || '').trim(),
          assignments: finalAssignments,
        });

        closeModal();
        showToast(existing ? 'Escala e roteiro atualizados!' : 'Escala publicada e sincronizada com a Agenda e Liturgia!');
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
        <p class="text-sm text-[#5D4037]">
          Informe o motivo da sua indisponibilidade. Os colegas e coordenadores da sua pastoral serão notificados no sino para que alguém possa assumir sua vaga!
        </p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1.5">Motivo *</label>
          <textarea name="reason" rows="3" required placeholder="Ex: Viagem em família, compromisso de trabalho..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-sub-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037]">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold">Confirmar Solicitação</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-sub-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#sub-form').addEventListener('submit', (e) => {
        e.preventDefault();
        dataService.requestSubstitution(scheduleId, assignmentId, String(new FormData(e.target).get('reason')));
        closeModal();
        showToast('Substituição solicitada! Os colegas da sua pastoral foram notificados.');
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

  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const pastoral = dataService.getPastoralById(pastoralId);
  const role = dataService.getRoleById(asg.roleId);
  const currentName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
  const candidates = dataService.getActiveParticipantsByPastoral(pastoralId);
  const currentKey = `${asg.userId}::${asg.memberId || asg.userId}`;

  openModal({
    title: 'Reatribuir Integrante na Escala',
    bodyHtml: `
      <form id="reassign-form" class="space-y-4">
        <div class="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-[#4E342E] space-y-1">
          <p><strong>Pastoral:</strong> ${escapeHtml(pastoral?.name || '—')}</p>
          <p><strong>Função:</strong> ${escapeHtml(role?.name || '—')}</p>
          <p><strong>Escalado atual:</strong> ${escapeHtml(currentName)}</p>
          <p><strong>Motivo:</strong> ${escapeHtml(asg.substitutionReason || '—')}</p>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1.5">Novo Integrante Ativo *</label>
          <select name="newParticipant" required class="w-full px-3 py-2.5 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
            ${candidates
              .map((c) => {
                const val = `${c.accountId}::${c.memberId}`;
                return `<option value="${val}" ${val === currentKey ? 'selected' : ''}>${escapeHtml(c.name)}${c.isFamily ? ' (Conta Familiar)' : ''}</option>`;
              })
              .join('')}
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
        const [newUserId, newMemberId] = String(new FormData(e.target).get('newParticipant')).split('::');
        dataService.reassignScheduleMember(scheduleId, assignmentId, newUserId, newMemberId);
        closeModal();
        showToast('Integrante reatribuído com sucesso!');
        onDone();
      });
    },
  });
}
