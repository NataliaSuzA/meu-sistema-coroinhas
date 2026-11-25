/**
 * Módulo 6: Bloco de Notas Segmentado por Pastoral (Vínculo N:N Estrito)
 * - Seleção obrigatória de 1 ou mais pastorais (listando apenas pastorais que o usuário participa/coordena;
 *   "Toda a Paróquia" exclusivo da Coordenação Geral).
 * - Visibilidade estrita: usuário só visualiza notas vinculadas a pelo menos uma de suas pastorais
 *   ou "Toda a Paróquia" (exceção: Coordenação Geral vê todas).
 */

import { dataService } from '../services/dataService.js';
import {
  canManageAnyOfPastorals,
  canManagePastoral,
  closeModal,
  escapeHtml,
  formatDateTimeBR,
  getMemberPastoralIds,
  isAnyCoordinator,
  isGeneralAdmin,
  isPastoralScopedItemVisible,
  openModal,
  refreshIcons,
  renderPastoralPillsList,
  showToast,
} from '../utils/helpers.js';

let notePastoralFilter = 'all';

function isNoteVisibleStrict(note, user, pastorals) {
  if (isGeneralAdmin(user)) return true;
  if (note.authorId === user.id) return true;
  if (!isPastoralScopedItemVisible(note.pastoralIds, user, pastorals)) return false;

  if (note.coordinatorsOnly) {
    const pids = note.pastoralIds || ['all'];
    if (pids.includes('all')) return isAnyCoordinator(user);
    return pids.some((pid) => canManagePastoral(user, pid));
  }
  return true;
}

export function renderNotes(container, { user }) {
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const accessibleIds = getMemberPastoralIds(user, pastorals);
  const accessiblePastorals = pastorals.filter((p) => accessibleIds.includes(p.id));

  if (notePastoralFilter !== 'all' && notePastoralFilter !== 'mine' && !accessibleIds.includes(notePastoralFilter)) {
    notePastoralFilter = 'all';
  }

  const visibleNotes = dataService.getNotes().filter((n) => isNoteVisibleStrict(n, user, pastorals));
  const filtered = visibleNotes.filter((n) => {
    if (notePastoralFilter === 'all') return true;
    if (notePastoralFilter === 'mine') return n.authorId === user.id;
    const pids = n.pastoralIds || ['all'];
    return pids.includes('all') || pids.includes(notePastoralFilter);
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="text-xl font-extrabold text-[#3E2723]">Bloco de Notas &amp; Orientações</h3>
          <p class="text-sm text-[#6D4C41] mt-0.5">
            Mural segmentado por pastoral. Você visualiza apenas notas das suas pastorais e da paróquia.
          </p>
        </div>
        <button id="btn-new-note" type="button"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold shadow-sm transition shrink-0">
          <i data-lucide="sticky-note" class="w-4 h-4 text-amber-400"></i>
          Nova Anotação
        </button>
      </div>

      <!-- Filtro por Pastoral -->
      <div class="flex items-center gap-2 flex-wrap">
        <button type="button" data-note-filter="all"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
            notePastoralFilter === 'all' ? 'bg-[#3E2723] text-white border-[#3E2723]' : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
          }">Todas as minhas pastorais</button>
        <button type="button" data-note-filter="mine"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
            notePastoralFilter === 'mine' ? 'bg-[#3E2723] text-white border-[#3E2723]' : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
          }">Minhas anotações</button>
        ${accessiblePastorals
          .map(
            (p) => `
          <button type="button" data-note-filter="${p.id}"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              notePastoralFilter === p.id ? 'bg-[#3E2723] text-white border-[#3E2723]' : 'bg-white text-[#5D4037] border-[#E6DACE] hover:bg-[#FDFBF7]'
            }">
            <span class="w-2 h-2 rounded-full" style="background-color:${escapeHtml(p.color)};"></span>
            ${escapeHtml(p.shortName)}
          </button>
        `,
          )
          .join('')}
      </div>

      ${
        filtered.length === 0
          ? `
        <div class="bg-white rounded-2xl border border-dashed border-[#D7C4B2] p-10 text-center">
          <i data-lucide="notebook-pen" class="w-10 h-10 text-[#8D6E63] mx-auto mb-3"></i>
          <h4 class="text-base font-bold text-[#3E2723]">Nenhuma anotação encontrada</h4>
          <p class="text-sm text-[#6D4C41] mt-1">Crie uma nova anotação selecionando as pastorais de destino.</p>
        </div>
      `
          : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${filtered
            .map((note) => {
              const author = userMap[note.authorId]?.name || 'Membro';
              const canManage =
                isGeneralAdmin(user) ||
                note.authorId === user.id ||
                canManageAnyOfPastorals(user, note.pastoralIds);
              return `
                <article class="bg-white rounded-2xl border border-[#E6DACE] p-5 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md transition">
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-3">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${renderPastoralPillsList(note.pastoralIds, pastoralMap, { compact: true })}
                        ${
                          note.coordinatorsOnly
                            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3E2723] text-amber-300">
                                <i data-lucide="shield" class="w-2.5 h-2.5"></i>
                                Só Coord.
                              </span>`
                            : ''
                        }
                      </div>
                      ${
                        canManage
                          ? `
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" data-edit-note="${note.id}" class="p-1.5 rounded-lg text-[#8D6E63] hover:text-[#3E2723] hover:bg-[#F5EFE6]" title="Editar">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                          </button>
                          <button type="button" data-delete-note="${note.id}" class="p-1.5 rounded-lg text-[#8D6E63] hover:text-red-700 hover:bg-red-50" title="Excluir">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      `
                          : ''
                      }
                    </div>
                    <h4 class="text-base font-bold text-[#3E2723]">${escapeHtml(note.title)}</h4>
                    <p class="text-sm text-[#5D4037] mt-2 leading-relaxed whitespace-pre-line">${escapeHtml(note.content)}</p>
                  </div>

                  <div class="pt-3 border-t border-[#E6DACE]/70 flex items-center justify-between text-[11px] text-[#8D6E63]">
                    <span class="font-semibold text-[#5D4037]">Por ${escapeHtml(author)}</span>
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
      notePastoralFilter = btn.dataset.noteFilter;
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
  const generalAdmin = isGeneralAdmin(user);
  const pastorals = dataService.getActivePastorals();
  const accessibleIds = getMemberPastoralIds(user, pastorals);
  const selectablePastorals = pastorals.filter((p) => accessibleIds.includes(p.id));
  const initialTargets = existing?.pastoralIds || (generalAdmin ? ['all'] : selectablePastorals.slice(0, 1).map((p) => p.id));

  openModal({
    title: existing ? 'Editar Anotação' : 'Nova Anotação Segmentada',
    bodyHtml: `
      <form id="note-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Título *</label>
          <input name="title" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Repertório da Missa / Checklist da Sacristia"
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">Conteúdo *</label>
          <textarea name="content" rows="4" required placeholder="Escreva sua anotação ou orientação..."
            class="w-full px-3 py-2 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">${escapeHtml(existing?.content || '')}</textarea>
        </div>

        <!-- Seleção Obrigatória N:N de Pastorais -->
        <div class="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6DACE] space-y-2">
          <label class="block text-xs font-bold uppercase tracking-wider text-[#3E2723]">Pastorais de Destino (Obrigatório) *</label>
          <p class="text-[11px] text-[#6D4C41]">Apenas membros das pastorais selecionadas visualizarão esta anotação.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            ${
              generalAdmin
                ? `
              <label class="inline-flex items-center gap-2 text-xs font-extrabold text-[#92400E] cursor-pointer sm:col-span-2">
                <input id="note-target-all" type="checkbox" name="pastoralIds" value="all" ${initialTargets.includes('all') ? 'checked' : ''} class="rounded text-[#B45309]">
                Toda a Paróquia (todas as pastorais)
              </label>
            `
                : ''
            }
            ${selectablePastorals
              .map(
                (p) => `
              <label class="inline-flex items-center gap-2 text-xs font-semibold text-[#3E2723] cursor-pointer">
                <input type="checkbox" class="note-target-pid rounded text-[#B45309]" name="pastoralIds" value="${p.id}" ${initialTargets.includes(p.id) ? 'checked' : ''}>
                <span class="w-2 h-2 rounded-full" style="background-color:${escapeHtml(p.color)};"></span>
                ${escapeHtml(p.shortName)}
              </label>
            `,
              )
              .join('')}
          </div>
        </div>

        ${
          isAnyCoordinator(user)
            ? `
          <label class="inline-flex items-center gap-2 text-xs font-bold text-[#5D4037] cursor-pointer">
            <input type="checkbox" name="coordinatorsOnly" ${existing?.coordinatorsOnly ? 'checked' : ''} class="rounded text-[#B45309]">
            Restringir leitura apenas aos Coordenadores das pastorais selecionadas
          </label>
        `
            : ''
        }

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-note-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Anotação</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      const allChk = bodyEl.querySelector('#note-target-all');
      const pidChks = bodyEl.querySelectorAll('.note-target-pid');
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

      bodyEl.querySelector('#cancel-note-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#note-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const pastoralIds = fd.getAll('pastoralIds');
        if (pastoralIds.length === 0) {
          showToast('Selecione obrigatoriamente pelo menos uma pastoral de destino.', 'error');
          return;
        }
        dataService.saveNote({
          id: existing?.id,
          title: String(fd.get('title')).trim(),
          content: String(fd.get('content')).trim(),
          authorId: existing?.authorId || user.id,
          pastoralIds,
          coordinatorsOnly: fd.get('coordinatorsOnly') === 'on',
        });
        closeModal();
        showToast(existing ? 'Anotação atualizada!' : 'Anotação publicada!');
        onSaved();
      });
    },
  });
}
