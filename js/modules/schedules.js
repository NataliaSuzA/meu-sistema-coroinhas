/**
 * Módulo 2: Escalas (Módulo Principal)
 * - Abas: Minhas Escalas (padrão), Escala de Acólitos, Escala de Coroinhas, Escala de Coordenadores
 * - Destaque dourado + badge "Sua Escala" quando o usuário logado está escalado
 * - Criação/Edição pela Coordenação com vinculação dinâmica (+ Adicionar Função)
 *   filtrando apenas Funções Ativas e Usuários Ativos da categoria
 * - Solicitar Substituição + Reatribuição pela Coordenação
 */

import { dataService } from '../services/dataService.js';
import {
  closeModal,
  escapeHtml,
  formatDateBR,
  formatWeekdayBR,
  getCategoryBadgeClass,
  getTodayISO,
  isCoordinator,
  openModal,
  refreshIcons,
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

let activeTab = 'mine';

export function resetSchedulesTab() {
  activeTab = 'mine';
}

export function renderSchedules(container, { user }) {
  const coord = isCoordinator(user);
  const schedules = dataService
    .getSchedules()
    .slice()
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const users = dataService.getUsers();
  const roles = dataService.getRoles();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));

  const tabs = [
    { id: 'mine', label: 'Minhas Escalas', icon: 'star' },
    { id: 'Acólito', label: 'Escala de Acólitos', icon: 'flame' },
    { id: 'Coroinha', label: 'Escala de Coroinhas', icon: 'sparkles' },
    { id: 'Coordenador', label: 'Escala de Coordenadores', icon: 'shield-check' },
  ];

  const filtered = schedules.filter((sch) => {
    if (activeTab === 'mine') {
      return sch.assignments.some((a) => a.userId === user.id);
    }
    return sch.category === activeTab;
  });

  const pendingSubCount = schedules.reduce(
    (sum, s) => sum + s.assignments.filter((a) => a.substitutionRequested).length,
    0,
  );

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Barra superior -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Escalas Litúrgicas</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            Consulte suas missas, acompanhe as equipes e solicite substituições quando necessário.
          </p>
        </div>
        ${
          coord
            ? `
          <button id="btn-new-schedule" type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold shadow-sm transition">
            <i data-lucide="plus-circle" class="w-4 h-4 text-amber-400"></i>
            Nova Escala
          </button>
        `
            : ''
        }
      </div>

      ${
        coord && pendingSubCount > 0
          ? `
        <div class="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3.5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <i data-lucide="alert-triangle" class="w-4 h-4"></i>
            </div>
            <p class="text-sm text-amber-950 font-medium">
              Há <strong>${pendingSubCount}</strong> ${pendingSubCount === 1 ? 'solicitação de substituição pendente' : 'solicitações de substituição pendentes'}. Use o botão <strong>Reatribuir</strong> na escala correspondente.
            </p>
          </div>
        </div>
      `
          : ''
      }

      <!-- Abas de Navegação -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        ${tabs
          .map((t) => {
            const isActive = activeTab === t.id;
            const count =
              t.id === 'mine'
                ? schedules.filter((s) => s.assignments.some((a) => a.userId === user.id)).length
                : schedules.filter((s) => s.category === t.id).length;
            return `
              <button type="button" data-tab="${t.id}"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap border transition ${
                  isActive
                    ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }">
                <i data-lucide="${t.icon}" class="w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}"></i>
                ${escapeHtml(t.label)}
                <span class="px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                  isActive ? 'bg-amber-500/25 text-amber-300' : 'bg-slate-100 text-slate-600'
                }">${count}</span>
              </button>
            `;
          })
          .join('')}
      </div>

      <!-- Lista de Escalas -->
      ${
        filtered.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <i data-lucide="calendar-x" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
          <h4 class="text-base font-bold text-slate-700">Nenhuma escala encontrada nesta aba</h4>
          <p class="text-sm text-slate-500 mt-1">
            ${activeTab === 'mine' ? 'Você ainda não foi vinculado(a) a nenhuma celebração.' : 'Nenhuma escala cadastrada para esta categoria.'}
          </p>
        </div>
      `
          : `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          ${filtered
            .map((sch) => renderScheduleCard(sch, { user, coord, userMap, roleMap }))
            .join('')}
        </div>
      `
      }
    </div>
  `;

  // Eventos das abas
  container.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderSchedules(container, { user });
    });
  });

  // Nova escala
  container.querySelector('#btn-new-schedule')?.addEventListener('click', () => {
    openScheduleModal(null, () => renderSchedules(container, { user }));
  });

  // Editar escala
  container.querySelectorAll('[data-edit-schedule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sch = dataService.getScheduleById(btn.dataset.editSchedule);
      if (sch) openScheduleModal(sch, () => renderSchedules(container, { user }));
    });
  });

  // Excluir escala
  container.querySelectorAll('[data-delete-schedule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja realmente excluir esta escala? Ela também será removida da Agenda sincronizada.')) return;
      dataService.deleteSchedule(btn.dataset.deleteSchedule);
      showToast('Escala excluída com sucesso.');
      renderSchedules(container, { user });
    });
  });

  // Solicitar Substituição
  container.querySelectorAll('[data-request-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scheduleId = btn.dataset.scheduleId;
      const assignmentId = btn.dataset.requestSub;
      openSubstitutionModal(scheduleId, assignmentId, () => renderSchedules(container, { user }));
    });
  });

  // Reatribuir (Coordenação)
  container.querySelectorAll('[data-reassign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scheduleId = btn.dataset.scheduleId;
      const assignmentId = btn.dataset.reassign;
      openReassignModal(scheduleId, assignmentId, () => renderSchedules(container, { user }));
    });
  });

  refreshIcons();
}

function renderScheduleCard(sch, { user, coord, userMap, roleMap }) {
  const isUserAssigned = sch.assignments.some((a) => a.userId === user.id);
  const isPast = sch.date < getTodayISO();

  return `
    <article class="bg-white rounded-2xl border-2 ${
      isUserAssigned ? 'user-schedule-card' : 'border-slate-200/90'
    } overflow-hidden flex flex-col justify-between transition">
      <div>
        <!-- Cabeçalho do Card -->
        <div class="px-5 py-4 border-b ${
          isUserAssigned ? 'bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white border-amber-200/80' : 'bg-slate-50/70 border-slate-100'
        }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1.5">
                ${
                  isUserAssigned
                    ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                        <i data-lucide="star" class="w-3 h-3"></i>
                        Sua Escala
                      </span>`
                    : ''
                }
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(sch.category)}">
                  ${escapeHtml(sch.category)}
                </span>
                ${
                  isPast
                    ? `<span class="text-[11px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">Realizada</span>`
                    : ''
                }
              </div>
              <h4 class="text-base font-extrabold text-[#0F172A]">${escapeHtml(sch.celebrationType)}</h4>
              <div class="flex items-center gap-3 flex-wrap text-xs text-slate-600 mt-1.5">
                <span class="inline-flex items-center gap-1 font-semibold text-[#1E3A8A]">
                  <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                  ${escapeHtml(formatDateBR(sch.date))} (${escapeHtml(formatWeekdayBR(sch.date))})
                </span>
                <span class="inline-flex items-center gap-1 font-bold text-[#0F172A]">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-600"></i>
                  ${escapeHtml(sch.time)}
                </span>
              </div>
              <p class="inline-flex items-center gap-1 text-xs text-slate-600 mt-1">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-600"></i>
                ${escapeHtml(sch.location)}
              </p>
            </div>

            ${
              coord
                ? `
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-edit-schedule="${sch.id}" title="Editar escala"
                  class="p-2 rounded-lg text-slate-500 hover:text-[#1E3A8A] hover:bg-blue-50 transition">
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" data-delete-schedule="${sch.id}" title="Excluir escala"
                  class="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            `
                : ''
            }
          </div>
        </div>

        <!-- Lista de Funções e Escalados -->
        <div class="p-5 space-y-2.5">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Funções Litúrgicas Escaladas</p>
          ${
            sch.assignments.length === 0
              ? `<p class="text-xs text-slate-400 italic">Nenhuma função vinculada ainda.</p>`
              : sch.assignments
                  .map((asg) => {
                    const member = userMap[asg.userId];
                    const role = roleMap[asg.roleId];
                    const isMine = asg.userId === user.id;
                    return `
                      <div class="rounded-xl p-3 border ${
                        asg.substitutionRequested
                          ? 'bg-red-50/60 border-red-200'
                          : isMine
                            ? 'bg-amber-50/80 border-amber-300'
                            : 'bg-slate-50/80 border-slate-200/70'
                      }">
                        <div class="flex items-center justify-between gap-2 flex-wrap">
                          <div class="min-w-0">
                            <span class="text-[11px] font-bold uppercase tracking-wider ${
                              isMine ? 'text-amber-700' : 'text-[#1E3A8A]'
                            }">
                              ${escapeHtml(role?.name || 'Função removida')}
                            </span>
                            <p class="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                              ${escapeHtml(member?.name || 'Membro não encontrado')}
                              ${isMine ? '<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">Você</span>' : ''}
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
                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-800 bg-white hover:bg-amber-100 border border-amber-300 transition">
                                    <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                                    Solicitar Substituição
                                  </button>`
                                : ''
                            }
                            ${
                              coord && asg.substitutionRequested
                                ? `<button type="button" data-reassign="${asg.id}" data-schedule-id="${sch.id}"
                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E3A8A] transition">
                                    <i data-lucide="user-check" class="w-3 h-3 text-amber-400"></i>
                                    Reatribuir
                                  </button>`
                                : ''
                            }
                          </div>
                        </div>

                        ${
                          asg.substitutionRequested && asg.substitutionReason
                            ? `<p class="mt-2 text-xs text-red-800 bg-white/80 rounded-lg px-2.5 py-1.5 border border-red-200/80">
                                <strong>Motivo:</strong> ${escapeHtml(asg.substitutionReason)}
                              </p>`
                            : ''
                        }
                      </div>
                    `;
                  })
                  .join('')
          }
        </div>
      </div>

      ${
        sch.notes
          ? `
        <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 flex items-start gap-2">
          <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"></i>
          <span>${escapeHtml(sch.notes)}</span>
        </div>
      `
          : ''
      }
    </article>
  `;
}

function openScheduleModal(existing, onSaved) {
  const activeRoles = dataService.getActiveRoles();
  const initialCategory = existing?.category || 'Acólito';

  const bodyHtml = `
    <form id="schedule-form" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Data *</label>
          <input name="date" type="date" required value="${escapeHtml(existing?.date || getTodayISO())}"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Horário *</label>
          <input name="time" type="time" required value="${escapeHtml(existing?.time || '19:00')}"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Local / Igreja *</label>
          <input name="location" list="church-locations" required value="${escapeHtml(existing?.location || 'Matriz Santa Teresa')}"
            placeholder="Ex: Matriz Santa Teresa"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
          <datalist id="church-locations">
            ${DEFAULT_LOCATIONS.map((loc) => `<option value="${escapeHtml(loc)}"></option>`).join('')}
          </datalist>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Tipo de Celebração *</label>
          <select name="celebrationType" required
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:border-[#1E3A8A] outline-none">
            ${CELEBRATION_TYPES.map(
              (type) => `<option value="${escapeHtml(type)}" ${existing?.celebrationType === type ? 'selected' : ''}>${escapeHtml(type)}</option>`,
            ).join('')}
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Categoria da Escala *</label>
        <select id="schedule-category-select" name="category" required
          class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:border-[#1E3A8A] outline-none">
          <option value="Acólito" ${initialCategory === 'Acólito' ? 'selected' : ''}>Escala de Acólitos</option>
          <option value="Coroinha" ${initialCategory === 'Coroinha' ? 'selected' : ''}>Escala de Coroinhas</option>
          <option value="Coordenador" ${initialCategory === 'Coordenador' ? 'selected' : ''}>Escala de Coordenadores</option>
        </select>
        <p class="text-[11px] text-slate-500 mt-1">Apenas membros com status <strong>Ativo</strong> desta categoria e funções <strong>Ativas</strong> ficam disponíveis abaixo.</p>
      </div>

      <!-- Vinculação Dinâmica -->
      <div class="pt-2 border-t border-slate-100">
        <div class="flex items-center justify-between mb-2.5">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-700">Funções &amp; Escalados</label>
          <button id="btn-add-assignment-row" type="button"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            Adicionar Função
          </button>
        </div>
        <div id="assignments-list" class="space-y-2.5"></div>
      </div>

      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Observações</label>
        <textarea name="notes" rows="2" placeholder="Ex: Chegar 30 minutos antes na sacristia..."
          class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">${escapeHtml(existing?.notes || '')}</textarea>
      </div>

      <div class="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
        <button type="button" id="cancel-modal-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">
          ${existing ? 'Salvar Alterações' : 'Publicar Escala'}
        </button>
      </div>
    </form>
  `;

  openModal({
    title: existing ? 'Editar Escala Litúrgica' : 'Nova Escala Litúrgica',
    bodyHtml,
    maxWidth: 'max-w-2xl',
    onMount(bodyEl) {
      const catSelect = bodyEl.querySelector('#schedule-category-select');
      const listEl = bodyEl.querySelector('#assignments-list');

      function addAssignmentRow(preset = null) {
        const category = catSelect.value;
        const activeMembers = dataService.getActiveUsersByCategory(category);
        const row = document.createElement('div');
        row.className = 'assignment-row grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200';
        row.dataset.asgId = preset?.id || '';
        row.dataset.subReq = preset?.substitutionRequested ? '1' : '0';
        row.dataset.subReason = preset?.substitutionReason || '';

        row.innerHTML = `
          <div class="sm:col-span-5">
            <select class="asg-role w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none focus:border-[#1E3A8A]" required>
              <option value="">Selecione a função...</option>
              ${activeRoles
                .map((r) => `<option value="${r.id}" ${preset?.roleId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="sm:col-span-6">
            <select class="asg-user w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none focus:border-[#1E3A8A]" required>
              <option value="">Selecione o membro ativo...</option>
              ${activeMembers
                .map((u) => `<option value="${u.id}" ${preset?.userId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="sm:col-span-1 flex justify-end">
            <button type="button" class="remove-asg-btn p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Remover função">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        `;
        row.querySelector('.remove-asg-btn').addEventListener('click', () => row.remove());
        listEl.appendChild(row);
        refreshIcons();
      }

      if (existing?.assignments?.length) {
        existing.assignments.forEach((a) => addAssignmentRow(a));
      } else {
        addAssignmentRow();
      }

      catSelect.addEventListener('change', () => {
        const activeMembers = dataService.getActiveUsersByCategory(catSelect.value);
        listEl.querySelectorAll('.asg-user').forEach((sel) => {
          sel.innerHTML = `
            <option value="">Selecione o membro ativo...</option>
            ${activeMembers.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}
          `;
        });
      });

      bodyEl.querySelector('#btn-add-assignment-row').addEventListener('click', () => addAssignmentRow());
      bodyEl.querySelector('#cancel-modal-btn').addEventListener('click', closeModal);

      bodyEl.querySelector('#schedule-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const assignments = [];
        listEl.querySelectorAll('.assignment-row').forEach((row) => {
          const roleId = row.querySelector('.asg-role').value;
          const userId = row.querySelector('.asg-user').value;
          if (roleId && userId) {
            assignments.push({
              id: row.dataset.asgId || undefined,
              roleId,
              userId,
              substitutionRequested: row.dataset.subReq === '1',
              substitutionReason: row.dataset.subReason || '',
            });
          }
        });

        if (assignments.length === 0) {
          showToast('Adicione pelo menos uma função com um membro ativo.', 'error');
          return;
        }

        dataService.saveSchedule({
          id: existing?.id,
          date: fd.get('date'),
          time: fd.get('time'),
          location: String(fd.get('location')).trim(),
          celebrationType: fd.get('celebrationType'),
          category: fd.get('category'),
          notes: String(fd.get('notes') || '').trim(),
          assignments,
        });

        closeModal();
        showToast(existing ? 'Escala atualizada e sincronizada com a Agenda!' : 'Escala criada e sincronizada com a Agenda!');
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
        <p class="text-sm text-slate-600">
          Informe o motivo da sua indisponibilidade. A coordenação receberá o alerta visual nesta escala para reatribuir outro membro.
        </p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Motivo da Substituição *</label>
          <textarea name="reason" rows="3" required placeholder="Ex: Compromisso familiar / viagem / prova escolar..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-sub-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition">
            Confirmar Solicitação
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-sub-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#sub-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const reason = new FormData(e.target).get('reason');
        dataService.requestSubstitution(scheduleId, assignmentId, String(reason));
        closeModal();
        showToast('Substituição solicitada! A coordenação foi sinalizada na escala.');
        onDone();
      });
    },
  });
}

function openReassignModal(scheduleId, assignmentId, onDone) {
  const sch = dataService.getScheduleById(scheduleId);
  if (!sch) return;
  const asg = sch.assignments.find((a) => a.id === assignmentId);
  if (!asg) return;
  const role = dataService.getRoleById(asg.roleId);
  const currentUser = dataService.getUserById(asg.userId);
  const candidates = dataService.getActiveUsersByCategory(sch.category);

  openModal({
    title: 'Reatribuir Membro na Escala',
    bodyHtml: `
      <form id="reassign-form" class="space-y-4">
        <div class="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-950 space-y-1">
          <p><strong>Função:</strong> ${escapeHtml(role?.name || '—')}</p>
          <p><strong>Escalado atual:</strong> ${escapeHtml(currentUser?.name || '—')}</p>
          <p><strong>Motivo informado:</strong> ${escapeHtml(asg.substitutionReason || 'Não informado')}</p>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Novo Membro (${escapeHtml(sch.category)} Ativo) *</label>
          <select name="newUserId" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
            ${candidates
              .map(
                (c) => `<option value="${c.id}" ${c.id === asg.userId ? 'selected' : ''}>${escapeHtml(c.name)}${c.id === asg.userId ? ' (atual)' : ''}</option>`,
              )
              .join('')}
          </select>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-reassign-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">
            Salvar Reatribuição
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-reassign-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#reassign-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const newUserId = new FormData(e.target).get('newUserId');
        dataService.reassignScheduleMember(scheduleId, assignmentId, String(newUserId));
        closeModal();
        showToast('Membro reatribuído com sucesso e Agenda atualizada!');
        onDone();
      });
    },
  });
}
