/**
 * Módulo / Modal "Meu Perfil" (Autonomia do Usuário)
 * - Acessível ao clicar no nome/avatar no cabeçalho (todos os perfis)
 * - Aba 1: Dados Pessoais editáveis (Nome, E-mail, Telefone/WhatsApp, Data de Nascimento)
 *   mantendo pastorais, cargos e status bloqueados para edição apenas pela Coordenação
 * - Aba 2: Troca de Senha (Senha Atual, Nova Senha, Confirmar Nova Senha) com validação
 */

import { dataService } from '../services/dataService.js';
import {
  closeModal,
  escapeHtml,
  getInitials,
  getStatusBadgeClass,
  getUserMemberships,
  getUserRoleSummary,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

export function openMyProfileModal(user, { onProfileUpdated } = {}) {
  const freshUser = dataService.getUserById(user.id) || user;
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const memberships = getUserMemberships(freshUser);
  const roleSummary = getUserRoleSummary(freshUser, pastorals);

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
            Dados Pessoais
          </button>
          <button type="button" data-profile-tab="password"
            class="profile-tab-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#5D4037] border border-[#E6DACE] hover:bg-[#FAF6F0] transition">
            <i data-lucide="key-round" class="w-3.5 h-3.5"></i>
            Trocar Senha
          </button>
        </div>

        <!-- Painel 1: Dados Pessoais -->
        <form id="profile-personal-form" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Nome de Exibição *</label>
            <input name="name" required value="${escapeHtml(freshUser.name)}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">E-mail *</label>
              <input name="email" type="email" required value="${escapeHtml(freshUser.email)}"
                class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Telefone / WhatsApp *</label>
              <input name="phone" required value="${escapeHtml(freshUser.phone || '')}" placeholder="(11) 99999-0000"
                class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Data de Nascimento *</label>
            <input name="birthDate" type="date" required value="${escapeHtml(freshUser.birthDate || '')}"
              class="w-full sm:w-1/2 px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
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
        const updated = dataService.updateOwnProfile(freshUser.id, {
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          birthDate: fd.get('birthDate'),
        });
        if (updated) {
          closeModal();
          showToast('Seus dados pessoais foram atualizados com sucesso!');
          onProfileUpdated?.(updated);
        }
      });

      passwordForm.addEventListener('submit', (e) => {
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

        const result = dataService.updateOwnPassword(freshUser.id, currentPassword, newPassword);
        if (!result.ok) {
          passErr.textContent = result.error;
          passErr.classList.remove('hidden');
          return;
        }

        passErr.classList.add('hidden');
        closeModal();
        showToast('Senha alterada com sucesso!');
        onProfileUpdated?.(result.user);
      });
    },
  });
}
