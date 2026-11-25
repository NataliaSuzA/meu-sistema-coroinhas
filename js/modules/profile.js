/**
 * Módulo / Modal "Meu Perfil" (Autonomia do Usuário + Contas Familiares)
 * - Acessível ao clicar no nome/avatar no cabeçalho (todos os perfis)
 * - Aba 1: Dados Pessoais editáveis (E-mail, Telefone/WhatsApp do Responsável,
 *   e 1 ou mais integrantes via "+ Adicionar Irmão / Integrante" com Nome e Data de Nascimento),
 *   mantendo pastorais, cargos e status bloqueados para edição apenas pela Coordenação
 * - Aba 2: Troca de Senha (Senha Atual, Nova Senha, Confirmar Nova Senha) com validação
 */

import { dataService } from '../services/dataService.js';
import { authService } from '../services/authService.js';
import {
  closeModal,
  escapeHtml,
  getAccountMembers,
  getInitials,
  getStatusBadgeClass,
  getUserMemberships,
  getUserRoleSummary,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderFamilyAccountBadge,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

export function openMyProfileModal(user, { onProfileUpdated } = {}) {
  const freshUser = dataService.getUserById(user.id) || user;
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const memberships = getUserMemberships(freshUser);
  const roleSummary = getUserRoleSummary(freshUser, pastorals);
  const initialMembers = getAccountMembers(freshUser);

  openModal({
    title: 'Meu Perfil & Segurança',
    maxWidth: 'max-w-2xl',
    bodyHtml: `
      <div class="space-y-5">
        <!-- Cabeçalho do Perfil -->
        <div class="flex items-center gap-4 p-4 rounded-2xl bg-[#FAF6F0] border border-[#E6DACE]">
          <div class="w-14 h-14 rounded-2xl bg-[#3E2723] text-amber-400 font-extrabold text-lg flex items-center justify-center shrink-0 shadow-sm">
            ${escapeHtml(getInitials(freshUser.name))}
          </div>
          <div class="min-w-0">
            <h4 class="text-base font-extrabold text-[#3E2723] truncate">${escapeHtml(freshUser.name)}</h4>
            <p class="text-xs text-[#6D4C41] truncate">${escapeHtml(freshUser.email)}</p>
            <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleSummary.badgeClass}">
                ${escapeHtml(roleSummary.label)}
              </span>
              ${renderFamilyAccountBadge(freshUser, { compact: true })}
              <span class="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(freshUser.status)}">
                ${escapeHtml(freshUser.status)}
              </span>
            </div>
          </div>
        </div>

        <!-- Abas internas: Dados Pessoais / Alterar Senha -->
        <div class="flex items-center gap-2 border-b border-[#E6DACE] pb-2">
          <button type="button" data-profile-tab="personal"
            class="profile-tab-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#3E2723] text-white transition">
            <i data-lucide="user-cog" class="w-3.5 h-3.5 text-amber-400"></i>
            Dados Pessoais &amp; Integrantes
          </button>
          <button type="button" data-profile-tab="password"
            class="profile-tab-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#5D4037] border border-[#E6DACE] hover:bg-[#FAF6F0] transition">
            <i data-lucide="key-round" class="w-3.5 h-3.5"></i>
            Trocar Senha
          </button>
        </div>

        <!-- Painel 1: Dados Pessoais -->
        <form id="profile-personal-form" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">E-mail de Acesso *</label>
              <input name="email" type="email" required value="${escapeHtml(freshUser.email)}"
                class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Telefone / WhatsApp *</label>
              <input name="phone" required value="${escapeHtml(freshUser.phone || '')}" placeholder="(11) 99999-0000"
                class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
            </div>
          </div>

          <!-- Integrantes / Irmãos da Conta -->
          <div class="p-4 rounded-xl bg-amber-50/50 border border-amber-300/80 space-y-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span class="text-xs font-extrabold uppercase tracking-wider text-[#3E2723] flex items-center gap-1.5">
                  <i data-lucide="users" class="w-3.5 h-3.5 text-[#B45309]"></i>
                  Integrantes da Conta
                </span>
                <p class="text-[11px] text-[#6D4C41]">Irmãos que compartilham este login podem ser cadastrados aqui com datas de nascimento próprias.</p>
              </div>
              <button id="profile-add-member-btn" type="button"
                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#B45309] hover:bg-[#92400E] text-white transition">
                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                + Adicionar Irmão / Integrante
              </button>
            </div>

            <div id="profile-family-title-wrap" class="${initialMembers.length > 1 ? '' : 'hidden'}">
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome de Exibição da Conta Familiar</label>
              <input name="accountName" value="${escapeHtml(initialMembers.length > 1 ? freshUser.name : '')}"
                placeholder="Ex: Família Silva (Pedro Lucas & João Miguel)"
                class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm focus:border-[#B45309] outline-none">
            </div>

            <div id="profile-members-list" class="space-y-2.5"></div>
          </div>

          <!-- Campos bloqueados (somente leitura) -->
          <div class="p-4 rounded-xl bg-[#FAF6F0] border border-[#E6DACE] space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-[#5D4037] flex items-center gap-1.5">
                <i data-lucide="lock" class="w-3.5 h-3.5 text-[#B45309]"></i>
                Vínculos Pastorais, Cargos e Status
              </span>
              <span class="text-[10px] font-bold text-[#8D6E63]">Somente leitura</span>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              ${
                isGeneralAdmin(freshUser)
                  ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-[#92400E] border border-amber-300">Coordenação Geral (Admin Paroquial)</span>`
                  : memberships.length === 0
                    ? `<span class="text-xs text-[#8D6E63] italic">Nenhuma pastoral vinculada.</span>`
                    : memberships
                        .map((m) => {
                          const p = pastoralMap[m.pastoralId];
                          return `<span class="inline-flex items-center gap-1">${renderPastoralPill(p, { compact: true })}<span class="text-[10px] font-bold text-[#5D4037] mr-1">(${escapeHtml(m.role)})</span></span>`;
                        })
                        .join('')
              }
            </div>
            <p class="text-[11px] text-[#8D6E63]">Apenas a Coordenação pode alterar suas pastorais, cargos ou status no sistema.</p>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="close-profile-btn px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Fechar</button>
            <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">
              Salvar Dados Pessoais
            </button>
          </div>
        </form>

        <!-- Painel 2: Troca de Senha -->
        <form id="profile-password-form" class="hidden space-y-4">
          <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-[#4E342E]">
            <strong>Segurança da conta:</strong> Informe sua senha atual e escolha uma nova senha com no mínimo 6 caracteres.
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Senha Atual *</label>
            <input name="currentPassword" type="password" required placeholder="Digite sua senha atual"
              class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nova Senha *</label>
              <input name="newPassword" type="password" required minlength="6" placeholder="Mínimo 6 caracteres"
                class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Confirmar Nova Senha *</label>
              <input name="confirmPassword" type="password" required minlength="6" placeholder="Repita a nova senha"
                class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
            </div>
          </div>

          <p id="profile-pass-error" class="hidden text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2"></p>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="close-profile-btn px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
            <button type="submit" class="px-5 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold transition">
              Atualizar Senha
            </button>
          </div>
        </form>
      </div>
    `,
    onMount(bodyEl) {
      const personalForm = bodyEl.querySelector('#profile-personal-form');
      const passwordForm = bodyEl.querySelector('#profile-password-form');
      const passErr = bodyEl.querySelector('#profile-pass-error');
      const membersList = bodyEl.querySelector('#profile-members-list');
      const titleWrap = bodyEl.querySelector('#profile-family-title-wrap');

      function refreshProfileRows() {
        const rows = Array.from(membersList.querySelectorAll('.pf-member-row'));
        titleWrap.classList.toggle('hidden', rows.length <= 1);
        rows.forEach((row, idx) => {
          const lbl = row.querySelector('.pf-idx-label');
          if (lbl) lbl.textContent = rows.length > 1 ? `Integrante ${idx + 1}` : 'Dados do Titular';
          const rm = row.querySelector('.pf-remove-btn');
          if (rm) rm.classList.toggle('hidden', rows.length <= 1);
        });
      }

      function addProfileMemberRow(preset = { id: '', name: '', birthDate: '' }) {
        const row = document.createElement('div');
        row.className = 'pf-member-row p-3 rounded-xl bg-white border border-[#E6DACE] space-y-2';
        row.dataset.memberId = preset.id || '';
        row.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="pf-idx-label text-[11px] font-extrabold uppercase tracking-wider text-[#B45309]">Integrante</span>
            <button type="button" class="pf-remove-btn inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-red-700 hover:bg-red-50 transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              Remover
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div class="sm:col-span-7">
              <label class="block text-[11px] font-bold text-[#5D4037] mb-1">Nome Completo / de Exibição *</label>
              <input type="text" required class="pf-name w-full px-3 py-2 rounded-lg border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"
                value="${escapeHtml(preset.name || '')}" placeholder="Nome do integrante">
            </div>
            <div class="sm:col-span-5">
              <label class="block text-[11px] font-bold text-[#5D4037] mb-1">Data de Nascimento *</label>
              <input type="date" required class="pf-birth w-full px-3 py-2 rounded-lg border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none"
                value="${escapeHtml(preset.birthDate || '')}">
            </div>
          </div>
        `;
        row.querySelector('.pf-remove-btn').addEventListener('click', () => {
          row.remove();
          refreshProfileRows();
        });
        membersList.appendChild(row);
        refreshProfileRows();
        refreshIcons();
      }

      initialMembers.forEach((m) => addProfileMemberRow(m));

      bodyEl.querySelector('#profile-add-member-btn').addEventListener('click', () => {
        addProfileMemberRow({ id: '', name: '', birthDate: '' });
      });

      bodyEl.querySelectorAll('.profile-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const isPersonal = btn.dataset.profileTab === 'personal';
          personalForm.classList.toggle('hidden', !isPersonal);
          passwordForm.classList.toggle('hidden', isPersonal);
          bodyEl.querySelectorAll('.profile-tab-btn').forEach((b) => {
            const active = b === btn;
            b.className = `profile-tab-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              active
                ? 'bg-[#3E2723] text-white'
                : 'bg-white text-[#5D4037] border border-[#E6DACE] hover:bg-[#FAF6F0]'
            }`;
          });
          refreshIcons();
        });
      });

      bodyEl.querySelectorAll('.close-profile-btn').forEach((btn) => {
        btn.addEventListener('click', closeModal);
      });

      personalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const familyMembers = [];
        membersList.querySelectorAll('.pf-member-row').forEach((row) => {
          const name = row.querySelector('.pf-name').value.trim();
          const birthDate = row.querySelector('.pf-birth').value;
          if (name) {
            familyMembers.push({
              id: row.dataset.memberId || undefined,
              name,
              birthDate,
            });
          }
        });
        if (familyMembers.length === 0) {
          showToast('Informe pelo menos um integrante.', 'error');
          return;
        }
        const customName = String(fd.get('accountName') || '').trim();
        const updated = dataService.updateOwnProfile(freshUser.id, {
          name: familyMembers.length > 1 ? customName : familyMembers[0].name,
          email: fd.get('email'),
          phone: fd.get('phone'),
          birthDate: familyMembers[0].birthDate,
          familyMembers,
        });
        if (updated) {
          closeModal();
          showToast('Seus dados pessoais e integrantes foram atualizados!');
          onProfileUpdated?.(updated);
        }
      });

      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const currentPassword = String(fd.get('currentPassword'));
        const newPassword = String(fd.get('newPassword'));
        const confirmPassword = String(fd.get('confirmPassword'));

        if (newPassword.length < 6) {
          passErr.textContent = 'A nova senha deve conter pelo menos 6 caracteres.';
          passErr.classList.remove('hidden');
          return;
        }
        if (newPassword !== confirmPassword) {
          passErr.textContent = 'A nova senha e a confirmação não conferem.';
          passErr.classList.remove('hidden');
          return;
        }

        const submitBtn = passwordForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        const result = await authService.updatePasswordForUser(freshUser, currentPassword, newPassword);
        if (submitBtn) submitBtn.disabled = false;

        if (!result.ok) {
          passErr.textContent = result.error;
          passErr.classList.remove('hidden');
          return;
        }

        passErr.classList.add('hidden');
        closeModal();
        showToast('Senha atualizada com sucesso no Firebase!');
        onProfileUpdated?.(result.user);
      });
    },
  });
}
