/**
 * Módulo 5: Configuração de Funções das Escalas (Exclusivo Coordenação)
 * CRUD completo de funções litúrgicas com ativação/inativação.
 */

import { dataService } from '../services/dataService.js';
import {
  closeModal,
  escapeHtml,
  openModal,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

export function renderRoles(container) {
  const roles = dataService.getRoles();
  const activeCount = roles.filter((r) => r.active).length;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Configuração de Funções Litúrgicas</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            ${activeCount} funções ativas de ${roles.length} cadastradas. Apenas funções <strong>Ativas</strong> aparecem na montagem de escalas.
          </p>
        </div>
        <button id="btn-new-role" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold shadow-sm transition">
          <i data-lucide="plus-circle" class="w-4 h-4 text-amber-400"></i>
          Nova Função
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${roles
          .map(
            (role) => `
          <article class="bg-white rounded-2xl border ${
            role.active ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/70 opacity-80'
          } p-5 flex flex-col justify-between gap-4 shadow-xs transition">
            <div>
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="w-9 h-9 rounded-xl ${
                  role.active ? 'bg-[#0F172A] text-amber-400' : 'bg-slate-200 text-slate-500'
                } flex items-center justify-center shrink-0">
                  <i data-lucide="award" class="w-4 h-4"></i>
                </div>
                <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  role.active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }">
                  ${role.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <h4 class="text-base font-bold text-[#0F172A]">${escapeHtml(role.name)}</h4>
              <p class="text-xs text-slate-500 mt-1 leading-relaxed">${escapeHtml(role.description || 'Sem descrição cadastrada.')}</p>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button type="button" data-toggle-role="${role.id}"
                class="text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                  role.active
                    ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                }">
                ${role.active ? 'Inativar' : 'Ativar'}
              </button>
              <div class="flex items-center gap-1">
                <button type="button" data-edit-role="${role.id}" title="Editar função"
                  class="p-2 rounded-lg text-slate-500 hover:text-[#1E3A8A] hover:bg-blue-50 transition">
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" data-delete-role="${role.id}" title="Excluir função"
                  class="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </article>
        `,
          )
          .join('')}
      </div>
    </div>
  `;

  container.querySelector('#btn-new-role').addEventListener('click', () => {
    openRoleModal(null, () => renderRoles(container));
  });

  container.querySelectorAll('[data-toggle-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = dataService.getRoleById(btn.dataset.toggleRole);
      if (!role) return;
      dataService.saveRole({ ...role, active: !role.active });
      showToast(`Função "${role.name}" marcada como ${!role.active ? 'Ativa' : 'Inativa'}.`);
      renderRoles(container);
    });
  });

  container.querySelectorAll('[data-edit-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = dataService.getRoleById(btn.dataset.editRole);
      if (role) openRoleModal(role, () => renderRoles(container));
    });
  });

  container.querySelectorAll('[data-delete-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja realmente excluir esta função litúrgica?')) return;
      dataService.deleteRole(btn.dataset.deleteRole);
      showToast('Função excluída com sucesso.');
      renderRoles(container);
    });
  });

  refreshIcons();
}

function openRoleModal(existing, onSaved) {
  openModal({
    title: existing ? 'Editar Função Litúrgica' : 'Nova Função Litúrgica',
    bodyHtml: `
      <form id="role-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Nome da Função *</label>
          <input name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Turiferário, Naviculário, Microfone..."
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Descrição / Orientações</label>
          <textarea name="description" rows="3" placeholder="Breve descrição das atribuições no altar..."
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <label class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
          <input name="active" type="checkbox" ${(existing?.active ?? true) ? 'checked' : ''} class="rounded text-[#1E3A8A]">
          Função ativa (disponível para seleção nas escalas)
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-role-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">Salvar Função</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-role-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#role-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        dataService.saveRole({
          id: existing?.id,
          name: String(fd.get('name')).trim(),
          description: String(fd.get('description') || '').trim(),
          active: fd.get('active') === 'on',
        });
        closeModal();
        showToast(existing ? 'Função atualizada!' : 'Nova função cadastrada!');
        onSaved();
      });
    },
  });
}
