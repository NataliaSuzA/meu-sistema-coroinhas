/**
 * Módulo 3: Agenda (Sincronizada Automaticamente com Escalas)
 * - Calendário mensal interativo + lista de eventos do mês
 * - Regra de Ouro: todo vínculo em Escala aparece automaticamente na agenda
 *   pessoal do usuário com tag indicando sua função (ex: 19:00 - Igreja São Francisco (Missal))
 * - Coordenadores também podem criar/editar/excluir eventos gerais (Ensaios, Reuniões, Formações)
 */

import { dataService } from '../services/dataService.js';
import {
  buildSyncedAgendaItems,
  closeModal,
  escapeHtml,
  formatDateBR,
  formatWeekdayBR,
  getTodayISO,
  isCoordinator,
  MONTHS_PT,
  openModal,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth(); // 0..11
let selectedDateISO = null;
let showAllPastoralSchedules = true;

export function renderAgenda(container, { user }) {
  const coord = isCoordinator(user);
  const schedules = dataService.getSchedules();
  const events = dataService.getEvents();
  const roles = dataService.getRoles();

  const items = buildSyncedAgendaItems(user, {
    schedules,
    events,
    roles,
    includeAllSchedules: coord && showAllPastoralSchedules,
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
    cells.push('<div class="calendar-cell bg-slate-50/60 border-b border-r border-slate-100"></div>');
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const dayItems = itemsByDay[iso] || [];
    const isToday = iso === todayISO;
    const isSelected = iso === selectedDateISO;

    cells.push(`
      <button type="button" data-cal-day="${iso}"
        class="calendar-cell text-left p-1.5 sm:p-2 border-b border-r border-slate-100 align-top flex flex-col gap-1 transition ${
          isSelected
            ? 'bg-blue-50/90 ring-2 ring-inset ring-[#1E3A8A]'
            : isToday
              ? 'bg-amber-50/50 hover:bg-amber-50'
              : 'bg-white hover:bg-slate-50'
        }">
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            isToday ? 'bg-[#0F172A] text-amber-400' : 'text-slate-700'
          }">${day}</span>
          ${dayItems.length > 0 ? `<span class="text-[10px] font-bold text-slate-400">${dayItems.length}</span>` : ''}
        </div>
        <div class="space-y-1 overflow-hidden w-full">
          ${dayItems
            .slice(0, 2)
            .map((it) => {
              const pillClass = it.isPersonalSchedule
                ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                : it.sourceType === 'event'
                  ? 'bg-blue-100 text-blue-900 border-blue-200 font-semibold'
                  : 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
              return `
                <div class="truncate text-[10px] px-1.5 py-0.5 rounded border ${pillClass}" title="${escapeHtml(it.shortTag)}">
                  ${escapeHtml(it.shortTag)}
                </div>
              `;
            })
            .join('')}
          ${
            dayItems.length > 2
              ? `<div class="text-[10px] font-bold text-[#1E3A8A] pl-1">+${dayItems.length - 2} mais</div>`
              : ''
          }
        </div>
      </button>
    `);
  }

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Cabeçalho -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Agenda Paroquial &amp; Pessoal</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            Sincronizada automaticamente com suas escalas litúrgicas, ensaios e reuniões.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          ${
            coord
              ? `
            <label class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer">
              <input id="toggle-all-schedules" type="checkbox" ${showAllPastoralSchedules ? 'checked' : ''} class="rounded text-[#1E3A8A]">
              Exibir todas as escalas
            </label>
            <button id="btn-new-event" type="button"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold shadow-sm transition">
              <i data-lucide="calendar-plus" class="w-4 h-4 text-amber-400"></i>
              Novo Evento
            </button>
          `
              : ''
          }
        </div>
      </div>

      <!-- Legenda -->
      <div class="flex items-center gap-4 flex-wrap text-xs text-slate-600">
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-amber-400"></span> Minha Escala (sincronizada)</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-[#1E3A8A]"></span> Ensaio / Reunião / Formação</span>
        ${coord ? '<span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-slate-300"></span> Outras Escalas da Pastoral</span>' : ''}
      </div>

      <!-- Calendário Mensal -->
      <section class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between gap-3">
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

        <div class="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 py-2">
          <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div class="grid grid-cols-7 border-l border-slate-100">
          ${cells.join('')}
        </div>
      </section>

      <!-- Lista de Compromissos do Mês / Dia Selecionado -->
      <section class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h4 class="text-base font-bold text-[#0F172A]">
              ${selectedDateISO ? `Compromissos de ${formatDateBR(selectedDateISO)}` : `Compromissos de ${MONTHS_PT[currentMonth]}`}
            </h4>
            <p class="text-xs text-slate-500">${displayedItems.length} ${displayedItems.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p>
          </div>
          ${
            selectedDateISO
              ? `<button id="clear-day-filter" type="button" class="text-xs font-bold text-[#1E3A8A] hover:underline">Ver mês inteiro</button>`
              : ''
          }
        </div>

        <div class="p-5 space-y-3">
          ${
            displayedItems.length === 0
              ? `
            <div class="text-center py-8 text-slate-500 text-sm">
              Nenhum compromisso registrado para este período.
            </div>
          `
              : displayedItems
                  .map((it) => {
                    const accent = it.isPersonalSchedule
                      ? 'border-l-4 border-l-amber-500 bg-amber-50/40 border-amber-200'
                      : it.sourceType === 'event'
                        ? 'border-l-4 border-l-[#1E3A8A] bg-blue-50/30 border-blue-200/70'
                        : 'border-l-4 border-l-slate-300 bg-slate-50/50 border-slate-200';
                    return `
                      <article class="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${accent}">
                        <div class="space-y-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-extrabold text-[#0F172A] bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                              ${escapeHtml(formatDateBR(it.date))} • ${escapeHtml(it.time)}
                            </span>
                            <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              it.isPersonalSchedule
                                ? 'bg-amber-500 text-white'
                                : it.sourceType === 'event'
                                  ? 'bg-[#1E3A8A] text-white'
                                  : 'bg-slate-200 text-slate-700'
                            }">
                              ${escapeHtml(it.eventType)}
                            </span>
                            ${
                              it.isPersonalSchedule
                                ? `<span class="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                                    ${escapeHtml(it.shortTag)}
                                  </span>`
                                : ''
                            }
                          </div>
                          <h5 class="text-sm font-bold text-[#0F172A]">${escapeHtml(it.title)}</h5>
                          <p class="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                            <span class="capitalize">${escapeHtml(formatWeekdayBR(it.date))}</span>
                            <span>•</span>
                            <span>${escapeHtml(it.location)}</span>
                            ${it.description ? `<span>•</span><span>${escapeHtml(it.description)}</span>` : ''}
                          </p>
                        </div>

                        ${
                          coord && it.sourceType === 'event'
                            ? `
                          <div class="flex items-center gap-1 shrink-0">
                            <button type="button" data-edit-event="${it.sourceId}" class="p-2 rounded-lg text-slate-500 hover:text-[#1E3A8A] hover:bg-white transition" title="Editar evento">
                              <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button type="button" data-delete-event="${it.sourceId}" class="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-white transition" title="Excluir evento">
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

  container.querySelector('#toggle-all-schedules')?.addEventListener('change', (e) => {
    showAllPastoralSchedules = e.target.checked;
    renderAgenda(container, { user });
  });

  container.querySelector('#btn-new-event')?.addEventListener('click', () => {
    openEventModal(null, () => renderAgenda(container, { user }));
  });

  container.querySelectorAll('[data-edit-event]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const evt = dataService.getEvents().find((e) => e.id === btn.dataset.editEvent);
      if (evt) openEventModal(evt, () => renderAgenda(container, { user }));
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

function openEventModal(existing, onSaved) {
  openModal({
    title: existing ? 'Editar Evento da Agenda' : 'Novo Evento na Agenda',
    bodyHtml: `
      <form id="event-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Título do Evento *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Ensaio Geral de Páscoa"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Tipo *</label>
            <select name="type" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
              ${['Ensaio', 'Reunião', 'Formação', 'Missa', 'Confraternização']
                .map((t) => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`)
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Público-Alvo *</label>
            <select name="audience" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
              ${['Todos', 'Coordenador', 'Acólito', 'Coroinha']
                .map((a) => `<option value="${a}" ${existing?.audience === a ? 'selected' : ''}>${a}</option>`)
                .join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Data *</label>
            <input name="date" type="date" required value="${escapeHtml(existing?.date || selectedDateISO || getTodayISO())}"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Horário *</label>
            <input name="time" type="time" required value="${escapeHtml(existing?.time || '19:00')}"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Local *</label>
          <input name="location" required value="${escapeHtml(existing?.location || 'Matriz Santa Teresa')}"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Descrição</label>
          <textarea name="description" rows="2" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-evt-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">Salvar Evento</button>
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
          audience: fd.get('audience'),
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
