/**
 * Módulo dedicado "Minhas Datas"
 * Lista exclusivamente as datas, horários, locais, pastorais e funções em que o próprio
 * usuário logado está escalado, ordenadas cronologicamente, com contagem regressiva
 * ("Hoje", "Amanhã", "Em X dias"), alerta amigável de conflito e botão "Solicitar Substituição".
 */

import { dataService } from '../services/dataService.js';
import {
  buildUserTimeSlotIndex,
  closeModal,
  escapeHtml,
  formatDateBR,
  formatWeekdayBR,
  getCountdownBadge,
  getTodayISO,
  hasTimeConflict,
  openModal,
  refreshIcons,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

let scopeFilter = 'upcoming'; // 'upcoming' | 'all'

export function renderMyDatesContent(targetEl, { user, onChanged, compactHeader = false }) {
  const todayISO = getTodayISO();
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const roles = dataService.getRoles();
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));
  const schedules = dataService.getSchedules();
  const slotIndex = buildUserTimeSlotIndex(schedules);

  const allMine = [];
  schedules.forEach((sch) => {
    (sch.assignments || []).forEach((asg) => {
      if (asg.userId !== user.id) return;
      const pastoral = pastoralMap[asg.pastoralId] || pastoralMap[sch.pastoralId];
      allMine.push({
        schedule: sch,
        assignment: asg,
        pastoral,
        roleName: roleMap[asg.roleId]?.name || 'Função',
        countdown: getCountdownBadge(sch.date),
        hasConflict: hasTimeConflict(slotIndex, user.id, sch.date, sch.time),
      });
    });
  });

  allMine.sort((a, b) =>
    `${a.schedule.date}T${a.schedule.time}`.localeCompare(`${b.schedule.date}T${b.schedule.time}`),
  );

  const upcomingCount = allMine.filter((item) => item.schedule.date >= todayISO).length;
  const displayed =
    scopeFilter === 'upcoming'
      ? allMine.filter((item) => item.schedule.date >= todayISO)
      : allMine;

  targetEl.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        ${
          compactHeader
            ? `<div>
                <h4 class="text-base font-extrabold text-[#3E2723]">Minhas Datas Agendadas</h4>
                <p class="text-xs text-[#6D4C41]">Exclusivamente seus compromissos em ordem cronológica, com contagem regressiva.</p>
              </div>`
            : `<div>
                <span class="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full mb-1.5">
                  <i data-lucide="calendar-clock" class="w-3 h-3"></i>
                  Compromissos Pessoais
                </span>
                <h3 class="text-xl font-extrabold text-[#3E2723]">Minhas Datas</h3>
                <p class="text-sm text-[#6D4C41] mt-0.5">
                  Todas as datas, horários, locais e funções em que você está escalado(a), em ordem cronológica.
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
            Todas (${allMine.length})
          </button>
        </div>
      </div>

      ${
        displayed.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
          <i data-lucide="calendar-heart" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
          <h4 class="text-base font-bold text-[#3E2723]">Nenhuma data encontrada neste filtro</h4>
          <p class="text-sm text-[#6D4C41] mt-1">Quando você for escalado(a) em alguma pastoral, seus compromissos aparecerão automaticamente aqui.</p>
        </div>
      `
          : `
        <div class="space-y-3.5">
          ${displayed
            .map(({ schedule: sch, assignment: asg, pastoral, roleName, countdown, hasConflict }) => {
              const isPast = countdown.diffDays < 0;
              return `
                <article class="bg-white rounded-2xl border-2 ${
                  isPast ? 'border-[#E6DACE] opacity-85' : 'user-schedule-card'
                } p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition">
                  <div class="flex items-start gap-4 min-w-0">
                    <!-- Bloco de Data + Contagem -->
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
                        ${renderPastoralPill(pastoral, { compact: true })}
                        ${
                          asg.substitutionRequested
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                                <i data-lucide="alert-circle" class="w-3 h-3"></i>
                                Substituição Solicitada
                              </span>`
                            : ''
                        }
                      </div>

                      <h5 class="text-base font-extrabold text-[#3E2723]">
                        ${escapeHtml(sch.celebrationType)} — <span class="text-[#B45309]">${escapeHtml(roleName)}</span>
                      </h5>

                      <div class="flex items-center gap-3 flex-wrap text-xs text-[#6D4C41]">
                        <span class="capitalize font-semibold">${escapeHtml(formatWeekdayBR(sch.date))}, ${escapeHtml(formatDateBR(sch.date))}</span>
                        <span class="inline-flex items-center gap-1">
                          <i data-lucide="map-pin" class="w-3.5 h-3.5 text-[#B45309]"></i>
                          ${escapeHtml(sch.location)}
                        </span>
                      </div>

                      ${
                        hasConflict
                          ? `<div class="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-amber-950 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1">
                              <i data-lucide="clock-alert" class="w-3.5 h-3.5 text-[#B45309] shrink-0"></i>
                              Conflito amigável: você possui outra escala neste mesmo dia e horário.
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

                  <div class="flex items-center gap-2 shrink-0 self-end md:self-center">
                    ${
                      !isPast && !asg.substitutionRequested
                        ? `<button type="button" data-md-sub="${asg.id}" data-md-sch="${sch.id}"
                            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#92400E] bg-amber-50 hover:bg-amber-100 border border-amber-300 transition">
                            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                            Solicitar Substituição
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
      renderMyDatesContent(targetEl, { user, onChanged, compactHeader });
    });
  });

  targetEl.querySelectorAll('[data-md-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openQuickSubModal(btn.dataset.mdSch, btn.dataset.mdSub, () => {
        if (onChanged) onChanged();
        else renderMyDatesContent(targetEl, { user, onChanged, compactHeader });
      });
    });
  });

  refreshIcons();
}

export function renderMyDates(container, { user, setHeaderContext }) {
  setHeaderContext?.('Minhas Datas', 'Seus compromissos pessoais em ordem cronológica');
  renderMyDatesContent(container, { user, compactHeader: false });
}

function openQuickSubModal(scheduleId, assignmentId, onDone) {
  openModal({
    title: 'Solicitar Substituição',
    bodyHtml: `
      <form id="md-sub-form" class="space-y-4">
        <p class="text-sm text-[#5D4037]">
          Informe o motivo da sua indisponibilidade para que a coordenação da pastoral possa reatribuir outro membro.
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
        showToast('Substituição solicitada! A coordenação da pastoral foi sinalizada.');
        onDone();
      });
    },
  });
}
