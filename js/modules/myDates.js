/**
 * Módulo dedicado "Minhas Datas" (Suporte a Contas Familiares Agrupadas + Diferenciação Suave por Integrante)
 * - Em Contas Familiares, agrupa irmãos escalados na mesma data, horário e local em um único card de celebração
 * - Exibe etiquetas discretas em tons terrosos/litúrgicos por integrante (Dourado Suave, Terracota Suave, Verde Oliva Suave)
 *   com botão individual "Solicitar Substituição" alinhado à direita para cada irmão
 * - Contador de "Minhas Datas" (Próximas / Todas) contabiliza celebrações únicas agendadas
 */

import { dataService } from '../services/dataService.js';
import {
  buildUserTimeSlotIndex,
  closeModal,
  escapeHtml,
  formatDateBR,
  formatWeekdayBR,
  getAccountMembers,
  getCountdownBadge,
  getFirstName,
  getTodayISO,
  hasTimeConflict,
  isFamilyAccount,
  openModal,
  refreshIcons,
  renderFamilyAccountBadge,
  renderFamilyMemberPill,
  renderFamilyMembersLegend,
  renderPastoralPill,
  resolveAssignedMemberName,
  showToast,
} from '../utils/helpers.js';

let scopeFilter = 'upcoming'; // 'upcoming' | 'all'

export function renderMyDatesContent(targetEl, { user, onChanged, onNotificationsChanged, openLiturgyFor, compactHeader = false }) {
  const todayISO = getTodayISO();
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const roles = dataService.getRoles();
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const schedules = dataService.getSchedules();
  const slotIndex = buildUserTimeSlotIndex(schedules);
  const isFam = isFamilyAccount(user);
  const familyMembers = getAccountMembers(user);
  const memberOrderIndex = new Map(familyMembers.map((m, idx) => [m.id, idx]));

  // Agrupa por celebração única (data + horário + local) para evitar cards duplicados em Contas Familiares
  const groupsByKey = new Map();

  schedules.forEach((sch) => {
    (sch.assignments || []).forEach((asg) => {
      if (asg.userId !== user.id) return;
      const pastoral = pastoralMap[asg.pastoralId] || pastoralMap[sch.pastoralId];
      const assignedMemberId = asg.memberId || user.id;
      const assignedName = resolveAssignedMemberName(userMap, asg.userId, asg.memberId);
      const personKey = asg.memberId || asg.userId;
      const rName = roleMap[asg.roleId]?.name || 'Função';
      const isCoordShift =
        asg.roleId === 'role_cor_coord' ||
        asg.roleId === 'role_aco_coord' ||
        rName.toLowerCase().includes('coordenador');

      const groupKey = `${sch.date}|${sch.time}|${String(sch.location || '').trim().toLowerCase()}`;
      let group = groupsByKey.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          schedule: sch,
          date: sch.date,
          time: sch.time,
          location: sch.location,
          celebrationType: sch.celebrationType,
          countdown: getCountdownBadge(sch.date),
          entries: [],
        };
        groupsByKey.set(groupKey, group);
      }

      group.entries.push({
        schedule: sch,
        assignment: asg,
        pastoral,
        assignedMemberId,
        assignedName,
        roleName: rName,
        isCoordShift,
        hasConflict: hasTimeConflict(slotIndex, personKey, sch.date, sch.time),
      });
    });
  });

  const allGroups = Array.from(groupsByKey.values())
    .map((g) => {
      g.entries.sort(
        (a, b) =>
          (memberOrderIndex.get(a.assignedMemberId) ?? 99) -
            (memberOrderIndex.get(b.assignedMemberId) ?? 99) ||
          a.assignedName.localeCompare(b.assignedName, 'pt-BR'),
      );
      return g;
    })
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  const upcomingCount = allGroups.filter((g) => g.date >= todayISO).length;
  const displayed =
    scopeFilter === 'upcoming'
      ? allGroups.filter((g) => g.date >= todayISO)
      : allGroups;

  const rerender = () => {
    onNotificationsChanged?.();
    if (onChanged) onChanged();
    else renderMyDatesContent(targetEl, { user, onChanged, onNotificationsChanged, openLiturgyFor, compactHeader });
  };

  targetEl.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        ${
          compactHeader
            ? `<div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-base font-extrabold text-[#3E2723]">Minhas Datas Agendadas</h4>
                  ${renderFamilyAccountBadge(user, { compact: true })}
                  ${renderFamilyMembersLegend(user)}
                </div>
                <p class="text-xs text-[#6D4C41] mt-0.5">
                  ${isFam ? 'Celebrações agrupadas por horário com diferenciação suave e substituição individual por irmão.' : 'Exclusivamente seus compromissos em ordem cronológica, com contagem regressiva.'}
                </p>
              </div>`
            : `<div>
                <div class="flex items-center gap-2 flex-wrap mb-1.5">
                  <span class="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    <i data-lucide="calendar-clock" class="w-3 h-3"></i>
                    ${isFam ? 'Compromissos da Família' : 'Compromissos Pessoais'}
                  </span>
                  ${renderFamilyAccountBadge(user, { compact: true })}
                  ${renderFamilyMembersLegend(user)}
                </div>
                <h3 class="text-xl font-extrabold text-[#3E2723]">Minhas Datas</h3>
                <p class="text-sm text-[#6D4C41] mt-0.5">
                  ${isFam ? 'Datas, horários, locais e funções dos irmãos desta conta familiar agrupados por celebração.' : 'Todas as datas, horários, locais e funções em que você está escalado(a), em ordem cronológica.'}
                </p>
              </div>`
        }

        <div class="inline-flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E6DACE] self-start sm:self-auto">
          <button type="button" data-mydates-scope="upcoming"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              scopeFilter === 'upcoming' ? 'bg-[#3E2723] text-white' : 'text-[#5D4037] hover:bg-[#FAF6F0]'
            }">
            Próximas (${upcomingCount})
          </button>
          <button type="button" data-mydates-scope="all"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              scopeFilter === 'all' ? 'bg-[#3E2723] text-white' : 'text-[#5D4037] hover:bg-[#FAF6F0]'
            }">
            Todas (${allGroups.length})
          </button>
        </div>
      </div>

      ${
        displayed.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
          <i data-lucide="calendar-heart" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
          <h4 class="text-base font-bold text-[#3E2723]">Nenhuma data encontrada neste filtro</h4>
          <p class="text-sm text-[#6D4C41] mt-1">Quando houver escalas vinculadas à sua conta, elas aparecerão automaticamente aqui.</p>
        </div>
      `
          : `
        <div class="space-y-3.5">
          ${displayed
            .map((group) => {
              const { schedule: sch, countdown, entries } = group;
              const isPast = countdown.diffDays < 0;

              // Card para Conta Familiar (agrupado por celebração, com linha individual por irmão)
              if (isFam) {
                return `
                  <article data-family-celebration-card="${escapeHtml(group.key)}" class="bg-white rounded-2xl border-2 ${
                    isPast ? 'border-[#E6DACE] opacity-85' : 'user-schedule-card'
                  } p-4 sm:p-5 space-y-3.5 transition">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div class="flex items-start gap-3.5 min-w-0">
                        <div class="w-16 sm:w-20 rounded-2xl ${
                          countdown.diffDays === 0
                            ? 'bg-[#D97706] text-white'
                            : isPast
                              ? 'bg-stone-100 text-stone-500'
                              : 'bg-[#3E2723] text-white'
                        } p-2.5 text-center shrink-0 shadow-xs">
                          <p class="text-xl font-extrabold leading-none">${escapeHtml(sch.date.slice(8, 10))}</p>
                          <p class="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-85">${escapeHtml(sch.date.slice(5, 7))}/${escapeHtml(sch.date.slice(2, 4))}</p>
                          <p class="text-xs font-extrabold mt-1 text-amber-300 ${countdown.diffDays === 0 ? '!text-white' : isPast ? '!text-stone-500' : ''}">${escapeHtml(sch.time)}</p>
                        </div>

                        <div class="space-y-1 min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${countdown.cls}">
                              <i data-lucide="hourglass" class="w-3 h-3"></i>
                              ${escapeHtml(countdown.label)}
                            </span>
                            ${
                              entries.length > 1
                                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF6F0] text-[#5D4037] border border-[#E6DACE]">
                                    <i data-lucide="users" class="w-3 h-3 text-[#B45309]"></i>
                                    ${entries.length} irmãos nesta missa
                                  </span>`
                                : ''
                            }
                          </div>
                          <h5 class="text-base font-extrabold text-[#3E2723]">${escapeHtml(sch.celebrationType)}</h5>
                          <div class="flex items-center gap-3 flex-wrap text-xs text-[#6D4C41]">
                            <span class="capitalize font-semibold">${escapeHtml(formatWeekdayBR(sch.date))}, ${escapeHtml(formatDateBR(sch.date))}</span>
                            <span class="inline-flex items-center gap-1">
                              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-[#B45309]"></i>
                              ${escapeHtml(sch.location)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button type="button" data-md-liturgy="${sch.id}" data-md-date="${escapeHtml(sch.date)}"
                        class="self-start sm:self-center shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 transition">
                        <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                        Ver Liturgia Completa
                      </button>
                    </div>

                    <!-- Lista individual de irmãos escalados nesta celebração -->
                    <div class="pt-3 border-t border-[#E6DACE]/80 space-y-2">
                      ${entries
                        .map((entry) => {
                          const asg = entry.assignment;
                          const eSch = entry.schedule;
                          return `
                            <div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div class="space-y-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                  ${renderFamilyMemberPill(user, entry.assignedMemberId, { fallbackName: entry.assignedName })}
                                  ${renderPastoralPill(entry.pastoral, { compact: true })}
                                  <span class="text-xs font-extrabold text-[#3E2723]">${escapeHtml(entry.roleName)}</span>
                                  ${
                                    entry.isCoordShift
                                      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#3E2723] text-amber-300">
                                          👑 Plantão
                                        </span>`
                                      : ''
                                  }
                                  ${
                                    asg.substitutionRequested
                                      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                                          <i data-lucide="alert-circle" class="w-3 h-3"></i>
                                          Substituição Solicitada
                                        </span>`
                                      : asg.substitutionAccepted
                                        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            <i data-lucide="check-circle-2" class="w-3 h-3"></i>
                                            Substituição Confirmada
                                          </span>`
                                        : ''
                                  }
                                </div>
                                ${
                                  entry.hasConflict
                                    ? `<p class="text-[11px] font-semibold text-amber-950 flex items-center gap-1">
                                        <i data-lucide="clock-alert" class="w-3 h-3 text-[#B45309] shrink-0"></i>
                                        Conflito amigável: ${escapeHtml(getFirstName(entry.assignedName))} possui outra escala neste horário.
                                      </p>`
                                    : ''
                                }
                                ${
                                  asg.substitutionRequested && asg.substitutionReason
                                    ? `<p class="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                        <strong>Motivo:</strong> ${escapeHtml(asg.substitutionReason)}
                                      </p>`
                                    : ''
                                }
                              </div>

                              <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                ${
                                  !isPast && !asg.substitutionRequested
                                    ? `<button type="button" data-md-sub="${asg.id}" data-md-sch="${eSch.id}"
                                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#92400E] bg-white hover:bg-amber-50 border border-amber-300 transition">
                                        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                                        Solicitar Substituição
                                      </button>`
                                    : !isPast && asg.substitutionRequested
                                      ? `<button type="button" data-md-cancel-sub="${asg.id}" data-md-sch="${eSch.id}"
                                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#5D4037] bg-white hover:bg-[#FAF6F0] border border-[#D7C4B2] transition">
                                          <i data-lucide="x-circle" class="w-3.5 h-3.5 text-red-600"></i>
                                          Cancelar Pedido
                                        </button>`
                                      : ''
                                }
                              </div>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>
                  </article>
                `;
              }

              // Card padrão marrom/dourado para Contas Individuais
              const primary = entries[0];
              const asg = primary.assignment;
              return `
                <article class="bg-white rounded-2xl border-2 ${
                  isPast ? 'border-[#E6DACE] opacity-85' : 'user-schedule-card'
                } p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition">
                  <div class="flex items-start gap-4 min-w-0">
                    <div class="w-16 sm:w-20 rounded-2xl ${
                      countdown.diffDays === 0
                        ? 'bg-[#D97706] text-white'
                        : isPast
                          ? 'bg-stone-100 text-stone-500'
                          : 'bg-[#3E2723] text-white'
                    } p-2.5 text-center shrink-0 shadow-xs">
                      <p class="text-xl font-extrabold leading-none">${escapeHtml(sch.date.slice(8, 10))}</p>
                      <p class="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-85">${escapeHtml(sch.date.slice(5, 7))}/${escapeHtml(sch.date.slice(2, 4))}</p>
                      <p class="text-xs font-extrabold mt-1 text-amber-300 ${countdown.diffDays === 0 ? '!text-white' : isPast ? '!text-stone-500' : ''}">${escapeHtml(sch.time)}</p>
                    </div>

                    <div class="space-y-1.5 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${countdown.cls}">
                          <i data-lucide="hourglass" class="w-3 h-3"></i>
                          ${escapeHtml(countdown.label)}
                        </span>
                        ${
                          primary.isCoordShift
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#3E2723] text-amber-300 border border-amber-400/70">
                                👑 Plantão de Coordenação
                              </span>`
                            : ''
                        }
                        ${renderPastoralPill(primary.pastoral, { compact: true })}
                        ${
                          asg.substitutionRequested
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                                <i data-lucide="alert-circle" class="w-3 h-3"></i>
                                Substituição Solicitada
                              </span>`
                            : asg.substitutionAccepted
                              ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <i data-lucide="check-circle-2" class="w-3 h-3"></i>
                                  Substituição Confirmada
                                </span>`
                              : ''
                        }
                      </div>

                      <h5 class="text-base font-extrabold text-[#3E2723]">
                        ${escapeHtml(sch.celebrationType)} — <span class="text-[#B45309]">${escapeHtml(entries.map((e) => e.roleName).join(' / '))}</span>
                      </h5>

                      <div class="flex items-center gap-3 flex-wrap text-xs text-[#6D4C41]">
                        <span class="capitalize font-semibold">${escapeHtml(formatWeekdayBR(sch.date))}, ${escapeHtml(formatDateBR(sch.date))}</span>
                        <span class="inline-flex items-center gap-1">
                          <i data-lucide="map-pin" class="w-3.5 h-3.5 text-[#B45309]"></i>
                          ${escapeHtml(sch.location)}
                        </span>
                      </div>

                      ${
                        primary.hasConflict
                          ? `<div class="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-amber-950 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1">
                              <i data-lucide="clock-alert" class="w-3.5 h-3.5 text-[#B45309] shrink-0"></i>
                              Conflito amigável: ${escapeHtml(getFirstName(primary.assignedName))} possui outra escala neste mesmo dia e horário.
                            </div>`
                          : ''
                      }
                      ${
                        asg.substitutionRequested && asg.substitutionReason
                          ? `<p class="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 mt-1">
                              <strong>Motivo informado:</strong> ${escapeHtml(asg.substitutionReason)}
                            </p>`
                          : ''
                      }
                    </div>
                  </div>

                  <div class="flex items-center gap-2 flex-wrap shrink-0 self-end md:self-center">
                    <button type="button" data-md-liturgy="${sch.id}" data-md-date="${escapeHtml(sch.date)}"
                      class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 transition">
                      <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                      Ver Liturgia Completa
                    </button>
                    ${
                      !isPast && !asg.substitutionRequested
                        ? `<button type="button" data-md-sub="${asg.id}" data-md-sch="${sch.id}"
                            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#92400E] bg-amber-50 hover:bg-amber-100 border border-amber-300 transition">
                            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                            Solicitar Substituição
                          </button>`
                        : !isPast && asg.substitutionRequested
                          ? `<button type="button" data-md-cancel-sub="${asg.id}" data-md-sch="${sch.id}"
                              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#5D4037] bg-white hover:bg-[#FAF6F0] border border-[#D7C4B2] transition">
                              <i data-lucide="x-circle" class="w-3.5 h-3.5 text-red-600"></i>
                              Cancelar Pedido de Substituição
                            </button>`
                          : ''
                    }
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `
      }
    </div>
  `;

  targetEl.querySelectorAll('[data-mydates-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      scopeFilter = btn.dataset.mydatesScope;
      renderMyDatesContent(targetEl, { user, onChanged, onNotificationsChanged, openLiturgyFor, compactHeader });
    });
  });

  targetEl.querySelectorAll('[data-md-liturgy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openLiturgyFor?.(btn.dataset.mdDate, btn.dataset.mdLiturgy);
    });
  });

  targetEl.querySelectorAll('[data-md-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openQuickSubModal(btn.dataset.mdSch, btn.dataset.mdSub, rerender);
    });
  });

  targetEl.querySelectorAll('[data-md-cancel-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.cancelSubstitutionRequest(btn.dataset.mdSch, btn.dataset.mdCancelSub);
      showToast('Pedido de substituição cancelado. Escala mantida.');
      rerender();
    });
  });

  refreshIcons();
}

export function renderMyDates(container, { user, setHeaderContext, openLiturgyFor, onNotificationsChanged }) {
  setHeaderContext?.('Minhas Datas', 'Seus compromissos pessoais em ordem cronológica');
  renderMyDatesContent(container, { user, openLiturgyFor, onNotificationsChanged, compactHeader: false });
}

function openQuickSubModal(scheduleId, assignmentId, onDone) {
  openModal({
    title: 'Solicitar Substituição',
    bodyHtml: `
      <form id="md-sub-form" class="space-y-4">
        <p class="text-sm text-[#5D4037]">
          Informe o motivo da indisponibilidade. Todos os colegas e coordenadores da sua pastoral serão notificados para que alguém possa assumir esta escala.
        </p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1.5">Motivo da Substituição *</label>
          <textarea name="reason" rows="3" required placeholder="Ex: Viagem, compromisso familiar ou trabalho..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-md-sub" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold transition">Confirmar Solicitação</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-md-sub').addEventListener('click', closeModal);
      bodyEl.querySelector('#md-sub-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const reason = String(new FormData(e.target).get('reason'));
        dataService.requestSubstitution(scheduleId, assignmentId, reason);
        closeModal();
        showToast('Substituição solicitada! Colegas e coordenação da pastoral foram notificados.');
        onDone();
      });
    },
  });
}
