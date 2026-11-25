/**
 * Módulo 5: Pastorais & Funções
 * - Coordenação Geral (Admin Paroquial): cadastra/edita/exclui Pastorais (com cor própria
 *   e atribuição de coordenadores iniciais) e gerencia funções de qualquer pastoral.
 * - Coordenador de Pastoral: visualiza e gerencia funções APENAS das pastorais que coordena.
 */

import { dataService } from '../services/dataService.js';
import {
  canManagePastoral,
  closeModal,
  escapeHtml,
  getCoordinatedPastoralIds,
  getUserMemberships,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

const COLOR_SWATCHES = ['#B45309', '#9A3412', '#5D4037', '#881337', '#0F766E', '#1E3A8A', '#4338CA', '#3F6212'];

let selectedPastoralId = null;

export function renderRoles(container, { user, onPastoralsChanged }) {
  const generalAdmin = isGeneralAdmin(user);
  const allPastorals = dataService.getPastorals();
  const managedIds = new Set(getCoordinatedPastoralIds(user, allPastorals));
  const managedPastorals = allPastorals.filter((p) => managedIds.has(p.id));
  const users = dataService.getUsers();
  const allRoles = dataService.getRoles();

  if (!selectedPastoralId || !managedIds.has(selectedPastoralId)) {
    selectedPastoralId = managedPastorals[0]?.id || null;
  }

  const activePastoral = managedPastorals.find((p) => p.id === selectedPastoralId) || null;
  const pastoralRoles = activePastoral ? allRoles.filter((r) => r.pastoralId === activePastoral.id) : [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Pastorais &amp; Funções</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            ${
              generalAdmin
                ? 'Cadastre as pastorais da paróquia com cor própria, atribua coordenadores e configure as funções de cada equipe.'
                : 'Gerencie as funções litúrgicas e ministeriais das pastorais sob sua coordenação.'
            }
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          ${
            generalAdmin
              ? `
            <button id="btn-new-pastoral" type="button"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold shadow-sm transition">
              <i data-lucide="folder-plus" class="w-4 h-4"></i>
              Nova Pastoral
            </button>
          `
              : `
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6D4C41] bg-[#F5EFE6] border border-[#E6DACE] px-3 py-2 rounded-xl">
              <i data-lucide="lock" class="w-3.5 h-3.5 text-[#B45309]"></i>
              Criação de novas pastorais: apenas Coordenação Geral
            </span>
          `
          }
        </div>
      </div>

      <!-- Grade de Pastorais Gerenciadas -->
      <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${managedPastorals
          .map((p) => {
            const isSelected = p.id === selectedPastoralId;
            const roleCount = allRoles.filter((r) => r.pastoralId === p.id && r.active).length;
            const coords = users.filter((u) =>
              getUserMemberships(u).some((m) => m.pastoralId === p.id && m.role === 'Coordenador'),
            );
            const memberCount = users.filter((u) =>
              u.status === 'Ativo' && getUserMemberships(u).some((m) => m.pastoralId === p.id),
            ).length;

            return `
              <article data-select-pastoral="${p.id}"
                class="cursor-pointer bg-white rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 transition ${
                  isSelected ? 'border-[#D97706] shadow-md bg-[#FDFBF7]' : 'border-[#E6DACE] hover:border-[#D7C4B2]'
                }">
                <div>
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-4 h-4 rounded-full shrink-0 shadow-xs" style="background-color:${escapeHtml(p.color)};"></span>
                      <h4 class="font-extrabold text-[#3E2723] text-sm truncate">${escapeHtml(p.name)}</h4>
                    </div>
                    ${
                      generalAdmin
                        ? `
                      <div class="flex items-center gap-0.5 shrink-0">
                        <button type="button" data-edit-pastoral="${p.id}" title="Editar pastoral"
                          class="p-1.5 rounded-lg text-[#6D4C41] hover:text-[#3E2723] hover:bg-[#F5EFE6]">
                          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button type="button" data-delete-pastoral="${p.id}" title="Excluir pastoral"
                          class="p-1.5 rounded-lg text-[#6D4C41] hover:text-red-700 hover:bg-red-50">
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    `
                        : ''
                    }
                  </div>
                  <p class="text-xs text-[#6D4C41] leading-relaxed">${escapeHtml(p.description || 'Sem descrição.')}</p>
                </div>

                <div class="pt-3 border-t border-[#E6DACE]/70 space-y-1.5 text-[11px] text-[#5D4037]">
                  <div class="flex items-center justify-between">
                    <span><strong>${roleCount}</strong> funções ativas</span>
                    <span><strong>${memberCount}</strong> membros ativos</span>
                  </div>
                  <p class="truncate text-[#8D6E63]">
                    Coord.: <strong class="text-[#4E342E]">${coords.length ? coords.map((c) => c.name.split(' ')[0]).join(', ') : 'Sem coordenador'}</strong>
                  </p>
                </div>
              </article>
            `;
          })
          .join('')}
      </section>

      <!-- Funções da Pastoral Selecionada -->
      ${
        activePastoral
          ? `
        <section class="bg-white rounded-2xl border border-[#E6DACE] shadow-xs overflow-hidden">
          <div class="px-6 py-4 bg-[#FDFBF7] border-b border-[#E6DACE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="w-4 h-4 rounded-full shrink-0" style="background-color:${escapeHtml(activePastoral.color)};"></span>
              <div>
                <h4 class="text-base font-extrabold text-[#3E2723]">Funções — ${escapeHtml(activePastoral.name)}</h4>
                <p class="text-xs text-[#6D4C41]">Apenas funções <strong>Ativas</strong> ficam disponíveis ao adicionar posições nas escalas desta pastoral.</p>
              </div>
            </div>
            <button id="btn-new-role" type="button"
              class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-xs sm:text-sm font-semibold transition shrink-0">
              <i data-lucide="plus-circle" class="w-4 h-4 text-amber-400"></i>
              Nova Função nesta Pastoral
            </button>
          </div>

          <div class="p-5">
            ${
              pastoralRoles.length === 0
                ? `
              <div class="text-center py-8 px-4 rounded-xl bg-[#FAF6F0] border border-dashed border-[#D7C4B2]">
                <p class="text-sm font-semibold text-[#5D4037]">Nenhuma função cadastrada nesta pastoral ainda.</p>
                <p class="text-xs text-[#8D6E63] mt-1">Clique em "Nova Função nesta Pastoral" para começar.</p>
              </div>
            `
                : `
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${pastoralRoles
                  .map(
                    (role) => `
                  <article class="rounded-2xl border ${
                    role.active ? 'border-[#E6DACE] bg-white' : 'border-[#E6DACE] bg-[#FAF6F0]/80 opacity-75'
                  } p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div class="flex items-start justify-between gap-2 mb-2">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white" style="background-color:${escapeHtml(activePastoral.color)};">
                          <i data-lucide="award" class="w-4 h-4"></i>
                        </div>
                        <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          role.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                        }">
                          ${role.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <h5 class="text-sm font-bold text-[#3E2723]">${escapeHtml(role.name)}</h5>
                      <p class="text-xs text-[#6D4C41] mt-1 leading-relaxed">${escapeHtml(role.description || 'Sem descrição.')}</p>
                    </div>

                    <div class="pt-2.5 border-t border-[#E6DACE]/70 flex items-center justify-between gap-2">
                      <button type="button" data-toggle-role="${role.id}"
                        class="text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                          role.active
                            ? 'text-[#92400E] bg-amber-50 hover:bg-amber-100 border-amber-200'
                            : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                        }">
                        ${role.active ? 'Inativar' : 'Ativar'}
                      </button>
                      <div class="flex items-center gap-1">
                        <button type="button" data-edit-role="${role.id}" title="Editar função"
                          class="p-1.5 rounded-lg text-[#6D4C41] hover:text-[#3E2723] hover:bg-[#F5EFE6]">
                          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button type="button" data-delete-role="${role.id}" title="Excluir função"
                          class="p-1.5 rounded-lg text-[#6D4C41] hover:text-red-700 hover:bg-red-50">
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    </div>
                  </article>
                `,
                  )
                  .join('')}
              </div>
            `
            }
          </div>
        </section>
      `
          : ''
      }
    </div>
  `;

  // Selecionar card da pastoral
  container.querySelectorAll('[data-select-pastoral]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectedPastoralId = card.dataset.selectPastoral;
      renderRoles(container, { user, onPastoralsChanged });
    });
  });

  // Nova / Editar / Excluir Pastoral (Apenas Coordenação Geral)
  container.querySelector('#btn-new-pastoral')?.addEventListener('click', () => {
    openPastoralModal(null, (saved) => {
      selectedPastoralId = saved.id;
      onPastoralsChanged?.();
      renderRoles(container, { user, onPastoralsChanged });
    });
  });

  container.querySelectorAll('[data-edit-pastoral]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = dataService.getPastoralById(btn.dataset.editPastoral);
      if (p) {
        openPastoralModal(p, () => {
          onPastoralsChanged?.();
          renderRoles(container, { user, onPastoralsChanged });
        });
      }
    });
  });

  container.querySelectorAll('[data-delete-pastoral]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja excluir esta pastoral e suas funções vinculadas?')) return;
      dataService.deletePastoral(btn.dataset.deletePastoral);
      showToast('Pastoral excluída.');
      onPastoralsChanged?.();
      renderRoles(container, { user, onPastoralsChanged });
    });
  });

  // CRUD de Funções na Pastoral Selecionada
  container.querySelector('#btn-new-role')?.addEventListener('click', () => {
    if (!activePastoral || !canManagePastoral(user, activePastoral.id)) return;
    openRoleModal(null, activePastoral, () => renderRoles(container, { user, onPastoralsChanged }));
  });

  container.querySelectorAll('[data-toggle-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = dataService.getRoleById(btn.dataset.toggleRole);
      if (!role || !canManagePastoral(user, role.pastoralId)) return;
      dataService.saveRole({ ...role, active: !role.active });
      showToast(`Função "${role.name}" marcada como ${!role.active ? 'Ativa' : 'Inativa'}.`);
      renderRoles(container, { user, onPastoralsChanged });
    });
  });

  container.querySelectorAll('[data-edit-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = dataService.getRoleById(btn.dataset.editRole);
      if (role && canManagePastoral(user, role.pastoralId)) {
        openRoleModal(role, activePastoral, () => renderRoles(container, { user, onPastoralsChanged }));
      }
    });
  });

  container.querySelectorAll('[data-delete-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = dataService.getRoleById(btn.dataset.deleteRole);
      if (!role || !canManagePastoral(user, role.pastoralId)) return;
      if (!confirm('Deseja realmente excluir esta função?')) return;
      dataService.deleteRole(role.id);
      showToast('Função excluída.');
      renderRoles(container, { user, onPastoralsChanged });
    });
  });

  refreshIcons();
}

function openPastoralModal(existing, onSaved) {
  const activeUsers = dataService.getUsers().filter((u) => u.status === 'Ativo' && !u.isGeneralAdmin);
  const currentCoordIds = new Set(
    existing
      ? activeUsers
          .filter((u) => getUserMemberships(u).some((m) => m.pastoralId === existing.id && m.role === 'Coordenador'))
          .map((u) => u.id)
      : [],
  );

  openModal({
    title: existing ? 'Editar Pastoral' : 'Cadastrar Nova Pastoral',
    maxWidth: 'max-w-xl',
    bodyHtml: `
      <form id="pastoral-form" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome Completo *</label>
            <input name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Pastoral da Catequese"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome Curto (Badge) *</label>
            <input name="shortName" required value="${escapeHtml(existing?.shortName || '')}" placeholder="Ex: Catequese"
              class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1.5">Cor de Identificação *</label>
          <div class="flex items-center gap-3 flex-wrap">
            <input id="pastoral-color-input" name="color" type="color" value="${escapeHtml(existing?.color || '#B45309')}"
              class="w-11 h-10 rounded-lg border border-[#E6DACE] cursor-pointer p-0.5 bg-white">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${COLOR_SWATCHES.map(
                (hex) => `
                <button type="button" data-swatch="${hex}" class="w-6 h-6 rounded-full border-2 border-white shadow-xs hover:scale-110 transition" style="background-color:${hex};" title="${hex}"></button>
              `,
              ).join('')}
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Descrição</label>
          <textarea name="description" rows="2" placeholder="Missão e atuação desta pastoral na paróquia..."
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.description || '')}</textarea>
        </div>

        <div class="pt-2 border-t border-[#E6DACE]/80">
          <label class="block text-xs font-bold uppercase tracking-wider text-[#3E2723] mb-1.5">Coordenadores desta Pastoral (opcional)</label>
          <div class="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E6DACE]">
            ${activeUsers
              .map(
                (u) => `
              <label class="flex items-center gap-2.5 text-xs font-medium text-[#3E2723] cursor-pointer">
                <input type="checkbox" name="coordUserIds" value="${u.id}" ${currentCoordIds.has(u.id) ? 'checked' : ''} class="rounded text-[#B45309]">
                <span>${escapeHtml(u.name)} <span class="text-[#8D6E63]">(${escapeHtml(u.email)})</span></span>
              </label>
            `,
              )
              .join('')}
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-pastoral-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Pastoral</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const colorInput = bodyEl.querySelector('#pastoral-color-input');
      bodyEl.querySelectorAll('[data-swatch]').forEach((btn) => {
        btn.addEventListener('click', () => {
          colorInput.value = btn.dataset.swatch;
        });
      });

      bodyEl.querySelector('#cancel-pastoral-btn').addEventListener('click', closeModal);

      bodyEl.querySelector('#pastoral-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const saved = dataService.savePastoral({
          id: existing?.id,
          name: String(fd.get('name')).trim(),
          shortName: String(fd.get('shortName')).trim(),
          color: fd.get('color') || '#B45309',
          description: String(fd.get('description') || '').trim(),
          active: true,
        });

        // Sincroniza coordenadores selecionados na pastoral
        const selectedCoordIds = new Set(fd.getAll('coordUserIds'));
        dataService.getUsers().forEach((u) => {
          if (u.isGeneralAdmin) return;
          const mems = getUserMemberships(u);
          const idx = mems.findIndex((m) => m.pastoralId === saved.id);
          if (selectedCoordIds.has(u.id)) {
            if (idx >= 0) mems[idx] = { ...mems[idx], role: 'Coordenador' };
            else mems.push({ pastoralId: saved.id, role: 'Coordenador' });
            dataService.saveUser({ ...u, memberships: mems });
          } else if (idx >= 0 && mems[idx].role === 'Coordenador') {
            mems[idx] = { ...mems[idx], role: 'Membro' };
            dataService.saveUser({ ...u, memberships: mems });
          }
        });

        closeModal();
        showToast(existing ? 'Pastoral atualizada!' : `Pastoral "${saved.shortName}" criada!`);
        onSaved(saved);
      });
    },
  });
}

function openRoleModal(existing, pastoral, onSaved) {
  openModal({
    title: existing ? `Editar Função — ${pastoral.shortName}` : `Nova Função — ${pastoral.shortName}`,
    bodyHtml: `
      <form id="role-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome da Função *</label>
          <input name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Salmista, Violão, Missal..."
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Descrição / Orientações</label>
          <textarea name="description" rows="3" placeholder="Breve descrição da função nesta pastoral..."
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <label class="inline-flex items-center gap-2 text-sm font-medium text-[#3E2723] cursor-pointer">
          <input name="active" type="checkbox" ${(existing?.active ?? true) ? 'checked' : ''} class="rounded text-[#B45309]">
          Função ativa (disponível nas escalas)
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-role-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Função</button>
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
          pastoralId: pastoral.id,
          name: String(fd.get('name')).trim(),
          description: String(fd.get('description') || '').trim(),
          active: fd.get('active') === 'on',
        });
        closeModal();
        showToast(existing ? 'Função atualizada!' : 'Função adicionada à pastoral!');
        onSaved();
      });
    },
  });
}
