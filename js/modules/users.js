/**
 * Módulo 4: Gestão de Usuários Multi-Pastoral (Relacionamento N:N)
 * - Permite vincular uma mesma pessoa a uma ou mais pastorais simultaneamente,
 *   definindo em cada vínculo se atua como Coordenador(a) ou Membro.
 * - Isolamento de governança:
 *   * Coordenação Geral vê e gerencia todos os usuários, pastorais e o perfil Admin Paroquial.
 *   * Coordenador de Pastoral gerencia apenas vínculos nas pastorais que coordena
 *     (preservando intactos os vínculos daquela pessoa em outras pastorais).
 */

import { dataService } from '../services/dataService.js';
import {
  closeModal,
  escapeHtml,
  formatDateBR,
  getCoordinatedPastoralIds,
  getInitials,
  getStatusBadgeClass,
  getUserMemberships,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

let searchTerm = '';
let filterPastoralId = 'all';
let filterStatus = 'Todos';

export function renderUsers(container, { user, onUsersChanged }) {
  const generalAdmin = isGeneralAdmin(user);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const managedPastorals = pastorals.filter((p) => managedIds.has(p.id));

  if (filterPastoralId !== 'all' && !managedIds.has(filterPastoralId)) {
    filterPastoralId = 'all';
  }

  const allUsers = dataService.getUsers();
  // Coordenador de pastoral vê membros das pastorais que coordena; Admin Geral vê todos
  const scopedUsers = generalAdmin
    ? allUsers
    : allUsers.filter((u) => getUserMemberships(u).some((m) => managedIds.has(m.pastoralId)));

  const filtered = scopedUsers.filter((u) => {
    const matchSearch =
      !searchTerm ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPastoral =
      filterPastoralId === 'all' ||
      getUserMemberships(u).some((m) => m.pastoralId === filterPastoralId);
    const matchStatus = filterStatus === 'Todos' || u.status === filterStatus;
    return matchSearch && matchPastoral && matchStatus;
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Gestão de Usuários &amp; Vínculos</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${
              generalAdmin
                ? `${scopedUsers.length} membros cadastrados em toda a paróquia. Vincule cada pessoa a uma ou mais pastorais.`
                : `Exibindo ${scopedUsers.length} membros vinculados às pastorais que você coordena (${managedPastorals.map((p) => p.shortName).join(', ')}).`
            }
          </p>
        </div>
        <button id="btn-new-user" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition shrink-0">
          <i data-lucide="user-plus" class="w-4 h-4 text-amber-400"></i>
          Novo Membro
        </button>
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-2xl border border-[#E6DACE] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 shadow-xs">
        <div class="md:col-span-5 relative">
          <i data-lucide="search" class="w-4 h-4 text-[#8D6E63] absolute left-3.5 top-1/2 -translate-y-1/2"></i>
          <input id="users-search" type="text" value="${escapeHtml(searchTerm)}" placeholder="Buscar por nome ou e-mail..."
            class="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E6DACE] bg-[#FAF6F0] focus:bg-white focus:border-[#B45309] text-sm outline-none transition">
        </div>
        <div class="md:col-span-4">
          <select id="users-filter-pastoral" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
            <option value="all" ${filterPastoralId === 'all' ? 'selected' : ''}>${generalAdmin ? 'Todas as Pastorais' : 'Todas que Coordeno'}</option>
            ${managedPastorals
              .map((p) => `<option value="${p.id}" ${filterPastoralId === p.id ? 'selected' : ''}>${escapeHtml(p.shortName)}</option>`)
              .join('')}
          </select>
        </div>
        <div class="md:col-span-3">
          <select id="users-filter-status" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
            ${['Todos', 'Ativo', 'Inativo', 'Bloqueado']
              .map((s) => `<option value="${s}" ${filterStatus === s ? 'selected' : ''}>Status: ${s}</option>`)
              .join('')}
          </select>
        </div>
      </div>

      <!-- Tabela de Membros -->
      <div class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#FDFBF7] border-b border-[#E6DACE] text-[11px] font-bold uppercase tracking-wider text-[#6D4C41]">
                <th class="px-5 py-3.5">Membro</th>
                <th class="px-4 py-3.5">Contato &amp; Nasc.</th>
                <th class="px-4 py-3.5">Pastorais &amp; Papéis (N:N)</th>
                <th class="px-4 py-3.5">Status</th>
                <th class="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E6DACE]/60 text-sm">
              ${
                filtered.length === 0
                  ? `
                <tr>
                  <td colspan="5" class="px-5 py-10 text-center text-[#8D6E63]">
                    Nenhum membro encontrado com os filtros informados.
                  </td>
                </tr>
              `
                  : filtered
                      .map((u) => {
                        const memberships = getUserMemberships(u);
                        return `
                          <tr class="hover:bg-[#FAF6F0]/80 transition">
                            <td class="px-5 py-3.5">
                              <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-full bg-[#3E2723] text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                                  ${escapeHtml(getInitials(u.name))}
                                </div>
                                <div class="min-w-0">
                                  <p class="font-bold text-[#3E2723] truncate">${escapeHtml(u.name)}</p>
                                  <p class="text-xs text-[#8D6E63] truncate">${escapeHtml(u.email)}</p>
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3.5 text-xs text-[#5D4037] whitespace-nowrap">
                              <p>${escapeHtml(u.phone || '—')}</p>
                              <p class="text-[#8D6E63] mt-0.5">${escapeHtml(formatDateBR(u.birthDate))}</p>
                            </td>
                            <td class="px-4 py-3.5">
                              <div class="flex items-center gap-1.5 flex-wrap max-w-md">
                                ${
                                  u.isGeneralAdmin
                                    ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-[#92400E] border border-amber-400">
                                        <i data-lucide="crown" class="w-3 h-3"></i>
                                        Coordenação Geral
                                      </span>`
                                    : ''
                                }
                                ${memberships
                                  .map((m) => {
                                    const p = pastoralMap[m.pastoralId];
                                    if (!p) return '';
                                    const isCoordRole = m.role === 'Coordenador';
                                    return `
                                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                                        style="background-color:${escapeHtml(p.color)}15; color:${escapeHtml(p.color)}; border-color:${escapeHtml(p.color)}44;">
                                        <span class="w-1.5 h-1.5 rounded-full" style="background-color:${escapeHtml(p.color)};"></span>
                                        ${escapeHtml(p.shortName)}: <strong>${isCoordRole ? 'Coord.' : 'Membro'}</strong>
                                      </span>
                                    `;
                                  })
                                  .join('')}
                                ${!u.isGeneralAdmin && memberships.length === 0 ? '<span class="text-xs text-[#8D6E63] italic">Sem pastoral vinculada</span>' : ''}
                              </div>
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap">
                              <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(u.status)}">
                                ${escapeHtml(u.status)}
                              </span>
                            </td>
                            <td class="px-5 py-3.5 text-right whitespace-nowrap">
                              <button type="button" data-edit-user="${u.id}" title="Editar vínculos e cadastro"
                                class="p-2 rounded-lg text-[#6D4C41] hover:text-[#3E2723] hover:bg-[#F5EFE6] transition">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                              </button>
                              ${
                                generalAdmin && u.id !== user.id
                                  ? `<button type="button" data-delete-user="${u.id}" title="Excluir usuário"
                                      class="p-2 rounded-lg text-[#6D4C41] hover:text-red-700 hover:bg-red-50 transition">
                                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>`
                                  : ''
                              }
                            </td>
                          </tr>
                        `;
                      })
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

  container.querySelector('#users-filter-pastoral').addEventListener('change', (e) => {
    filterPastoralId = e.target.value;
    renderUsers(container, { user, onUsersChanged });
  });

  container.querySelector('#users-filter-status').addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderUsers(container, { user, onUsersChanged });
  });

  container.querySelector('#btn-new-user').addEventListener('click', () => {
    openUserModal(null, user, () => {
      onUsersChanged?.();
      renderUsers(container, { user, onUsersChanged });
    });
  });

  container.querySelectorAll('[data-edit-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = dataService.getUserById(btn.dataset.editUser);
      if (target) {
        openUserModal(target, user, () => {
          onUsersChanged?.();
          renderUsers(container, { user, onUsersChanged });
        });
      }
    });
  });

  container.querySelectorAll('[data-delete-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja realmente remover este membro do sistema?')) return;
      dataService.deleteUser(btn.dataset.deleteUser);
      showToast('Usuário removido com sucesso.');
      onUsersChanged?.();
      renderUsers(container, { user, onUsersChanged });
    });
  });

  refreshIcons();
}

function openUserModal(existing, actor, onSaved) {
  const generalAdmin = isGeneralAdmin(actor);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const managedIds = new Set(getCoordinatedPastoralIds(actor, pastorals));
  const editablePastorals = pastorals.filter((p) => managedIds.has(p.id));

  const existingMemberships = getUserMemberships(existing);
  const membershipByPastoral = Object.fromEntries(existingMemberships.map((m) => [m.pastoralId, m.role]));
  const otherPastoralsMemberships = existingMemberships.filter((m) => !managedIds.has(m.pastoralId));

  openModal({
    title: existing ? 'Editar Membro & Vínculos Pastorais' : 'Cadastrar Novo Membro',
    maxWidth: 'max-w-2xl',
    bodyHtml: `
      <form id="user-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome Completo *</label>
          <input name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Ana Beatriz Silva"
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">E-mail *</label>
            <input name="email" type="email" required value="${escapeHtml(existing?.email || '')}" placeholder="membro@santateresa.org.br"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Telefone / WhatsApp *</label>
            <input name="phone" required value="${escapeHtml(existing?.phone || '')}" placeholder="(11) 99999-0000"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Data de Nascimento *</label>
            <input name="birthDate" type="date" required value="${escapeHtml(existing?.birthDate || '')}"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Status *</label>
            <select name="status" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
              ${['Ativo', 'Inativo', 'Bloqueado']
                .map((s) => `<option value="${s}" ${(existing?.status || 'Ativo') === s ? 'selected' : ''}>${s}</option>`)
                .join('')}
            </select>
          </div>
        </div>

        ${
          generalAdmin
            ? `
          <label class="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-[#78350F] cursor-pointer">
            <input name="isGeneralAdmin" type="checkbox" ${existing?.isGeneralAdmin ? 'checked' : ''} class="rounded text-[#B45309]">
            <span>Conceder perfil de <strong>Coordenação Geral (Admin Paroquial)</strong> — acesso total para criar pastorais e atribuir coordenadores.</span>
          </label>
        `
            : ''
        }

        <!-- Vínculos Multi-Pastoral (N:N) -->
        <div class="pt-2 border-t border-[#E6DACE]/80 space-y-2.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#3E2723]">Vínculos nas Pastorais (Multi-Pastoral)</label>
            <p class="text-[11px] text-[#6D4C41]">
              ${
                generalAdmin
                  ? 'Marque uma ou mais pastorais e defina se esta pessoa atua como Coordenador(a) ou Membro em cada uma.'
                  : 'Você pode gerenciar os vínculos apenas nas pastorais sob sua coordenação.'
              }
            </p>
          </div>

          <div class="space-y-2">
            ${editablePastorals
              .map((p) => {
                const currentRole = membershipByPastoral[p.id] || '';
                const checked = Boolean(currentRole);
                return `
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-[#E6DACE] bg-[#FAF6F0]">
                    <label class="inline-flex items-center gap-2.5 text-sm font-semibold text-[#3E2723] cursor-pointer">
                      <input type="checkbox" class="mem-check rounded text-[#B45309]" data-pid="${p.id}" ${checked ? 'checked' : ''}>
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color:${escapeHtml(p.color)};"></span>
                      <span>${escapeHtml(p.name)}</span>
                    </label>
                    <select class="mem-role px-2.5 py-1.5 rounded-lg border border-[#E6DACE] bg-white text-xs font-bold text-[#4E342E] outline-none focus:border-[#B45309]"
                      data-pid="${p.id}" ${checked ? '' : 'disabled'}>
                      <option value="Membro" ${currentRole === 'Membro' ? 'selected' : ''}>Membro</option>
                      <option value="Coordenador" ${currentRole === 'Coordenador' ? 'selected' : ''}>Coordenador(a)</option>
                    </select>
                  </div>
                `;
              })
              .join('')}
          </div>

          ${
            !generalAdmin && otherPastoralsMemberships.length > 0
              ? `
            <div class="p-3 rounded-xl bg-stone-50 border border-[#E6DACE] text-[11px] text-[#6D4C41]">
              <strong>Vínculos preservados em outras pastorais:</strong>
              ${otherPastoralsMemberships
                .map((m) => `${escapeHtml(pastoralMap[m.pastoralId]?.shortName || 'Pastoral')} (${m.role})`)
                .join(', ')}
            </div>
          `
              : ''
          }
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-[#E6DACE]/80">
          <button type="button" id="cancel-user-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">
            ${existing ? 'Salvar Alterações' : 'Cadastrar Membro'}
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelectorAll('.mem-check').forEach((chk) => {
        chk.addEventListener('change', () => {
          const sel = bodyEl.querySelector(`.mem-role[data-pid="${chk.dataset.pid}"]`);
          if (sel) sel.disabled = !chk.checked;
        });
      });

      bodyEl.querySelector('#cancel-user-btn').addEventListener('click', closeModal);

      bodyEl.querySelector('#user-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        const editedMemberships = [];
        bodyEl.querySelectorAll('.mem-check').forEach((chk) => {
          if (chk.checked) {
            const sel = bodyEl.querySelector(`.mem-role[data-pid="${chk.dataset.pid}"]`);
            editedMemberships.push({
              pastoralId: chk.dataset.pid,
              role: sel?.value || 'Membro',
            });
          }
        });

        const isAdminFlag = generalAdmin ? fd.get('isGeneralAdmin') === 'on' : Boolean(existing?.isGeneralAdmin);
        const finalMemberships = [...otherPastoralsMemberships, ...editedMemberships];

        if (!isAdminFlag && finalMemberships.length === 0) {
          showToast('Vincule o membro a pelo menos uma pastoral.', 'error');
          return;
        }

        dataService.saveUser({
          id: existing?.id,
          name: String(fd.get('name')).trim(),
          email: String(fd.get('email')).trim(),
          phone: String(fd.get('phone')).trim(),
          birthDate: fd.get('birthDate'),
          status: fd.get('status'),
          isGeneralAdmin: isAdminFlag,
          memberships: finalMemberships,
        });

        closeModal();
        showToast(existing ? 'Cadastro e vínculos atualizados!' : 'Novo membro cadastrado com sucesso!');
        onSaved();
      });
    },
  });
}
