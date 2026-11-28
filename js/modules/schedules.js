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
import { evaluatePastoralAvailability } from '../services/availabilityService.js';
import { renderMyDatesContent } from './myDates.js';
import {
  MONTHS_PT,
  buildUserTimeSlotIndex,
  canManagePastoral,
  canManageSchedule,
  closeModal,
  doesMemberBelongToPastoral,
  escapeHtml,
  findConflictsForMember,
  formatDateBR,
  formatDateTimeBR,
  formatVacancyBadgeText,
  formatWeekdayBR,
  getAccountMembers,
  getCoordinatedPastoralIds,
  getCountdownBadge,
  getEligibleMembersForVacancy,
  getFirstName,
  getLinkedSiblingsInfo,
  getMemberPastoralIds,
  getOpenSubstitutionsForUser,
  getTodayISO,
  hasPermission,
  hasTimeConflict,
  isAnyCoordinator,
  isFamilyAccount,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderPastoralPill,
  resolveAssignedMemberName,
  showToast,
} from '../utils/helpers.js';

let activeTab = 'my_dates';
let selectedCoordinatorFilter = 'all';
let subControlPeriodFilter = 'all';
let subControlPastoralFilter = 'all';
let onlyOpenVacanciesFilter = false;

function isCoordinatorRole(roleId, roleMap = {}) {
  if (!roleId) return false;
  if (roleId === 'role_cor_coord' || roleId === 'role_aco_coord') return true;
  const rName = String(roleMap[roleId]?.name || '').toLowerCase();
  return rName.includes('coordenador');
}

/**
 * Filtra estritamente as posições pertencentes à pastoral selecionada na aba de equipe.
 * Para membros comuns, oculta também posições de Coordenador de Plantão.
 */
function getStrictPastoralAssignments(sch, pastoralId, { isCoordOrAdmin, roleMap }) {
  return (sch.assignments || []).filter((a) => {
    const aPid = a.pastoralId || sch.pastoralId;
    if (aPid !== pastoralId) return false;
    if (!isCoordOrAdmin && isCoordinatorRole(a.roleId, roleMap)) return false;
    return true;
  });
}

function getStrictPastoralVacancies(sch, pastoralId) {
  return (sch.vagasAbertas || []).filter(
    (v) => v && v.pastoralId === pastoralId && Number(v.quantidade) > 0,
  );
}

function getVisibleVacanciesForTab(sch, { activeTab, isSpecificPastoralTab, isCoordOrAdmin, accessiblePastoralSet }) {
  const allOpen = (sch.vagasAbertas || []).filter((v) => v && Number(v.quantidade) > 0);
  if (isSpecificPastoralTab) {
    return allOpen.filter((v) => v.pastoralId === activeTab);
  }
  if (isCoordOrAdmin) return allOpen;
  return allOpen.filter((v) => accessiblePastoralSet.has(v.pastoralId));
}

function formatCoordinatorTitle(fullName) {
  const first = getFirstName(fullName).toLowerCase();
  return first.endsWith('a') ? 'Coordenadora' : 'Coordenador';
}

export function resetSchedulesTab() {
  activeTab = 'my_dates';
  selectedCoordinatorFilter = 'all';
  subControlPeriodFilter = 'all';
  subControlPastoralFilter = 'all';
  onlyOpenVacanciesFilter = false;
}

export function setSchedulesTab(tabId) {
  activeTab = tabId || 'my_dates';
}

export function openSchedulesWithOpenVacancies({ user, pastoralId = 'all', pastorals = [] } = {}) {
  const accessibleIds = getMemberPastoralIds(user, pastorals);
  if (pastoralId && pastoralId !== 'all' && accessibleIds.includes(pastoralId)) {
    activeTab = pastoralId;
  } else if (isGeneralAdmin(user)) {
    activeTab = 'all_managed';
  } else {
    const schedules = dataService.getSchedules();
    const todayISO = getTodayISO();
    const firstWithVacancy = accessibleIds.find((pid) =>
      schedules.some(
        (s) =>
          s.date >= todayISO &&
          (s.vagasAbertas || []).some((v) => v && v.pastoralId === pid && Number(v.quantidade) > 0),
      ),
    );
    activeTab = firstWithVacancy || accessibleIds[0] || 'my_dates';
  }
  onlyOpenVacanciesFilter = true;
}

export function renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged }) {
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const coordPastoralIds = getCoordinatedPastoralIds(user, pastorals);
  const accessiblePastoralIds = getMemberPastoralIds(user, pastorals);
  const accessiblePastoralSet = new Set(accessiblePastoralIds);
  const accessiblePastorals = pastorals.filter((p) => accessiblePastoralSet.has(p.id));
  const generalAdmin = isGeneralAdmin(user);
  const isCoordOrAdmin = isAnyCoordinator(user);
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

  if (
    activeTab !== 'my_dates' &&
    activeTab !== 'all_managed' &&
    activeTab !== 'coordinators' &&
    activeTab !== 'substitutions' &&
    !accessiblePastoralSet.has(activeTab)
  ) {
    activeTab = 'my_dates';
  }
  if (activeTab === 'all_managed' && !generalAdmin) {
    activeTab = 'my_dates';
  }
  if ((activeTab === 'coordinators' || activeTab === 'substitutions') && !isCoordOrAdmin) {
    activeTab = 'my_dates';
  }

  const selectedPastoral = pastoralMap[activeTab] || null;
  const dynamicTitle =
    activeTab === 'substitutions'
      ? 'Controle & Histórico de Trocas'
      : activeTab === 'coordinators'
        ? 'Escala de Coordenadores (Plantão)'
        : selectedPastoral
          ? selectedPastoral.name
          : 'Visão Geral das Pastorais';
  setHeaderContext?.('Escalas', dynamicTitle);

  const coordPastoralSet = new Set(coordPastoralIds);
  const scopedSubstitutions = isCoordOrAdmin
    ? dataService.getSubstitutions().filter((s) => generalAdmin || coordPastoralSet.has(s.pastoralId))
    : [];

  const coordSchedulesAll = schedules.filter((sch) =>
    (sch.assignments || []).some((a) => isCoordinatorRole(a.roleId, roleMap)),
  );

  // Lista de coordenadores presentes nos plantões para os chips de filtro rápido
  const coordShiftCounts = new Map();
  coordSchedulesAll.forEach((sch) => {
    const seenInMass = new Set();
    (sch.assignments || []).forEach((a) => {
      if (!isCoordinatorRole(a.roleId, roleMap)) return;
      if (seenInMass.has(a.userId)) return;
      seenInMass.add(a.userId);
      const name = resolveAssignedMemberName(userMap, a.userId, a.memberId);
      const prev = coordShiftCounts.get(a.userId) || { userId: a.userId, name, count: 0 };
      prev.count += 1;
      coordShiftCounts.set(a.userId, prev);
    });
  });
  const coordinatorFilterList = Array.from(coordShiftCounts.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  if (selectedCoordinatorFilter !== 'all' && !coordShiftCounts.has(selectedCoordinatorFilter)) {
    selectedCoordinatorFilter = 'all';
  }

  const tabs = [
    { id: 'my_dates', label: 'Minhas Datas', icon: 'calendar-clock', managed: false },
    ...(generalAdmin ? [{ id: 'all_managed', label: 'Todas as Pastorais', icon: 'layers', managed: true }] : []),
    ...accessiblePastorals.map((p) => ({
      id: p.id,
      label: p.shortName,
      color: p.color,
      managed: canCreateEdit && canManagePastoral(user, p.id),
    })),
    ...(isCoordOrAdmin ? [{ id: 'coordinators', label: 'Coordenadores', icon: 'crown', managed: false }] : []),
    ...(isCoordOrAdmin ? [{ id: 'substitutions', label: '🔄 Controle de Trocas', icon: 'arrow-left-right', managed: false }] : []),
  ];

  // Conta datas/celebrações únicas agendadas para o usuário (ou para a família)
  const myUniqueCelebrationKeys = new Set();
  schedules.forEach((s) => {
    if ((s.assignments || []).some((a) => a.userId === user.id)) {
      myUniqueCelebrationKeys.add(
        `${s.date}|${s.time}|${String(s.location || '').trim().toLowerCase()}`,
      );
    }
  });
  const myAssignmentsCount = myUniqueCelebrationKeys.size;

  const isSpecificPastoralTab =
    activeTab !== 'my_dates' &&
    activeTab !== 'all_managed' &&
    activeTab !== 'coordinators' &&
    activeTab !== 'substitutions';

  const filteredByTab = schedules.filter((sch) => {
    if (activeTab === 'all_managed') return true;
    if (activeTab === 'coordinators') {
      if (!isCoordOrAdmin) return false;
      const coordAsgs = (sch.assignments || []).filter((a) => isCoordinatorRole(a.roleId, roleMap));
      if (coordAsgs.length === 0) return false;
      if (selectedCoordinatorFilter === 'all') return true;
      return coordAsgs.some((a) => a.userId === selectedCoordinatorFilter);
    }
    if (isSpecificPastoralTab) {
      // Nível 1: exibe celebrações com pelo menos 1 posição escalada OU 1 vaga aberta nesta pastoral
      return (
        getStrictPastoralAssignments(sch, activeTab, { isCoordOrAdmin, roleMap }).length > 0 ||
        getStrictPastoralVacancies(sch, activeTab).length > 0
      );
    }
    return false;
  });

  const openVacanciesInTabCount = filteredByTab.filter(
    (sch) =>
      getVisibleVacanciesForTab(sch, {
        activeTab,
        isSpecificPastoralTab,
        isCoordOrAdmin,
        accessiblePastoralSet,
      }).length > 0,
  ).length;

  const filtered =
    onlyOpenVacanciesFilter && activeTab !== 'my_dates' && activeTab !== 'substitutions'
      ? filteredByTab.filter(
          (sch) =>
            getVisibleVacanciesForTab(sch, {
              activeTab,
              isSpecificPastoralTab,
              isCoordOrAdmin,
              accessiblePastoralSet,
            }).length > 0,
        )
      : filteredByTab;

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
          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <button id="btn-import-whatsapp" type="button"
              class="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-amber-50 text-[#3E2723] border border-[#D7C4B2] hover:border-[#B45309] text-sm font-semibold shadow-xs transition">
              <i data-lucide="file-spreadsheet" class="w-4 h-4 text-[#B45309]"></i>
              Importar Escala (WhatsApp / CSV)
            </button>
            <button id="btn-new-schedule" type="button"
              class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition">
              <i data-lucide="plus-circle" class="w-4 h-4 text-amber-400"></i>
              Nova Escala
            </button>
          </div>
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
                  : t.id === 'coordinators'
                    ? coordSchedulesAll.length
                    : t.id === 'substitutions'
                      ? scopedSubstitutions.length
                      : schedules.filter(
                          (s) =>
                            getStrictPastoralAssignments(s, t.id, { isCoordOrAdmin, roleMap }).length > 0 ||
                            getStrictPastoralVacancies(s, t.id).length > 0,
                        ).length;

            return `
              <button type="button" data-tab="${t.id}"
                class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap border transition ${
                  isActive
                    ? 'bg-[#3E2723] text-white border-[#3E2723] shadow-sm'
                    : t.id === 'coordinators' || t.id === 'substitutions'
                      ? 'bg-amber-50/80 text-[#78350F] border-amber-300 hover:bg-amber-100/80'
                      : 'bg-white text-[#5D4037] border-[#E6DACE] hover:border-[#D7C4B2] hover:bg-[#FDFBF7]'
                }">
                ${
                  t.color
                    ? `<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color:${escapeHtml(t.color)};"></span>`
                    : `<i data-lucide="${t.icon}" class="w-4 h-4 ${isActive ? 'text-amber-400' : t.id === 'coordinators' || t.id === 'substitutions' ? 'text-[#B45309]' : 'text-[#8D6E63]'}"></i>`
                }
                ${escapeHtml(t.label)}
                ${
                  t.id !== 'my_dates' && t.id !== 'all_managed' && t.id !== 'coordinators' && t.id !== 'substitutions' && !generalAdmin
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
        ${
          activeTab !== 'my_dates' && activeTab !== 'substitutions'
            ? `
          <button id="btn-filter-open-vacancies" type="button"
            class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition ${
              onlyOpenVacanciesFilter
                ? 'bg-[#D97706] text-white border-[#B45309] shadow-sm'
                : 'bg-amber-50 text-[#78350F] border-amber-300 hover:bg-amber-100'
            }">
            <span>🟡 Com Vagas Abertas</span>
            <span class="px-1.5 py-0.5 rounded-md text-[11px] font-extrabold ${
              onlyOpenVacanciesFilter ? 'bg-white/25 text-white' : 'bg-amber-200/80 text-[#78350F]'
            }">${openVacanciesInTabCount}</span>
          </button>
        `
            : ''
        }
      </div>

      <!-- Filtro rápido por Coordenador Responsável (apenas na aba Coordenadores para Coordenação) -->
      ${
        isCoordOrAdmin && activeTab === 'coordinators' && coordinatorFilterList.length > 0
          ? `
        <div class="bg-white rounded-2xl border border-amber-300/80 p-3.5 flex items-center gap-2 flex-wrap shadow-xs">
          <span class="text-xs font-extrabold uppercase tracking-wider text-[#78350F] flex items-center gap-1.5 mr-1">
            <i data-lucide="crown" class="w-3.5 h-3.5 text-[#D97706]"></i>
            Filtrar por Coordenador(a):
          </span>
          <button type="button" data-coord-filter="all"
            class="px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              selectedCoordinatorFilter === 'all'
                ? 'bg-[#3E2723] text-amber-300 border-[#3E2723]'
                : 'bg-[#FAF6F0] text-[#5D4037] border-[#E6DACE] hover:bg-amber-50'
            }">
            Todos (${coordSchedulesAll.length})
          </button>
          ${coordinatorFilterList
            .map(
              (c) => `
            <button type="button" data-coord-filter="${c.userId}"
              class="px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                selectedCoordinatorFilter === c.userId
                  ? 'bg-[#B45309] text-white border-[#B45309]'
                  : 'bg-white text-[#3E2723] border-[#E6DACE] hover:border-amber-300 hover:bg-amber-50/60'
              }">
              ${escapeHtml(c.name)} (${c.count})
            </button>
          `,
            )
            .join('')}
        </div>
      `
          : ''
      }

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
  } else if (activeTab === 'substitutions' && isCoordOrAdmin) {
    renderSubstitutionsControlPanel(tabBody, {
      substitutions: scopedSubstitutions,
      schedules,
      pastorals: pastorals.filter((p) => generalAdmin || coordPastoralSet.has(p.id)),
      pastoralMap,
      roleMap,
      generalAdmin,
      coordPastoralSet,
      onFilterChanged: () => renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged }),
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
              activeTab,
              isSpecificPastoralTab,
              isCoordOrAdmin,
              canCreateEdit,
              accessiblePastoralSet,
              userMap,
              roleMap,
              pastoralMap,
              ctMap,
              slotIndex,
              allSchedules: schedules,
            }),
          )
          .join('')}
      </div>
    `;
  }

  container.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      if (activeTab === 'my_dates' || activeTab === 'substitutions') {
        onlyOpenVacanciesFilter = false;
      }
      renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged });
    });
  });

  container.querySelector('#btn-filter-open-vacancies')?.addEventListener('click', () => {
    onlyOpenVacanciesFilter = !onlyOpenVacanciesFilter;
    renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged });
  });

  container.querySelectorAll('[data-coord-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedCoordinatorFilter = btn.dataset.coordFilter;
      renderSchedules(container, { user, setHeaderContext, permissions, openLiturgyFor, onNotificationsChanged });
    });
  });

  container.querySelector('#btn-new-schedule')?.addEventListener('click', () => {
    const defaultPastoralId = coordPastoralIds.includes(activeTab) ? activeTab : coordPastoralIds[0];
    openScheduleModal(null, { user, defaultPastoralId }, rerender);
  });

  container.querySelector('#btn-import-whatsapp')?.addEventListener('click', () => {
    openWhatsAppImportModal({ user }, rerender);
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

  tabBody.querySelectorAll('[data-claim-vacancy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openClaimVacancyModal(btn.dataset.scheduleId, btn.dataset.claimVacancy, user, rerender);
    });
  });

  refreshIcons();
}

function renderScheduleCard(sch, { user, activeTab = '', isSpecificPastoralTab = false, isCoordOrAdmin = false, canCreateEdit, accessiblePastoralSet, userMap, roleMap, pastoralMap, ctMap, slotIndex, allSchedules = [] }) {
  // Nível 2: quando uma aba de pastoral específica está selecionada (ex: Acólitos ou Coroinhas),
  // exibe APENAS os integrantes e funções pertencentes àquela pastoral.
  // Para Membro comum em qualquer aba, oculta também o Plantão de Coordenação.
  const visibleAssignments = isSpecificPastoralTab
    ? getStrictPastoralAssignments(sch, activeTab, { isCoordOrAdmin, roleMap })
    : isCoordOrAdmin
      ? sch.assignments || []
      : (sch.assignments || []).filter(
          (a) => !isCoordinatorRole(a.roleId, roleMap) && accessiblePastoralSet.has(a.pastoralId || sch.pastoralId),
        );
  const myAssignmentsHere = visibleAssignments.filter((a) => a.userId === user.id);
  const isUserAssigned = myAssignmentsHere.length > 0;
  const canEdit = canCreateEdit && canManageSchedule(user, sch);
  const countdown = getCountdownBadge(sch.date);
  const isPast = countdown.diffDays < 0;
  const cardPastoralId = isSpecificPastoralTab
    ? activeTab
    : isCoordOrAdmin
      ? sch.pastoralId
      : visibleAssignments[0]?.pastoralId || sch.pastoralId;
  const mainPastoral = pastoralMap[cardPastoralId] || pastoralMap[sch.pastoralId];
  const ctObj = ctMap[sch.celebrationTypeId];
  const oe = getEucharisticPrayerById(sch.eucharisticPrayerId);
  const hasSpecialScript = Boolean(sch.celebrantScript || sch.eucharisticPrayerSource === 'custom');
  const userHasConflictHere = myAssignmentsHere.some((a) =>
    hasTimeConflict(slotIndex, a.memberId || a.userId, sch.date, sch.time),
  );

  // Integrantes escalados nesta mesma data/horário (na mesma escala ou em escala paralela de outra pastoral)
  const sameSlotMemberIds = new Set();
  (allSchedules.length ? allSchedules : [sch]).forEach((s) => {
    if (s.date === sch.date && s.time === sch.time) {
      (s.assignments || []).forEach((a) => sameSlotMemberIds.add(a.memberId || a.userId));
    }
  });

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
          ${[
            ...visibleAssignments.filter((a) => isCoordinatorRole(a.roleId, roleMap)),
            ...visibleAssignments.filter((a) => !isCoordinatorRole(a.roleId, roleMap)),
          ]
            .map((asg) => {
              const isCoordShift = isCoordinatorRole(asg.roleId, roleMap);
              const memberAccount = userMap[asg.userId];
              const assignedName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
              const isFamAcc = isFamilyAccount(memberAccount);
              const linkedSiblings = isFamAcc
                ? getLinkedSiblingsInfo(userMap, asg.userId, asg.memberId, pastoralMap)
                : [];
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

              if (isCoordShift) {
                const coordLabel = formatCoordinatorTitle(assignedName);
                return `
                  <div class="rounded-xl p-3 border-2 ${
                    asg.substitutionRequested
                      ? 'bg-red-50/90 border-red-300'
                      : 'bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#5D4037] border-amber-400/80 text-white shadow-xs'
                  }">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                      <div class="min-w-0 space-y-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            asg.substitutionRequested
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-amber-400 text-[#2B1B18]'
                          }">
                            👑 ${escapeHtml(coordLabel)}: ${escapeHtml(assignedName)}
                          </span>
                          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            asg.substitutionRequested
                              ? 'bg-white text-[#5D4037] border border-[#E6DACE]'
                              : 'bg-white/15 text-amber-200 border border-amber-300/30'
                          }">
                            Plantão da Missa
                          </span>
                          ${
                            isMine
                              ? `<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                  asg.substitutionRequested ? 'bg-amber-200 text-[#78350F]' : 'bg-white text-[#3E2723]'
                                }">Você</span>`
                              : ''
                          }
                        </div>
                        ${
                          isCoordOrAdmin && (asg.substituidoDe?.nome || (asg.substitutionAccepted && asg.substitutedFromName))
                            ? `<p class="text-[11px] font-semibold text-amber-200 flex items-center gap-1">
                                🔄 Cobrindo ${escapeHtml(asg.substituidoDe?.nome || asg.substitutedFromName)}
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
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#3E2723] bg-amber-100 hover:bg-amber-200 border border-amber-300 transition">
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
                                Cancelar Pedido
                              </button>`
                            : ''
                        }
                        ${
                          canAcceptThis
                            ? `<button type="button" data-accept-sub="${asg.id}" data-schedule-id="${sch.id}"
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs transition">
                                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                                Assumir / Aceitar
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
                        ? `<p class="mt-2 text-xs text-red-800 bg-white/90 rounded-lg px-2.5 py-1.5 border border-red-200">
                            <strong>Motivo:</strong> ${escapeHtml(asg.substitutionReason)}
                          </p>`
                        : ''
                    }
                  </div>
                `;
              }

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
                        ${isCoordOrAdmin && asg.voluntario ? '<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">🙋 Voluntário</span>' : ''}
                      </p>
                      ${
                        linkedSiblings.length > 0
                          ? `<div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                              ${linkedSiblings
                                .map((sib) => {
                                  const together = sameSlotMemberIds.has(sib.id);
                                  const pSuffix = sib.pastoralShortName ? ` • ${escapeHtml(sib.pastoralShortName)}` : '';
                                  return together
                                    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        <i data-lucide="users" class="w-3 h-3"></i>
                                        Irmão(ã) nesta missa: ${escapeHtml(sib.name)}${pSuffix}
                                      </span>`
                                    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50/90 text-[#78350F] border border-amber-200">
                                        <i data-lucide="users" class="w-3 h-3 text-[#B45309]"></i>
                                        Irmão(ã): ${escapeHtml(sib.name)}${pSuffix}
                                      </span>`;
                                })
                                .join('')}
                            </div>`
                          : ''
                      }
                      ${
                        isCoordOrAdmin && (asg.substituidoDe?.nome || (asg.substitutionAccepted && asg.substitutedFromName))
                          ? `<p class="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                              🔄 Cobrindo ${escapeHtml(asg.substituidoDe?.nome || asg.substitutedFromName)}
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
          ${(() => {
            const visibleVacancies = getVisibleVacanciesForTab(sch, {
              activeTab,
              isSpecificPastoralTab,
              isCoordOrAdmin,
              accessiblePastoralSet,
            });
            if (visibleVacancies.length === 0) return '';
            return `
              <div class="pt-2 space-y-2" data-open-vacancies-box="${sch.id}">
                <p class="text-[11px] font-extrabold uppercase tracking-wider text-[#92400E]">Vagas em Aberto</p>
                ${visibleVacancies
                  .map((v) => {
                    const eligible = !isPast ? getEligibleMembersForVacancy(user, sch, v) : [];
                    return `
                      <div class="vacancy-row-card rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="vacancy-pill">${escapeHtml(formatVacancyBadgeText(v, pastoralMap))}</span>
                        </div>
                        ${
                          eligible.length > 0
                            ? `<button type="button" data-claim-vacancy="${escapeHtml(v.id)}" data-schedule-id="${sch.id}"
                                class="btn-volunteer-serve shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-xs transition">
                                🙋‍♂️ Me Oferecer para Servir
                              </button>`
                            : ''
                        }
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `;
          })()}
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
  const pastoralId = asg.pastoralId || sch.pastoralId;
  const pastoral = dataService.getPastoralById(pastoralId);
  const requesterName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
  const isFam = isFamilyAccount(user);
  const allFamilyMembers = getAccountMembers(user);
  const eligibleFamilyMembers = isFam
    ? allFamilyMembers.filter((m) => doesMemberBelongToPastoral(user, m, pastoralId))
    : allFamilyMembers;
  const familyMembers = eligibleFamilyMembers.length > 0 ? eligibleFamilyMembers : allFamilyMembers;

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

/**
 * Modal de Confirmação Rápida para Candidatura em Vaga Aberta ("🙋‍♂️ Me Oferecer para Servir")
 * Exportado para uso tanto na tela de Escalas quanto no widget "Oportunidades para Servir" do Início (Dashboard).
 */
export function openClaimVacancyModal(scheduleId, vacancyId, user, onDone) {
  const sch = dataService.getScheduleById(scheduleId);
  if (!sch) return;
  const vacancy = (sch.vagasAbertas || []).find((v) => v.id === vacancyId && Number(v.quantidade) > 0);
  if (!vacancy) {
    showToast('Esta vaga já foi preenchida!', 'info');
    onDone?.();
    return;
  }

  const eligible = getEligibleMembersForVacancy(user, sch, vacancy);
  if (eligible.length === 0) {
    showToast('Você (ou sua família) já está escalado(a) nesta pastoral nesta celebração ou não pertence a ela.', 'info');
    return;
  }

  const pastoral = dataService.getPastoralById(vacancy.pastoralId);
  const pastoralMap = Object.fromEntries(dataService.getPastorals().map((p) => [p.id, p]));

  openModal({
    title: 'Confirmar Voluntariado na Escala',
    maxWidth: 'max-w-lg',
    bodyHtml: `
      <form id="claim-vacancy-form" class="space-y-4">
        <div class="rounded-2xl bg-amber-50/90 border border-amber-300 p-4 space-y-2 text-sm text-[#3E2723]">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="vacancy-pill">${escapeHtml(formatVacancyBadgeText(vacancy, pastoralMap))}</span>
            ${renderPastoralPill(pastoral, { compact: true })}
          </div>
          <p class="leading-relaxed">
            Deseja confirmar presença como voluntário(a) na função de <strong class="text-[#B45309]">${escapeHtml(vacancy.funcao)}</strong>
            na celebração de <strong>${escapeHtml(formatDateBR(sch.date))} (${escapeHtml(formatWeekdayBR(sch.date))}) às ${escapeHtml(sch.time)}</strong>
            (${escapeHtml(sch.location)})?
          </p>
        </div>

        ${
          eligible.length > 1
            ? `
          <div>
            <label for="volunteer-member-select" class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">
              Qual integrante da Conta Familiar vai assumir esta vaga? *
            </label>
            <select id="volunteer-member-select" name="memberId" required
              class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] bg-white text-sm font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
              ${eligible.map((m) => `<option value="${escapeHtml(m.memberId)}">${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>
        `
            : `<p class="text-xs text-[#5D4037] bg-[#FAF6F0] border border-[#E6DACE] rounded-xl px-3.5 py-2.5">
                Integrante que será escalado(a): <strong class="text-[#3E2723]">${escapeHtml(eligible[0].name)}</strong>
              </p>`
        }

        <div class="flex justify-end gap-2 pt-2 border-t border-[#E6DACE]/80">
          <button type="button" id="cancel-claim-vac" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" id="confirm-claim-vac" class="btn-volunteer-serve inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-extrabold shadow-xs transition">
            🙋‍♂️ Confirmar e Servir
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-claim-vac').addEventListener('click', closeModal);
      bodyEl.querySelector('#claim-vacancy-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = bodyEl.querySelector('#confirm-claim-vac');
        if (submitBtn) submitBtn.disabled = true;
        const fd = new FormData(e.target);
        const chosenMemberId = eligible.length > 1 ? String(fd.get('memberId')) : eligible[0].memberId;
        const res = await dataService.claimOpenVacancy(scheduleId, vacancyId, {
          userId: user.id,
          memberId: chosenMemberId,
        });
        if (!res?.ok) {
          if (submitBtn) submitBtn.disabled = false;
          showToast(res?.error || 'Não foi possível confirmar esta vaga.', 'error');
          return;
        }
        closeModal();
        showToast('✅ Presença confirmada na escala!');
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
  const allForms = dataService.getForms();
  const allResponses = dataService.getResponses();
  const allLocations = dataService.getLocations();
  const locationMap = Object.fromEntries(allLocations.map((l) => [l.id, l]));
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
            <select id="sch-location-select" name="locationId" required class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm bg-white focus:border-[#B45309] outline-none">
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

        <!-- Contador Rápido de Disponibilidade (Cruzamento Automático com Formulários) -->
        <div id="schedule-availability-banner" class="hidden rounded-2xl border p-3.5 text-xs space-y-2"></div>

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
              <p class="text-[11px] text-[#6D4C41]">1. <strong>Pastoral</strong> → 2. <strong>Função ativa</strong> → 3. <strong>Integrante ativo</strong> (cruzamento automático com Formulários e Contas Familiares).</p>
            </div>
            <button id="btn-add-position-row" type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-[#92400E] border border-amber-300 transition">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              Adicionar Posição
            </button>
          </div>
          <div id="schedule-show-all-wrap" class="hidden mb-2.5">
            <label class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E6DACE] text-xs font-medium text-[#5D4037] hover:bg-amber-50/70 cursor-pointer select-none transition">
              <input id="sch-show-unavailable" type="checkbox" class="rounded text-[#B45309] focus:ring-[#B45309]">
              <span>Mostrar também integrantes indisponíveis ou sem resposta no formulário</span>
            </label>
          </div>
          <div id="positions-list" class="space-y-2.5"></div>
        </div>

        <!-- Vagas em Aberto (Precisa-se de Voluntários) -->
        <div class="pt-3 border-t border-[#E6DACE]/80 space-y-2.5">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <label class="text-xs font-bold uppercase tracking-wider text-[#92400E]">Vagas em Aberto (Precisa-se de Voluntários)</label>
              <p class="text-[11px] text-[#6D4C41]">Registre posições descobertas para que membros da pastoral possam se oferecer pelo app.</p>
            </div>
            <button id="btn-add-vacancy-row" type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-[#78350F] border border-amber-400 transition">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              + Adicionar Vaga em Aberto
            </button>
          </div>
          <div id="vacancies-list" class="space-y-2"></div>
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
      const vacanciesListEl = bodyEl.querySelector('#vacancies-list');
      const dateInput = bodyEl.querySelector('#sch-date-input');
      const timeInput = bodyEl.querySelector('#sch-time-input');
      const locationSelect = bodyEl.querySelector('#sch-location-select');
      const oeSelect = bodyEl.querySelector('#sch-oe-select');
      const oeBadge = bodyEl.querySelector('#sch-oe-badge');
      const litPreview = bodyEl.querySelector('#sch-liturgy-preview');
      const conflictBanner = bodyEl.querySelector('#schedule-conflict-banner');
      const availabilityBanner = bodyEl.querySelector('#schedule-availability-banner');
      const showAllWrap = bodyEl.querySelector('#schedule-show-all-wrap');
      const showUnavailableChk = bodyEl.querySelector('#sch-show-unavailable');

      function computeAvailabilityByPastoral() {
        const date = dateInput.value;
        const time = timeInput.value;
        const locationId = locationSelect?.value || '';
        const locationName = locationMap[locationId]?.name || existing?.location || '';
        const map = new Map();

        allActivePastorals.forEach((p) => {
          const participants = dataService.getActiveParticipantsByPastoral(p.id);
          const result = evaluatePastoralAvailability({
            pastoralId: p.id,
            date,
            time,
            locationId,
            locationName,
            forms: allForms,
            responses: allResponses,
            participants,
            locations: allLocations,
          });
          map.set(p.id, result);
        });
        return map;
      }

      function renderAvailabilitySummary(availabilityByPastoral) {
        const selectedRowPastorals = Array.from(
          new Set(
            Array.from(listEl.querySelectorAll('.pos-pastoral'))
              .map((s) => s.value)
              .filter(Boolean),
          ),
        );

        // Prioriza as pastorais selecionadas nas linhas, mas também destaca outras pastorais sob gestão que tenham formulário para esta missa
        const candidatePids = Array.from(
          new Set([
            ...selectedRowPastorals,
            ...managedPastorals.map((p) => p.id).filter((pid) => availabilityByPastoral.get(pid)?.hasMatch),
          ]),
        );

        const matchedResults = candidatePids
          .map((pid) => ({ pastoral: pastoralMap[pid], avail: availabilityByPastoral.get(pid) }))
          .filter((item) => item.pastoral && item.avail?.hasMatch);

        const anyRowHasMatch = selectedRowPastorals.some((pid) => availabilityByPastoral.get(pid)?.hasMatch);
        showAllWrap.classList.toggle('hidden', !anyRowHasMatch && matchedResults.length === 0);

        if (matchedResults.length === 0) {
          availabilityBanner.classList.add('hidden');
          availabilityBanner.innerHTML = '';
          return;
        }

        availabilityBanner.className =
          'rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50/90 via-[#FDFBF7] to-amber-50/70 p-3.5 text-xs space-y-2 shadow-xs';
        availabilityBanner.innerHTML = `
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i>
              </span>
              <span class="font-extrabold uppercase tracking-wider text-emerald-950">Disponibilidade nos Formulários</span>
            </div>
            <span class="text-[11px] font-bold text-[#6D4C41]">
              ${showUnavailableChk?.checked ? 'Exibindo todos agrupados por status' : 'Filtro ativo: exibindo apenas ✅ Disponíveis'}
            </span>
          </div>
          <div class="space-y-1.5">
            ${matchedResults
              .map(({ pastoral, avail }) => {
                const pLabelRaw = String(pastoral.shortName || pastoral.name).toLowerCase();
                const pLabel = avail.available.length === 1 && pLabelRaw.endsWith('s') ? pLabelRaw.slice(0, -1) : pLabelRaw;
                return `
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 bg-white/90 rounded-xl border border-emerald-200/80 px-3 py-2">
                    <div class="space-y-0.5 min-w-0">
                      <p class="font-extrabold text-[#3E2723] text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                        <span class="inline-flex items-center gap-1 text-emerald-800">
                          ✅ ${avail.available.length} ${escapeHtml(pLabel)} ${avail.available.length === 1 ? 'disponível' : 'disponíveis'} para esta missa (de ${avail.totalRegular})
                        </span>
                      </p>
                      <p class="text-[11px] text-[#6D4C41] truncate">
                        Formulário: <strong>${escapeHtml(avail.form.title)}</strong> • Pergunta: <em>${escapeHtml(avail.question.text)}</em>
                      </p>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap shrink-0 text-[10px] font-bold">
                      <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">✅ ${avail.available.length} disp.</span>
                      <span class="px-2 py-0.5 rounded-full bg-amber-100 text-[#92400E] border border-amber-200">⏳ ${avail.noResponse.length} s/ resp.</span>
                      <span class="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">❌ ${avail.unavailable.length} indisp.</span>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        `;
        availabilityBanner.classList.remove('hidden');
      }

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
          oeSelect.value = lit.oracaoEucaristicaSugerida || lit.defaultEucharisticPrayerId;
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
        const pickedInSamePastoralRole = {};
        const pickedInSamePastoral = {};

        listEl.querySelectorAll('.position-row').forEach((row) => {
          const val = row.querySelector('.pos-user').value;
          const rowPid = row.querySelector('.pos-pastoral')?.value || '';
          const rowRoleId = row.querySelector('.pos-role')?.value || '';
          if (!val) return;
          const [accountId, memberId] = val.split('::');
          const personKey = memberId || accountId;
          const memberName = resolveAssignedMemberName(userMap, accountId, memberId);
          const pName = pastoralMap[rowPid]?.shortName || 'esta pastoral';

          // Chave composta integranteId + pastoralId + roleId (bloqueada no submit)
          if (rowPid && rowRoleId) {
            const compositeRoleKey = `${personKey}::${rowPid}::${rowRoleId}`;
            pickedInSamePastoralRole[compositeRoleKey] = (pickedInSamePastoralRole[compositeRoleKey] || 0) + 1;
            if (pickedInSamePastoralRole[compositeRoleKey] === 2) {
              const rName = roleMap[rowRoleId]?.name || 'esta função';
              warnings.push(
                `<strong>${escapeHtml(memberName)}</strong> está duplicado(a) na mesma pastoral e função (<strong>${escapeHtml(pName)} — ${escapeHtml(rName)}</strong>).`,
              );
            }
          }

          // Aviso amigável apenas se repetido na MESMA pastoral (multi-pastoral em pastorais diferentes é 100% permitido)
          if (rowPid) {
            const compositePastoralKey = `${personKey}::${rowPid}`;
            pickedInSamePastoral[compositePastoralKey] = (pickedInSamePastoral[compositePastoralKey] || 0) + 1;
            if (
              pickedInSamePastoral[compositePastoralKey] === 2 &&
              !(rowRoleId && pickedInSamePastoralRole[`${personKey}::${rowPid}::${rowRoleId}`] >= 2)
            ) {
              warnings.push(
                `<strong>${escapeHtml(memberName)}</strong> foi selecionado(a) em mais de uma função dentro de <strong>${escapeHtml(pName)}</strong> nesta escala.`,
              );
            }
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
                <p class="font-bold text-[#92400E]">Atenção na escala:</p>
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

      function collectSameCelebrationSelected() {
        const date = dateInput.value;
        const time = timeInput.value;
        // Mapa: memberId -> { accountId, memberId, name }
        const selectedByMemberId = new Map();

        // 1. Seleções atuais no formulário desta escala
        listEl.querySelectorAll('.position-row').forEach((row) => {
          const val = row.querySelector('.pos-user')?.value;
          if (!val) return;
          const [accountId, memberId] = val.split('::');
          const mId = memberId || accountId;
          selectedByMemberId.set(mId, {
            accountId,
            memberId: mId,
            name: resolveAssignedMemberName(userMap, accountId, mId),
          });
        });

        // 2. Escalas já salvas em outra pastoral no mesmo dia e horário
        if (date && time) {
          allSchedules.forEach((s) => {
            if (existing?.id && s.id === existing.id) return;
            if (s.date !== date || s.time !== time) return;
            (s.assignments || []).forEach((a) => {
              const mId = a.memberId || a.userId;
              if (!selectedByMemberId.has(mId)) {
                selectedByMemberId.set(mId, {
                  accountId: a.userId,
                  memberId: mId,
                  name: resolveAssignedMemberName(userMap, a.userId, mId),
                });
              }
            });
          });
        }

        return selectedByMemberId;
      }

      function getSiblingAvailabilityStatus(accountId, sib, availabilityByPastoral) {
        const sibPid = sib.pastoralId || '';
        const sibAvail = sibPid ? availabilityByPastoral.get(sibPid) : null;
        if (!sibAvail?.hasMatch) return null;
        const entry = sibAvail.statusByKey.get(`${accountId}::${sib.id}`);
        return entry?.status || null;
      }

      function populateUserSelect(row, pastoralId, currentVal = '', sameCelebrationMap = new Map(), availabilityByPastoral = new Map()) {
        const userSel = row.querySelector('.pos-user');
        const roleId = row.querySelector('.pos-role')?.value || '';
        const isCoordRole = isCoordinatorRole(roleId, roleMap);
        const participants = dataService.getActiveParticipantsByPastoral(pastoralId);
        const avail = availabilityByPastoral.get(pastoralId);
        const hasFormMatch = Boolean(avail?.hasMatch);
        const showAll = Boolean(showUnavailableChk?.checked);

        const buildItemMeta = (p) => {
          const val = `${p.accountId}::${p.memberId}`;
          const info = hasFormMatch ? avail.statusByKey.get(val) : null;
          const status = info?.status || null;

          const siblingMatches = (p.siblings || [])
            .filter((sib) => sameCelebrationMap.has(sib.id))
            .map((sib) => sib.name);

          const availableSiblings = hasFormMatch
            ? (p.siblings || [])
                .filter((sib) => !sameCelebrationMap.has(sib.id))
                .map((sib) => {
                  const sibPid = sib.pastoralId || pastoralId;
                  const sibStatus = getSiblingAvailabilityStatus(p.accountId, { ...sib, pastoralId: sibPid }, availabilityByPastoral);
                  return sibStatus === 'available'
                    ? `${sib.name}${sibPid !== pastoralId && pastoralMap[sibPid] ? ` - ${pastoralMap[sibPid].shortName}` : ''}`
                    : null;
                })
                .filter(Boolean)
            : [];

          return { p, val, status, siblingMatches, availableSiblings };
        };

        const buildOpt = ({ p, val, status, siblingMatches = [], availableSiblings = [] }) => {
          const selected =
            val === currentVal ||
            (currentVal && !currentVal.includes('::') && p.accountId === currentVal);

          const statusPrefix =
            status === 'available'
              ? '✅ '
              : status === 'unavailable'
                ? '❌ '
                : status === 'no_response'
                  ? '⏳ '
                  : '';

          const statusTag =
            status === 'available'
              ? ' • Disponível'
              : status === 'unavailable'
                ? ' • Indisponível'
                : status === 'no_response'
                  ? ' • Não respondeu'
                  : '';

          let extraNote = '';
          if (siblingMatches.length > 0) {
            extraNote = ` (★ Irmão/ã de ${siblingMatches.join(', ')} nesta missa)`;
          } else if (availableSiblings.length > 0) {
            extraNote = ` (Irmão/ã ${availableSiblings.join(', ')} também disponível)`;
          } else if (p.isFamily) {
            extraNote = ' (Conta Familiar)';
          }

          const label = `${statusPrefix}${siblingMatches.length > 0 && !statusPrefix ? '★ ' : ''}${p.name}${statusTag}${extraNote}`;
          return `<option value="${val}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        };

        const allItems = participants.map(buildItemMeta);

        // Sem formulário correspondente: comportamento clássico com destaque de irmãos
        if (!hasFormMatch) {
          const highlighted = allItems.filter((it) => it.siblingMatches.length > 0);
          const regular = allItems.filter((it) => it.siblingMatches.length === 0);
          let optionsHtml = '<option value="">3. Integrante ativo...</option>';
          if (highlighted.length > 0) {
            optionsHtml += `<optgroup label="★ Irmãos já escalados nesta celebração">${highlighted.map(buildOpt).join('')}</optgroup>`;
            optionsHtml += `<optgroup label="Demais integrantes da pastoral">${regular.map(buildOpt).join('')}</optgroup>`;
          } else {
            optionsHtml += regular.map(buildOpt).join('');
          }
          userSel.innerHTML = optionsHtml;
          return;
        }

        // COM formulário correspondente e checkbox DESMARCADO: filtra somente Disponíveis (com exceção segura para valor já salvo e função Coordenador)
        if (!showAll) {
          const availItems = allItems.filter((it) => it.status === 'available');
          const highlighted = availItems.filter((it) => it.siblingMatches.length > 0);
          const regularAvail = availItems.filter((it) => it.siblingMatches.length === 0);

          const coordCandidates = isCoordRole
            ? allItems.filter(
                (it) =>
                  it.status !== 'available' &&
                  (it.p.account?.isGeneralAdmin ||
                    (it.p.account?.memberships || []).some(
                      (m) => m.pastoralId === pastoralId && m.role === 'Coordenador',
                    )),
              )
            : [];

          // Preserva integrante já escalado ao editar uma escala existente (mesmo que não esteja marcado como disponível)
          const preservedCurrent = currentVal
            ? allItems.find(
                (it) =>
                  (it.val === currentVal || (!currentVal.includes('::') && it.p.accountId === currentVal)) &&
                  it.status !== 'available' &&
                  !coordCandidates.some((c) => c.val === it.val),
              )
            : null;

          let optionsHtml =
            availItems.length > 0 || coordCandidates.length > 0
              ? `<option value="">3. Integrante disponível (${availItems.length})...</option>`
              : '<option value="">Nenhum integrante disponível no formulário (marque a opção acima para ver todos)</option>';

          if (preservedCurrent) {
            optionsHtml += `<optgroup label="Escalado atualmente (exceção)">${buildOpt(preservedCurrent)}</optgroup>`;
          }
          if (isCoordRole && coordCandidates.length > 0) {
            optionsHtml += `<optgroup label="👑 Coordenadores da Pastoral">${coordCandidates.map(buildOpt).join('')}</optgroup>`;
          }
          if (highlighted.length > 0) {
            optionsHtml += `<optgroup label="★ Disponíveis com irmão/ã nesta celebração">${highlighted.map(buildOpt).join('')}</optgroup>`;
            if (regularAvail.length > 0) {
              optionsHtml += `<optgroup label="✅ Disponíveis no formulário (${regularAvail.length})">${regularAvail.map(buildOpt).join('')}</optgroup>`;
            }
          } else if (availItems.length > 0) {
            optionsHtml += `<optgroup label="✅ Disponíveis no formulário (${availItems.length})">${availItems.map(buildOpt).join('')}</optgroup>`;
          }

          userSel.innerHTML = optionsHtml;
          return;
        }

        // COM formulário correspondente e checkbox MARCADO: todos os membros agrupados por status
        const highlightedAll = allItems.filter((it) => it.siblingMatches.length > 0);
        const nonHighlighted = allItems.filter((it) => it.siblingMatches.length === 0);
        const groupAvail = nonHighlighted.filter((it) => it.status === 'available');
        const groupNoResp = nonHighlighted.filter((it) => it.status === 'no_response');
        const groupUnavail = nonHighlighted.filter((it) => it.status === 'unavailable');

        let optionsHtml = '<option value="">3. Selecionar integrante (todos os status)...</option>';
        if (highlightedAll.length > 0) {
          optionsHtml += `<optgroup label="★ Irmãos já escalados nesta celebração">${highlightedAll.map(buildOpt).join('')}</optgroup>`;
        }
        if (groupAvail.length > 0) {
          optionsHtml += `<optgroup label="✅ Disponíveis (${groupAvail.length})">${groupAvail.map(buildOpt).join('')}</optgroup>`;
        }
        if (groupNoResp.length > 0) {
          optionsHtml += `<optgroup label="⏳ Não responderam (${groupNoResp.length})">${groupNoResp.map(buildOpt).join('')}</optgroup>`;
        }
        if (groupUnavail.length > 0) {
          optionsHtml += `<optgroup label="❌ Indisponíveis (${groupUnavail.length})">${groupUnavail.map(buildOpt).join('')}</optgroup>`;
        }
        userSel.innerHTML = optionsHtml;
      }

      function refreshSiblingReconciliation() {
        const sameCelebrationMap = collectSameCelebrationSelected();
        const availabilityByPastoral = computeAvailabilityByPastoral();
        renderAvailabilitySummary(availabilityByPastoral);

        listEl.querySelectorAll('.position-row').forEach((row) => {
          const pastoralId = row.querySelector('.pos-pastoral').value;
          const userSel = row.querySelector('.pos-user');
          const currentVal = userSel.value;

          // Atualiza filtro de disponibilidade e destaque de irmãos preservando o valor selecionado
          populateUserSelect(row, pastoralId, currentVal, sameCelebrationMap, availabilityByPastoral);

          // Atualiza a etiqueta discreta de irmãos vinculados abaixo da linha
          const hintEl = row.querySelector('.pos-sibling-hint');
          if (!hintEl) return;

          if (!currentVal) {
            hintEl.innerHTML = '';
            hintEl.classList.add('hidden');
            return;
          }

          const [accountId, memberId] = currentVal.split('::');
          const siblings = getLinkedSiblingsInfo(userMap, accountId, memberId, pastoralMap);

          if (siblings.length === 0) {
            hintEl.innerHTML = '';
            hintEl.classList.add('hidden');
            return;
          }

          hintEl.classList.remove('hidden');
          hintEl.innerHTML = `
            <div class="flex items-center gap-1.5 flex-wrap pt-1.5">
              ${siblings
                .map((sib) => {
                  const alreadyInMass = sameCelebrationMap.has(sib.id);
                  const sibAvailStatus = getSiblingAvailabilityStatus(accountId, sib, availabilityByPastoral);
                  const pSuffix = sib.pastoralShortName ? ` • ${escapeHtml(sib.pastoralShortName)}` : '';
                  const canQuickAdd = !alreadyInMass && sib.pastoralId && managedIds.has(sib.pastoralId);

                  let pillCls = 'bg-amber-50 text-[#78350F] border-amber-300';
                  let pillText = `Irmão(ã): ${escapeHtml(sib.name)}${pSuffix}`;
                  if (alreadyInMass) {
                    pillCls = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                    pillText = `✓ Irmão(ã) nesta celebração: ${escapeHtml(sib.name)}${pSuffix}`;
                  } else if (sibAvailStatus === 'available') {
                    pillCls = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                    pillText = `✅ Irmão(ã) disponível no formulário: ${escapeHtml(sib.name)}${pSuffix}`;
                  } else if (sibAvailStatus === 'unavailable') {
                    pillCls = 'bg-red-50 text-red-700 border-red-200';
                    pillText = `❌ Irmão(ã) indisponível no formulário: ${escapeHtml(sib.name)}${pSuffix}`;
                  } else if (sibAvailStatus === 'no_response') {
                    pillCls = 'bg-amber-50 text-[#78350F] border-amber-300';
                    pillText = `⏳ Irmão(ã) sem resposta no formulário: ${escapeHtml(sib.name)}${pSuffix}`;
                  }

                  return `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${pillCls}">
                      <i data-lucide="users" class="w-3 h-3"></i>
                      ${pillText}
                    </span>
                    ${
                      canQuickAdd
                        ? `<button type="button" data-quick-add-sib-acc="${sib.accountId}" data-quick-add-sib-mid="${sib.id}" data-quick-add-sib-pid="${sib.pastoralId}"
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 transition">
                            + Escalar ${escapeHtml(sib.name)}
                          </button>`
                        : ''
                    }
                  `;
                })
                .join('')}
            </div>
          `;

          hintEl.querySelectorAll('[data-quick-add-sib-mid]').forEach((qBtn) => {
            qBtn.addEventListener('click', () => {
              addPositionRow({
                pastoralId: qBtn.dataset.quickAddSibPid,
                userId: qBtn.dataset.quickAddSibAcc,
                memberId: qBtn.dataset.quickAddSibMid,
              });
            });
          });
        });

        refreshIcons();
      }

      function populateRolesAndMembers(row, pastoralId, presetRoleId = '', presetUserId = '', presetMemberId = '') {
        const activeRoles = dataService.getActiveRolesByPastoral(pastoralId);
        const targetKey = presetUserId ? `${presetUserId}::${presetMemberId || presetUserId}` : '';

        row.querySelector('.pos-role').innerHTML = `
          <option value="">2. Função ativa...</option>
          ${activeRoles.map((r) => `<option value="${r.id}" ${presetRoleId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
        `;
        populateUserSelect(row, pastoralId, targetKey, collectSameCelebrationSelected(), computeAvailabilityByPastoral());
      }

      function addPositionRow(preset = null) {
        const rowPastoralId =
          preset?.pastoralId && managedIds.has(preset.pastoralId)
            ? preset.pastoralId
            : managedIds.has(defaultPastoralId)
              ? defaultPastoralId
              : managedPastorals[0].id;

        const row = document.createElement('div');
        row.className = 'position-row bg-[#FAF6F0] p-2.5 rounded-xl border border-[#E6DACE]';
        row.dataset.asgId = preset?.id || '';
        row.dataset.subReq = preset?.substitutionRequested ? '1' : '0';
        row.dataset.subReason = preset?.substitutionReason || '';
        row.dataset.subAccepted = preset?.substitutionAccepted ? '1' : '0';
        row.dataset.subFrom = preset?.substitutedFromName || '';
        row.dataset.subFromUid = preset?.substituidoDe?.userId || '';
        row.dataset.subFromMid = preset?.substituidoDe?.memberId || '';
        row.dataset.subFromNome = preset?.substituidoDe?.nome || '';
        row.dataset.subRecId = preset?.substitutionRecordId || '';
        row.dataset.subAt = preset?.substitutedAt || '';
        row.dataset.voluntario = preset?.voluntario ? '1' : '0';

        row.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
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
          </div>
          <div class="pos-sibling-hint hidden"></div>
        `;

        populateRolesAndMembers(row, rowPastoralId, preset?.roleId || '', preset?.userId || '', preset?.memberId || '');
        row.querySelector('.pos-pastoral').addEventListener('change', (e) => {
          populateRolesAndMembers(row, e.target.value);
          updateConflictWarnings();
          refreshSiblingReconciliation();
        });
        row.querySelector('.pos-role').addEventListener('change', () => {
          refreshSiblingReconciliation();
        });
        row.querySelector('.pos-user').addEventListener('change', () => {
          updateConflictWarnings();
          refreshSiblingReconciliation();
        });
        row.querySelector('.remove-pos-btn').addEventListener('click', () => {
          row.remove();
          updateConflictWarnings();
          refreshSiblingReconciliation();
        });

        listEl.appendChild(row);
        updateConflictWarnings();
        refreshSiblingReconciliation();
      }

      const STANDARD_VACANCY_ROLES = ['Altar', 'Missal', 'Credência', 'Turíbulo', 'Naveta', 'Tocha'];

      function buildVacancyRoleOptions(pastoralId, selectedFunc = '') {
        const activeRoles = dataService
          .getActiveRolesByPastoral(pastoralId)
          .filter((r) => !isCoordinatorRole(r.id, roleMap));
        const namesSeen = new Set();
        const opts = [];
        activeRoles.forEach((r) => {
          namesSeen.add(r.name.toLowerCase());
          opts.push({ label: r.name, roleId: r.id });
        });
        STANDARD_VACANCY_ROLES.forEach((std) => {
          if (!namesSeen.has(std.toLowerCase())) {
            opts.push({ label: std, roleId: '' });
          }
        });
        return opts
          .map(
            (o) =>
              `<option value="${escapeHtml(o.label)}" data-role-id="${escapeHtml(o.roleId)}" ${
                selectedFunc && o.label.toLowerCase() === selectedFunc.toLowerCase() ? 'selected' : ''
              }>${escapeHtml(o.label)}</option>`,
          )
          .join('');
      }

      function addVacancyRow(preset = null) {
        const vPastoralId =
          preset?.pastoralId && managedIds.has(preset.pastoralId)
            ? preset.pastoralId
            : managedIds.has(defaultPastoralId)
              ? defaultPastoralId
              : managedPastorals[0].id;
        const defaultFunc =
          preset?.funcao || (pastoralMap[vPastoralId]?.shortName?.toLowerCase().includes('acól') ? 'Credência' : 'Altar');

        const vRow = document.createElement('div');
        vRow.className = 'vacancy-row vacancy-row-card p-2.5 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center';
        vRow.dataset.vid = preset?.id || '';
        vRow.innerHTML = `
          <div class="sm:col-span-4">
            <select class="vac-pastoral w-full px-2.5 py-2 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
              ${managedPastorals.map((p) => `<option value="${p.id}" ${vPastoralId === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`).join('')}
            </select>
          </div>
          <div class="sm:col-span-4">
            <select class="vac-role w-full px-2.5 py-2 rounded-lg border border-amber-300 bg-white text-xs font-medium text-[#3E2723] outline-none focus:border-[#B45309]">
              ${buildVacancyRoleOptions(vPastoralId, defaultFunc)}
            </select>
          </div>
          <div class="sm:col-span-3 flex items-center gap-1.5">
            <span class="text-[11px] font-bold text-[#78350F] shrink-0">Qtd:</span>
            <input type="number" min="1" max="10" value="${Math.max(1, parseInt(preset?.quantidade, 10) || 1)}"
              class="vac-qty w-full px-2.5 py-2 rounded-lg border border-amber-300 bg-white text-xs font-extrabold text-[#3E2723] outline-none focus:border-[#B45309]">
          </div>
          <div class="sm:col-span-1 flex justify-end">
            <button type="button" class="remove-vac-btn p-1.5 rounded-lg text-[#8D6E63] hover:text-red-700 hover:bg-red-50 transition" title="Remover vaga">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        `;

        const vacPastoralSel = vRow.querySelector('.vac-pastoral');
        const vacRoleSel = vRow.querySelector('.vac-role');
        vacPastoralSel.addEventListener('change', () => {
          const fallback = pastoralMap[vacPastoralSel.value]?.shortName?.toLowerCase().includes('acól')
            ? 'Credência'
            : 'Altar';
          vacRoleSel.innerHTML = buildVacancyRoleOptions(vacPastoralSel.value, fallback);
        });
        vRow.querySelector('.remove-vac-btn').addEventListener('click', () => vRow.remove());

        vacanciesListEl.appendChild(vRow);
        refreshIcons();
      }

      if (existing?.assignments?.length) {
        existing.assignments.filter((a) => managedIds.has(a.pastoralId || existing.pastoralId)).forEach((a) => addPositionRow(a));
      } else if (!existing?.vagasAbertas?.length) {
        addPositionRow();
      }

      if (existing?.vagasAbertas?.length) {
        existing.vagasAbertas
          .filter((v) => managedIds.has(v.pastoralId))
          .forEach((v) => addVacancyRow(v));
      }

      bodyEl.querySelector('#btn-add-vacancy-row')?.addEventListener('click', () => addVacancyRow());

      dateInput.addEventListener('change', () => {
        syncLiturgyForDate(dateInput.value, true);
        updateConflictWarnings();
        refreshSiblingReconciliation();
      });
      timeInput.addEventListener('change', () => {
        updateConflictWarnings();
        refreshSiblingReconciliation();
      });
      locationSelect?.addEventListener('change', () => {
        refreshSiblingReconciliation();
      });
      showUnavailableChk?.addEventListener('change', () => {
        refreshSiblingReconciliation();
      });
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
              substituidoDe: row.dataset.subFromNome
                ? {
                    userId: row.dataset.subFromUid || '',
                    memberId: row.dataset.subFromMid || '',
                    nome: row.dataset.subFromNome,
                  }
                : null,
              substitutionRecordId: row.dataset.subRecId || null,
              substitutedAt: row.dataset.subAt || null,
              voluntario: row.dataset.voluntario === '1',
            });
          }
        });

        const editedVagas = [];
        vacanciesListEl.querySelectorAll('.vacancy-row').forEach((vRow) => {
          const vPid = vRow.querySelector('.vac-pastoral')?.value;
          const vRoleSel = vRow.querySelector('.vac-role');
          const vFuncao = vRoleSel?.value?.trim();
          const vRoleId = vRoleSel?.selectedOptions?.[0]?.dataset?.roleId || '';
          const vQty = Math.max(1, parseInt(vRow.querySelector('.vac-qty')?.value, 10) || 1);
          if (vPid && vFuncao && vQty > 0) {
            editedVagas.push({
              id: vRow.dataset.vid || undefined,
              pastoralId: vPid,
              pastoralNome: pastoralMap[vPid]?.shortName || pastoralMap[vPid]?.name || 'Pastoral',
              funcao: vFuncao,
              roleId: vRoleId,
              quantidade: vQty,
            });
          }
        });

        const preserved = (existing?.assignments || []).filter((a) => !managedIds.has(a.pastoralId || existing.pastoralId));
        const preservedVagas = (existing?.vagasAbertas || []).filter((v) => !managedIds.has(v.pastoralId));
        const finalAssignments = [...preserved, ...edited];
        const finalVagas = [...preservedVagas, ...editedVagas];
        if (finalAssignments.length === 0 && finalVagas.length === 0) {
          showToast('Adicione pelo menos uma posição ou uma vaga em aberto.', 'error');
          return;
        }

        // Bloqueia apenas duplicidade exata dentro da mesma pastoral + função (permite multi-pastoral na mesma missa)
        const seenComposite = new Set();
        for (const a of finalAssignments) {
          const personKey = a.memberId || a.userId;
          const compositeKey = `${personKey}::${a.pastoralId}::${a.roleId}`;
          if (seenComposite.has(compositeKey)) {
            const dupName = resolveAssignedMemberName(userMap, a.userId, a.memberId);
            const dupPastoral = pastoralMap[a.pastoralId]?.shortName || 'Pastoral';
            const dupRole = roleMap[a.roleId]?.name || 'Função';
            showToast(
              `${dupName} já está escalado(a) em ${dupPastoral} (${dupRole}) nesta celebração. Remova a linha duplicada.`,
              'error',
            );
            return;
          }
          seenComposite.add(compositeKey);
        }

        dataService.saveSchedule({
          id: existing?.id,
          date: fd.get('date'),
          time: fd.get('time'),
          locationId: fd.get('locationId'),
          celebrationTypeId: fd.get('celebrationTypeId'),
          pastoralId:
            existing?.pastoralId ||
            finalAssignments[0]?.pastoralId ||
            finalVagas[0]?.pastoralId ||
            managedPastorals[0].id,
          eucharisticPrayerId: fd.get('eucharisticPrayerId'),
          eucharisticPrayerSource: oeSource,
          celebrantScript: String(fd.get('celebrantScript') || '').trim(),
          notes: String(fd.get('notes') || '').trim(),
          assignments: finalAssignments,
          vagasAbertas: finalVagas,
        });

        closeModal();
        showToast(existing ? 'Escala e roteiro atualizados!' : 'Escala publicada e sincronizada com a Agenda e Liturgia!');
        onSaved();
      });
    },
  });
}

export function openSubstitutionModal(scheduleId, assignmentId, onDone) {
  const sch = dataService.getScheduleById(scheduleId);
  const asg = sch?.assignments?.find((a) => a.id === assignmentId);
  const pastoral = asg ? dataService.getPastoralById(asg.pastoralId || sch.pastoralId) : null;
  const role = asg ? dataService.getRoleById(asg.roleId) : null;
  const userMap = Object.fromEntries(dataService.getUsers().map((u) => [u.id, u]));
  const memberName = asg ? resolveAssignedMemberName(userMap, asg.userId, asg.memberId) : '';

  openModal({
    title: 'Solicitar Substituição',
    bodyHtml: `
      <form id="sub-form" class="space-y-4">
        ${
          sch && asg
            ? `
          <div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] p-3 space-y-1.5 text-xs text-[#4E342E]">
            <div class="flex items-center gap-2 flex-wrap">
              ${renderPastoralPill(pastoral, { compact: true })}
              <span class="font-extrabold text-[#3E2723]">${escapeHtml(role?.name || 'Função')}</span>
              ${memberName ? `<span class="text-[#8D6E63]">•</span><span class="font-bold text-[#78350F]">${escapeHtml(memberName)}</span>` : ''}
            </div>
            <p class="text-[#6D4C41]">
              ${escapeHtml(formatDateBR(sch.date))} às ${escapeHtml(sch.time)} • ${escapeHtml(sch.celebrationType)} (${escapeHtml(sch.location)})
            </p>
          </div>
        `
            : ''
        }
        <p class="text-sm text-[#5D4037]">
          Informe o motivo da sua indisponibilidade. Os colegas e coordenadores da pastoral <strong>${escapeHtml(pastoral?.shortName || 'vinculada')}</strong> serão notificados no sino para que alguém possa assumir esta função!
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
        onDone?.();
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

// --- Importador Inteligente de Escala (Texto WhatsApp) ---

function normText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findParticipantByName(rawToken, pastoralId, participantsByPastoral, allUsers) {
  let cleanToken = String(rawToken || '').trim();
  let roleHint = '';
  const parenMatch = cleanToken.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const inner = normText(parenMatch[2]);
    // Mantém "(Acólitos)" ou "(Coroinhas)" como desambiguador de nome; outros parênteses viram função (ex: Missal, Turíbulo)
    if (!inner.includes('acolit') && !inner.includes('coroinh')) {
      cleanToken = parenMatch[1].trim();
      roleHint = parenMatch[2].trim();
    }
  }

  const targetNorm = normText(cleanToken);
  if (!targetNorm) return null;

  const pool = pastoralId ? participantsByPastoral[pastoralId] || [] : [];

  const matchInList = (list) => {
    // 1. Correspondência exata normalizada
    let hit = list.find((p) => normText(p.name) === targetNorm);
    if (hit) return hit;
    // 2. Correspondência removendo sufixo "(Acólitos)" / "(Coroinhas)"
    hit = list.find((p) => normText(p.name.replace(/\([^)]*\)/g, '')) === targetNorm);
    if (hit) return hit;
    // 3. Primeiro nome exato ou prefixo (ex: "Natália" -> "Natália Faria de Souza")
    hit = list.find((p) => normText(p.name).startsWith(`${targetNorm} `) || normText(p.name) === targetNorm);
    return hit || null;
  };

  let found = matchInList(pool);
  if (!found && pastoralId === null) {
    // Busca entre coordenadores / todos os usuários ativos
    const flatAll = [];
    allUsers
      .filter((u) => u.status === 'Ativo')
      .forEach((u) => {
        getAccountMembers(u).forEach((m) => {
          flatAll.push({ accountId: u.id, memberId: m.id, name: m.name });
        });
      });
    found = matchInList(flatAll);
  }

  return found ? { ...found, roleHint } : null;
}

function parseWhatsAppScheduleText(
  rawText,
  {
    defaultYear,
    defaultPastoralId,
    pastorals,
    locations,
    celebrationTypes,
    roles,
    users,
    skipSunday7Cor = true,
    minCoroinhas = 0,
    minAcolitos = 0,
  },
) {
  const activePastorals = pastorals.filter((p) => p.active);
  const coroinhasP = activePastorals.find((p) => normText(p.shortName) === 'coroinhas') || activePastorals[0];
  const acolitosP = activePastorals.find((p) => normText(p.shortName) === 'acolitos') || activePastorals[1] || activePastorals[0];
  const defaultLoc = locations.find((l) => normText(l.name).includes('matriz')) || locations[0];

  const participantsByPastoral = {};
  activePastorals.forEach((p) => {
    participantsByPastoral[p.id] = dataService.getActiveParticipantsByPastoral(p.id);
  });

  const findRoleFor = (pastoralId, hintText, isCoord = false) => {
    const pRoles = roles.filter((r) => r.pastoralId === pastoralId && r.active);
    if (isCoord) {
      return pRoles.find((r) => normText(r.name).includes('coordenador')) || pRoles[0];
    }
    if (hintText) {
      const hn = normText(hintText);
      const exact = pRoles.find((r) => normText(r.name).includes(hn) || hn.includes(normText(r.name)));
      if (exact) return exact;
      if (hn.includes('turib')) {
        const tur = pRoles.find((r) => normText(r.name).includes('turif') || normText(r.name).includes('turib'));
        if (tur) return tur;
      }
      if (hn.includes('toch') || hn.includes('vela')) {
        const vela = pRoles.find((r) => normText(r.name).includes('toch') || normText(r.name).includes('vela'));
        if (vela) return vela;
      }
    }
    return pRoles.find((r) => normText(r.name).includes('altar')) || pRoles[0];
  };

  const detectLocation = (line) => {
    const ln = normText(line);
    if (ln.includes('maria goretti') || ln.includes('goretti')) {
      return locations.find((l) => normText(l.name).includes('goretti')) || defaultLoc;
    }
    if (ln.includes('sao francisco') || ln.includes('francisco')) {
      return locations.find((l) => normText(l.name).includes('francisco')) || defaultLoc;
    }
    if (ln.includes('sav')) {
      return locations.find((l) => normText(l.name).includes('sav')) || defaultLoc;
    }
    if (ln.includes('matriz')) return defaultLoc;
    const match = locations.find((l) => ln.includes(normText(l.name)));
    return match || null;
  };

  const detectCelebrationType = (contextText, isoDate) => {
    const cn = normText(contextText);
    if (cn.includes('finados')) return celebrationTypes.find((c) => normText(c.name).includes('finados')) || celebrationTypes[0];
    if (cn.includes('sagrado')) return celebrationTypes.find((c) => normText(c.name).includes('sagrado')) || celebrationTypes[0];
    if (cn.includes('novena')) return celebrationTypes.find((c) => normText(c.name).includes('novena')) || celebrationTypes[0];
    if (cn.includes('sav')) return celebrationTypes.find((c) => normText(c.name).includes('sav')) || celebrationTypes[0];
    const [y, m, d] = isoDate.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) {
      return celebrationTypes.find((c) => normText(c.name).includes('dominical')) || celebrationTypes[0];
    }
    return celebrationTypes.find((c) => normText(c.name).includes('semanal')) || celebrationTypes[0];
  };

  const isSunday7AM = (isoDate, time) => {
    if (!isoDate || time !== '07:00') return false;
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === 0;
  };

  const isAbsenceToken = (rawStr) => {
    const t = normText(rawStr);
    if (!t) return true;
    return (
      /\bvaga\b/.test(t) ||
      /\bfalta\b/.test(t) ||
      t.includes('sem escala') ||
      t.includes('sem disponibilidade') ||
      t.includes('ninguem') ||
      t.includes('nenhum') ||
      t === '-' ||
      t === '—'
    );
  };

  const addVacancyToEntry = (entry, pastoralObj, funcao, quantidade = 1) => {
    if (!entry || !pastoralObj || quantidade <= 0) return;
    if (
      skipSunday7Cor &&
      coroinhasP &&
      pastoralObj.id === coroinhasP.id &&
      isSunday7AM(entry.date, entry.time)
    ) {
      return;
    }
    const existingVac = entry.vagasAbertas.find(
      (v) => v.pastoralId === pastoralObj.id && normText(v.funcao) === normText(funcao),
    );
    if (existingVac) {
      existingVac.quantidade += quantidade;
    } else {
      const roleObj = findRoleFor(pastoralObj.id, funcao, false);
      entry.vagasAbertas.push({
        id: `imp_vaga_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        pastoralId: pastoralObj.id,
        pastoralNome: pastoralObj.shortName || pastoralObj.name,
        funcao,
        roleId: roleObj?.id || '',
        quantidade,
      });
    }
  };

  // Detecta se o conteúdo é CSV tabular (ex: Data;Horário;Local;Coroinhas;Acólitos)
  const rawLines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries = [];
  let currentDate = null;
  let currentDayHint = '';
  let currentEntry = null;
  let sawDecember = false;

  const ensureEntry = (dateIso, time, locObj, contextText) => {
    if (!dateIso) return null;
    const loc = locObj || defaultLoc;
    const ct = detectCelebrationType(`${currentDayHint} ${contextText}`, dateIso);
    let existing = entries.find((e) => e.date === dateIso && e.time === time && e.locationId === loc.id);
    if (!existing) {
      existing = {
        date: dateIso,
        time,
        locationId: loc.id,
        location: loc.name,
        celebrationTypeId: ct.id,
        celebrationType: ct.name,
        assignments: [],
        vagasAbertas: [],
        notes: [],
        unmatched: [],
        touchedCoroinhas: false,
        touchedAcolitos: false,
      };
      entries.push(existing);
    }
    currentEntry = existing;
    return existing;
  };

  const addNamesToEntry = (entry, rawNames, pastoralId, isCoord = false) => {
    if (!entry) return;
    const pastoralObj = activePastorals.find((p) => p.id === pastoralId);
    if (coroinhasP && pastoralId === coroinhasP.id) entry.touchedCoroinhas = true;
    if (acolitosP && pastoralId === acolitosP.id) entry.touchedAcolitos = true;

    const cleanRaw = String(rawNames || '').trim();
    if (!isCoord && isAbsenceToken(cleanRaw)) {
      if (coroinhasP && pastoralId === coroinhasP.id) {
        addVacancyToEntry(entry, coroinhasP, 'Altar', 2);
      } else if (acolitosP && pastoralId === acolitosP.id) {
        addVacancyToEntry(entry, acolitosP, 'Credência', 1);
      }
      return;
    }

    cleanRaw
      .split(/[,;|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((tok) => {
        if (!isCoord && isAbsenceToken(tok)) {
          if (coroinhasP && pastoralId === coroinhasP.id) {
            addVacancyToEntry(entry, coroinhasP, 'Altar', 1);
          } else if (acolitosP && pastoralId === acolitosP.id) {
            addVacancyToEntry(entry, acolitosP, 'Credência', 1);
          }
          return;
        }

        // Acúmulo de função nos Acólitos: "Nome (Missal / Credência)" -> escala em Missal + abre 1 vaga de Credência
        const isDualMissalCredencia =
          !isCoord &&
          acolitosP &&
          pastoralId === acolitosP.id &&
          /\(\s*missal\s*[\/+&]\s*cred[eê]ncia\s*\)/i.test(tok);

        const normalizedTok = isDualMissalCredencia
          ? tok.replace(/\(\s*missal\s*[\/+&]\s*cred[eê]ncia\s*\)/i, '(Missal)')
          : tok;

        const hit = findParticipantByName(normalizedTok, isCoord ? null : pastoralId, participantsByPastoral, users);
        if (!hit) {
          entry.unmatched.push(tok);
          return;
        }
        const targetPastoralId = pastoralId || coroinhasP?.id || acolitosP?.id;
        const role = findRoleFor(targetPastoralId, hit.roleHint, isCoord);
        if (!role) return;
        const dup = entry.assignments.some(
          (a) => a.userId === hit.accountId && a.memberId === hit.memberId && a.roleId === role.id,
        );
        if (!dup) {
          entry.assignments.push({
            pastoralId: targetPastoralId,
            roleId: role.id,
            userId: hit.accountId,
            memberId: hit.memberId,
            displayName: hit.name,
            roleName: role.name,
          });
        }

        if (isDualMissalCredencia && acolitosP) {
          addVacancyToEntry(entry, acolitosP, 'Credência', 1);
        }
      });
  };

  // Verifica se é formato CSV estruturado (cabeçalho com Data e Horário/Local separados por ; ou ,)
  const firstLineNorm = normText(rawLines[0] || '');
  const isCsvMode =
    rawLines.length >= 2 &&
    (rawLines[0].includes(';') || rawLines[0].split(',').length >= 4) &&
    firstLineNorm.includes('data') &&
    (firstLineNorm.includes('horario') || firstLineNorm.includes('hora') || firstLineNorm.includes('coroinha') || firstLineNorm.includes('acolito'));

  if (isCsvMode) {
    const sep = rawLines[0].includes(';') ? ';' : ',';
    const parseCsvRow = (line) =>
      line
        .split(sep)
        .map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

    const headers = parseCsvRow(rawLines[0]).map((h) => normText(h));
    const idxDate = headers.findIndex((h) => h.includes('data'));
    const idxTime = headers.findIndex((h) => h.includes('hora'));
    const idxLoc = headers.findIndex((h) => h.includes('local') || h.includes('comunidade') || h.includes('igreja'));
    const idxCor = headers.findIndex((h) => h.includes('coroinha'));
    const idxAco = headers.findIndex((h) => h.includes('acolito'));
    const idxCoord = headers.findIndex((h) => h.includes('coord'));

    rawLines.slice(1).forEach((rowLine) => {
      const cols = parseCsvRow(rowLine);
      const rawDate = idxDate >= 0 ? cols[idxDate] || '' : '';
      const rawTime = idxTime >= 0 ? cols[idxTime] || '' : '';
      const dMatch = rawDate.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      const tMatch = rawTime.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
      if (!dMatch || !tMatch) return;

      const dd = String(Number(dMatch[1])).padStart(2, '0');
      const mm = String(Number(dMatch[2])).padStart(2, '0');
      if (mm === '12') sawDecember = true;
      const yyyy = dMatch[3]
        ? dMatch[3].length === 2
          ? `20${dMatch[3]}`
          : dMatch[3]
        : String(sawDecember && mm === '01' ? defaultYear + 1 : defaultYear);
      const iso = `${yyyy}-${mm}-${dd}`;
      const timeStr = `${String(Number(tMatch[1])).padStart(2, '0')}:${tMatch[2] || '00'}`;
      const loc = (idxLoc >= 0 ? detectLocation(cols[idxLoc]) : null) || defaultLoc;
      const entry = ensureEntry(iso, timeStr, loc, rawDate);

      if (idxCor >= 0 && coroinhasP) {
        addNamesToEntry(entry, cols[idxCor] || '', coroinhasP.id, false);
      }
      if (idxAco >= 0 && acolitosP) {
        addNamesToEntry(entry, cols[idxAco] || '', acolitosP.id, false);
      }
      if (idxCoord >= 0 && cols[idxCoord]) {
        addNamesToEntry(entry, cols[idxCoord], coroinhasP?.id || acolitosP?.id, true);
      }
    });
  } else {
    rawLines.forEach((line) => {
      // 1. Detecta data: 07/11 ou 07/11/2026
      const dateMatch = line.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (dateMatch) {
        const dd = String(Number(dateMatch[1])).padStart(2, '0');
        const mm = String(Number(dateMatch[2])).padStart(2, '0');
        if (mm === '12') sawDecember = true;
        const yyyy = dateMatch[3]
          ? dateMatch[3].length === 2
            ? `20${dateMatch[3]}`
            : dateMatch[3]
          : String(sawDecember && mm === '01' ? defaultYear + 1 : defaultYear);
        currentDate = `${yyyy}-${mm}-${dd}`;
        currentDayHint = line;
      }

      // 2. Detecta horário: 17h30, 19:00, 07h
      const timeMatch = line.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
      if (timeMatch && (dateMatch || /[\u{1F550}-\u{1F567}]|^\s*\d{1,2}\s*[h:]/u.test(line) || line.includes('—') || line.includes('-'))) {
        const hh = String(Number(timeMatch[1])).padStart(2, '0');
        const min = timeMatch[2] ? timeMatch[2] : '00';
        const loc = detectLocation(line) || defaultLoc;
        ensureEntry(currentDate, `${hh}:${min}`, loc, line);

        const afterTime = line.slice(timeMatch.index + timeMatch[0].length);
        if (/(coroinhas|ac[oó]litos|coord\.?)\s*:/i.test(afterTime)) {
          const segments = afterTime.split('|');
          segments.forEach((seg) => {
            const corM = seg.match(/coroinhas\s*:\s*(.*)$/i);
            const acoM = seg.match(/ac[oó]litos?\s*:\s*(.*)$/i);
            const coordM = seg.match(/coord(?:enador[a]?)?\.?\s*:\s*(.+)$/i);
            if (corM && coroinhasP) addNamesToEntry(currentEntry, corM[1], coroinhasP.id, false);
            else if (acoM && acolitosP) addNamesToEntry(currentEntry, acoM[1], acolitosP.id, false);
            else if (coordM) addNamesToEntry(currentEntry, coordM[1], currentEntry.assignments[0]?.pastoralId || coroinhasP?.id, true);
          });
          return;
        }

        const inlineColon = afterTime.match(/:\s*(.+)$/);
        if (inlineColon && defaultPastoralId !== 'auto') {
          addNamesToEntry(currentEntry, inlineColon[1], defaultPastoralId, false);
        }
        return;
      }

      if (!currentEntry) return;

      // 3. Linhas de integrantes / coordenador / observação dentro da celebração atual
      const corLine = line.match(/^(?:[-•*]\s*)?coroinhas\s*:\s*(.*)$/i);
      if (corLine && coroinhasP) {
        addNamesToEntry(currentEntry, corLine[1], coroinhasP.id, false);
        return;
      }

      const acoLine = line.match(/^(?:[-•*]\s*)?ac[oó]litos?\s*:\s*(.*)$/i);
      if (acoLine && acolitosP) {
        addNamesToEntry(currentEntry, acoLine[1], acolitosP.id, false);
        return;
      }

      const coordLine = line.match(/^(?:[-•*]\s*)?coord(?:enador[a]?)?\.?\s*:\s*(.+)$/i);
      if (coordLine) {
        const targetPid = currentEntry.assignments[0]?.pastoralId || coroinhasP?.id || acolitosP?.id;
        addNamesToEntry(currentEntry, coordLine[1], targetPid, true);
        return;
      }

      const obsLine = line.match(/^(?:[-•*]\s*)?obs(?:erva[cç][aã]o)?\.?\s*:\s*(.+)$/i);
      if (obsLine) {
        currentEntry.notes.push(obsLine[1].trim());
        return;
      }

      if (defaultPastoralId !== 'auto' && !dateMatch) {
        addNamesToEntry(currentEntry, line.replace(/^[-•*]\s*/, ''), defaultPastoralId, false);
      }
    });
  }

  // 4. Aplica mínimos configuráveis por celebração (completando a diferença com vagasAbertas)
  entries.forEach((entry) => {
    if (coroinhasP && minCoroinhas > 0 && !(skipSunday7Cor && isSunday7AM(entry.date, entry.time))) {
      const corAssigned = entry.assignments.filter(
        (a) => a.pastoralId === coroinhasP.id && !normText(a.roleName).includes('coordenador'),
      ).length;
      const corVacOpen = entry.vagasAbertas
        .filter((v) => v.pastoralId === coroinhasP.id)
        .reduce((s, v) => s + Number(v.quantidade || 0), 0);
      const missingCor = minCoroinhas - (corAssigned + corVacOpen);
      if (missingCor > 0) {
        addVacancyToEntry(entry, coroinhasP, 'Altar', missingCor);
      }
    }

    if (acolitosP && minAcolitos > 0) {
      const acoAssigned = entry.assignments.filter(
        (a) => a.pastoralId === acolitosP.id && !normText(a.roleName).includes('coordenador'),
      ).length;
      const acoVacOpen = entry.vagasAbertas
        .filter((v) => v.pastoralId === acolitosP.id)
        .reduce((s, v) => s + Number(v.quantidade || 0), 0);
      const missingAco = minAcolitos - (acoAssigned + acoVacOpen);
      if (missingAco > 0) {
        addVacancyToEntry(entry, acolitosP, 'Credência', missingAco);
      }
    }
  });

  return entries.filter(
    (e) => e.assignments.length > 0 || e.vagasAbertas.length > 0 || e.unmatched.length > 0,
  );
}

function openWhatsAppImportModal({ user }, onSaved) {
  const pastorals = dataService.getActivePastorals();
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const managedPastorals = pastorals.filter((p) => managedIds.has(p.id));
  const locations = dataService.getActiveLocations();
  const celebrationTypes = dataService.getActiveCelebrationTypes();
  const roles = dataService.getRoles();
  const users = dataService.getUsers();
  const existingSchedules = dataService.getSchedules();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));

  let parsedEntries = [];

  openModal({
    title: 'Importar Escala (WhatsApp / CSV) com Detecção de Vagas',
    maxWidth: 'max-w-4xl',
    bodyHtml: `
      <div class="space-y-4">
        <div class="rounded-xl bg-amber-50 border border-amber-300 p-3.5 text-xs text-[#4E342E] space-y-1">
          <p class="font-bold text-[#78350F]">Detecção automática de Vagas em Aberto:</p>
          <p>Cole o texto do WhatsApp ou carregue uma planilha <strong>CSV/Excel</strong>. O importador detecta automaticamente <code>VAGA</code>, <code>FALTA</code>, <code>(sem escala)</code>, acúmulo de função nos Acólitos (<code>Nome (Missal / Credência)</code> → escala em Missal + abre vaga em Credência) e completa o mínimo desejado por celebração.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-[#5D4037] mb-1">Ano de Referência</label>
            <input id="wa-import-year" type="number" value="2026" min="2024" max="2035"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold outline-none focus:border-[#B45309]">
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-[#5D4037] mb-1">Pastoral Padrão</label>
            <select id="wa-import-pastoral" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-xs sm:text-sm font-semibold outline-none focus:border-[#B45309]">
              <option value="auto">Automático (Coroinhas:/Acólitos:)</option>
              ${managedPastorals.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="wa-min-cor" class="block text-[11px] font-bold uppercase tracking-wider text-[#5D4037] mb-1">Mín. Coroinhas / missa</label>
            <input id="wa-min-cor" type="number" min="0" max="10" placeholder="Opcional (ex: 3)"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold outline-none focus:border-[#B45309]">
          </div>
          <div>
            <label for="wa-min-aco" class="block text-[11px] font-bold uppercase tracking-wider text-[#5D4037] mb-1">Mín. Acólitos / missa</label>
            <input id="wa-min-aco" type="number" min="0" max="10" placeholder="Opcional (ex: 2)"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold outline-none focus:border-[#B45309]">
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#FAF6F0] border border-[#E6DACE] rounded-xl px-3.5 py-2.5">
          <label class="inline-flex items-center gap-2 text-xs font-semibold text-[#3E2723] cursor-pointer select-none">
            <input id="wa-skip-sun7-cor" type="checkbox" checked class="rounded text-[#B45309] focus:ring-[#B45309]">
            <span>Não abrir vaga de Coroinhas nas missas de Domingo 07:00</span>
          </label>
          <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 border border-[#D7C4B2] text-xs font-bold text-[#5D4037] cursor-pointer transition shrink-0">
            <i data-lucide="upload" class="w-3.5 h-3.5 text-[#B45309]"></i>
            Carregar CSV / Excel
            <input id="wa-import-csv-file" type="file" accept=".csv,.txt" class="hidden">
          </label>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Texto da Escala (WhatsApp ou CSV) *</label>
          <textarea id="wa-import-text" rows="6"
            placeholder="📌 02/01 (Sáb)&#10;🕖 19h00 - Maria Goretti&#10;Coroinhas: (sem disponibilidade)&#10;Acólitos: José Flávio (Missal / Credência)&#10;&#10;📌 03/01 (Dom)&#10;🕖 07h00 - Matriz&#10;Coroinhas: (sem escala)&#10;Acólitos: Milena (Missal / Credência)"
            class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] focus:bg-white text-xs sm:text-sm font-mono focus:border-[#B45309] outline-none"></textarea>
        </div>

        <div class="flex items-center justify-between gap-2 flex-wrap">
          <button id="btn-wa-parse" type="button"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-xs sm:text-sm font-bold shadow-xs transition">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
            Analisar e Pré-visualizar
          </button>
          <span id="wa-parse-summary" class="text-xs font-semibold text-[#6D4C41]"></span>
        </div>

        <div id="wa-preview-box" class="hidden space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1"></div>

        <div class="flex justify-end gap-2 pt-3 border-t border-[#E6DACE]/80">
          <button type="button" id="cancel-wa-import" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="button" id="btn-wa-confirm" disabled
            class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition">
            Confirmar e Salvar no Firestore
          </button>
        </div>
      </div>
    `,
    onMount(bodyEl) {
      const textEl = bodyEl.querySelector('#wa-import-text');
      const yearEl = bodyEl.querySelector('#wa-import-year');
      const pastoralEl = bodyEl.querySelector('#wa-import-pastoral');
      const minCorEl = bodyEl.querySelector('#wa-min-cor');
      const minAcoEl = bodyEl.querySelector('#wa-min-aco');
      const skipSun7El = bodyEl.querySelector('#wa-skip-sun7-cor');
      const csvFileEl = bodyEl.querySelector('#wa-import-csv-file');
      const previewBox = bodyEl.querySelector('#wa-preview-box');
      const summaryEl = bodyEl.querySelector('#wa-parse-summary');
      const confirmBtn = bodyEl.querySelector('#btn-wa-confirm');

      bodyEl.querySelector('#cancel-wa-import').addEventListener('click', closeModal);

      csvFileEl?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          textEl.value = String(reader.result || '');
          showToast(`Arquivo "${file.name}" carregado. Clique em Analisar e Pré-visualizar.`, 'info');
        };
        reader.readAsText(file, 'utf-8');
      });

      function renderPreviewTable() {
        const totalAsg = parsedEntries.reduce((s, e) => s + e.assignments.length, 0);
        const totalVagas = parsedEntries.reduce(
          (s, e) => s + (e.vagasAbertas || []).reduce((vs, v) => vs + Number(v.quantidade || 0), 0),
          0,
        );
        summaryEl.textContent = `${parsedEntries.length} ${parsedEntries.length === 1 ? 'celebração' : 'celebrações'} • ${totalAsg} posições • 🟡 ${totalVagas} ${totalVagas === 1 ? 'vaga em aberto' : 'vagas em aberto'}.`;
        confirmBtn.disabled = totalAsg === 0 && totalVagas === 0;
        previewBox.classList.remove('hidden');

        previewBox.innerHTML = parsedEntries
          .map((e, eIdx) => {
            const matchExisting = existingSchedules.find(
              (s) => s.date === e.date && s.time === e.time && (s.locationId === e.locationId || normText(s.location) === normText(e.location)),
            );
            const entryVacSum = (e.vagasAbertas || []).reduce((s, v) => s + Number(v.quantidade || 0), 0);
            return `
              <div class="rounded-xl border border-[#E6DACE] bg-[#FAF6F0] p-3 space-y-2 text-xs">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <span class="font-extrabold text-[#3E2723]">${escapeHtml(formatDateBR(e.date))} às ${escapeHtml(e.time)} • ${escapeHtml(e.location)}</span>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    ${
                      entryVacSum > 0
                        ? `<span class="vacancy-pill text-[10px]">🟡 ${entryVacSum} ${entryVacSum === 1 ? 'vaga em aberto' : 'vagas em aberto'}</span>`
                        : ''
                    }
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      matchExisting ? 'bg-amber-100 text-[#92400E] border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }">
                      ${matchExisting ? 'Atualizar / Mesclar existente' : 'Nova escala'}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-1 flex-wrap">
                  ${e.assignments
                    .map(
                      (a) =>
                        `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E6DACE] text-[10px] font-semibold text-[#3E2723]">
                          <span class="w-1.5 h-1.5 rounded-full" style="background-color:${escapeHtml(pastoralMap[a.pastoralId]?.color || '#B45309')}"></span>
                          ${escapeHtml(a.displayName)} <span class="text-[#8D6E63]">(${escapeHtml(a.roleName)})</span>
                        </span>`,
                    )
                    .join('')}
                </div>
                ${
                  (e.vagasAbertas || []).length > 0
                    ? `
                  <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#E6DACE]/70">
                    ${e.vagasAbertas
                      .map(
                        (v, vIdx) => `
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-[#78350F] border border-amber-400 text-[10px] font-extrabold">
                        ${escapeHtml(formatVacancyBadgeText(v, pastoralMap))}
                        <button type="button" data-imp-vac-dec="${eIdx}:${vIdx}" class="px-1 rounded hover:bg-amber-200" title="Diminuir">−</button>
                        <button type="button" data-imp-vac-inc="${eIdx}:${vIdx}" class="px-1 rounded hover:bg-amber-200" title="Aumentar">+</button>
                        <button type="button" data-imp-vac-del="${eIdx}:${vIdx}" class="px-1 rounded text-red-700 hover:bg-red-100" title="Remover vaga">×</button>
                      </span>
                    `,
                      )
                      .join('')}
                  </div>
                `
                    : ''
                }
                ${
                  e.unmatched.length > 0
                    ? `<p class="text-[11px] text-amber-800 font-semibold">Não encontrados no cadastro: ${escapeHtml(e.unmatched.join(', '))}</p>`
                    : ''
                }
              </div>
            `;
          })
          .join('');

        previewBox.querySelectorAll('[data-imp-vac-dec]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const [eIdx, vIdx] = btn.dataset.impVacDec.split(':').map(Number);
            const v = parsedEntries[eIdx]?.vagasAbertas?.[vIdx];
            if (!v) return;
            v.quantidade -= 1;
            if (v.quantidade <= 0) parsedEntries[eIdx].vagasAbertas.splice(vIdx, 1);
            renderPreviewTable();
          });
        });
        previewBox.querySelectorAll('[data-imp-vac-inc]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const [eIdx, vIdx] = btn.dataset.impVacInc.split(':').map(Number);
            const v = parsedEntries[eIdx]?.vagasAbertas?.[vIdx];
            if (!v) return;
            v.quantidade = Math.min(10, Number(v.quantidade) + 1);
            renderPreviewTable();
          });
        });
        previewBox.querySelectorAll('[data-imp-vac-del]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const [eIdx, vIdx] = btn.dataset.impVacDel.split(':').map(Number);
            parsedEntries[eIdx]?.vagasAbertas?.splice(vIdx, 1);
            renderPreviewTable();
          });
        });

        refreshIcons();
      }

      bodyEl.querySelector('#btn-wa-parse').addEventListener('click', () => {
        const raw = textEl.value.trim();
        if (!raw) {
          showToast('Cole o texto da escala ou carregue um arquivo CSV antes de analisar.', 'error');
          return;
        }
        parsedEntries = parseWhatsAppScheduleText(raw, {
          defaultYear: Number(yearEl.value) || 2026,
          defaultPastoralId: pastoralEl.value,
          pastorals,
          locations,
          celebrationTypes,
          roles,
          users,
          skipSunday7Cor: Boolean(skipSun7El?.checked),
          minCoroinhas: Math.max(0, parseInt(minCorEl?.value, 10) || 0),
          minAcolitos: Math.max(0, parseInt(minAcoEl?.value, 10) || 0),
        });

        if (parsedEntries.length === 0) {
          previewBox.classList.add('hidden');
          confirmBtn.disabled = true;
          summaryEl.textContent = 'Nenhuma celebração reconhecida. Verifique se há dia (DD/MM) e horário (HHhMM).';
          return;
        }

        renderPreviewTable();
      });

      confirmBtn.addEventListener('click', () => {
        if (parsedEntries.length === 0) return;
        const latestSchedules = dataService.getSchedules();
        let savedCount = 0;

        parsedEntries.forEach((e) => {
          if (e.assignments.length === 0 && (e.vagasAbertas || []).length === 0) return;
          const existing = latestSchedules.find(
            (s) => s.date === e.date && s.time === e.time && (s.locationId === e.locationId || normText(s.location) === normText(e.location)),
          );
          const baseAssignments = existing ? [...(existing.assignments || [])] : [];
          const baseVagas = existing ? [...(existing.vagasAbertas || [])] : [];

          e.assignments.forEach((a) => {
            const already = baseAssignments.some(
              (x) => x.userId === a.userId && (x.memberId || x.userId) === a.memberId && x.pastoralId === a.pastoralId && x.roleId === a.roleId,
            );
            if (!already) {
              baseAssignments.push({
                pastoralId: a.pastoralId,
                roleId: a.roleId,
                userId: a.userId,
                memberId: a.memberId,
              });
            }
          });

          (e.vagasAbertas || []).forEach((v) => {
            const idx = baseVagas.findIndex(
              (bv) => bv.pastoralId === v.pastoralId && normText(bv.funcao) === normText(v.funcao),
            );
            if (idx >= 0) {
              baseVagas[idx] = { ...baseVagas[idx], quantidade: v.quantidade };
            } else {
              baseVagas.push(v);
            }
          });

          const notesJoined = [existing?.notes, ...e.notes].filter(Boolean).join(' | ');
          dataService.saveSchedule({
            id: existing?.id,
            date: e.date,
            time: e.time,
            locationId: e.locationId,
            location: e.location,
            celebrationTypeId: existing?.celebrationTypeId || e.celebrationTypeId,
            celebrationType: existing?.celebrationType || e.celebrationType,
            pastoralId:
              existing?.pastoralId ||
              baseAssignments[0]?.pastoralId ||
              baseVagas[0]?.pastoralId ||
              managedPastorals[0]?.id,
            eucharisticPrayerId: existing?.eucharisticPrayerId || 'oe_2',
            eucharisticPrayerSource: existing?.eucharisticPrayerSource || 'default',
            celebrantScript: existing?.celebrantScript || '',
            notes: notesJoined,
            assignments: baseAssignments,
            vagasAbertas: baseVagas,
          });
          savedCount += 1;
        });

        closeModal();
        showToast(`${savedCount} ${savedCount === 1 ? 'escala importada' : 'escalas importadas'} com sucesso no Cloud Firestore!`);
        onSaved();
      });
    },
  });
}

// --- Controle, Histórico e Painel de Indicadores de Trocas/Substituições (Exclusivo Coordenação) ---

function formatPeriodMonthLabel(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm || '—';
  const [y, m] = yyyyMm.split('-').map(Number);
  const monthName = MONTHS_PT[m - 1] || String(m).padStart(2, '0');
  return `${monthName}/${y}`;
}

function renderSubstitutionsControlPanel(
  container,
  { substitutions, schedules, pastorals, pastoralMap, roleMap, generalAdmin, coordPastoralSet, onFilterChanged },
) {
  // Opções de período (YYYY-MM) derivadas de escalas e substituições
  const periodSet = new Set();
  schedules.forEach((s) => {
    if (s.date && /^\d{4}-\d{2}/.test(s.date)) periodSet.add(s.date.slice(0, 7));
  });
  substitutions.forEach((sub) => {
    if (sub.dataMissa && /^\d{4}-\d{2}/.test(sub.dataMissa)) periodSet.add(sub.dataMissa.slice(0, 7));
  });
  const periodOptions = Array.from(periodSet).sort((a, b) => b.localeCompare(a));

  if (subControlPeriodFilter !== 'all' && !periodSet.has(subControlPeriodFilter)) {
    subControlPeriodFilter = 'all';
  }
  const managedIdsSet = new Set(pastorals.map((p) => p.id));
  if (subControlPastoralFilter !== 'all' && !managedIdsSet.has(subControlPastoralFilter)) {
    subControlPastoralFilter = 'all';
  }

  // Substituições filtradas por Período e Pastoral
  const filteredSubs = substitutions
    .filter((sub) => {
      if (subControlPeriodFilter !== 'all' && !String(sub.dataMissa || '').startsWith(subControlPeriodFilter)) {
        return false;
      }
      if (subControlPastoralFilter !== 'all' && sub.pastoralId !== subControlPastoralFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));

  // Total de escalações no período/pastoral para cálculo de percentuais
  let totalAssignmentsInPeriod = 0;
  const memberAssignmentsCount = new Map();
  schedules.forEach((sch) => {
    if (subControlPeriodFilter !== 'all' && !String(sch.date || '').startsWith(subControlPeriodFilter)) {
      return;
    }
    (sch.assignments || []).forEach((asg) => {
      const pid = asg.pastoralId || sch.pastoralId;
      if (!generalAdmin && !coordPastoralSet.has(pid)) return;
      if (subControlPastoralFilter !== 'all' && pid !== subControlPastoralFilter) return;
      totalAssignmentsInPeriod += 1;
      const key = asg.memberId || asg.userId;
      memberAssignmentsCount.set(key, (memberAssignmentsCount.get(key) || 0) + 1);
    });
  });

  const totalTrocas = filteredSubs.length;
  const concluidas = filteredSubs.filter((s) => s.status === 'concluida');
  const abertas = filteredSubs.filter((s) => s.status === 'aberta');
  const canceladas = filteredSubs.filter((s) => s.status === 'cancelada');
  const pctTrocasSobreEscalas =
    totalAssignmentsInPeriod > 0
      ? ((totalTrocas / totalAssignmentsInPeriod) * 100).toFixed(1).replace('.', ',')
      : '0,0';

  // Ranking 1: Quem Mais Solicita Trocas (pedidos abertos + concluídos; conta também se só houver cancelados? Mantém não-cancelados para justiça)
  const requesterMap = new Map();
  const concludedByRequester = new Map();
  filteredSubs.forEach((sub) => {
    if (sub.status === 'cancelada') return;
    const personKey = sub.solicitanteMemberId || sub.solicitanteId || sub.solicitanteNome;
    if (!personKey) return;
    const prev = requesterMap.get(personKey) || {
      key: personKey,
      name: sub.solicitanteNome || 'Integrante',
      pastoralId: sub.pastoralId,
      pastoralNome: sub.pastoralNome || pastoralMap[sub.pastoralId]?.shortName || 'Pastoral',
      count: 0,
    };
    prev.count += 1;
    requesterMap.set(personKey, prev);
    if (sub.status === 'concluida') {
      concludedByRequester.set(personKey, (concludedByRequester.get(personKey) || 0) + 1);
    }
  });

  const requesterRanking = Array.from(requesterMap.values())
    .map((item) => {
      // Quando uma troca é concluída, a vaga original saiu da escala atual do solicitante; somamos de volta para % real
      const currentEscalas = memberAssignmentsCount.get(item.key) || 0;
      const originalEscalas = currentEscalas + (concludedByRequester.get(item.key) || 0);
      const denominator = Math.max(originalEscalas, item.count);
      const pct = denominator > 0 ? Math.min(100, Math.round((item.count / denominator) * 100)) : 0;
      return { ...item, totalEscalas: denominator, pct };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));

  // Ranking 2: Quem Mais Vai no Lugar (Coberturas concluídas)
  const helperMap = new Map();
  concluidas.forEach((sub) => {
    if (!sub.substitutoNome) return;
    const personKey = sub.substitutoMemberId || sub.substitutoId || sub.substitutoNome;
    const prev = helperMap.get(personKey) || {
      key: personKey,
      name: sub.substitutoNome,
      pastoralId: sub.pastoralId,
      pastoralNome: sub.pastoralNome || pastoralMap[sub.pastoralId]?.shortName || 'Pastoral',
      count: 0,
    };
    prev.count += 1;
    helperMap.set(personKey, prev);
  });

  const helperRanking = Array.from(helperMap.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'),
  );

  const topRequester = requesterRanking[0] || null;
  const topHelper = helperRanking[0] || null;
  const maxReqCount = topRequester?.count || 1;
  const maxHelpCount = topHelper?.count || 1;

  container.innerHTML = `
    <div id="substitutions-control-panel" class="space-y-6">
      <!-- Barra de Filtros: Período e Pastoral -->
      <div class="bg-white rounded-2xl border border-[#E6DACE] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-[#3E2723] text-amber-400 flex items-center justify-center shrink-0">
            <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
          </div>
          <div>
            <h4 class="text-sm sm:text-base font-extrabold text-[#3E2723]">Controle &amp; Indicadores de Trocas</h4>
            <p class="text-xs text-[#6D4C41]">Acompanhamento exclusivo da Coordenação com histórico permanente no Cloud Firestore.</p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="flex items-center gap-1.5 bg-[#FAF6F0] border border-[#E6DACE] rounded-xl px-3 py-2">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-[#B45309]"></i>
            <select id="sub-ctrl-period-filter" aria-label="Filtrar trocas por mês/período"
              class="text-xs sm:text-sm font-bold text-[#3E2723] bg-transparent outline-none cursor-pointer">
              <option value="all" ${subControlPeriodFilter === 'all' ? 'selected' : ''}>Todos os períodos</option>
              ${periodOptions
                .map(
                  (p) =>
                    `<option value="${p}" ${subControlPeriodFilter === p ? 'selected' : ''}>${escapeHtml(formatPeriodMonthLabel(p))}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="flex items-center gap-1.5 bg-[#FAF6F0] border border-[#E6DACE] rounded-xl px-3 py-2">
            <i data-lucide="layers" class="w-3.5 h-3.5 text-[#B45309]"></i>
            <select id="sub-ctrl-pastoral-filter" aria-label="Filtrar trocas por pastoral"
              class="text-xs sm:text-sm font-bold text-[#3E2723] bg-transparent outline-none cursor-pointer">
              <option value="all" ${subControlPastoralFilter === 'all' ? 'selected' : ''}>Todas as pastorais</option>
              ${pastorals
                .map(
                  (p) =>
                    `<option value="${p.id}" ${subControlPastoralFilter === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- 4 Cards de Resumo no Topo -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl border border-[#E6DACE] p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">Total de Trocas</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-[#B45309] flex items-center justify-center">
              <i data-lucide="repeat" class="w-4 h-4"></i>
            </div>
          </div>
          <p class="text-2xl font-extrabold text-[#3E2723] mt-2.5">${totalTrocas}</p>
          <p class="text-xs text-[#6D4C41] mt-1">
            <strong class="text-[#B45309]">${pctTrocasSobreEscalas}%</strong> sobre ${totalAssignmentsInPeriod} ${totalAssignmentsInPeriod === 1 ? 'escalação' : 'escalações'}
          </p>
        </div>

        <div class="bg-white rounded-2xl border border-[#E6DACE] p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">Concluídas vs Em Aberto</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="flex items-baseline gap-2.5 mt-2.5">
            <span class="text-2xl font-extrabold text-emerald-800">${concluidas.length}</span>
            <span class="text-xs font-bold text-[#8D6E63]">cobertas</span>
            <span class="text-[#D7C4B2]">•</span>
            <span class="text-2xl font-extrabold ${abertas.length > 0 ? 'text-[#D97706]' : 'text-[#5D4037]'}">${abertas.length}</span>
            <span class="text-xs font-bold text-[#8D6E63]">em aberto</span>
          </div>
          <p class="text-xs text-[#8D6E63] mt-1">
            ${canceladas.length > 0 ? `${canceladas.length} ${canceladas.length === 1 ? 'cancelada' : 'canceladas'} no período` : 'Todas as trocas registradas'}
          </p>
        </div>

        <div class="bg-white rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#92400E]">Quem Mais Pede Troca</span>
            <div class="w-9 h-9 rounded-xl bg-amber-100 text-[#B45309] flex items-center justify-center">
              <i data-lucide="user-minus" class="w-4 h-4"></i>
            </div>
          </div>
          ${
            topRequester
              ? `
            <p class="text-lg font-extrabold text-[#3E2723] mt-2.5 truncate" title="${escapeHtml(topRequester.name)}">${escapeHtml(topRequester.name)}</p>
            <p class="text-xs text-[#6D4C41] mt-1">
              <strong class="text-[#B45309]">${topRequester.count} ${topRequester.count === 1 ? 'pedido' : 'pedidos'}</strong> • ${escapeHtml(topRequester.pastoralNome)}
            </p>
          `
              : `<p class="text-sm font-bold text-[#8D6E63] mt-3">Sem pedidos no período</p>`
          }
        </div>

        <div class="bg-white rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-xs">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-900">Quem Mais Cobre / Ajuda</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <i data-lucide="heart-handshake" class="w-4 h-4"></i>
            </div>
          </div>
          ${
            topHelper
              ? `
            <p class="text-lg font-extrabold text-[#3E2723] mt-2.5 truncate" title="${escapeHtml(topHelper.name)}">${escapeHtml(topHelper.name)}</p>
            <p class="text-xs text-[#6D4C41] mt-1">
              <strong class="text-emerald-800">${topHelper.count} ${topHelper.count === 1 ? 'cobertura' : 'coberturas'}</strong> • ${escapeHtml(topHelper.pastoralNome)}
            </p>
          `
              : `<p class="text-sm font-bold text-[#8D6E63] mt-3">Sem coberturas no período</p>`
          }
        </div>
      </div>

      <!-- Dois Rankings Lado a Lado com Barras de Progresso -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- Ranking: Quem Mais Solicita Trocas -->
        <section class="bg-white rounded-2xl border border-[#E6DACE] p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h5 class="text-sm sm:text-base font-extrabold text-[#3E2723]">Ranking: Quem Mais Solicita Trocas</h5>
              <p class="text-xs text-[#6D4C41]">Total de pedidos e percentual sobre as próprias escalas</p>
            </div>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-[#92400E] border border-amber-200">
              ${requesterRanking.length} ${requesterRanking.length === 1 ? 'integrante' : 'integrantes'}
            </span>
          </div>

          ${
            requesterRanking.length === 0
              ? `<p class="text-xs text-[#8D6E63] py-6 text-center bg-[#FAF6F0] rounded-xl border border-dashed border-[#D7C4B2]">Nenhuma solicitação registrada neste filtro.</p>`
              : `
            <div class="space-y-3">
              ${requesterRanking
                .slice(0, 10)
                .map((item, idx) => {
                  const barPct = Math.max(8, Math.round((item.count / maxReqCount) * 100));
                  const pObj = pastoralMap[item.pastoralId];
                  return `
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-5 h-5 rounded-md ${idx === 0 ? 'bg-[#D97706] text-white' : 'bg-[#F5EFE6] text-[#5D4037]'} flex items-center justify-center text-[10px] font-extrabold shrink-0">${idx + 1}º</span>
                          <span class="font-bold text-[#3E2723] truncate">${escapeHtml(item.name)}</span>
                          ${renderPastoralPill(pObj, { compact: true })}
                        </div>
                        <div class="text-right shrink-0 whitespace-nowrap">
                          <span class="font-extrabold text-[#92400E]">${item.count} ${item.count === 1 ? 'pedido' : 'pedidos'}</span>
                          <span class="text-[11px] text-[#8D6E63] ml-1">(${item.pct}% das escalas)</span>
                        </div>
                      </div>
                      <div class="h-2 w-full rounded-full bg-[#F5EFE6] overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-[#D97706] to-[#B45309] transition-all" style="width:${barPct}%"></div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </section>

        <!-- Ranking: Quem Mais Vai no Lugar (Coberturas) -->
        <section class="bg-white rounded-2xl border border-[#E6DACE] p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h5 class="text-sm sm:text-base font-extrabold text-[#3E2723]">Ranking: Quem Mais Vai no Lugar (Coberturas)</h5>
              <p class="text-xs text-[#6D4C41]">Integrantes que mais assumiram vagas de colegas</p>
            </div>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              ${helperRanking.length} ${helperRanking.length === 1 ? 'integrante' : 'integrantes'}
            </span>
          </div>

          ${
            helperRanking.length === 0
              ? `<p class="text-xs text-[#8D6E63] py-6 text-center bg-[#FAF6F0] rounded-xl border border-dashed border-[#D7C4B2]">Nenhuma cobertura concluída neste filtro.</p>`
              : `
            <div class="space-y-3">
              ${helperRanking
                .slice(0, 10)
                .map((item, idx) => {
                  const barPct = Math.max(8, Math.round((item.count / maxHelpCount) * 100));
                  const pObj = pastoralMap[item.pastoralId];
                  return `
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-5 h-5 rounded-md ${idx === 0 ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800'} flex items-center justify-center text-[10px] font-extrabold shrink-0">${idx + 1}º</span>
                          <span class="font-bold text-[#3E2723] truncate">${escapeHtml(item.name)}</span>
                          ${renderPastoralPill(pObj, { compact: true })}
                        </div>
                        <span class="font-extrabold text-emerald-800 shrink-0 whitespace-nowrap">
                          ${item.count} ${item.count === 1 ? 'cobertura' : 'coberturas'}
                        </span>
                      </div>
                      <div class="h-2 w-full rounded-full bg-emerald-50 overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all" style="width:${barPct}%"></div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </section>
      </div>

      <!-- Tabela Cronológica Completa de Trocas -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="px-5 py-4 border-b border-[#E6DACE] bg-[#FDFBF7] flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h5 class="text-sm sm:text-base font-extrabold text-[#3E2723]">Histórico Cronológico de Trocas (${filteredSubs.length})</h5>
            <p class="text-xs text-[#6D4C41]">Registro permanente de pedidos abertos, concluídos e cancelados.</p>
          </div>
        </div>

        ${
          filteredSubs.length === 0
            ? `
          <div class="p-10 text-center">
            <i data-lucide="history" class="w-9 h-9 text-[#8D6E63] mx-auto mb-2.5"></i>
            <p class="text-sm font-bold text-[#3E2723]">Nenhuma troca registrada para este filtro</p>
            <p class="text-xs text-[#6D4C41] mt-1">Quando um integrante solicitar ou aceitar uma substituição, o histórico completo aparecerá aqui automaticamente.</p>
          </div>
        `
            : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-[#FAF6F0] border-b border-[#E6DACE] text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">
                  <th class="px-4 py-3 whitespace-nowrap">Data / Missa</th>
                  <th class="px-4 py-3 whitespace-nowrap">Pastoral</th>
                  <th class="px-4 py-3 whitespace-nowrap">Quem Pediu → Quem Cobriu</th>
                  <th class="px-4 py-3 min-w-[180px]">Motivo</th>
                  <th class="px-4 py-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E6DACE]/60 text-xs sm:text-sm">
                ${filteredSubs
                  .map((sub) => {
                    const pObj = pastoralMap[sub.pastoralId];
                    const statusBadge =
                      sub.status === 'concluida'
                        ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ Concluída</span>`
                        : sub.status === 'cancelada'
                          ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">⚪ Cancelada</span>`
                          : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-[#92400E] border border-amber-300">🟡 Em Aberto</span>`;

                    const substituteHtml =
                      sub.status === 'concluida' && sub.substitutoNome
                        ? `<span class="font-extrabold text-emerald-800">${escapeHtml(sub.substitutoNome)}</span>`
                        : sub.status === 'cancelada'
                          ? `<span class="text-[#8D6E63] italic">Cancelado pelo solicitante</span>`
                          : `<span class="text-[#B45309] font-semibold italic">Aguardando cobertura</span>`;

                    return `
                      <tr class="hover:bg-[#FAF6F0]/70 align-top">
                        <td class="px-4 py-3 whitespace-nowrap">
                          <p class="font-bold text-[#3E2723]">${escapeHtml(formatDateBR(sub.dataMissa))} às ${escapeHtml(sub.horarioMissa || '—')}</p>
                          <p class="text-[11px] text-[#6D4C41]">${escapeHtml(sub.localMissa || '—')}</p>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap space-y-1">
                          <div>${renderPastoralPill(pObj, { compact: true })}</div>
                          <p class="text-[11px] font-semibold text-[#5D4037]">${escapeHtml(sub.funcao || 'Função')}</p>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                          <p class="text-xs sm:text-sm text-[#3E2723]">
                            <strong class="text-[#5D4037]">${escapeHtml(sub.solicitanteNome || '—')}</strong>
                            <span class="mx-1 text-[#B45309] font-bold">→</span>
                            ${substituteHtml}
                          </p>
                          <p class="text-[10px] text-[#8D6E63] mt-0.5">
                            Pedido: ${escapeHtml(formatDateTimeBR(sub.criadoEm))}${sub.concluidoEm ? ` • Fechado: ${escapeHtml(formatDateTimeBR(sub.concluidoEm))}` : ''}
                          </p>
                        </td>
                        <td class="px-4 py-3 text-xs text-[#4E342E] leading-relaxed">
                          ${escapeHtml(sub.motivo || '—')}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                          ${statusBadge}
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </section>
    </div>
  `;

  container.querySelector('#sub-ctrl-period-filter')?.addEventListener('change', (e) => {
    subControlPeriodFilter = e.target.value;
    onFilterChanged?.();
  });

  container.querySelector('#sub-ctrl-pastoral-filter')?.addEventListener('change', (e) => {
    subControlPastoralFilter = e.target.value;
    onFilterChanged?.();
  });
}
