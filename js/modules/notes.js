/**
 * Módulo 6: Bloco de Notas (Mural Compartilhado)
 * Mural de cards com controle de visibilidade:
 * Todos, Apenas Coordenadores, Apenas Acólitos, Apenas Coroinhas ou seleção múltipla personalizada.
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

let visibilityFilter = 'all';

function isNoteVisibleToUser(note, user) {
  if (isCoordinator(user)) return true;
  if (note.authorId === user.id) return true;
  const cats = note.visibleCategories || [];
  return cats.includes(user.category);
}

function getVisibilityBadge(note) {
  const mode = note.visibilityMode || 'Todos';
  if (mode === 'Todos') {
    return { label: 'Visível para Todos', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (mode === 'Personalizado') {
    const label = (note.visibleCategories || []).join(', ') || 'Personalizado';
    return { label: `Restrito: ${label}`, cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  return { label: mode, cls: 'bg-blue-50 text-[#1E3A8A] border-blue-200' };
}

export function renderNotes(container, { user }) {
  const coord = isCoordinator(user);
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const allVisibleNotes = dataService
    .getNotes()
    .filter((n) => isNoteVisibleToUser(n, user));

  const filtered = allVisibleNotes.filter((n) => {
    if (visibilityFilter === 'all') return true;
    if (visibilityFilter === 'mine') return n.authorId === user.id;
    return (n.visibleCategories || []).includes(visibilityFilter);
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#0F172A]">Bloco de Notas &amp; Orientações</h3>
          <p class="text-sm text-slate-500 mt-0.5">
            Mural compartilhado de anotações, checklists de sacristia e orientações litúrgicas.
          </p>
        </div>
        <button id="btn-new-note" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold shadow-sm transition">
          <i data-lucide="sticky-note" class="w-4 h-4 text-amber-400"></i>
          Nova Anotação
        </button>
      </div>

      <!-- Filtros -->
      <div class="flex items-center gap-2 flex-wrap">
        ${[
          { id: 'all', label: 'Todas visíveis' },
          { id: 'mine', label: 'Minhas anotações' },
          ...(coord
            ? [
                { id: 'Coordenador', label: 'Coordenadores' },
                { id: 'Acólito', label: 'Acólitos' },
                { id: 'Coroinha', label: 'Coroinhas' },
              ]
            : []),
        ]
          .map(
            (f) => `
          <button type="button" data-note-filter="${f.id}"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              visibilityFilter === f.id
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }">
            ${escapeHtml(f.label)}
          </button>
        `,
          )
          .join('')}
      </div>

      ${
        filtered.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <i data-lucide="notebook-pen" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
          <h4 class="text-base font-bold text-slate-700">Nenhuma anotação encontrada</h4>
          <p class="text-sm text-slate-500 mt-1">Crie uma nova nota para compartilhar orientações com a pastoral.</p>
        </div>
      `
          : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${filtered
            .map((note) => {
              const author = userMap[note.authorId]?.name || 'Membro';
              const badge = getVisibilityBadge(note);
              const canManage = coord || note.authorId === user.id;
              return `
                <article class="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md transition">
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-3">
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.cls}">
                        <i data-lucide="eye" class="w-3 h-3"></i>
                        ${escapeHtml(badge.label)}
                      </span>
                      ${
                        canManage
                          ? `
                        <div class="flex items-center gap-1">
                          <button type="button" data-edit-note="${note.id}" class="p-1.5 rounded-lg text-slate-400 hover:text-[#1E3A8A] hover:bg-blue-50 transition" title="Editar">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                          </button>
                          <button type="button" data-delete-note="${note.id}" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Excluir">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      `
                          : ''
                      }
                    </div>
                    <h4 class="text-base font-bold text-[#0F172A]">${escapeHtml(note.title)}</h4>
                    <p class="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">${escapeHtml(note.content)}</p>
                  </div>

                  <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span class="font-semibold text-slate-600">Por ${escapeHtml(author)}</span>
                    <span>${escapeHtml(formatDateTimeBR(note.createdAt))}</span>
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

  container.querySelectorAll('[data-note-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      visibilityFilter = btn.dataset.noteFilter;
      renderNotes(container, { user });
    });
  });

  container.querySelector('#btn-new-note').addEventListener('click', () => {
    openNoteModal(null, user, () => renderNotes(container, { user }));
  });

  container.querySelectorAll('[data-edit-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const note = dataService.getNotes().find((n) => n.id === btn.dataset.editNote);
      if (note) openNoteModal(note, user, () => renderNotes(container, { user }));
    });
  });

  container.querySelectorAll('[data-delete-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Deseja excluir esta anotação?')) return;
      dataService.deleteNote(btn.dataset.deleteNote);
      showToast('Anotação excluída.');
      renderNotes(container, { user });
    });
  });

  refreshIcons();
}

function openNoteModal(existing, user, onSaved) {
  const initialMode = existing?.visibilityMode || 'Todos';
  const initialCats = existing?.visibleCategories || ['Coordenador', 'Acólito', 'Coroinha'];

  openModal({
    title: existing ? 'Editar Anotação' : 'Nova Anotação no Mural',
    bodyHtml: `
      <form id="note-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Título *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Orientações para a Procissão de Entrada"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Conteúdo *</label>
          <textarea name="content" rows="4" required placeholder="Escreva sua anotação ou orientação..."
            class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#1E3A8A] outline-none">${escapeHtml(existing?.content || '')}</textarea>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Quem pode visualizar? *</label>
          <select id="note-vis-mode" name="visibilityMode" class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#1E3A8A]">
            ${['Todos', 'Apenas Coordenadores', 'Apenas Acólitos', 'Apenas Coroinhas', 'Personalizado']
              .map((m) => `<option value="${m}" ${initialMode === m ? 'selected' : ''}>${m === 'Personalizado' ? 'Seleção múltipla personalizada' : m}</option>`)
              .join('')}
          </select>
        </div>

        <div id="custom-vis-box" class="${initialMode === 'Personalizado' ? '' : 'hidden'} p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <p class="text-xs font-bold text-slate-600">Selecione as categorias que poderão ver esta nota:</p>
          <div class="flex items-center gap-4 flex-wrap">
            ${['Coordenador', 'Acólito', 'Coroinha']
              .map(
                (cat) => `
              <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" name="customCats" value="${cat}" ${initialCats.includes(cat) ? 'checked' : ''} class="rounded text-[#1E3A8A]">
                ${cat}
              </label>
            `,
              )
              .join('')}
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-note-btn" class="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-sm font-semibold transition">Salvar Anotação</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const modeSel = bodyEl.querySelector('#note-vis-mode');
      const customBox = bodyEl.querySelector('#custom-vis-box');

      modeSel.addEventListener('change', () => {
        customBox.classList.toggle('hidden', modeSel.value !== 'Personalizado');
      });

      bodyEl.querySelector('#cancel-note-btn').addEventListener('click', closeModal);

      bodyEl.querySelector('#note-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const mode = fd.get('visibilityMode');
        let visibleCategories = ['Coordenador', 'Acólito', 'Coroinha'];
        if (mode === 'Apenas Coordenadores') visibleCategories = ['Coordenador'];
        else if (mode === 'Apenas Acólitos') visibleCategories = ['Acólito'];
        else if (mode === 'Apenas Coroinhas') visibleCategories = ['Coroinha'];
        else if (mode === 'Personalizado') {
          visibleCategories = fd.getAll('customCats');
          if (visibleCategories.length === 0) {
            showToast('Selecione pelo menos uma categoria na visibilidade personalizada.', 'error');
            return;
          }
        }

        dataService.saveNote({
          id: existing?.id,
          title: String(fd.get('title')).trim(),
          content: String(fd.get('content')).trim(),
          authorId: existing?.authorId || user.id,
          visibilityMode: mode,
          visibleCategories,
        });
        closeModal();
        showToast(existing ? 'Anotação atualizada!' : 'Anotação publicada no mural!');
        onSaved();
      });
    },
  });
}
