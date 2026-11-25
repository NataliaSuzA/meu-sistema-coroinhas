/**
 * Módulo 3: Agenda Multi-Pastoral (Sincronizada Automaticamente)
 * - Unifica automaticamente todas as escalas do usuário logado com tag colorida da pastoral
 * - Exibe alerta visual amigável para conflitos no mesmo dia/horário
 * - Isolamento de gestão: Coordenadores criam/editam eventos apenas das pastorais que coordenam
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
  isGeneralAdmin,
  MONTHS_PT,
  openModal,
  refreshIcons,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth();
let selectedDateISO = null;
let showManagedPastoralSchedules = true;

export function renderAgenda(container, { user }) {
  const anyCoord = isAnyCoordinator(user);
  const pastorals = dataService.getPastorals();
  const schedules = dataService.getSchedules();
  const events = dataService.getEvents();
  const roles = dataService.getRoles();

  const items = buildSyncedAgendaItems(user, {
    schedules,
    events,
    roles,
    pastorals,
    includeManagedSchedules: anyCoord && showManagedPastoralSchedules,
  });

  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthItems = items.filter((item) => item.date.startsWith(monthPrefix));
  const displayedItems = selectedDateISO
    ? monthItems.filter((item) => item.date === selectedDateISO)
    : monthItems;

  const itemsByDay = {};
  monthItems.forEach((item) => {
    if (!itemsByDay[item.date]) itemsByDay[item.date] = [];
    itemsByDay[item.date].push(item);
  });

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
    const isToday = iso === todayISO;
    const isSelected = iso === selectedDateISO;

    cells.push(`
      <button type="button" data-cal-day="${iso}"
        class="calendar-cell text-left p-1.5 sm:p-2 border-b border-r border-[#E6DACE]/60 align-top flex flex-col gap-1 transition ${
          isSelected
            ? 'bg-amber-50 ring-2 ring-inset ring-[#B45309]'
            : isToday
              ? 'bg-amber-50/50 hover:bg-amber-50'
              : 'bg-white hover:bg-[#FDFBF7]'
        }">
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            isToday ? 'bg-[#3E2723] text-amber-400' : 'text-[#4E342E]'
          }">${day}</span>
          ${dayItems.length > 0 ? `<span class="text-[10px] font-bold text-[#8D6E63]">${dayItems.length}</span>` : ''}
        </div>
        <div class="space-y-1 overflow-hidden w-full">
          ${dayItems
            .slice(0, 2)
            .map((it) => {
              const color = it.pastoral?.color || '#5D4037';
              const style = it.isPersonalSchedule
                ? `background-color:${color}22; color:${color}; border-color:${color}66;`
                : '';
              const cls = it.isPersonalSchedule
                ? 'font-bold'
                : it.sourceType === 'event'
                  ? 'bg-[#F5EFE6] text-[#3E2723] border-[#D7C4B2] font-semibold'
                  : 'bg-stone-100 text-stone-600 border-stone-200 font-medium';
              return `
                <div class="truncate text-[10px] px-1.5 py-0.5 rounded border ${cls}" style="${style}" title="${escapeHtml(it.shortTag)}">
                  ${escapeHtml(it.shortTag)}
                </div>
              `;
            })
            .join('')}
          ${
            dayItems.length > 2
              ? `<div class="text-[10px] font-bold text-[#B45309] pl-1">+${dayItems.length - 2} mais</div>`
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
          <h3 class="text-xl font-extrabold text-[#3E2723]">Agenda Paroquial &amp; Pessoal</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Todas as suas escalas unificadas com a cor de cada pastoral, além de ensaios e reuniões.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          ${
            anyCoord
              ? `
            <label class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#E6DACE] text-xs font-semibold text-[#5D4037] cursor-pointer">
              <input id="toggle-managed-schedules" type="checkbox" ${showManagedPastoralSchedules ? 'checked' : ''} class="rounded text-[#B45309]">
              Exibir escalas das pastorais que coordeno
            </label>
            <button id="btn-new-event" type="button"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition">
              <i data-lucide="calendar-plus" class="w-4 h-4 text-amber-400"></i>
              Novo Evento
            </button>
          `
              : ''
          }
        </div>
      </div>

      <!-- Calendário Mensal -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="px-5 py-4 bg-[#3E2723] text-white flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <button id="cal-prev" type="button" class="p-1.5 rounded-lg hover:bg-white/10 transition" aria-label="Mês anterior">
              <i data-lucide="chevron-left" class="w-5 h-5"></i>
            </button>
            <h4 class="text-base sm:text-lg font-bold min-w-[170px] text-center">
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

        <div class="grid grid-cols-7 bg-[#FAF6F0] border-b border-[#E6DACE] text-center text-[11px] font-bold uppercase tracking-wider text-[#6D4C41] py-2">
          <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div class="grid grid-cols-7 border-l border-[#E6DACE]/60">
          ${cells.join('')}
        </div>
      </section>

      <!-- Lista de Compromissos -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-[#E6DACE]/80 flex items-center justify-between gap-3 bg-[#FDFBF7]">
          <div>
            <h4 class="text-base font-bold text-[#3E2723]">
              ${selectedDateISO ? `Compromissos de ${formatDateBR(selectedDateISO)}` : `Compromissos de ${MONTHS_PT[currentMonth]}`}
            </h4>
            <p class="text-xs text-[#6D4C41]">${displayedItems.length} ${displayedItems.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p>
          </div>
          ${
            selectedDateISO
              ? `<button id="clear-day-filter" type="button" class="text-xs font-bold text-[#B45309] hover:underline">Ver mês inteiro</button>`
              : ''
          }
        </div>

        <div class="p-5 space-y-3">
          ${
            displayedItems.length === 0
              ? `<div class="text-center py-8 text-[#8D6E63] text-sm">Nenhum compromisso registrado para este período.</div>`
              : displayedItems
                  .map((it) => {
                    const borderColor = it.isPersonalSchedule
                      ? it.pastoral?.color || '#D97706'
                      : it.sourceType === 'event'
                        ? '#5D4037'
                        : '#D7C4B2';
                    return `
                      <article class="rounded-xl border border-[#E6DACE] bg-[#FDFBF7] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        style="border-left: 4px solid ${escapeHtml(borderColor)};">
                        <div class="space-y-1.5">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-extrabold text-[#3E2723] bg-white px-2.5 py-0.5 rounded-lg border border-[#E6DACE]">
                              ${escapeHtml(formatDateBR(it.date))} • ${escapeHtml(it.time)}
                            </span>
                            ${renderPastoralPill(it.pastoral, { compact: true })}
                            <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              it.isPersonalSchedule
                                ? 'bg-[#D97706] text-white'
                                : it.sourceType === 'event'
                                  ? 'bg-[#4E342E] text-amber-200'
                                  : 'bg-[#F5EFE6] text-[#5D4037]'
                            }">
                              ${escapeHtml(it.eventType)}
                            </span>
                            ${
                              it.isPersonalSchedule
                                ? `<span class="text-xs font-bold text-[#92400E] bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                                    ${escapeHtml(it.shortTag)}
                                  </span>`
                                : ''
                            }
                            ${
                              it.hasConflict
                                ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded-full">
                                    <i data-lucide="clock-alert" class="w-3 h-3"></i>
                                    Conflito de horário
                                  </span>`
                                : ''
                            }
                          </div>
                          <h5 class="text-sm font-bold text-[#3E2723]">${escapeHtml(it.title)}</h5>
                          <p class="text-xs text-[#6D4C41] flex items-center gap-2 flex-wrap">
                            <span class="capitalize">${escapeHtml(formatWeekdayBR(it.date))}</span>
                            <span>•</span>
                            <span>${escapeHtml(it.location)}</span>
                            ${it.description ? `<span>•</span><span>${escapeHtml(it.description)}</span>` : ''}
                          </p>
                        </div>

                        ${
                          it.canEdit && it.sourceType === 'event'
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
      selectedDateISO = selectedDateISO === iso ? null : iso;
      renderAgenda(container, { user });
    });
  });

  container.querySelector('#clear-day-filter')?.addEventListener('click', () => {
    selectedDateISO = null;
    renderAgenda(container, { user });
  });

  container.querySelector('#toggle-managed-schedules')?.addEventListener('change', (e) => {
    showManagedPastoralSchedules = e.target.checked;
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
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const managedPastorals = pastorals.filter((p) => managedIds.has(p.id));
  const generalAdmin = isGeneralAdmin(user);

  openModal({
    title: existing ? 'Editar Evento da Agenda' : 'Novo Evento na Agenda',
    bodyHtml: `
      <form id="event-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Título do Evento *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Ensaio Geral de Liturgia"
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Tipo *</label>
            <select name="type" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${['Ensaio', 'Reunião', 'Formação', 'Missa', 'Confraternização']
                .map((t) => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`)
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Pastoral *</label>
            <select name="pastoralId" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${generalAdmin ? `<option value="all" ${existing?.pastoralId === 'all' ? 'selected' : ''}>Todas as Pastorais (Paroquial)</option>` : ''}
              ${managedPastorals
                .map((p) => `<option value="${p.id}" ${existing?.pastoralId === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`)
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
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Local *</label>
          <input name="location" required value="${escapeHtml(existing?.location || 'Matriz Santa Teresa')}"
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
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
          pastoralId: fd.get('pastoralId'),
          date: fd.get('date'),
          time: fd.get('time'),
          location: String(fd.get('location')).trim(),
          description: String(fd.get('description') || '').trim(),
        });
        closeModal();
        showToast(existing ? 'Evento atualizado!' : 'Evento adicionado à agenda!');
        onSaved();
      });
    },
  });
}
