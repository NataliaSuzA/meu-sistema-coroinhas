/**
 * Módulo 4: Gestão de Usuários (Exclusivo Coordenação)
 * - Busca por nome + filtros por Categoria (Coordenador, Acólito, Coroinha)
 *   e Status (Ativo, Inativo, Bloqueado)
 * - CRUD completo com data de nascimento (alimenta Aniversariantes)
 * - Usuários Inativos ou Bloqueados não aparecem nos dropdowns de escala
 */

import { dataService } from '../services/dataService.js';
import {
  closeModal,
  escapeHtml,
  formatDateBR,
  getCategoryBadgeClass,
  getInitials,
  getStatusBadgeClass,
  openModal,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

let searchTerm = '';
let filterCategory = 'Todas';
let filterStatus = 'Todos';

export function renderUsers(container, { user, onUsersChanged }) {
  const allUsers = dataService.getUsers();
  const filtered = allUsers.filter((u) => {
    const matchSearch =
      !searchTerm ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCategory === 'Todas' || u.category === filterCategory;
    const matchStatus = filterStatus === 'Todos' || u.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const activeCount = allUsers.filter((u) => u.status === 'Ativo').length;
  const inactiveOrBlocked = allUsers.length - activeCount;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Gestão de Usuários</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            ${allUsers.length} membros cadastrados (${activeCount} ativos • ${inactiveOrBlocked} inativos/bloqueados fora das escalas).
          </p>
        </div>
        <button id="btn-new-user" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold shadow-sm transition">
          <i data-lucide="user-plus" class="w-4 h-4 text-amber-400"></i>
          Novo Membro
        </button>
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-2xl border border-slate-200/90 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 shadow-xs">
        <div class="md:col-span-6 relative">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
          <input id="users-search" type="text" value="${escapeHtml(searchTerm)}" placeholder="Buscar por nome ou e-mail..."
            class="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#1E3A8A] text-sm outline-none transition">
        </div>
        <div class="md:col-span-3">
          <select id="users-filter-category" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
            ${['Todas', 'Coordenador', 'Acólito', 'Coroinha']
              .map((c) => `<option value="${c}" ${filterCategory === c ? 'selected' : ''}>Categoria: ${c}</option>`)
              .join('')}
          </select>
        </div>
        <div class="md:col-span-3">
          <select id="users-filter-status" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
            ${['Todos', 'Ativo', 'Inativo', 'Bloqueado']
              .map((s) => `<option value="${s}" ${filterStatus === s ? 'selected' : ''}>Status: ${s}</option>`)
              .join('')}
          </select>
        </div>
      </div>

      <!-- Tabela de Membros -->
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th class="px-5 py-3.5">Membro</th>
                <th class="px-4 py-3.5">Contato</th>
                <th class="px-4 py-3.5">Nascimento</th>
                <th class="px-4 py-3.5">Categoria</th>
                <th class="px-4 py-3.5">Status</th>
                <th class="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              ${
                filtered.length === 0
                  ? `
                <tr>
                  <td colspan="6" class="px-5 py-10 text-center text-slate-500">
                    Nenhum membro encontrado com os filtros informados.
                  </td>
                </tr>
              `
                  : filtered
                      .map(
                        (u) => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-[#0F172A] text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          ${escapeHtml(getInitials(u.name))}
                        </div>
                        <div class="min-w-0">
                          <p class="font-bold text-[#0F172A] truncate">${escapeHtml(u.name)}</p>
                          <p class="text-xs text-slate-500 truncate">${escapeHtml(u.email)}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">${escapeHtml(u.phone || '—')}</td>
                    <td class="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">${escapeHtml(formatDateBR(u.birthDate))}</td>
                    <td class="px-4 py-3.5 whitespace-nowrap">
                      <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryBadgeClass(u.category)}">
                        ${escapeHtml(u.category)}
                      </span>
                    </td>
                    <td class="px-4 py-3.5 whitespace-nowrap">
                      <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(u.status)}">
                        ${escapeHtml(u.status)}
                      </span>
                    </td>
                    <td class="px-5 py-3.5 text-right whitespace-nowrap">
                      <button type="button" data-edit-user="${u.id}" title="Editar usuário"
                        class="p-2 rounded-lg text-slate-500 hover:text-[#1E3A8A] hover:bg-blue-50 transition">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                      </button>
                      ${
                        u.id !== user.id
                          ? `<button type="button" data-delete-user="${u.id}" title="Excluir usuário"
                              class="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition">
                              <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>`
                          : ''
                      }
                    </td>
                  </tr>
                `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#users-search');
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderUsers(container, { user, onUsersChanged });
    const refreshed = container.querySelector('#users-search');
    if (refreshed) {
      refreshed.focus();
      refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
    }
  });

  container.querySelector('#users-filter-category').addEventListener('change', (e) => {
    filterCategory = e.target.value;
    renderUsers(container, { user, onUsersChanged });
  });

  container.querySelector('#users-filter-status').addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderUsers(container, { user, onUsersChanged });
  });

  container.querySelector('#btn-new-user').addEventListener('click', () => {
    openUserModal(null, () => {
      onUsersChanged?.();
      renderUsers(container, { user, onUsersChanged });
    });
  });

  container.querySelectorAll('[data-edit-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = dataService.getUserById(btn.dataset.editUser);
      if (target) {
        openUserModal(target, () => {
          onUsersChanged?.();
          renderUsers(container, { user, onUsersChanged });
        });
      }
    });
  });

  container.querySelectorAll('[data-delete-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja realmente remover este membro do cadastro?')) return;
      dataService.deleteUser(btn.dataset.deleteUser);
      showToast('Usuário removido com sucesso.');
      onUsersChanged?.();
      renderUsers(container, { user, onUsersChanged });
    });
  });

  refreshIcons();
}

function openUserModal(existing, onSaved) {
  openModal({
    title: existing ? 'Editar Membro' : 'Cadastrar Novo Membro',
    bodyHtml: `
      <form id="user-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Nome Completo *</label>
          <input name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Ana Beatriz Silva"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">E-mail *</label>
            <input name="email" type="email" required value="${escapeHtml(existing?.email || '')}" placeholder="membro@santateresa.org.br"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Telefone / WhatsApp *</label>
            <input name="phone" required value="${escapeHtml(existing?.phone || '')}" placeholder="(11) 99999-0000"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Data de Nascimento *</label>
            <input name="birthDate" type="date" required value="${escapeHtml(existing?.birthDate || '')}"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Categoria *</label>
            <select name="category" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
              ${['Coordenador', 'Acólito', 'Coroinha']
                .map((c) => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`)
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Status *</label>
            <select name="status" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
              ${['Ativo', 'Inativo', 'Bloqueado']
                .map((s) => `<option value="${s}" ${(existing?.status || 'Ativo') === s ? 'selected' : ''}>${s}</option>`)
                .join('')}
            </select>
          </div>
        </div>

        <p class="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <strong>Regra das Escalas:</strong> Apenas usuários com status <strong>Ativo</strong> ficam disponíveis para seleção ao montar escalas.
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-user-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">
            ${existing ? 'Salvar Alterações' : 'Cadastrar Membro'}
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-user-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#user-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        dataService.saveUser({
          id: existing?.id,
          name: String(fd.get('name')).trim(),
          email: String(fd.get('email')).trim(),
          phone: String(fd.get('phone')).trim(),
          birthDate: fd.get('birthDate'),
          category: fd.get('category'),
          status: fd.get('status'),
        });
        closeModal();
        showToast(existing ? 'Cadastro atualizado!' : 'Novo membro cadastrado!');
        onSaved();
      });
    },
  });
}
