/**
 * Módulo "Permissões e Acessos" (Exclusivo Coordenação Geral / Admin Paroquial)
 * Matriz dinâmica cruzando Módulos/Ações do Sistema x Perfis de Acesso.
 * Atualiza Sidebar e bloqueios de rota em tempo real ao salvar ou restaurar padrão.
 */

import { dataService } from '../services/dataService.js';
import { PERMISSION_DEFINITIONS } from '../services/seedData.js';
import { escapeHtml, refreshIcons, showToast } from '../utils/helpers.js';

export function renderPermissions(container, { onPermissionsChanged }) {
  const matrix = dataService.getPermissions();

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#92400E] bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full mb-1.5">
            <i data-lucide="crown" class="w-3 h-3"></i>
            Exclusivo Coordenação Geral
          </div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Permissões e Acessos</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Configure em tempo real quais módulos e ações ficam disponíveis para Coordenadores de Pastoral e Membros.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button id="btn-reset-permissions" type="button"
            class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#FAF6F0] text-[#5D4037] border border-[#E6DACE] text-xs sm:text-sm font-semibold transition">
            <i data-lucide="rotate-ccw" class="w-4 h-4 text-[#B45309]"></i>
            Restaurar Padrão
          </button>
          <button id="btn-save-permissions" type="button"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-xs sm:text-sm font-semibold shadow-sm transition">
            <i data-lucide="save" class="w-4 h-4 text-amber-400"></i>
            Salvar Permissões
          </button>
        </div>
      </div>

      <div class="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-[#4E342E] flex items-start gap-2.5">
        <i data-lucide="shield-check" class="w-4 h-4 text-[#B45309] shrink-0 mt-0.5"></i>
        <span>
          A <strong>Coordenação Geral (Admin Paroquial)</strong> mantém acesso total fixo e bloqueado contra remoção. Itens desmarcados para outros perfis desaparecem automaticamente da barra lateral e têm acesso direto bloqueado.
        </span>
      </div>

      <!-- Matriz de Permissões -->
      <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#3E2723] text-white text-xs font-bold uppercase tracking-wider">
                <th class="px-5 py-4">Módulo / Ação do Sistema</th>
                <th class="px-4 py-4 text-center whitespace-nowrap">Coordenação Geral</th>
                <th class="px-4 py-4 text-center whitespace-nowrap">Coordenador de Pastoral</th>
                <th class="px-4 py-4 text-center whitespace-nowrap">Membro / Coroinha / Agente</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E6DACE]/70 text-sm">
              ${PERMISSION_DEFINITIONS.map((perm) => {
                const coordChecked = Boolean(matrix.coordinator?.[perm.key]);
                const memberChecked = Boolean(matrix.member?.[perm.key]);
                return `
                  <tr class="hover:bg-[#FAF6F0]/80 transition">
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-2.5">
                        <span class="font-bold text-[#3E2723]">${escapeHtml(perm.label)}</span>
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F5EFE6] text-[#6D4C41] border border-[#E6DACE]">
                          ${escapeHtml(perm.group)}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-center">
                      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-[#92400E] border border-amber-300" title="Acesso total permanente">
                        <i data-lucide="lock" class="w-3 h-3"></i>
                        Total
                      </span>
                    </td>
                    <td class="px-4 py-3.5 text-center">
                      <label class="inline-flex items-center justify-center cursor-pointer">
                        <input type="checkbox" class="perm-check sr-only peer" data-role="coordinator" data-key="${perm.key}" ${coordChecked ? 'checked' : ''}>
                        <div class="w-11 h-6 bg-[#E6DACE] rounded-full peer peer-checked:bg-[#3E2723] relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                      </label>
                    </td>
                    <td class="px-4 py-3.5 text-center">
                      <label class="inline-flex items-center justify-center cursor-pointer">
                        <input type="checkbox" class="perm-check sr-only peer" data-role="member" data-key="${perm.key}" ${memberChecked ? 'checked' : ''}>
                        <div class="w-11 h-6 bg-[#E6DACE] rounded-full peer peer-checked:bg-[#B45309] relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                      </label>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  container.querySelector('#btn-save-permissions').addEventListener('click', () => {
    const nextMatrix = { coordinator: {}, member: {} };
    container.querySelectorAll('.perm-check').forEach((chk) => {
      nextMatrix[chk.dataset.role][chk.dataset.key] = chk.checked;
    });
    dataService.savePermissions(nextMatrix);
    showToast('Permissões salvas e aplicadas em tempo real!');
    onPermissionsChanged?.();
  });

  container.querySelector('#btn-reset-permissions').addEventListener('click', () => {
    dataService.resetPermissionsToDefault();
    showToast('Matriz de permissões restaurada para o padrão recomendado.', 'info');
    onPermissionsChanged?.();
    renderPermissions(container, { onPermissionsChanged });
  });

  refreshIcons();
}
