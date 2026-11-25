/**
 * Módulo 4: Gestão de Usuários Multi-Pastoral (Relacionamento N:N) + Contas Familiares
 * - Permite vincular uma mesma conta a uma ou mais pastorais simultaneamente (Coordenador/Membro).
 * - Suporta Contas Compartilhadas / Familiares (1 ou mais irmãos na mesma conta de acesso,
 *   cada qual com Nome Completo e Data de Nascimento próprios).
 * - Isolamento de governança preservado para Coordenadores de Pastoral vs Coordenação Geral.
 */

import { dataService } from '../services/dataService.js';
import {
  closeModal,
  escapeHtml,
  formatDateBR,
  getAccountMembers,
  getCoordinatedPastoralIds,
  getInitials,
  getStatusBadgeClass,
  getUserMemberships,
  isFamilyAccount,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderFamilyAccountBadge,
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
  const scopedUsers = generalAdmin
    ? allUsers
    : allUsers.filter((u) => getUserMemberships(u).some((m) => managedIds.has(m.pastoralId)));

  const q = searchTerm.trim().toLowerCase();
  const filtered = scopedUsers.filter((u) => {
    const members = getAccountMembers(u);
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      members.some((m) => m.name.toLowerCase().includes(q));
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
          <h3 class="text-xl font-extrabold text-[#3E2723]">Gestão de Usuários &amp; Contas Familiares</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${
              generalAdmin
                ? `${scopedUsers.length} contas cadastradas na paróquia. Cadastre membros individuais ou contas familiares (irmãos no mesmo acesso).`
                : `Exibindo ${scopedUsers.length} contas vinculadas às pastorais que você coordena (${managedPastorals.map((p) => p.shortName).join(', ')}).`
            }
          </p>
        </div>
        <button id="btn-new-user" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition shrink-0">
          <i data-lucide="user-plus" class="w-4 h-4 text-amber-400"></i>
          Novo Membro / Família
        </button>
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-2xl border border-[#E6DACE] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 shadow-xs">
        <div class="md:col-span-5 relative">
          <i data-lucide="search" class="w-4 h-4 text-[#8D6E63] absolute left-3.5 top-1/2 -translate-y-1/2"></i>
          <input id="users-search" type="text" value="${escapeHtml(searchTerm)}" placeholder="Buscar por nome, irmão ou e-mail..."
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
                <th class="px-5 py-3.5">Conta / Integrantes</th>
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
                        const members = getAccountMembers(u);
                        const isFam = isFamilyAccount(u);
                        return `
                          <tr class="hover:bg-[#FAF6F0]/80 transition">
                            <td class="px-5 py-3.5">
                              <div class="flex items-start gap-3">
                                <div class="w-9 h-9 rounded-full ${isFam ? 'bg-[#B45309] text-white' : 'bg-[#3E2723] text-amber-400'} font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                  ${isFam ? '<i data-lucide="users" class="w-4 h-4"></i>' : escapeHtml(getInitials(u.name))}
                                </div>
                                <div class="min-w-0">
                                  <div class="flex items-center gap-1.5 flex-wrap">
                                    <p class="font-bold text-[#3E2723] truncate">${escapeHtml(u.name)}</p>
                                    ${renderFamilyAccountBadge(u, { compact: true })}
                                  </div>
                                  <p class="text-xs text-[#8D6E63] truncate">${escapeHtml(u.email)}</p>
                                  ${
                                    isFam
                                      ? `<div class="mt-1.5 flex flex-wrap gap-1">
                                          ${members
                                            .map(
                                              (m) => `
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF6F0] border border-[#E6DACE] text-[10px] font-semibold text-[#4E342E]">
                                              ${escapeHtml(m.name)} <span class="text-[#8D6E63]">(${escapeHtml(formatDateBR(m.birthDate))})</span>
                                            </span>
                                          `,
                                            )
                                            .join('')}
                                        </div>`
                                      : ''
                                  }
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3.5 text-xs text-[#5D4037] whitespace-nowrap">
                              <p>${escapeHtml(u.phone || '—')}</p>
                              <p class="text-[#8D6E63] mt-0.5">
                                ${isFam ? `${members.length} datas individuais` : escapeHtml(formatDateBR(u.birthDate))}
                              </p>
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
      if (!confirm('Deseja realmente remover esta conta do sistema?')) return;
      dataService.deleteUser(btn.dataset.deleteUser);
      showToast('Conta removida com sucesso.');
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
  const initialMembers = existing
    ? getAccountMembers(existing)
    : [{ id: '', name: '', birthDate: '' }];

  openModal({
    title: existing ? 'Editar Conta & Vínculos Pastorais' : 'Cadastrar Novo Membro / Conta Familiar',
    maxWidth: 'max-w-2xl',
    bodyHtml: `
      <form id="user-form" class="space-y-4">
        <!-- Dados Únicos de Acesso da Conta -->
        <div class="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6DACE] space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-extrabold uppercase tracking-wider text-[#3E2723]">Dados de Acesso da Conta</span>
            <span class="text-[11px] text-[#6D4C41]">Login único compartilhado entre irmãos</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">E-mail de Login *</label>
              <input name="email" type="email" required value="${escapeHtml(existing?.email || '')}" placeholder="familia@santateresa.org.br"
                class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm focus:border-[#B45309] outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Telefone / WhatsApp (Responsável) *</label>
              <input name="phone" required value="${escapeHtml(existing?.phone || '')}" placeholder="(11) 99999-0000"
                class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm focus:border-[#B45309] outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Senha de Acesso ${existing ? '(deixe vazio p/ manter)' : '*'}</label>
              <input name="password" type="password" ${existing ? '' : 'required'} value="" placeholder="${existing ? '••••••••' : 'Ex: pastoral2026'}"
                class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm focus:border-[#B45309] outline-none">
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
        </div>

        <!-- Integrantes da Conta (1 ou mais irmãos) -->
        <div class="p-3.5 rounded-xl bg-amber-50/50 border border-amber-300/80 space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#3E2723] flex items-center gap-1.5">
                <i data-lucide="users" class="w-3.5 h-3.5 text-[#B45309]"></i>
                Integrantes Vinculados à Conta
              </span>
              <p class="text-[11px] text-[#6D4C41]">Adicione irmãos na mesma conta: cada um terá escala, presença e aniversário individuais.</p>
            </div>
            <button id="btn-add-family-member" type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#B45309] hover:bg-[#92400E] text-white transition">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
              + Adicionar Irmão / Integrante
            </button>
          </div>

          <div id="family-title-wrap" class="${initialMembers.length > 1 ? '' : 'hidden'}">
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome da Conta Familiar (Opcional)</label>
            <input name="accountName" value="${escapeHtml(initialMembers.length > 1 ? existing?.name || '' : '')}"
              placeholder="Ex: Família Silva (Pedro Lucas & João Miguel)"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm focus:border-[#B45309] outline-none">
          </div>

          <div id="family-members-list" class="space-y-2.5"></div>
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
                  ? 'Marque uma ou mais pastorais e defina se esta conta atua como Coordenador(a) ou Membro em cada uma.'
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
            ${existing ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const fmList = bodyEl.querySelector('#family-members-list');
      const fmTitleWrap = bodyEl.querySelector('#family-title-wrap');

      function refreshFamilyRowLabels() {
        const rows = Array.from(fmList.querySelectorAll('.family-member-row'));
        fmTitleWrap.classList.toggle('hidden', rows.length <= 1);
        rows.forEach((row, idx) => {
          const lbl = row.querySelector('.fm-index-label');
          if (lbl) lbl.textContent = `Integrante ${idx + 1}`;
          const rmBtn = row.querySelector('.remove-fm-btn');
          if (rmBtn) rmBtn.classList.toggle('hidden', rows.length <= 1);
        });
      }

      function addFamilyMemberRow(preset = { id: '', name: '', birthDate: '' }) {
        const row = document.createElement('div');
        row.className = 'family-member-row p-3 rounded-xl bg-white border border-[#E6DACE] space-y-2';
        row.dataset.memberId = preset.id || '';
        row.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="fm-index-label text-[11px] font-extrabold uppercase tracking-wider text-[#B45309]">Integrante</span>
            <button type="button" class="remove-fm-btn inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-red-700 hover:bg-red-50 transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              Remover
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div class="sm:col-span-7">
              <label class="block text-[11px] font-bold text-[#5D4037] mb-1">Nome Completo / de Exibição *</label>
              <input type="text" required class="fm-name w-full px-3 py-2 rounded-lg border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"
                placeholder="Ex: Pedro Lucas Silva" value="${escapeHtml(preset.name || '')}">
            </div>
            <div class="sm:col-span-5">
              <label class="block text-[11px] font-bold text-[#5D4037] mb-1">Data de Nascimento *</label>
              <input type="date" required class="fm-birth w-full px-3 py-2 rounded-lg border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"
                value="${escapeHtml(preset.birthDate || '')}">
            </div>
          </div>
        `;
        row.querySelector('.remove-fm-btn').addEventListener('click', () => {
          row.remove();
          refreshFamilyRowLabels();
        });
        fmList.appendChild(row);
        refreshFamilyRowLabels();
        refreshIcons();
      }

      initialMembers.forEach((m) => addFamilyMemberRow(m));

      bodyEl.querySelector('#btn-add-family-member').addEventListener('click', () => {
        addFamilyMemberRow({ id: '', name: '', birthDate: '' });
      });

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

        const familyMembers = [];
        fmList.querySelectorAll('.family-member-row').forEach((row) => {
          const name = row.querySelector('.fm-name').value.trim();
          const birthDate = row.querySelector('.fm-birth').value;
          if (name) {
            familyMembers.push({
              id: row.dataset.memberId || undefined,
              name,
              birthDate,
            });
          }
        });

        if (familyMembers.length === 0) {
          showToast('Informe pelo menos um integrante na conta.', 'error');
          return;
        }

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
          showToast('Vincule a conta a pelo menos uma pastoral.', 'error');
          return;
        }

        const customAccountName = String(fd.get('accountName') || '').trim();
        const passwordVal = String(fd.get('password') || '').trim();

        dataService.saveUser({
          id: existing?.id,
          name: familyMembers.length > 1 ? customAccountName : familyMembers[0].name,
          email: String(fd.get('email')).trim(),
          phone: String(fd.get('phone')).trim(),
          password: passwordVal || existing?.password || 'pastoral2026',
          birthDate: familyMembers[0].birthDate,
          status: fd.get('status'),
          isGeneralAdmin: isAdminFlag,
          memberships: finalMemberships,
          familyMembers,
        });

        closeModal();
        showToast(existing ? 'Cadastro e integrantes atualizados!' : 'Novo cadastro salvo com sucesso!');
        onSaved();
      });
    },
  });
}
