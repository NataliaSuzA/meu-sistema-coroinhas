/**
 * Módulo 7: Formulários Avançados
 * - Criação segmentada por 1 ou mais pastorais (N:N) + "Toda a Paróquia" (Admin Geral)
 * - Data e Hora de Encerramento (deadline) com bloqueio automático após expirar
 * - Membro pode editar a própria resposta enquanto aberto e NÃO validado pela Coordenação
 * - Após validação, exibe selo verde "Validada pela Coordenação" e bloqueia edição
 */

import { dataService } from '../services/dataService.js';
import {
  canManageAnyOfPastorals,
  closeModal,
  escapeHtml,
  formatDateBR,
  formatDateTimeBR,
  getCoordinatedPastoralIds,
  hasPermission,
  isFormClosed,
  isFormExpiredByDeadline,
  isGeneralAdmin,
  isPastoralScopedItemVisible,
  openModal,
  refreshIcons,
  renderPastoralPillsList,
  showToast,
} from '../utils/helpers.js';

let pendingFormToAutoOpen = null;

export function queueAutoOpenForm(formId) {
  pendingFormToAutoOpen = formId;
}

export function renderForms(container, { user, navigate, permissions, onNotificationsChanged }) {
  const generalAdmin = isGeneralAdmin(user);
  const canCreate = hasPermission(user, 'forms_manage', permissions);
  const canAnswer = hasPermission(user, 'forms_answer', permissions);
  const canSeeResponses = hasPermission(user, 'responses', permissions);

  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const allForms = dataService.getForms();
  const responses = dataService.getResponses();

  const visibleForms = allForms.filter((f) => {
    if (generalAdmin) return true;
    if (canCreate && canManageAnyOfPastorals(user, f.pastoralIds)) return true;
    return isPastoralScopedItemVisible(f.pastoralIds, user, pastorals);
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Formulários da Paróquia</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${canCreate ? 'Crie formulários segmentados por pastoral com prazo de encerramento ou responda aos formulários abertos.' : 'Responda e acompanhe o status de validação dos formulários das suas pastorais.'}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          ${
            canSeeResponses
              ? `
            <button id="btn-go-responses" type="button"
              class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#FDFBF7] text-[#4E342E] border border-[#E6DACE] text-sm font-semibold transition">
              <i data-lucide="bar-chart-3" class="w-4 h-4 text-[#B45309]"></i>
              Ver Respostas
            </button>
          `
              : ''
          }
          ${
            canCreate
              ? `
            <button id="btn-new-form" type="button"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition">
              <i data-lucide="file-plus-2" class="w-4 h-4 text-amber-400"></i>
              Novo Formulário
            </button>
          `
              : ''
          }
        </div>
      </div>

      ${
        visibleForms.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
          <i data-lucide="clipboard-check" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
          <h4 class="text-base font-bold text-[#3E2723]">Nenhum formulário disponível no momento</h4>
          <p class="text-sm text-[#6D4C41] mt-1">Quando houver formulários destinados às suas pastorais, eles aparecerão aqui.</p>
        </div>
      `
          : `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          ${visibleForms
            .map((form) => {
              const formResponses = responses.filter((r) => r.formId === form.id);
              const myResponse = formResponses.find((r) => r.userId === user.id);
              const canManageThis = canCreate && (generalAdmin || canManageAnyOfPastorals(user, form.pastoralIds));
              const closed = isFormClosed(form);
              const expired = isFormExpiredByDeadline(form);
              const isValidated = Boolean(myResponse?.validated);

              let actionHtml = '';
              if (myResponse && isValidated) {
                actionHtml = `
                  <button type="button" data-view-form="${form.id}"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    Visualizar Resposta (Validada)
                  </button>
                `;
              } else if (closed) {
                actionHtml = myResponse
                  ? `<button type="button" data-view-form="${form.id}"
                      class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                      Visualizar Minha Resposta
                    </button>`
                  : `<span class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-100 text-stone-500 border border-stone-200">
                      <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                      Prazo Encerrado
                    </span>`;
              } else if (canAnswer) {
                actionHtml = `
                  <button type="button" data-answer-form="${form.id}"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                      myResponse
                        ? 'bg-[#F5EFE6] hover:bg-[#E6DACE] text-[#3E2723] border border-[#D7C4B2]'
                        : 'bg-[#3E2723] hover:bg-[#5D4037] text-white'
                    }">
                    <i data-lucide="${myResponse ? 'edit-3' : 'send'}" class="w-3.5 h-3.5 ${myResponse ? 'text-[#B45309]' : 'text-amber-400'}"></i>
                    ${myResponse ? 'Editar Minha Resposta' : 'Responder Formulário'}
                  </button>
                `;
              }

              return `
                <article class="bg-white rounded-2xl border-2 ${
                  isValidated ? 'border-emerald-300' : closed ? 'border-stone-200 opacity-90' : 'border-[#E6DACE]'
                } p-5 flex flex-col justify-between gap-4 shadow-xs">
                  <div>
                    <div class="flex items-start justify-between gap-3 mb-2.5">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${renderPastoralPillsList(form.pastoralIds, pastoralMap, { compact: true })}
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          closed
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }">
                          ${closed ? 'Encerrado' : 'Aberto'}
                        </span>
                        ${
                          isValidated
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <i data-lucide="badge-check" class="w-3.5 h-3.5"></i>
                                Validada pela Coordenação
                              </span>`
                            : myResponse
                              ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-[#92400E] border border-amber-300">
                                  <i data-lucide="check-circle-2" class="w-3 h-3"></i>
                                  Respondido (Editável)
                                </span>`
                              : ''
                        }
                      </div>

                      ${
                        canManageThis
                          ? `
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" data-toggle-form="${form.id}" title="${form.active ? 'Encerrar manualmente' : 'Reabrir'}"
                            class="p-1.5 rounded-lg text-[#8D6E63] hover:text-[#B45309] hover:bg-amber-50 transition">
                            <i data-lucide="${form.active ? 'pause-circle' : 'play-circle'}" class="w-4 h-4"></i>
                          </button>
                          <button type="button" data-edit-form="${form.id}" title="Editar formulário"
                            class="p-1.5 rounded-lg text-[#8D6E63] hover:text-[#3E2723] hover:bg-[#F5EFE6] transition">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                          </button>
                          <button type="button" data-delete-form="${form.id}" title="Excluir formulário"
                            class="p-1.5 rounded-lg text-[#8D6E63] hover:text-red-700 hover:bg-red-50 transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                          </button>
                        </div>
                      `
                          : ''
                      }
                    </div>

                    <h4 class="text-base font-extrabold text-[#3E2723]">${escapeHtml(form.title)}</h4>
                    <p class="text-sm text-[#5D4037] mt-1 leading-relaxed">${escapeHtml(form.description || '')}</p>

                    <div class="mt-3 flex items-center gap-3 flex-wrap text-xs text-[#6D4C41]">
                      <span>${form.questions.length} ${form.questions.length === 1 ? 'pergunta' : 'perguntas'}</span>
                      <span>•</span>
                      <span class="inline-flex items-center gap-1 font-semibold ${expired ? 'text-red-700' : 'text-[#5D4037]'}">
                        <i data-lucide="clock" class="w-3.5 h-3.5 ${expired ? 'text-red-600' : 'text-[#B45309]'}"></i>
                        ${form.deadline ? `Encerra em ${escapeHtml(formatDateTimeBR(form.deadline))}` : 'Sem prazo definido'}
                      </span>
                      ${canManageThis ? `<span>•</span><span><strong>${formResponses.length}</strong> ${formResponses.length === 1 ? 'resposta' : 'respostas'}</span>` : ''}
                    </div>
                  </div>

                  <div class="pt-3 border-t border-[#E6DACE]/70 flex items-center justify-between gap-2 flex-wrap">
                    ${actionHtml}
                    <span class="text-[11px] text-[#8D6E63]">Criado em ${escapeHtml(formatDateBR(form.createdAt))}</span>
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

  container.querySelector('#btn-go-responses')?.addEventListener('click', () => navigate('responses'));
  container.querySelector('#btn-new-form')?.addEventListener('click', () => {
    openFormBuilderModal(null, user, () => renderForms(container, { user, navigate, permissions }));
  });

  container.querySelectorAll('[data-edit-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = dataService.getForms().find((f) => f.id === btn.dataset.editForm);
      if (form) openFormBuilderModal(form, user, () => renderForms(container, { user, navigate, permissions }));
    });
  });

  container.querySelectorAll('[data-toggle-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = dataService.getForms().find((f) => f.id === btn.dataset.toggleForm);
      if (!form) return;
      dataService.saveForm({ ...form, active: !form.active });
      showToast(`Formulário ${!form.active ? 'reaberto' : 'encerrado'}.`);
      renderForms(container, { user, navigate, permissions });
    });
  });

  container.querySelectorAll('[data-delete-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja excluir este formulário e todas as suas respostas?')) return;
      dataService.deleteForm(btn.dataset.deleteForm);
      showToast('Formulário excluído.');
      renderForms(container, { user, navigate, permissions });
    });
  });

  container.querySelectorAll('[data-answer-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = dataService.getForms().find((f) => f.id === btn.dataset.answerForm);
      if (form) {
        openAnswerFormModal(form, user, { readOnly: false }, () => {
          onNotificationsChanged?.();
          renderForms(container, { user, navigate, permissions, onNotificationsChanged });
        });
      }
    });
  });

  container.querySelectorAll('[data-view-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = dataService.getForms().find((f) => f.id === btn.dataset.viewForm);
      if (form) {
        openAnswerFormModal(form, user, { readOnly: true }, () => {
          onNotificationsChanged?.();
          renderForms(container, { user, navigate, permissions, onNotificationsChanged });
        });
      }
    });
  });

  refreshIcons();

  // Abertura direta disparada por "Responder Agora" no Sino de Notificações ou Banner do Início
  if (pendingFormToAutoOpen) {
    const targetId = pendingFormToAutoOpen;
    pendingFormToAutoOpen = null;
    const targetForm = allForms.find((f) => f.id === targetId);
    if (targetForm) {
      openAnswerFormModal(targetForm, user, { readOnly: isFormClosed(targetForm) }, () => {
        onNotificationsChanged?.();
        renderForms(container, { user, navigate, permissions, onNotificationsChanged });
      });
    }
  }
}

function openAnswerFormModal(form, user, { readOnly = false }, onSaved) {
  const existing = dataService.getResponses().find((r) => r.formId === form.id && r.userId === user.id);
  const locked = readOnly || Boolean(existing?.validated) || isFormClosed(form);

  const questionsHtml = form.questions
    .map((q, idx) => {
      const prevVal = existing?.answers?.[q.id] || '';
      let inputHtml = '';
      if (q.type === 'text') {
        inputHtml = `
          <textarea name="q_${q.id}" rows="2" ${q.required ? 'required' : ''} ${locked ? 'disabled' : ''} placeholder="Sua resposta..."
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none disabled:bg-[#FAF6F0] disabled:text-[#5D4037]">${escapeHtml(prevVal)}</textarea>
        `;
      } else if (q.type === 'boolean') {
        inputHtml = `
          <div class="flex items-center gap-4">
            ${['Sim', 'Não']
              .map(
                (opt) => `
              <label class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] text-sm font-medium ${locked ? 'opacity-80' : 'hover:bg-white cursor-pointer'}">
                <input type="radio" name="q_${q.id}" value="${opt}" ${q.required ? 'required' : ''} ${locked ? 'disabled' : ''} ${prevVal === opt ? 'checked' : ''} class="text-[#B45309]">
                ${opt}
              </label>
            `,
              )
              .join('')}
          </div>
        `;
      } else if (q.type === 'choice') {
        inputHtml = `
          <div class="space-y-2">
            ${(q.options || [])
              .map(
                (opt) => `
              <label class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] text-sm ${locked ? 'opacity-80' : 'hover:bg-white cursor-pointer'}">
                <input type="radio" name="q_${q.id}" value="${escapeHtml(opt)}" ${q.required ? 'required' : ''} ${locked ? 'disabled' : ''} ${prevVal === opt ? 'checked' : ''} class="text-[#B45309]">
                <span>${escapeHtml(opt)}</span>
              </label>
            `,
              )
              .join('')}
          </div>
        `;
      }

      return `
        <div class="space-y-1.5">
          <label class="block text-sm font-bold text-[#3E2723]">
            ${idx + 1}. ${escapeHtml(q.text)} ${q.required && !locked ? '<span class="text-red-600">*</span>' : ''}
          </label>
          ${inputHtml}
        </div>
      `;
    })
    .join('');

  openModal({
    title: form.title,
    maxWidth: 'max-w-2xl',
    bodyHtml: `
      <form id="answer-form" class="space-y-5">
        ${
          existing?.validated
            ? `<div class="rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-3 text-xs font-bold text-emerald-900 flex items-center gap-2">
                <i data-lucide="badge-check" class="w-4 h-4 text-emerald-700 shrink-0"></i>
                Resposta validada pela Coordenação em ${escapeHtml(formatDateTimeBR(existing.validatedAt))}. Edição bloqueada.
              </div>`
            : isFormClosed(form)
              ? `<div class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-800 flex items-center gap-2">
                  <i data-lucide="lock" class="w-4 h-4 shrink-0"></i>
                  Este formulário está encerrado para novas respostas ou alterações.
                </div>`
              : existing
                ? `<div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-medium text-[#4E342E]">
                    Você já enviou este formulário. Enquanto não for validado pela Coordenação e estiver dentro do prazo, você pode editar sua resposta livremente.
                  </div>`
                : ''
        }

        ${form.description ? `<p class="text-sm text-[#5D4037] bg-[#FAF6F0] border border-[#E6DACE] rounded-xl p-3.5">${escapeHtml(form.description)}</p>` : ''}
        ${questionsHtml}
        <div class="flex justify-end gap-2 pt-3 border-t border-[#E6DACE]/80">
          <button type="button" id="cancel-ans-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">
            ${locked ? 'Fechar' : 'Cancelar'}
          </button>
          ${
            !locked
              ? `<button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">
                  ${existing ? 'Atualizar Respostas' : 'Enviar Respostas'}
                </button>`
              : ''
          }
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-ans-btn').addEventListener('click', closeModal);
      if (!locked) {
        bodyEl.querySelector('#answer-form').addEventListener('submit', (e) => {
          e.preventDefault();
          if (isFormClosed(form)) {
            showToast('O prazo deste formulário já foi encerrado.', 'error');
            closeModal();
            onSaved();
            return;
          }
          const fd = new FormData(e.target);
          const answers = {};
          form.questions.forEach((q) => {
            answers[q.id] = String(fd.get(`q_${q.id}`) || '').trim();
          });
          const res = dataService.saveResponse({ formId: form.id, userId: user.id, answers });
          if (!res.ok) {
            showToast(res.error, 'error');
            return;
          }
          closeModal();
          showToast(existing ? 'Resposta atualizada com sucesso!' : 'Respostas enviadas com sucesso!');
          onSaved();
        });
      }
    },
  });
}

function openFormBuilderModal(existing, user, onSaved) {
  const pastorals = dataService.getActivePastorals();
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const managedPastorals = pastorals.filter((p) => managedIds.has(p.id));
  const generalAdmin = isGeneralAdmin(user);

  const initialPids = existing?.pastoralIds || (generalAdmin ? ['all'] : managedPastorals.slice(0, 1).map((p) => p.id));
  const defaultDeadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const defaultDeadline = `${defaultDeadlineDate.getFullYear()}-${String(defaultDeadlineDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDeadlineDate.getDate()).padStart(2, '0')}T23:59`;

  openModal({
    title: existing ? 'Editar Formulário' : 'Criar Novo Formulário',
    maxWidth: 'max-w-2xl',
    bodyHtml: `
      <form id="builder-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Título do Formulário *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Disponibilidade para a Semana Santa"
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Descrição</label>
          <textarea name="description" rows="2" placeholder="Objetivo e instruções deste formulário..."
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.description || '')}</textarea>
        </div>

        <!-- Segmentação por Pastoral (N:N) -->
        <div class="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6DACE] space-y-2">
          <label class="block text-xs font-bold uppercase tracking-wider text-[#3E2723]">Pastorais de Destino *</label>
          <p class="text-[11px] text-[#6D4C41]">Selecione uma ou mais pastorais sob sua coordenação${generalAdmin ? ' ou marque "Toda a Paróquia"' : ''}.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            ${
              generalAdmin
                ? `
              <label class="inline-flex items-center gap-2 text-xs font-extrabold text-[#92400E] cursor-pointer sm:col-span-2">
                <input id="form-target-all" type="checkbox" name="pastoralIds" value="all" ${initialPids.includes('all') ? 'checked' : ''} class="rounded text-[#B45309]">
                Toda a Paróquia (todas as pastorais)
              </label>
            `
                : ''
            }
            ${managedPastorals
              .map(
                (p) => `
              <label class="inline-flex items-center gap-2 text-xs font-semibold text-[#3E2723] cursor-pointer">
                <input type="checkbox" class="form-target-pid rounded text-[#B45309]" name="pastoralIds" value="${p.id}" ${initialPids.includes(p.id) ? 'checked' : ''}>
                <span class="w-2 h-2 rounded-full" style="background-color:${escapeHtml(p.color)};"></span>
                ${escapeHtml(p.shortName)}
              </label>
            `,
              )
              .join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Data e Hora de Encerramento *</label>
            <input name="deadline" type="datetime-local" required value="${escapeHtml(existing?.deadline || defaultDeadline)}"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
          <div class="flex items-end pb-2">
            <label class="inline-flex items-center gap-2 text-sm font-medium text-[#3E2723] cursor-pointer">
              <input name="active" type="checkbox" ${(existing?.active ?? true) ? 'checked' : ''} class="rounded text-[#B45309]">
              Formulário ativo (até o prazo)
            </label>
          </div>
        </div>

        <div class="pt-3 border-t border-[#E6DACE]/80">
          <div class="flex items-center justify-between mb-2.5">
            <label class="text-xs font-bold uppercase tracking-wider text-[#3E2723]">Perguntas</label>
            <button id="btn-add-question" type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-[#92400E] border border-amber-300 transition">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              Adicionar Pergunta
            </button>
          </div>
          <div id="questions-builder-list" class="space-y-3"></div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-[#E6DACE]/80">
          <button type="button" id="cancel-builder-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Formulário</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const qList = bodyEl.querySelector('#questions-builder-list');
      const allChk = bodyEl.querySelector('#form-target-all');
      const pidChks = bodyEl.querySelectorAll('.form-target-pid');

      if (allChk) {
        allChk.addEventListener('change', () => {
          if (allChk.checked) pidChks.forEach((c) => { c.checked = false; });
        });
        pidChks.forEach((c) => {
          c.addEventListener('change', () => {
            if (c.checked) allChk.checked = false;
          });
        });
      }

      function addQuestionRow(preset = null) {
        const row = document.createElement('div');
        row.className = 'q-row p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6DACE] space-y-2.5';
        row.dataset.qid = preset?.id || '';
        const qType = preset?.type || 'text';
        row.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <div class="sm:col-span-7">
              <input type="text" class="q-text w-full px-3 py-2 rounded-lg border border-[#E6DACE] bg-white text-xs font-medium outline-none focus:border-[#B45309]"
                placeholder="Digite a pergunta..." value="${escapeHtml(preset?.text || '')}" required>
            </div>
            <div class="sm:col-span-4">
              <select class="q-type w-full px-2.5 py-2 rounded-lg border border-[#E6DACE] bg-white text-xs font-medium outline-none focus:border-[#B45309]">
                <option value="text" ${qType === 'text' ? 'selected' : ''}>Texto Livre</option>
                <option value="choice" ${qType === 'choice' ? 'selected' : ''}>Múltipla Escolha</option>
                <option value="boolean" ${qType === 'boolean' ? 'selected' : ''}>Sim / Não</option>
              </select>
            </div>
            <div class="sm:col-span-1 flex justify-end">
              <button type="button" class="remove-q-btn p-1.5 rounded-lg text-[#8D6E63] hover:text-red-700 hover:bg-red-50">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          <div class="q-options-wrap ${qType === 'choice' ? '' : 'hidden'}">
            <input type="text" class="q-options w-full px-3 py-1.5 rounded-lg border border-[#E6DACE] bg-white text-xs outline-none focus:border-[#B45309]"
              placeholder="Opções separadas por vírgula (ex: Manhã, Tarde, Noite)"
              value="${escapeHtml((preset?.options || []).join(', '))}">
          </div>
          <label class="inline-flex items-center gap-1.5 text-xs text-[#5D4037] cursor-pointer">
            <input type="checkbox" class="q-required rounded text-[#B45309]" ${(preset?.required ?? true) ? 'checked' : ''}>
            Pergunta obrigatória
          </label>
        `;

        const typeSel = row.querySelector('.q-type');
        const optsWrap = row.querySelector('.q-options-wrap');
        typeSel.addEventListener('change', () => {
          optsWrap.classList.toggle('hidden', typeSel.value !== 'choice');
        });
        row.querySelector('.remove-q-btn').addEventListener('click', () => row.remove());

        qList.appendChild(row);
        refreshIcons();
      }

      if (existing?.questions?.length) {
        existing.questions.forEach((q) => addQuestionRow(q));
      } else {
        addQuestionRow();
      }

      bodyEl.querySelector('#btn-add-question').addEventListener('click', () => addQuestionRow());
      bodyEl.querySelector('#cancel-builder-btn').addEventListener('click', closeModal);

      bodyEl.querySelector('#builder-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const pastoralIds = fd.getAll('pastoralIds');
        if (pastoralIds.length === 0) {
          showToast('Selecione pelo menos uma pastoral de destino.', 'error');
          return;
        }

        const questions = [];
        qList.querySelectorAll('.q-row').forEach((row) => {
          const text = row.querySelector('.q-text').value.trim();
          const type = row.querySelector('.q-type').value;
          const required = row.querySelector('.q-required').checked;
          const options =
            type === 'choice'
              ? row
                  .querySelector('.q-options')
                  .value.split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
          if (text) {
            questions.push({ id: row.dataset.qid || undefined, text, type, required, options });
          }
        });

        if (questions.length === 0) {
          showToast('Adicione pelo menos uma pergunta ao formulário.', 'error');
          return;
        }
        if (questions.some((q) => q.type === 'choice' && q.options.length < 2)) {
          showToast('Perguntas de múltipla escolha precisam de pelo menos 2 opções.', 'error');
          return;
        }

        dataService.saveForm({
          id: existing?.id,
          title: String(fd.get('title')).trim(),
          description: String(fd.get('description') || '').trim(),
          pastoralIds,
          deadline: fd.get('deadline') || '',
          active: fd.get('active') === 'on',
          questions,
        });
        closeModal();
        showToast(existing ? 'Formulário atualizado!' : 'Formulário criado com sucesso!');
        onSaved();
      });
    },
  });
}
