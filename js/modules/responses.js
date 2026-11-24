/**
 * Módulo 8: Respostas de Formulários (Exclusivo Coordenação)
 * Painel consolidado por formulário mostrando quem respondeu, respostas detalhadas
 * e exportação em CSV compatível com Excel.
 */

import { dataService } from '../services/dataService.js';
import {
  escapeHtml,
  exportToCSV,
  formatDateTimeBR,
  getCategoryBadgeClass,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

let selectedFormId = null;

export function renderResponses(container) {
  const forms = dataService.getForms();
  const responses = dataService.getResponses();
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  if (!selectedFormId || !forms.some((f) => f.id === selectedFormId)) {
    selectedFormId = forms[0]?.id || null;
  }

  const activeForm = forms.find((f) => f.id === selectedFormId) || null;
  const formResponses = activeForm ? responses.filter((r) => r.formId === activeForm.id) : [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Respostas dos Formulários</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            Painel consolidado de respostas enviadas pelos membros com exportação para Excel (CSV).
          </p>
        </div>

        ${
          activeForm
            ? `
          <button id="btn-export-csv" type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition">
            <i data-lucide="download" class="w-4 h-4"></i>
            Exportar CSV / Excel
          </button>
        `
            : ''
        }
      </div>

      ${
        forms.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          Nenhum formulário cadastrado ainda.
        </div>
      `
          : `
        <!-- Seletor de Formulário -->
        <div class="bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div class="flex-1">
            <label for="responses-form-select" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Selecionar Formulário</label>
            <select id="responses-form-select" class="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-[#0F172A] outline-none focus:border-[#1E3A8A]">
              ${forms
                .map((f) => {
                  const cnt = responses.filter((r) => r.formId === f.id).length;
                  return `<option value="${f.id}" ${f.id === selectedFormId ? 'selected' : ''}>${escapeHtml(f.title)} (${cnt} ${cnt === 1 ? 'resposta' : 'respostas'})</option>`;
                })
                .join('')}
            </select>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-center">
              <p class="text-[10px] font-bold uppercase tracking-wider text-blue-700">Público</p>
              <p class="text-sm font-extrabold text-[#1E3A8A]">${escapeHtml(activeForm.audience)}</p>
            </div>
            <div class="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p class="text-[10px] font-bold uppercase tracking-wider text-amber-700">Respostas</p>
              <p class="text-sm font-extrabold text-amber-900">${formResponses.length}</p>
            </div>
          </div>
        </div>

        <!-- Lista Consolidada de Respostas -->
        ${
          formResponses.length === 0
            ? `
          <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <i data-lucide="inbox" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
            <h4 class="text-base font-bold text-slate-700">Ainda não há respostas para este formulário</h4>
            <p class="text-sm text-slate-500 mt-1">Assim que os membros enviarem suas respostas, elas aparecerão consolidadas aqui.</p>
          </div>
        `
            : `
          <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th class="px-5 py-3.5 whitespace-nowrap">Membro</th>
                    <th class="px-4 py-3.5 whitespace-nowrap">Enviado em</th>
                    ${activeForm.questions
                      .map((q) => `<th class="px-4 py-3.5 min-w-[200px]">${escapeHtml(q.text)}</th>`)
                      .join('')}
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  ${formResponses
                    .map((resp) => {
                      const member = userMap[resp.userId];
                      return `
                        <tr class="hover:bg-slate-50/70 align-top">
                          <td class="px-5 py-3.5 whitespace-nowrap">
                            <p class="font-bold text-[#0F172A]">${escapeHtml(member?.name || 'Membro removido')}</p>
                            ${
                              member
                                ? `<span class="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(member.category)}">${escapeHtml(member.category)}</span>`
                                : ''
                            }
                          </td>
                          <td class="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">${escapeHtml(formatDateTimeBR(resp.submittedAt))}</td>
                          ${activeForm.questions
                            .map(
                              (q) => `<td class="px-4 py-3.5 text-xs text-slate-700 leading-relaxed">${escapeHtml(resp.answers?.[q.id] || '—')}</td>`,
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
    renderResponses(container);
  });

  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    if (!activeForm) return;
    if (formResponses.length === 0) {
      showToast('Não há respostas para exportar neste formulário.', 'info');
      return;
    }
    const headers = [
      'Membro',
      'Categoria',
      'E-mail',
      'Data/Hora Envio',
      ...activeForm.questions.map((q) => q.text),
    ];
    const rows = formResponses.map((resp) => {
      const m = userMap[resp.userId];
      return [
        m?.name || 'Membro removido',
        m?.category || '—',
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
