/**
 * Módulo 8: Respostas de Formulários (Isolamento por Pastoral)
 * Coordenadores visualizam e exportam (CSV/Excel) apenas respostas
 * dos formulários pertencentes às pastorais que coordenam (Admin Geral vê todos).
 */

import { dataService } from '../services/dataService.js';
import {
  canManagePastoral,
  escapeHtml,
  exportToCSV,
  formatDateTimeBR,
  getUserMemberships,
  isGeneralAdmin,
  refreshIcons,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

let selectedFormId = null;

export function renderResponses(container, { user }) {
  const generalAdmin = isGeneralAdmin(user);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const allForms = dataService.getForms();
  const managedForms = allForms.filter((f) => generalAdmin || canManagePastoral(user, f.pastoralId));

  const responses = dataService.getResponses();
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  if (!selectedFormId || !managedForms.some((f) => f.id === selectedFormId)) {
    selectedFormId = managedForms[0]?.id || null;
  }

  const activeForm = managedForms.find((f) => f.id === selectedFormId) || null;
  const formResponses = activeForm ? responses.filter((r) => r.formId === activeForm.id) : [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Respostas dos Formulários</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${
              generalAdmin
                ? 'Painel consolidado de todas as pastorais com exportação para Excel (CSV).'
                : 'Exibindo apenas formulários pertencentes às pastorais que você coordena.'
            }
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
          Nenhum formulário cadastrado nas pastorais sob sua coordenação ainda.
        </div>
      `
          : `
        <div class="bg-white rounded-2xl border border-[#E6DACE] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div class="flex-1">
            <label for="responses-form-select" class="block text-[11px] font-bold uppercase tracking-wider text-[#6D4C41] mb-1">Selecionar Formulário</label>
            <select id="responses-form-select" class="w-full px-3.5 py-2 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] text-sm font-semibold text-[#3E2723] outline-none focus:border-[#B45309]">
              ${managedForms
                .map((f) => {
                  const cnt = responses.filter((r) => r.formId === f.id).length;
                  const pLabel = f.pastoralId === 'all' ? 'Geral' : pastoralMap[f.pastoralId]?.shortName || 'Pastoral';
                  return `<option value="${f.id}" ${f.id === selectedFormId ? 'selected' : ''}>[${escapeHtml(pLabel)}] ${escapeHtml(f.title)} (${cnt})</option>`;
                })
                .join('')}
            </select>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="px-3.5 py-2 rounded-xl bg-[#FDFBF7] border border-[#E6DACE] text-center">
              <p class="text-[10px] font-bold uppercase tracking-wider text-[#8D6E63] mb-1">Pastoral</p>
              ${renderPastoralPill(activeForm.pastoralId === 'all' ? null : pastoralMap[activeForm.pastoralId], { compact: true })}
            </div>
            <div class="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p class="text-[10px] font-bold uppercase tracking-wider text-[#B45309]">Respostas</p>
              <p class="text-sm font-extrabold text-[#3E2723]">${formResponses.length}</p>
            </div>
          </div>
        </div>

        ${
          formResponses.length === 0
            ? `
          <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
            <i data-lucide="inbox" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
            <h4 class="text-base font-bold text-[#3E2723]">Ainda não há respostas para este formulário</h4>
            <p class="text-sm text-[#6D4C41] mt-1">Assim que os membros responderem, os dados consolidados aparecerão aqui.</p>
          </div>
        `
            : `
          <div class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-[#FDFBF7] border-b border-[#E6DACE] text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">
                    <th class="px-5 py-3.5 whitespace-nowrap">Membro</th>
                    <th class="px-4 py-3.5 whitespace-nowrap">Enviado em</th>
                    ${activeForm.questions
                      .map((q) => `<th class="px-4 py-3.5 min-w-[200px]">${escapeHtml(q.text)}</th>`)
                      .join('')}
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
                          <td class="px-4 py-3.5 text-xs text-[#8D6E63] whitespace-nowrap">${escapeHtml(formatDateTimeBR(resp.submittedAt))}</td>
                          ${activeForm.questions
                            .map(
                              (q) => `<td class="px-4 py-3.5 text-xs text-[#4E342E] leading-relaxed">${escapeHtml(resp.answers?.[q.id] || '—')}</td>`,
                            )
                            .join('')}
                        </tr>
                      `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        `
        }
      `
      }
    </div>
  `;

  container.querySelector('#responses-form-select')?.addEventListener('change', (e) => {
    selectedFormId = e.target.value;
    renderResponses(container, { user });
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
