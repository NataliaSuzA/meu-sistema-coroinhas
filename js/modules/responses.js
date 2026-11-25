/**
 * Módulo 8: Respostas de Formulários (Validação + Relatório de Adesão e Pendentes)
 * - Resumo numérico no topo (ex: "2 de 6 membros responderam — 33%")
 * - Aba "Responderam": lista envios, status, botão "Validar Resposta" e "Exportar CSV/Excel"
 * - Aba "Pendentes (Não Responderam)": cruza automaticamente membros ativos das pastorais
 *   de destino vs quem não respondeu, com botão de copiar lista e lembrete no WhatsApp.
 */

import { dataService } from '../services/dataService.js';
import {
  canManageAnyOfPastorals,
  cleanPhoneForWhatsApp,
  escapeHtml,
  exportToCSV,
  formatDateTimeBR,
  getFormTargetUsers,
  getUserMemberships,
  isFormClosed,
  isGeneralAdmin,
  refreshIcons,
  renderPastoralPill,
  renderPastoralPillsList,
  showToast,
} from '../utils/helpers.js';

let selectedFormId = null;
let activeSubTab = 'answered'; // 'answered' | 'pending'

export function renderResponses(container, { user }) {
  const generalAdmin = isGeneralAdmin(user);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const allForms = dataService.getForms();
  const managedForms = allForms.filter((f) => generalAdmin || canManageAnyOfPastorals(user, f.pastoralIds));

  const responses = dataService.getResponses();
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  if (!selectedFormId || !managedForms.some((f) => f.id === selectedFormId)) {
    selectedFormId = managedForms[0]?.id || null;
  }

  const activeForm = managedForms.find((f) => f.id === selectedFormId) || null;
  const formResponses = activeForm ? responses.filter((r) => r.formId === activeForm.id) : [];
  const targetMembers = activeForm ? getFormTargetUsers(activeForm, users) : [];
  const answeredIds = new Set(formResponses.map((r) => r.userId));
  const pendingMembers = targetMembers.filter((m) => !answeredIds.has(m.id));
  const validatedCount = formResponses.filter((r) => r.validated).length;

  const totalTargets = targetMembers.length;
  const answeredOfTargets = targetMembers.filter((m) => answeredIds.has(m.id)).length;
  const adherencePct = totalTargets > 0 ? Math.round((answeredOfTargets / totalTargets) * 100) : 0;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Respostas &amp; Adesão de Formulários</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Valide envios para travar edições, acompanhe pendentes e exporte planilhas em CSV/Excel.
          </p>
        </div>

        ${
          activeForm
            ? `
          <button id="btn-export-csv" type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold shadow-sm transition shrink-0">
            <i data-lucide="download" class="w-4 h-4"></i>
            Exportar CSV / Excel
          </button>
        `
            : ''
        }
      </div>

      ${
        managedForms.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center text-[#6D4C41]">
          Nenhum formulário encontrado nas pastorais sob sua coordenação.
        </div>
      `
          : `
        <!-- Seletor de Formulário + Resumo de Adesão -->
        <div class="bg-white rounded-2xl border border-[#E6DACE] p-5 space-y-4 shadow-xs">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex-1">
              <label for="responses-form-select" class="block text-[11px] font-bold uppercase tracking-wider text-[#6D4C41] mb-1">Selecionar Formulário</label>
              <select id="responses-form-select" class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] text-sm font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
                ${managedForms
                  .map((f) => {
                    const cnt = responses.filter((r) => r.formId === f.id).length;
                    const closedTag = isFormClosed(f) ? ' [Encerrado]' : '';
                    return `<option value="${f.id}" ${f.id === selectedFormId ? 'selected' : ''}>${escapeHtml(f.title)} (${cnt} envios)${closedTag}</option>`;
                  })
                  .join('')}
              </select>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              ${renderPastoralPillsList(activeForm.pastoralIds, pastoralMap)}
              <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                isFormClosed(activeForm) ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }">
                ${isFormClosed(activeForm) ? 'Encerrado' : 'Aberto'}
              </span>
            </div>
          </div>

          <!-- Resumo Numérico de Adesão -->
          <div class="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E6DACE] space-y-2.5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p class="text-sm font-extrabold text-[#3E2723]">
                ${answeredOfTargets} de ${totalTargets} membros responderam — <span class="text-[#B45309]">${adherencePct}%</span>
              </p>
              <div class="flex items-center gap-3 text-xs font-semibold">
                <span class="text-emerald-800">${validatedCount} validadas</span>
                <span class="text-[#8D6E63]">•</span>
                <span class="text-[#B45309]">${formResponses.length - validatedCount} aguardando validação</span>
                <span class="text-[#8D6E63]">•</span>
                <span class="text-red-700">${pendingMembers.length} pendentes</span>
              </div>
            </div>
            <div class="h-2.5 w-full rounded-full bg-[#E6DACE] overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-[#B45309] to-[#D97706] transition-all" style="width: ${adherencePct}%"></div>
            </div>
          </div>
        </div>

        <!-- Abas: Responderam / Pendentes -->
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <button type="button" data-resp-tab="answered"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition ${
                activeSubTab === 'answered'
                  ? 'bg-[#3E2723] text-white border-[#3E2723]'
                  : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
              }">
              <i data-lucide="check-circle-2" class="w-4 h-4 ${activeSubTab === 'answered' ? 'text-amber-400' : 'text-emerald-700'}"></i>
              Responderam (${formResponses.length})
            </button>
            <button type="button" data-resp-tab="pending"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition ${
                activeSubTab === 'pending'
                  ? 'bg-[#3E2723] text-white border-[#3E2723]'
                  : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
              }">
              <i data-lucide="clock-alert" class="w-4 h-4 ${activeSubTab === 'pending' ? 'text-amber-400' : 'text-[#B45309]'}"></i>
              Pendentes (Não Responderam) (${pendingMembers.length})
            </button>
          </div>

          ${
            activeSubTab === 'pending' && pendingMembers.length > 0
              ? `
            <button id="btn-copy-pending" type="button"
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#92400E] border border-amber-300 text-xs font-bold transition">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              Copiar Lista de Pendentes
            </button>
          `
              : ''
          }
        </div>

        ${
          activeSubTab === 'answered'
            ? renderAnsweredTab(activeForm, formResponses, userMap, pastoralMap)
            : renderPendingTab(activeForm, pendingMembers, pastoralMap)
        }
      `
      }
    </div>
  `;

  container.querySelector('#responses-form-select')?.addEventListener('change', (e) => {
    selectedFormId = e.target.value;
    renderResponses(container, { user });
  });

  container.querySelectorAll('[data-resp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.respTab;
      renderResponses(container, { user });
    });
  });

  container.querySelectorAll('[data-validate-resp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.validateResponse(btn.dataset.validateResp, user.id);
      showToast('Resposta validada pela Coordenação! Edição bloqueada para o membro.');
      renderResponses(container, { user });
    });
  });

  container.querySelector('#btn-copy-pending')?.addEventListener('click', async () => {
    const lines = [
      `Pendentes — ${activeForm.title}:`,
      ...pendingMembers.map((m) => {
        const pList = getUserMemberships(m)
          .map((x) => pastoralMap[x.pastoralId]?.shortName)
          .filter(Boolean)
          .join(', ');
        return `• ${m.name} (${pList}) - ${m.phone || 'Sem WhatsApp'}`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('Lista de pendentes copiada para a área de transferência!');
    } catch {
      showToast('Não foi possível copiar automaticamente; use os botões de WhatsApp abaixo.', 'info');
    }
  });

  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    if (!activeForm) return;
    if (formResponses.length === 0) {
      showToast('Não há respostas para exportar neste formulário.', 'info');
      return;
    }
    const headers = [
      'Membro',
      'Pastorais',
      'E-mail',
      'Status Validação',
      'Data/Hora Envio',
      ...activeForm.questions.map((q) => q.text),
    ];
    const rows = formResponses.map((resp) => {
      const m = userMap[resp.userId];
      const pNames = getUserMemberships(m)
        .map((mem) => `${pastoralMap[mem.pastoralId]?.shortName || 'Pastoral'} (${mem.role})`)
        .join(', ');
      return [
        m?.name || 'Membro removido',
        m?.isGeneralAdmin ? 'Coordenação Geral' : pNames || '—',
        m?.email || '—',
        resp.validated ? 'Validada pela Coordenação' : 'Aguardando Validação',
        formatDateTimeBR(resp.submittedAt),
        ...activeForm.questions.map((q) => resp.answers?.[q.id] || ''),
      ];
    });
    const safeSlug = activeForm.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    exportToCSV(`respostas-${safeSlug || 'formulario'}.csv`, headers, rows);
    showToast('Arquivo CSV exportado com sucesso (compatível com Excel)!');
  });

  refreshIcons();
}

function renderAnsweredTab(activeForm, formResponses, userMap, pastoralMap) {
  if (formResponses.length === 0) {
    return `
      <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
        <i data-lucide="inbox" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
        <h4 class="text-base font-bold text-[#3E2723]">Ainda não há respostas enviadas</h4>
        <p class="text-sm text-[#6D4C41] mt-1">Consulte a aba "Pendentes" para enviar um lembrete aos membros.</p>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[#FDFBF7] border-b border-[#E6DACE] text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">
              <th class="px-5 py-3.5 whitespace-nowrap">Membro</th>
              <th class="px-4 py-3.5 whitespace-nowrap">Status &amp; Envio</th>
              ${activeForm.questions
                .map((q) => `<th class="px-4 py-3.5 min-w-[190px]">${escapeHtml(q.text)}</th>`)
                .join('')}
              <th class="px-5 py-3.5 text-right whitespace-nowrap">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#E6DACE]/60 text-sm">
            ${formResponses
              .map((resp) => {
                const member = userMap[resp.userId];
                const mems = getUserMemberships(member);
                return `
                  <tr class="hover:bg-[#FAF6F0]/70 align-top">
                    <td class="px-5 py-3.5 whitespace-nowrap">
                      <p class="font-bold text-[#3E2723]">${escapeHtml(member?.name || 'Membro removido')}</p>
                      <div class="flex items-center gap-1 flex-wrap mt-1">
                        ${mems.slice(0, 2).map((m) => renderPastoralPill(pastoralMap[m.pastoralId], { compact: true })).join('')}
                      </div>
                    </td>
                    <td class="px-4 py-3.5 whitespace-nowrap space-y-1">
                      ${
                        resp.validated
                          ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <i data-lucide="badge-check" class="w-3.5 h-3.5"></i>
                              Validada pela Coordenação
                            </span>`
                          : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-[#92400E] border border-amber-300">
                              <i data-lucide="clock" class="w-3 h-3"></i>
                              Aguardando Validação
                            </span>`
                      }
                      <p class="text-[11px] text-[#8D6E63]">${escapeHtml(formatDateTimeBR(resp.submittedAt))}</p>
                    </td>
                    ${activeForm.questions
                      .map(
                        (q) => `<td class="px-4 py-3.5 text-xs text-[#4E342E] leading-relaxed">${escapeHtml(resp.answers?.[q.id] || '—')}</td>`,
                      )
                      .join('')}
                    <td class="px-5 py-3.5 text-right whitespace-nowrap">
                      ${
                        resp.validated
                          ? `<span class="text-xs font-bold text-emerald-700">Bloqueada</span>`
                          : `<button type="button" data-validate-resp="${resp.id}"
                              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3E2723] hover:bg-emerald-800 text-white text-xs font-bold transition">
                              <i data-lucide="check-check" class="w-3.5 h-3.5 text-amber-400"></i>
                              Validar Resposta
                            </button>`
                      }
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPendingTab(activeForm, pendingMembers, pastoralMap) {
  if (pendingMembers.length === 0) {
    return `
      <div class="bg-emerald-50 rounded-2xl border border-emerald-200 p-10 text-center">
        <i data-lucide="party-popper" class="w-10 h-10 text-emerald-700 mx-auto mb-3"></i>
        <h4 class="text-base font-extrabold text-emerald-900">100% de Adesão!</h4>
        <p class="text-sm text-emerald-800 mt-1">Todos os membros ativos das pastorais de destino já responderam a este formulário.</p>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[#FDFBF7] border-b border-[#E6DACE] text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">
              <th class="px-5 py-3.5">Membro Pendente</th>
              <th class="px-4 py-3.5">Pastorais</th>
              <th class="px-4 py-3.5">WhatsApp</th>
              <th class="px-5 py-3.5 text-right">Lembrete</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#E6DACE]/60 text-sm">
            ${pendingMembers
              .map((m) => {
                const wa = cleanPhoneForWhatsApp(m.phone);
                const msg = encodeURIComponent(
                  `Paz e bem, ${m.name}! Lembrete carinhoso da Paróquia Santa Teresa d'Ávila: ainda não recebemos sua resposta no formulário "${activeForm.title}". Quando puder, preencha no portal!`,
                );
                const mems = getUserMemberships(m);
                return `
                  <tr class="hover:bg-[#FAF6F0]/70">
                    <td class="px-5 py-3.5">
                      <p class="font-bold text-[#3E2723]">${escapeHtml(m.name)}</p>
                      <p class="text-xs text-[#8D6E63]">${escapeHtml(m.email)}</p>
                    </td>
                    <td class="px-4 py-3.5">
                      <div class="flex items-center gap-1 flex-wrap">
                        ${mems.map((x) => renderPastoralPill(pastoralMap[x.pastoralId], { compact: true })).join('')}
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-xs text-[#5D4037] whitespace-nowrap">${escapeHtml(m.phone || '—')}</td>
                    <td class="px-5 py-3.5 text-right whitespace-nowrap">
                      ${
                        wa
                          ? `<a href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener noreferrer"
                              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition">
                              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                              Enviar Lembrete
                            </a>`
                          : '<span class="text-xs text-[#8D6E63]">Sem telefone</span>'
                      }
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
