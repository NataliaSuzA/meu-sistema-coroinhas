/**
 * Módulo 9: Avisos Multi-Pastoral
 * - Feed cronológico com opção de "Fixado no Início"
 * - Isolamento: Coordenadores publicam, editam, fixam e excluem avisos APENAS
 *   das pastorais que coordenam (Coordenação Geral pode publicar avisos Paroquiais).
 */

import { dataService } from '../services/dataService.js';
import {
  canManagePastoral,
  closeModal,
  escapeHtml,
  formatDateTimeBR,
  getCoordinatedPastoralIds,
  getMemberPastoralIds,
  isAnyCoordinator,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderPastoralPill,
  showToast,
} from '../utils/helpers.js';

export function renderNotices(container, { user }) {
  const anyCoord = isAnyCoordinator(user);
  const generalAdmin = isGeneralAdmin(user);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const accessibleIds = new Set(getMemberPastoralIds(user, pastorals));
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const notices = dataService
    .getNotices()
    .filter((n) => generalAdmin || n.pastoralId === 'all' || accessibleIds.has(n.pastoralId))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Mural de Avisos</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Comunicados paroquiais e das pastorais em que você participa. Avisos fixados aparecem em destaque no Início.
          </p>
        </div>
        ${
          anyCoord
            ? `
          <button id="btn-new-notice" type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition shrink-0">
            <i data-lucide="megaphone" class="w-4 h-4 text-amber-400"></i>
            Novo Aviso
          </button>
        `
            : ''
        }
      </div>

      ${
        notices.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center text-[#6D4C41]">
          Nenhum aviso publicado no momento.
        </div>
      `
          : `
        <div class="space-y-4">
          ${notices
            .map((not) => {
              const author = userMap[not.authorId]?.name || 'Coordenação';
              const canManage = generalAdmin || canManagePastoral(user, not.pastoralId);
              const pastoral = not.pastoralId === 'all' ? null : pastoralMap[not.pastoralId];
              return `
                <article class="rounded-2xl border-2 ${
                  not.pinned
                    ? 'border-amber-400 bg-gradient-to-r from-amber-50/75 via-[#FDFBF7] to-white shadow-sm'
                    : 'border-[#E6DACE] bg-white'
                } p-5 transition">
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div class="space-y-1.5 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        ${
                          not.pinned
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#D97706] text-white">
                                <i data-lucide="pin" class="w-3 h-3"></i>
                                Fixado no Início
                              </span>`
                            : ''
                        }
                        ${renderPastoralPill(pastoral, { compact: true })}
                        <span class="text-xs text-[#8D6E63] font-medium">${escapeHtml(formatDateTimeBR(not.createdAt))}</span>
                      </div>
                      <h4 class="text-base sm:text-lg font-extrabold text-[#3E2723]">${escapeHtml(not.title)}</h4>
                      <p class="text-sm text-[#4E342E] leading-relaxed whitespace-pre-line">${escapeHtml(not.content)}</p>
                      <p class="text-xs text-[#8D6E63] pt-1">Publicado por <strong class="text-[#5D4037]">${escapeHtml(author)}</strong></p>
                    </div>

                    ${
                      canManage
                        ? `
                      <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" data-pin-notice="${not.id}"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            not.pinned
                              ? 'bg-amber-100 text-[#92400E] border-amber-300 hover:bg-amber-200'
                              : 'bg-[#FAF6F0] text-[#5D4037] border-[#E6DACE] hover:bg-amber-50 hover:text-[#92400E] hover:border-amber-300'
                          }">
                          <i data-lucide="pin" class="w-3.5 h-3.5"></i>
                          ${not.pinned ? 'Desafixar' : 'Fixar no Início'}
                        </button>
                        <button type="button" data-edit-notice="${not.id}" title="Editar aviso"
                          class="p-2 rounded-lg text-[#8D6E63] hover:text-[#3E2723] hover:bg-[#F5EFE6] transition">
                          <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button type="button" data-delete-notice="${not.id}" title="Excluir aviso"
                          class="p-2 rounded-lg text-[#8D6E63] hover:text-red-700 hover:bg-red-50 transition">
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                      </div>
                    `
                        : ''
                    }
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `
      }
    </div>
  `;

  container.querySelector('#btn-new-notice')?.addEventListener('click', () => {
    openNoticeModal(null, user, () => renderNotices(container, { user }));
  });

  container.querySelectorAll('[data-pin-notice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.togglePinNotice(btn.dataset.pinNotice);
      showToast('Destaque na tela inicial atualizado!');
      renderNotices(container, { user });
    });
  });

  container.querySelectorAll('[data-edit-notice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const not = dataService.getNotices().find((n) => n.id === btn.dataset.editNotice);
      if (not) openNoticeModal(not, user, () => renderNotices(container, { user }));
    });
  });

  container.querySelectorAll('[data-delete-notice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja excluir este aviso?')) return;
      dataService.deleteNotice(btn.dataset.deleteNotice);
      showToast('Aviso excluído.');
      renderNotices(container, { user });
    });
  });

  refreshIcons();
}

function openNoticeModal(existing, user, onSaved) {
  const pastorals = dataService.getActivePastorals();
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const managedPastorals = pastorals.filter((p) => managedIds.has(p.id));
  const generalAdmin = isGeneralAdmin(user);

  openModal({
    title: existing ? 'Editar Aviso' : 'Publicar Novo Aviso',
    bodyHtml: `
      <form id="notice-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Pastoral de Destino *</label>
          <select name="pastoralId" class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] bg-white text-sm outline-none focus:border-[#B45309]">
            ${generalAdmin ? `<option value="all" ${existing?.pastoralId === 'all' ? 'selected' : ''}>Todas as Pastorais (Aviso Paroquial)</option>` : ''}
            ${managedPastorals
              .map((p) => `<option value="${p.id}" ${existing?.pastoralId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Título do Comunicado *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Ensaio para a Festa de Santa Teresa"
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Mensagem *</label>
          <textarea name="content" rows="4" required placeholder="Escreva o comunicado..."
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.content || '')}</textarea>
        </div>
        <label class="inline-flex items-center gap-2 text-sm font-medium text-[#3E2723] cursor-pointer">
          <input name="pinned" type="checkbox" ${existing?.pinned ? 'checked' : ''} class="rounded text-[#B45309]">
          Fixar este aviso em destaque no Início (Dashboard)
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-notice-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Publicar Aviso</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-notice-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#notice-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        dataService.saveNotice({
          id: existing?.id,
          pastoralId: fd.get('pastoralId'),
          title: String(fd.get('title')).trim(),
          content: String(fd.get('content')).trim(),
          authorId: existing?.authorId || user.id,
          pinned: fd.get('pinned') === 'on',
        });
        closeModal();
        showToast(existing ? 'Aviso atualizado!' : 'Aviso publicado com sucesso!');
        onSaved();
      });
    },
  });
}
