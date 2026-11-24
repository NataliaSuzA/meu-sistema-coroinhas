/**
 * Módulo 9: Avisos
 * Feed cronológico de comunicados da coordenação com opção de marcar
 * um aviso como "Fixado no Início".
 */

import { dataService } from '../services/dataService.js';
import {
  closeModal,
  escapeHtml,
  formatDateTimeBR,
  isCoordinator,
  openModal,
  refreshIcons,
  showToast,
} from '../utils/helpers.js';

export function renderNotices(container, { user }) {
  const coord = isCoordinator(user);
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const notices = dataService
    .getNotices()
    .slice()
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Mural de Avisos</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            Comunicados oficiais da coordenação. O aviso fixado aparece em destaque na tela inicial.
          </p>
        </div>
        ${
          coord
            ? `
          <button id="btn-new-notice" type="button"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold shadow-sm transition">
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
        <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          Nenhum aviso publicado no momento.
        </div>
      `
          : `
        <div class="space-y-4">
          ${notices
            .map((not) => {
              const author = userMap[not.authorId]?.name || 'Coordenação';
              return `
                <article class="rounded-2xl border-2 ${
                  not.pinned
                    ? 'border-amber-300 bg-gradient-to-r from-amber-50/70 via-white to-white shadow-sm'
                    : 'border-slate-200/90 bg-white'
                } p-5 transition">
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div class="space-y-1.5 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        ${
                          not.pinned
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500 text-white">
                                <i data-lucide="pin" class="w-3 h-3"></i>
                                Fixado no Início
                              </span>`
                            : ''
                        }
                        <span class="text-xs text-slate-500 font-medium">${escapeHtml(formatDateTimeBR(not.createdAt))}</span>
                      </div>
                      <h4 class="text-base sm:text-lg font-extrabold text-[#0F172A]">${escapeHtml(not.title)}</h4>
                      <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-line">${escapeHtml(not.content)}</p>
                      <p class="text-xs text-slate-500 pt-1">Publicado por <strong class="text-slate-700">${escapeHtml(author)}</strong></p>
                    </div>

                    ${
                      coord
                        ? `
                      <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" data-pin-notice="${not.id}"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            not.pinned
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                          }">
                          <i data-lucide="pin" class="w-3.5 h-3.5"></i>
                          ${not.pinned ? 'Desafixar' : 'Fixar no Início'}
                        </button>
                        <button type="button" data-edit-notice="${not.id}" title="Editar aviso"
                          class="p-2 rounded-lg text-slate-400 hover:text-[#1E3A8A] hover:bg-blue-50 transition">
                          <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button type="button" data-delete-notice="${not.id}" title="Excluir aviso"
                          class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
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
  openModal({
    title: existing ? 'Editar Aviso' : 'Publicar Novo Aviso',
    bodyHtml: `
      <form id="notice-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Título do Comunicado *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Ensaio para a Festa da Padroeira"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Mensagem *</label>
          <textarea name="content" rows="4" required placeholder="Escreva o comunicado para os membros..."
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">${escapeHtml(existing?.content || '')}</textarea>
        </div>
        <label class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
          <input name="pinned" type="checkbox" ${existing?.pinned ? 'checked' : ''} class="rounded text-amber-600">
          Fixar este aviso em destaque no Início (Dashboard)
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-notice-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">Publicar Aviso</button>
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
