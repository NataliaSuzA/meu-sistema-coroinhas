/**
 * Módulo 9: Avisos Segmentados por Pastoral (Vínculo N:N Estrito)
 * - Seleção obrigatória de 1 ou mais pastorais (listando apenas pastorais coordenadas;
 *   "Toda a Paróquia" exclusivo da Coordenação Geral).
 * - Visibilidade estrita: usuário só visualiza avisos de suas pastorais ou "Toda a Paróquia".
 * - Exibe tags coloridas de todas as pastorais vinculadas + filtro por pastoral no topo.
 */

import { dataService } from '../services/dataService.js';
import {
  canManageAnyOfPastorals,
  closeModal,
  escapeHtml,
  formatDateTimeBR,
  getCoordinatedPastoralIds,
  getMemberPastoralIds,
  hasPermission,
  isGeneralAdmin,
  isPastoralScopedItemVisible,
  openModal,
  refreshIcons,
  renderPastoralPillsList,
  showToast,
} from '../utils/helpers.js';

let noticePastoralFilter = 'all';

export function renderNotices(container, { user, permissions }) {
  const generalAdmin = isGeneralAdmin(user);
  const canPublish = hasPermission(user, 'notices_publish', permissions);
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const accessibleIds = getMemberPastoralIds(user, pastorals);
  const accessiblePastorals = pastorals.filter((p) => accessibleIds.includes(p.id));
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  if (noticePastoralFilter !== 'all' && !accessibleIds.includes(noticePastoralFilter)) {
    noticePastoralFilter = 'all';
  }

  const visibleNotices = dataService
    .getNotices()
    .filter((n) => isPastoralScopedItemVisible(n.pastoralIds, user, pastorals))
    .filter((n) => {
      if (noticePastoralFilter === 'all') return true;
      const pids = n.pastoralIds || ['all'];
      return pids.includes('all') || pids.includes(noticePastoralFilter);
    })
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
            Comunicados paroquiais e das pastorais das quais você faz parte.
          </p>
        </div>
        ${
          canPublish
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

      <!-- Filtro por Pastoral -->
      <div class="flex items-center gap-2 flex-wrap">
        <button type="button" data-notice-filter="all"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
            noticePastoralFilter === 'all' ? 'bg-[#3E2723] text-white border-[#3E2723]' : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
          }">Todas as minhas pastorais</button>
        ${accessiblePastorals
          .map(
            (p) => `
          <button type="button" data-notice-filter="${p.id}"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              noticePastoralFilter === p.id ? 'bg-[#3E2723] text-white border-[#3E2723]' : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
            }">
            <span class="w-2 h-2 rounded-full" style="background-color:${escapeHtml(p.color)};"></span>
            ${escapeHtml(p.shortName)}
          </button>
        `,
          )
          .join('')}
      </div>

      ${
        visibleNotices.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center text-[#6D4C41]">
          Nenhum aviso publicado para este filtro no momento.
        </div>
      `
          : `
        <div class="space-y-4">
          ${visibleNotices
            .map((not) => {
              const author = userMap[not.authorId]?.name || 'Coordenação';
              const canManage = canPublish && (generalAdmin || canManageAnyOfPastorals(user, not.pastoralIds));
              return `
                <article class="rounded-2xl border-2 ${
                  not.pinned
                    ? 'border-amber-400 bg-gradient-to-r from-amber-50/75 via-[#FDFBF7] to-white shadow-sm'
                    : 'border-[#E6DACE] bg-white'
                } p-5 transition">
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div class="space-y-1.5 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${
                          not.pinned
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#D97706] text-white">
                                <i data-lucide="pin" class="w-3 h-3"></i>
                                Fixado no Início
                              </span>`
                            : ''
                        }
                        ${renderPastoralPillsList(not.pastoralIds, pastoralMap, { compact: true })}
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

  container.querySelectorAll('[data-notice-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      noticePastoralFilter = btn.dataset.noticeFilter;
      renderNotices(container, { user, permissions });
    });
  });

  container.querySelector('#btn-new-notice')?.addEventListener('click', () => {
    openNoticeModal(null, user, () => renderNotices(container, { user, permissions }));
  });

  container.querySelectorAll('[data-pin-notice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.togglePinNotice(btn.dataset.pinNotice);
      showToast('Destaque na tela inicial atualizado!');
      renderNotices(container, { user, permissions });
    });
  });

  container.querySelectorAll('[data-edit-notice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const not = dataService.getNotices().find((n) => n.id === btn.dataset.editNotice);
      if (not) openNoticeModal(not, user, () => renderNotices(container, { user, permissions }));
    });
  });

  container.querySelectorAll('[data-delete-notice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja excluir este aviso?')) return;
      dataService.deleteNotice(btn.dataset.deleteNotice);
      showToast('Aviso excluído.');
      renderNotices(container, { user, permissions });
    });
  });

  refreshIcons();
}

function openNoticeModal(existing, user, onSaved) {
  const generalAdmin = isGeneralAdmin(user);
  const pastorals = dataService.getActivePastorals();
  const managedIds = new Set(getCoordinatedPastoralIds(user, pastorals));
  const selectablePastorals = pastorals.filter((p) => managedIds.has(p.id));
  const initialTargets = existing?.pastoralIds || (generalAdmin ? ['all'] : selectablePastorals.slice(0, 1).map((p) => p.id));

  openModal({
    title: existing ? 'Editar Aviso' : 'Publicar Novo Aviso Segmentado',
    bodyHtml: `
      <form id="notice-form" class="space-y-4">
        <div class="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6DACE] space-y-2">
          <label class="block text-xs font-bold uppercase tracking-wider text-[#3E2723]">Pastorais de Destino (Obrigatório) *</label>
          <p class="text-[11px] text-[#6D4C41]">O comunicado ficará visível apenas para as pastorais marcadas (incluindo no mural do Início).</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            ${
              generalAdmin
                ? `
              <label class="inline-flex items-center gap-2 text-xs font-extrabold text-[#92400E] cursor-pointer sm:col-span-2">
                <input id="notice-target-all" type="checkbox" name="pastoralIds" value="all" ${initialTargets.includes('all') ? 'checked' : ''} class="rounded text-[#B45309]">
                Toda a Paróquia (aviso geral)
              </label>
            `
                : ''
            }
            ${selectablePastorals
              .map(
                (p) => `
              <label class="inline-flex items-center gap-2 text-xs font-semibold text-[#3E2723] cursor-pointer">
                <input type="checkbox" class="notice-target-pid rounded text-[#B45309]" name="pastoralIds" value="${p.id}" ${initialTargets.includes(p.id) ? 'checked' : ''}>
                <span class="w-2 h-2 rounded-full" style="background-color:${escapeHtml(p.color)};"></span>
                ${escapeHtml(p.shortName)}
              </label>
            `,
              )
              .join('')}
          </div>
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
      const allChk = bodyEl.querySelector('#notice-target-all');
      const pidChks = bodyEl.querySelectorAll('.notice-target-pid');
      if (allChk) {
        allChk.addEventListener('change', () => {
          if (allChk.checked) pidChks.forEach((c) => { c.checked = false; });
        });
        pidChks.forEach((c) => {
          c.addEventListener('change', () => {
            if (c.checked) allChk.checked = false;
          });
        });
      }

      bodyEl.querySelector('#cancel-notice-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#notice-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const pastoralIds = fd.getAll('pastoralIds');
        if (pastoralIds.length === 0) {
          showToast('Selecione obrigatoriamente pelo menos uma pastoral de destino.', 'error');
          return;
        }
        dataService.saveNotice({
          id: existing?.id,
          pastoralIds,
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
