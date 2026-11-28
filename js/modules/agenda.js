/**
 * Módulo 3: Agenda Multi-Pastoral (Visão Completa da Pastoral + Destaque do Usuário)
 * - Exibe todas as celebrações em que a(s) pastoral(is) do usuário participa(m), além de ensaios/eventos extras
 * - Diferencia visualmente:
 *   * Dias em que o usuário (ou irmão da Conta Familiar) ESTÁ ESCALADO: destaque escuro/dourado com estrela e selo "VOCÊ ESTÁ ESCALADO • [Função]"
 *   * Dias com missa da pastoral em que o usuário NÃO está escalado: etiqueta discreta/suave ("19:00 • Matriz (Coroinhas)")
 * - Legenda rápida no topo e botão "+ Novo Evento / Ensaio" para a Coordenação (coleção `eventos` no Firestore)
 */

import { dataService } from '../services/dataService.js';
import {
  buildSyncedAgendaItems,
  closeModal,
  escapeHtml,
  formatDateBR,
  formatWeekdayBR,
  getCoordinatedPastoralIds,
  getTodayISO,
  isAnyCoordinator,
  isFamilyAccount,
  isGeneralAdmin,
  MONTHS_PT,
  openModal,
  refreshIcons,
  renderFamilyMemberPill,
  renderFamilyMembersLegend,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth();
let selectedDateISO = null;

export function renderAgenda(container, { user }) {
  const anyCoord = isAnyCoordinator(user);
  const isFam = isFamilyAccount(user);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const schedules = dataService.getSchedules();
  const events = dataService.getEvents();
  const roles = dataService.getRoles();

  const items = buildSyncedAgendaItems(user, {
    schedules,
    events,
    roles,
    pastorals,
    includePastoralSchedules: true,
  });

  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthItems = items.filter((item) => item.date.startsWith(monthPrefix));
  const displayedItems = (selectedDateISO
    ? monthItems.filter((item) => item.date === selectedDateISO)
    : monthItems
  ).slice().sort((a, b) => {
    const dtCmp = `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
    if (dtCmp !== 0) return dtCmp;
    return Number(b.isPersonalSchedule) - Number(a.isPersonalSchedule);
  });

  const itemsByDay = {};
  monthItems.forEach((item) => {
    if (!itemsByDay[item.date]) itemsByDay[item.date] = [];
    itemsByDay[item.date].push(item);
  });
  Object.values(itemsByDay).forEach((arr) => {
    arr.sort((a, b) => Number(b.isPersonalSchedule) - Number(a.isPersonalSchedule));
  });

  const personalMonthCount = monthItems.filter((i) => i.isPersonalSchedule).length;
  const pastoralMonthCount = monthItems.filter((i) => i.isPastoralMass).length;

  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayISO = getTodayISO();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push('<div class="calendar-cell bg-[#FAF6F0]/70 border-b border-r border-[#E6DACE]/60"></div>');
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const dayItems = itemsByDay[iso] || [];
    const hasPersonal = dayItems.some((it) => it.isPersonalSchedule);
    const hasEvent = dayItems.some((it) => it.sourceType === 'event');
    const isToday = iso === todayISO;
    const isSelected = iso === selectedDateISO;

    // Até 3 bolinhas compactas (6px) para o modo mobile (< 768px)
    const mobileDotsHtml = dayItems
      .slice(0, 3)
      .map((it) => {
        if (it.isPersonalSchedule) {
          return '<span class="w-1.5 h-1.5 rounded-full bg-[#D97706] ring-2 ring-amber-300/90 shrink-0" aria-hidden="true"></span>';
        }
        if (it.sourceType === 'event') {
          return '<span class="w-1.5 h-1.5 rounded-full bg-[#5D4037] shrink-0" aria-hidden="true"></span>';
        }
        return '<span class="w-1.5 h-1.5 rounded-full bg-[#B8A394] shrink-0" aria-hidden="true"></span>';
      })
      .join('');

    cells.push(`
      <button type="button" data-cal-day="${iso}"
        class="calendar-cell text-left md:p-2 border-b border-r border-[#E6DACE]/60 align-top flex flex-col justify-center md:justify-start gap-1 transition ${
          isSelected
            ? 'bg-amber-100/90 ring-2 ring-inset ring-[#B45309]'
            : hasPersonal
              ? 'bg-amber-50/80 hover:bg-amber-100/60'
              : isToday
                ? 'bg-[#FDFBF7] hover:bg-amber-50/40'
                : 'bg-white hover:bg-[#FDFBF7]'
        }">
        <!-- Mobile (< 768px): número centralizado + até 3 bolinhas de 6px (sem textos cortados) -->
        <div class="flex md:hidden flex-col items-center justify-center gap-1 w-full">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold ${
            hasPersonal
              ? 'bg-[#D97706] text-white ring-2 ring-amber-300 shadow-xs'
              : isToday
                ? 'bg-[#3E2723] text-amber-400'
                : 'text-[#4E342E]'
          }">${day}</span>
          <div class="flex items-center justify-center gap-1 min-h-[6px]">
            ${mobileDotsHtml}
          </div>
        </div>

        <!-- Desktop (>= 768px): número + estrela + horários e etiquetas completas -->
        <div class="hidden md:flex items-center justify-between gap-0.5 w-full">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-extrabold ${
            hasPersonal
              ? 'bg-[#D97706] text-white ring-2 ring-amber-300 shadow-xs'
              : isToday
                ? 'bg-[#3E2723] text-amber-400'
                : 'text-[#4E342E]'
          }">${day}</span>
          ${
            hasPersonal
              ? `<span class="text-[11px] leading-none text-[#D97706]" title="Você está escalado neste dia">★</span>`
              : hasEvent
                ? `<span class="w-2 h-2 rounded-full bg-[#5D4037]" title="Evento / Ensaio"></span>`
                : dayItems.length > 0
                  ? `<span class="text-[10px] font-bold text-[#8D6E63]">${dayItems.length}</span>`
                  : ''
          }
        </div>
        <div class="hidden md:block space-y-1 overflow-hidden w-full">
          ${dayItems
            .slice(0, 2)
            .map((it) => {
              const cls = it.isPersonalSchedule
                ? 'bg-[#3E2723] text-amber-300 border-[#B45309] font-extrabold shadow-2xs'
                : it.sourceType === 'event'
                  ? 'bg-amber-50 text-[#4E342E] border-amber-300 font-semibold'
                  : 'bg-[#F5EFE6]/85 text-[#6D4C41] border-[#E6DACE] font-medium';
              return `
                <div class="truncate text-[10px] px-1.5 py-0.5 rounded border ${cls}" title="${escapeHtml(it.shortTag)}">
                  ${escapeHtml(it.shortTag)}
                </div>
              `;
            })
            .join('')}
          ${
            dayItems.length > 2
              ? `<div class="text-[10px] font-bold text-[#B45309] pl-0.5">+${dayItems.length - 2} mais</div>`
              : ''
          }
        </div>
      </button>
    `);
  }

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Agenda da Pastoral &amp; Escala Pessoal</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Visualize todas as missas da sua pastoral com destaque imediato nos dias em que você está escalado.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          ${
            anyCoord
              ? `
            <button id="btn-new-event" type="button"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition">
              <i data-lucide="calendar-plus" class="w-4 h-4 text-amber-400"></i>
              + Novo Evento / Ensaio
            </button>
          `
              : ''
          }
        </div>
      </div>

      <!-- Legenda Rápida -->
      <div class="bg-white rounded-2xl border border-[#E6DACE] px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div class="flex items-center gap-2.5 flex-wrap text-xs">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-extrabold bg-[#3E2723] text-amber-300 border border-[#B45309]">
            ⭐ ${isFam ? 'Escala da Família' : 'Sua Escala'} (${personalMonthCount})
          </span>
          ${isFam ? renderFamilyMembersLegend(user) : ''}
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-[#F5EFE6] text-[#5D4037] border border-[#E6DACE]">
            <span class="w-2 h-2 rounded-full bg-[#8D6E63]"></span>
            Missa da Pastoral (${pastoralMonthCount})
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-[#78350F] border border-amber-300">
            <span class="w-2 h-2 rounded-full bg-[#B45309]"></span>
            Evento / Ensaio
          </span>
        </div>
        <span class="text-[11px] text-[#8D6E63]">Toque em qualquer dia para filtrar os detalhes abaixo</span>
      </div>

      <!-- Calendário Mensal -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="px-4 sm:px-5 py-4 bg-[#3E2723] text-white flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <button id="cal-prev" type="button" class="p-1.5 rounded-lg hover:bg-white/10 transition" aria-label="Mês anterior">
              <i data-lucide="chevron-left" class="w-5 h-5"></i>
            </button>
            <h4 class="text-sm sm:text-lg font-bold min-w-[140px] sm:min-w-[175px] text-center">
              ${MONTHS_PT[currentMonth]} de ${currentYear}
            </h4>
            <button id="cal-next" type="button" class="p-1.5 rounded-lg hover:bg-white/10 transition" aria-label="Próximo mês">
              <i data-lucide="chevron-right" class="w-5 h-5"></i>
            </button>
          </div>
          <button id="cal-today" type="button"
            class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-bold transition">
            Hoje
          </button>
        </div>

        <div class="grid grid-cols-7 bg-[#FAF6F0] border-b border-[#E6DACE] text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#6D4C41] py-2">
          <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div class="grid grid-cols-7 border-l border-[#E6DACE]/60">
          ${cells.join('')}
        </div>
      </section>

      <!-- Lista de Compromissos e Missas da Pastoral -->
      <section id="agenda-details-panel" class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden scroll-mt-24">
        <div class="px-5 sm:px-6 py-4 border-b border-[#E6DACE]/80 flex items-center justify-between gap-3 bg-[#FDFBF7]">
          <div>
            <h4 class="text-base font-bold text-[#3E2723]">
              ${selectedDateISO ? `Detalhes de ${formatDateBR(selectedDateISO)}` : `Programação de ${MONTHS_PT[currentMonth]}`}
            </h4>
            <p class="text-xs text-[#6D4C41]">${displayedItems.length} ${displayedItems.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p>
          </div>
          ${
            selectedDateISO
              ? `<button id="clear-day-filter" type="button" class="text-xs font-bold text-[#B45309] hover:underline">Ver mês inteiro</button>`
              : ''
          }
        </div>

        <div class="p-4 sm:p-5 space-y-3">
          ${
            displayedItems.length === 0
              ? `<div class="text-center py-8 text-[#8D6E63] text-sm">Nenhum compromisso registrado para este período.</div>`
              : displayedItems
                  .map((it) => {
                    // 1. Card em DESTAQUE FORTE: Usuário (ou irmão da Conta Familiar) ESTÁ ESCALADO
                    if (it.isPersonalSchedule) {
                      const famEntries = isFam && Array.isArray(it.familyEntries) && it.familyEntries.length > 0
                        ? it.familyEntries
                        : null;

                      if (famEntries) {
                        return `
                          <article class="rounded-2xl border-2 border-[#D97706] bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#5D4037] text-white p-4 sm:p-5 shadow-md space-y-3">
                            <div class="space-y-1.5">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-400 text-[#2B1B18] shadow-xs">
                                  <i data-lucide="star" class="w-3.5 h-3.5"></i>
                                  Escala da Família
                                </span>
                                <span class="text-xs font-extrabold text-amber-200 bg-white/10 px-2.5 py-0.5 rounded-lg border border-amber-300/30">
                                  ${escapeHtml(formatDateBR(it.date))} • ${escapeHtml(it.time)}
                                </span>
                                ${
                                  it.hasConflict
                                    ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-[#2B1B18] bg-amber-300 px-2 py-0.5 rounded-full">
                                        <i data-lucide="clock-alert" class="w-3 h-3"></i>
                                        Conflito de horário
                                      </span>`
                                    : ''
                                }
                              </div>
                              <h5 class="text-base font-extrabold text-white">${escapeHtml(it.title)}</h5>
                              <p class="text-xs text-amber-100/85 flex items-center gap-2 flex-wrap">
                                <span class="capitalize font-semibold">${escapeHtml(formatWeekdayBR(it.date))}</span>
                                <span>•</span>
                                <span>${escapeHtml(it.location)}</span>
                              </p>
                            </div>

                            <div class="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2 border-t border-white/15">
                              ${famEntries
                                .map(
                                  (entry) => `
                                <div class="inline-flex items-center gap-2 flex-wrap bg-white/95 text-[#3E2723] rounded-xl px-3 py-1.5 shadow-2xs">
                                  ${renderFamilyMemberPill(user, entry.memberId, { compact: true, fallbackName: entry.memberName })}
                                  ${renderPastoralPill(entry.pastoral, { compact: true })}
                                  <span class="text-xs font-extrabold text-[#4E342E]">${escapeHtml(entry.roleName)}</span>
                                </div>
                              `,
                                )
                                .join('')}
                            </div>
                          </article>
                        `;
                      }

                      return `
                        <article class="rounded-2xl border-2 border-[#D97706] bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#5D4037] text-white p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div class="space-y-2">
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-400 text-[#2B1B18] shadow-xs">
                                <i data-lucide="star" class="w-3.5 h-3.5"></i>
                                ${escapeHtml(it.eventType)}
                              </span>
                              <span class="text-xs font-extrabold text-amber-200 bg-white/10 px-2.5 py-0.5 rounded-lg border border-amber-300/30">
                                ${escapeHtml(formatDateBR(it.date))} • ${escapeHtml(it.time)}
                              </span>
                              ${
                                it.pastoral
                                  ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-amber-100 border border-white/20">
                                      ${escapeHtml(it.pastoral.shortName)}
                                    </span>`
                                  : ''
                              }
                              ${
                                it.hasConflict
                                  ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-[#2B1B18] bg-amber-300 px-2 py-0.5 rounded-full">
                                      <i data-lucide="clock-alert" class="w-3 h-3"></i>
                                      Conflito de horário
                                    </span>`
                                  : ''
                              }
                            </div>
                            <h5 class="text-base font-extrabold text-white">${escapeHtml(it.title)}</h5>
                            <p class="text-xs text-amber-100/85 flex items-center gap-2 flex-wrap">
                              <span class="capitalize font-semibold">${escapeHtml(formatWeekdayBR(it.date))}</span>
                              <span>•</span>
                              <span>${escapeHtml(it.location)}</span>
                              ${it.description ? `<span>•</span><span>${escapeHtml(it.description)}</span>` : ''}
                            </p>
                          </div>
                        </article>
                      `;
                    }

                    // 2. Card DISCRETO: Missa da Pastoral (usuário NÃO está escalado) ou Evento/Ensaio
                    const isEvt = it.sourceType === 'event';
                    const pastoralBadges = Array.isArray(it.pastoralIds) && it.pastoralIds.length > 0
                      ? it.pastoralIds.map((pid) => renderPastoralPill(pastoralMap[pid], { compact: true })).join('')
                      : renderPastoralPill(it.pastoral, { compact: true });

                    return `
                      <article class="rounded-xl border ${
                        isEvt ? 'border-amber-300 bg-amber-50/40' : 'border-[#E6DACE] bg-[#FDFBF7]/90'
                      } p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="space-y-1.5">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-bold text-[#4E342E] bg-white px-2.5 py-0.5 rounded-lg border border-[#E6DACE]">
                              ${escapeHtml(formatDateBR(it.date))} • ${escapeHtml(it.time)}
                            </span>
                            ${pastoralBadges}
                            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isEvt
                                ? 'bg-[#4E342E] text-amber-200'
                                : 'bg-[#F5EFE6] text-[#6D4C41] border border-[#E6DACE]'
                            }">
                              ${escapeHtml(it.eventType)}
                            </span>
                          </div>
                          <h5 class="text-sm font-bold text-[#4E342E]">
                            ${escapeHtml(it.time)} • ${escapeHtml(it.location)}${it.pastoralLabels ? ` (${escapeHtml(it.pastoralLabels)})` : ''} — <span class="font-semibold text-[#6D4C41]">${escapeHtml(it.title.split(' • ')[0])}</span>
                          </h5>
                          <p class="text-xs text-[#8D6E63] flex items-center gap-2 flex-wrap">
                            <span class="capitalize">${escapeHtml(formatWeekdayBR(it.date))}</span>
                            ${it.description ? `<span>•</span><span>${escapeHtml(it.description)}</span>` : ''}
                          </p>
                        </div>

                        ${
                          it.canEdit && isEvt
                            ? `
                          <div class="flex items-center gap-1 shrink-0">
                            <button type="button" data-edit-event="${it.sourceId}" class="p-2 rounded-lg text-[#6D4C41] hover:text-[#3E2723] hover:bg-white transition" title="Editar evento">
                              <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button type="button" data-delete-event="${it.sourceId}" class="p-2 rounded-lg text-[#6D4C41] hover:text-red-700 hover:bg-white transition" title="Excluir evento">
                              <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                          </div>
                        `
                            : ''
                        }
                      </article>
                    `;
                  })
                  .join('')
          }
        </div>
      </section>
    </div>
  `;

  container.querySelector('#cal-prev').addEventListener('click', () => {
    currentMonth -= 1;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    }
    selectedDateISO = null;
    renderAgenda(container, { user });
  });

  container.querySelector('#cal-next').addEventListener('click', () => {
    currentMonth += 1;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    }
    selectedDateISO = null;
    renderAgenda(container, { user });
  });

  container.querySelector('#cal-today').addEventListener('click', () => {
    const t = new Date();
    currentYear = t.getFullYear();
    currentMonth = t.getMonth();
    selectedDateISO = null;
    renderAgenda(container, { user });
  });

  container.querySelectorAll('[data-cal-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const iso = btn.dataset.calDay;
      const selecting = selectedDateISO !== iso;
      selectedDateISO = selecting ? iso : null;
      renderAgenda(container, { user });
      if (selecting && window.innerWidth < 768) {
        container.querySelector('#agenda-details-panel')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  });

  container.querySelector('#clear-day-filter')?.addEventListener('click', () => {
    selectedDateISO = null;
    renderAgenda(container, { user });
  });

  container.querySelector('#btn-new-event')?.addEventListener('click', () => {
    openEventModal(null, user, () => renderAgenda(container, { user }));
  });

  container.querySelectorAll('[data-edit-event]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const evt = dataService.getEvents().find((e) => e.id === btn.dataset.editEvent);
      if (evt) openEventModal(evt, user, () => renderAgenda(container, { user }));
    });
  });

  container.querySelectorAll('[data-delete-event]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja excluir este evento da agenda?')) return;
      dataService.deleteEvent(btn.dataset.deleteEvent);
      showToast('Evento removido da agenda.');
      renderAgenda(container, { user });
    });
  });

  refreshIcons();
}

function openEventModal(existing, user, onSaved) {
  const pastorals = dataService.getActivePastorals();
  const activeLocations = dataService.getActiveLocations();
  const activeCelebrationTypes = dataService.getActiveCelebrationTypes();
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const managedPastorals = pastorals.filter((p) => managedIds.has(p.id));
  const generalAdmin = isGeneralAdmin(user);

  openModal({
    title: existing ? 'Editar Evento / Ensaio' : 'Novo Evento / Ensaio na Agenda',
    bodyHtml: `
      <form id="event-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Título do Evento / Ensaio *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Ensaio Geral de Coroinhas e Acólitos"
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Tipo de Celebração *</label>
            <select name="celebrationTypeId" required class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${activeCelebrationTypes
                .map(
                  (ct) => `<option value="${ct.id}" ${existing?.celebrationTypeId === ct.id ? 'selected' : ''}>${escapeHtml(ct.name)}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Categoria *</label>
            <select name="type" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${['Ensaio', 'Reunião', 'Formação', 'Celebração', 'Confraternização']
                .map((t) => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`)
                .join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Pastoral *</label>
            <select name="pastoralId" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${generalAdmin ? `<option value="all" ${existing?.pastoralId === 'all' ? 'selected' : ''}>Todas as Pastorais (Paroquial)</option>` : ''}
              ${managedPastorals
                .map((p) => `<option value="${p.id}" ${existing?.pastoralId === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`)
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Local (Apenas Ativos) *</label>
            <select name="locationId" required class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${activeLocations
                .map(
                  (loc) => `<option value="${loc.id}" ${existing?.locationId === loc.id || (!existing?.locationId && existing?.location === loc.name) ? 'selected' : ''}>${escapeHtml(loc.name)}</option>`,
                )
                .join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Data *</label>
            <input name="date" type="date" required value="${escapeHtml(existing?.date || selectedDateISO || getTodayISO())}"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Horário *</label>
            <input name="time" type="time" required value="${escapeHtml(existing?.time || '19:00')}"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Descrição</label>
          <textarea name="description" rows="2" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-evt-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Evento</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-evt-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#event-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        dataService.saveEvent({
          id: existing?.id,
          title: String(fd.get('title')).trim(),
          type: fd.get('type'),
          celebrationTypeId: fd.get('celebrationTypeId'),
          pastoralId: fd.get('pastoralId'),
          date: fd.get('date'),
          time: fd.get('time'),
          locationId: fd.get('locationId'),
          description: String(fd.get('description') || '').trim(),
        });
        closeModal();
        showToast(existing ? 'Evento atualizado!' : 'Evento adicionado à agenda!');
        onSaved();
      });
    },
  });
}
