/**
 * Controlador principal v5 — Paróquia Santa Teresa d'Ávila • Gestão Pastoral
 * - Contas Compartilhadas / Familiares (irmãos na mesma conta) com selo no cabeçalho
 * - Fluxo Completo de Aceite e Cancelamento de Substituições integrado ao Sino
 * - Liturgia Diária diretamente da Paulus (paulus.com.br) + OE exata + Roteiro do Celebrante
 * - Locais, Tipos de Celebração, Permissões Dinâmicas, Meu Perfil e PWA
 */

import { dataService } from './services/dataService.js';
import { authService } from './services/authService.js';
import {
  closeModal,
  escapeHtml,
  formatDateTimeBR,
  getFirstName,
  getInitials,
  getUserMemberships,
  getUserRoleSummary,
  hasPermission,
  isAnyCoordinator,
  isFamilyAccount,
  isFormClosed,
  isGeneralAdmin,
  openModal,
  refreshIcons,
  renderFamilyAccountBadge,
  showToast,
} from './utils/helpers.js';

import { openMyProfileModal } from './modules/profile.js';
import { renderPermissions } from './modules/permissions.js';
import { renderMyDates } from './modules/myDates.js';
import { renderDashboard, resetDashboardFilter } from './modules/dashboard.js';
import { renderLiturgy, setLiturgyViewTarget } from './modules/liturgy.js';
import { renderLocations } from './modules/locations.js';
import { renderCelebrationTypes } from './modules/celebrationTypes.js';
import { renderUsers } from './modules/users.js';
import { renderAgenda } from './modules/agenda.js';
import { renderSchedules, resetSchedulesTab, setSchedulesTab } from './modules/schedules.js';
import { renderRoles } from './modules/roles.js';
import { renderForms, queueAutoOpenForm } from './modules/forms.js';
import { renderNotes } from './modules/notes.js';
import { renderNotices } from './modules/notices.js';
import { renderBirthdays } from './modules/birthdays.js';
import { renderAttendance } from './modules/attendance.js';
import { renderResponses } from './modules/responses.js';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Início', subtitle: 'Visão Geral das Pastorais', icon: 'layout-dashboard', permKey: 'dashboard' },
  { id: 'liturgy', label: 'Liturgia Diária', subtitle: 'Leituras da Paulus, Orações Eucarísticas e Roteiro do Celebrante', icon: 'book-open', permKey: 'liturgy' },
  { id: 'users', label: 'Gestão de Usuários', subtitle: 'Cadastro de membros, contas familiares e vínculos N:N', icon: 'users', permKey: 'users', badge: 'Gestão' },
  { id: 'agenda', label: 'Agenda', subtitle: 'Calendário unificado da pastoral com destaque das suas escalas', icon: 'calendar-days', permKey: 'agenda' },
  { id: 'schedules', label: 'Escalas', subtitle: 'Visão Geral das Pastorais', icon: 'calendar-check-2', permKey: 'schedules_view' },
  { id: 'roles', label: 'Pastorais & Funções', subtitle: 'Cadastro de pastorais e funções vinculadas (1:N)', icon: 'sliders-horizontal', permKey: 'roles', badge: 'Gestão' },
  { id: 'locations', label: 'Locais', subtitle: 'Igrejas, capelas, salões e espaços da paróquia', icon: 'map-pin', permKey: 'locations', badge: 'Gestão' },
  { id: 'celebration_types', label: 'Tipos de Celebração', subtitle: 'Ritos, duração média e exigência de Liturgia da Palavra', icon: 'sparkles', permKey: 'celebration_types', badge: 'Gestão' },
  { id: 'forms', label: 'Formulários', subtitle: 'Pesquisas segmentadas por pastoral e prazo', icon: 'clipboard-list', permAny: ['forms_answer', 'forms_manage'] },
  { id: 'notes', label: 'Bloco de Notas', subtitle: 'Mural segmentado de orientações por pastoral', icon: 'notebook-pen', permKey: 'notes' },
  { id: 'notices', label: 'Avisos', subtitle: 'Comunicados paroquiais e das suas pastorais', icon: 'megaphone' },
  { id: 'birthdays', label: 'Aniversariantes', subtitle: 'Aniversariantes individuais e Mural de Parabéns', icon: 'cake', permKey: 'birthdays' },
  { id: 'attendance', label: 'Presença', subtitle: 'Chamadas individuais e indicador de frequência', icon: 'check-square', permAny: ['attendance_manage', 'attendance_self'] },
  { id: 'responses', label: 'Respostas', subtitle: 'Adesão, validação, lembretes internos e CSV/Excel', icon: 'bar-chart-3', permKey: 'responses', badge: 'Gestão' },
  { id: 'permissions', label: 'Permissões e Acessos', subtitle: 'Matriz dinâmica de permissões por perfil', icon: 'shield-check', adminOnly: true, badge: 'Admin' },
  { id: 'instagram', label: 'Instagram', subtitle: 'Perfil oficial da paróquia', icon: 'instagram', external: true },
];

let currentUser = null;
let currentRoute = 'dashboard';
let deferredInstallPrompt = null;

function isLocalDevEnvironment() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function canUseQuickProfileSwitcher(user) {
  return isGeneralAdmin(user) || isLocalDevEnvironment();
}

function canAccessMenuItem(item, user, permissions) {
  if (!item || !user) return false;
  if (item.external) return true;
  if (item.adminOnly) return isGeneralAdmin(user);
  if (isGeneralAdmin(user)) return true;
  if (item.permKey) return hasPermission(user, item.permKey, permissions);
  if (item.permAny) return item.permAny.some((k) => hasPermission(user, k, permissions));
  return true;
}

function registerServiceWorker() {
  if (
    'serviceWorker' in navigator &&
    (window.location.protocol === 'https:' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost')
  ) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[PWA] Service Worker não registrado:', err);
    });
  }
}

function setupPwaInstall() {
  const installBox = document.getElementById('pwa-install-box');
  const installBtn = document.getElementById('btn-install-pwa');
  if (!installBox || !installBtn) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    installBox.classList.add('hidden');
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBox.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installBox.classList.add('hidden');
    showToast('App "Santa Teresa" instalado na tela inicial!');
  });

  installBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredInstallPrompt = null;
        installBox.classList.add('hidden');
      }
      return;
    }

    openModal({
      title: 'Instalar App — Santa Teresa',
      bodyHtml: `
        <div class="space-y-4 text-sm text-[#4E342E]">
          <p>Instale a plataforma <strong>Gestão Pastoral - Santa Teresa</strong> na tela inicial do seu celular em modo aplicativo:</p>
          <div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] p-4 space-y-2">
            <p class="font-extrabold text-[#3E2723] flex items-center gap-2">
              <i data-lucide="smartphone" class="w-4 h-4 text-[#B45309]"></i>
              No Android (Chrome / Edge)
            </p>
            <p class="text-xs leading-relaxed">Toque no menu <strong>⋮</strong> e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
          </div>
          <div class="rounded-xl bg-[#FAF6F0] border border-[#E6DACE] p-4 space-y-2">
            <p class="font-extrabold text-[#3E2723] flex items-center gap-2">
              <i data-lucide="share" class="w-4 h-4 text-[#B45309]"></i>
              No iPhone / iPad (Safari)
            </p>
            <p class="text-xs leading-relaxed">Toque em <strong>Compartilhar</strong> e escolha <strong>"Adicionar à Tela de Início"</strong>.</p>
          </div>
          <div class="flex justify-end pt-1">
            <button type="button" id="close-pwa-guide" class="px-5 py-2 rounded-xl bg-[#3E2723] text-white text-xs font-bold">Entendi</button>
          </div>
        </div>
      `,
      onMount(bodyEl) {
        bodyEl.querySelector('#close-pwa-guide').addEventListener('click', closeModal);
      },
    });
  });
}

function getDemoProfiles() {
  const users = dataService.getUsers();
  const preferredIds = [
    'usr_natalia_admin',
    'usr_fam_alice_marina',
    'usr_fam_lara_victoriaa',
    'usr_fam_rafaelp_miguel',
    'usr_cor_malu1',
    'usr_aco_milena',
  ];
  const list = preferredIds.map((id) => users.find((u) => u.id === id)).filter(Boolean);
  if (list.length > 0) return list;
  return users.filter((u) => u.status === 'Ativo').slice(0, 6);
}

function describeUserScope(u, pastoralMap) {
  if (isGeneralAdmin(u)) return 'Admin Paroquial • Todas as pastorais';
  const mems = getUserMemberships(u);
  const coords = mems
    .filter((m) => m.role === 'Coordenador')
    .map((m) => pastoralMap[m.pastoralId]?.shortName)
    .filter(Boolean);
  const members = mems
    .filter((m) => m.role === 'Membro')
    .map((m) => pastoralMap[m.pastoralId]?.shortName)
    .filter(Boolean);

  const famNote = isFamilyAccount(u) ? ' • Conta Familiar' : '';
  if (coords.length > 0) return `Coord.: ${coords.join(' e ')}${famNote}`;
  return members.length ? `Membro: ${members.join(', ')}${famNote}` : `Membro${famNote}`;
}

function handleRealtimeFirestoreSync() {
  if (!currentUser) {
    // Atualiza perfis na tela de login se ela estiver aberta
    if (!document.getElementById('login-screen')?.classList.contains('hidden')) {
      showLoginScreen();
    }
    return;
  }

  const fresh = dataService.getUserById(currentUser.id);
  if (fresh) currentUser = fresh;

  renderHeader();
  renderNotificationsBell();
  renderSidebar();

  // Não interrompe digitação ou modal aberto ao receber atualização remota em tempo real
  const modalOpen = !document.getElementById('modal-root')?.classList.contains('hidden');
  const activeTag = document.activeElement?.tagName;
  const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
  if (!modalOpen && !isTyping) {
    renderCurrentRoute();
  }
}

async function init() {
  registerServiceWorker();
  setupPwaInstall();
  bindGlobalEvents();

  const bootEl = document.getElementById('firebase-boot-screen');
  const bootMsg = document.getElementById('firebase-boot-message');

  try {
    if (bootMsg) bootMsg.textContent = 'Conectando ao Cloud Firestore em tempo real...';
    await dataService.init(handleRealtimeFirestoreSync);
  } catch (err) {
    console.warn('[Firebase] Falha na inicialização:', err?.message || err);
    if (bootMsg) bootMsg.textContent = 'Erro ao conectar ao Firebase. Recarregue a página.';
  }

  if (bootEl) bootEl.classList.add('hidden');

  const syncEl = document.getElementById('firebase-sync-status');
  const status = dataService.getSyncStatus();
  if (syncEl && status.connected) {
    syncEl.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
      <span class="text-[10px] font-bold tracking-wide text-emerald-300 truncate">Cloud Firestore • Tempo Real</span>
    `;
  }

  const savedUserId = dataService.getSessionUserId();
  const savedUser = savedUserId ? dataService.getUserById(savedUserId) : null;

  if (savedUser && savedUser.status === 'Ativo') {
    loginAs(savedUser, { silent: true });
  } else {
    showLoginScreen();
  }
}

function closeNotificationsPopover() {
  document.getElementById('notifications-popover')?.classList.add('hidden');
}

function renderNotificationsBell() {
  if (!currentUser) return;
  const badge = document.getElementById('notifications-unread-badge');
  const popover = document.getElementById('notifications-popover');
  if (!badge || !popover) return;

  const forms = dataService.getForms();
  const users = dataService.getUsers();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const items = dataService.getNotificationsForUser(currentUser.id);
  const unreadCount = items.filter((n) => !n.read && !n.completed).length;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }

  popover.innerHTML = `
    <div class="px-4 py-3 bg-[#3E2723] text-white flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <i data-lucide="bell" class="w-4 h-4 text-amber-400"></i>
        <span class="text-xs font-extrabold uppercase tracking-wider">Notificações (${items.length})</span>
      </div>
      ${
        unreadCount > 0
          ? `<button id="btn-mark-all-read" type="button" class="text-[11px] font-bold text-amber-300 hover:text-white transition">Marcar lidas</button>`
          : ''
      }
    </div>
    <div class="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-[#E6DACE]/70">
      ${
        items.length === 0
          ? `<div class="p-6 text-center text-xs text-[#8D6E63]">Você não possui notificações no momento.</div>`
          : items
              .map((n) => {
                const senderName = userMap[n.senderUserId]?.name || 'Coordenação';
                const form = n.formId ? forms.find((f) => f.id === n.formId) : null;
                const canAnswerNow = n.type === 'form_reminder' && !n.completed && form && !isFormClosed(form);
                const isOpenSub = n.type === 'substitution_open' && !n.completed;
                const isConfirmedSub = n.type === 'substitution_confirmed';

                const statusPill = isConfirmedSub
                  ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-300">Confirmada</span>`
                  : n.completed
                    ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-50 text-emerald-800 border border-emerald-200">Concluído</span>`
                    : isOpenSub
                      ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-red-100 text-red-700 border border-red-300">Em Aberto</span>`
                      : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-[#92400E] border border-amber-300">Pendente</span>`;

                return `
                  <div class="p-3.5 ${!n.read && !n.completed ? (isConfirmedSub ? 'bg-emerald-50/70' : 'bg-amber-50/70') : 'bg-white'} space-y-2">
                    <div class="flex items-start justify-between gap-2">
                      <p class="text-xs font-extrabold text-[#3E2723] flex items-center gap-1.5">
                        ${!n.read && !n.completed ? `<span class="w-2 h-2 rounded-full ${isConfirmedSub ? 'bg-emerald-600' : 'bg-red-600'} shrink-0"></span>` : ''}
                        ${escapeHtml(n.title)}
                      </p>
                      ${statusPill}
                    </div>
                    <p class="text-xs text-[#5D4037] leading-relaxed">${escapeHtml(n.message)}</p>
                    <div class="flex items-center justify-between gap-2 pt-0.5">
                      <span class="text-[10px] text-[#8D6E63]">Por ${escapeHtml(senderName)} • ${escapeHtml(formatDateTimeBR(n.createdAt))}</span>
                      ${
                        canAnswerNow
                          ? `<button type="button" data-bell-answer-form="${n.formId}" data-bell-notif-id="${n.id}"
                              class="px-2.5 py-1 rounded-lg bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 text-[11px] font-bold transition">
                              Responder Agora
                            </button>`
                          : isOpenSub
                            ? `<button type="button" data-bell-open-sub="${n.pastoralId || 'my_dates'}" data-bell-notif-id="${n.id}"
                                class="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition">
                                Ver / Assumir
                              </button>`
                            : isConfirmedSub
                              ? `<button type="button" data-bell-open-sub="${n.pastoralId || 'my_dates'}" data-bell-notif-id="${n.id}"
                                  class="px-2.5 py-1 rounded-lg bg-[#3E2723] hover:bg-[#5D4037] text-amber-300 text-[11px] font-bold transition">
                                  Ver Escala
                                </button>`
                              : ''
                      }
                    </div>
                  </div>
                `;
              })
              .join('')
      }
    </div>
  `;

  popover.querySelector('#btn-mark-all-read')?.addEventListener('click', () => {
    dataService.markAllNotificationsReadForUser(currentUser.id);
    renderNotificationsBell();
  });

  popover.querySelectorAll('[data-bell-answer-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.markNotificationRead(btn.dataset.bellNotifId);
      closeNotificationsPopover();
      openFormDirectly(btn.dataset.bellAnswerForm);
    });
  });

  popover.querySelectorAll('[data-bell-open-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dataService.markNotificationRead(btn.dataset.bellNotifId);
      closeNotificationsPopover();
      renderNotificationsBell();
      setSchedulesTab(btn.dataset.bellOpenSub);
      navigate('schedules', { preserveSchedulesTab: true });
    });
  });

  refreshIcons();
}

function openFormDirectly(formId) {
  queueAutoOpenForm(formId);
  navigate('forms');
}

function openLiturgyFor(dateISO, scheduleId) {
  setLiturgyViewTarget(dateISO, scheduleId);
  navigate('liturgy');
}

function bindGlobalEvents() {
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-root')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-root') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeNotificationsPopover();
    }
  });

  document.getElementById('notifications-bell-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = document.getElementById('notifications-popover');
    if (!pop) return;
    const isHidden = pop.classList.contains('hidden');
    if (isHidden) {
      renderNotificationsBell();
      pop.classList.remove('hidden');
    } else {
      pop.classList.add('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    const pop = document.getElementById('notifications-popover');
    const bell = document.getElementById('notifications-bell-btn');
    if (pop && !pop.classList.contains('hidden') && !pop.contains(e.target) && !bell?.contains(e.target)) {
      pop.classList.add('hidden');
    }
  });

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => setMobileSidebar(true));
  document.getElementById('open-sidebar-btn')?.addEventListener('click', () => setMobileSidebar(true));
  document.getElementById('close-sidebar-btn')?.addEventListener('click', () => setMobileSidebar(false));
  document.getElementById('sidebar-backdrop')?.addEventListener('click', () => setMobileSidebar(false));

  document.getElementById('header-user-badge')?.addEventListener('click', () => {
    if (!currentUser) return;
    closeNotificationsPopover();
    openMyProfileModal(currentUser, {
      onProfileUpdated: (updated) => {
        currentUser = updated;
        renderHeader();
        renderCurrentRoute();
      },
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    closeNotificationsPopover();
    await authService.logout();
    currentUser = null;
    showLoginScreen();
    showToast('Você saiu do portal.', 'info');
  });

  document.getElementById('quick-profile-switcher')?.addEventListener('change', (e) => {
    if (!canUseQuickProfileSwitcher(currentUser)) return;
    const target = dataService.getUserById(e.target.value);
    if (!target) return;
    closeNotificationsPopover();
    resetSchedulesTab();
    resetDashboardFilter();
    loginAs(target, { silent: false });
  });

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const result = await authService.loginWithCredentials(email, password);
    if (submitBtn) submitBtn.disabled = false;

    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');
    loginAs(result.user);
  });
}

function setMobileSidebar(open) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;
  if (open) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

function showLoginScreen() {
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-form')?.reset();
  document.getElementById('login-error')?.classList.add('hidden');

  const quickSection = document.getElementById('login-quick-profiles-section');
  const quickBox = document.getElementById('login-quick-profiles');
  const allowQuickLogin = isLocalDevEnvironment();

  if (quickSection) {
    quickSection.classList.toggle('hidden', !allowQuickLogin);
  }

  if (allowQuickLogin && quickBox) {
    const pastorals = dataService.getPastorals();
    const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
    const demos = getDemoProfiles();

    quickBox.innerHTML = demos
      .map((u) => {
        const summary = getUserRoleSummary(u, pastorals);
        const scope = describeUserScope(u, pastoralMap);
        const isFam = isFamilyAccount(u);
        return `
          <button type="button" data-quick-login="${u.id}"
            class="text-left p-3 rounded-xl border border-[#E6DACE] bg-[#FDFBF7] hover:border-[#D97706] hover:bg-amber-50/50 transition group">
            <div class="flex items-center justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-7 h-7 rounded-lg ${isFam ? 'bg-[#B45309] text-white' : 'bg-[#3E2723] text-amber-400'} text-[11px] font-extrabold flex items-center justify-center shrink-0">
                  ${isFam ? '<i data-lucide="users" class="w-3.5 h-3.5"></i>' : escapeHtml(getInitials(u.name))}
                </span>
                <span class="text-xs font-extrabold text-[#3E2723] truncate">${escapeHtml(u.name.split(' ').slice(0, 2).join(' '))}</span>
              </div>
              <span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${summary.badgeClass}">
                ${escapeHtml(summary.label)}
              </span>
            </div>
            <p class="text-[11px] text-[#6D4C41] truncate pl-9">${escapeHtml(scope)}</p>
          </button>
        `;
      })
      .join('');

    quickBox.querySelectorAll('[data-quick-login]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = dataService.getUserById(btn.dataset.quickLogin);
        if (target) loginAs(target);
      });
    });
  } else if (quickBox) {
    quickBox.innerHTML = '';
  }

  refreshIcons();
}

function getFallbackAllowedRoute(user, permissions) {
  const firstAllowed = MENU_ITEMS.find((m) => !m.external && canAccessMenuItem(m, user, permissions));
  return firstAllowed ? firstAllowed.id : 'notices';
}

function loginAs(user, { silent = false } = {}) {
  currentUser = user;
  dataService.setSessionUserId(user.id);
  authService.syncDemoProfileSession(user);

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  const permissions = dataService.getPermissions();
  const activeMenuItem = MENU_ITEMS.find((m) => m.id === currentRoute);
  if (!activeMenuItem || !canAccessMenuItem(activeMenuItem, currentUser, permissions)) {
    currentRoute = getFallbackAllowedRoute(currentUser, permissions);
  }

  renderHeader();
  renderNotificationsBell();
  renderSidebar();
  renderCurrentRoute();

  if (!silent) {
    const pastorals = dataService.getPastorals();
    const summary = getUserRoleSummary(user, pastorals);
    showToast(`Conectado como ${isFamilyAccount(user) ? user.name.split('(')[0].trim() : getFirstName(user.name)} (${summary.label}).`, 'info');
  }
}

function setHeaderContext(title, subtitle) {
  const t = document.getElementById('page-title');
  const s = document.getElementById('page-subtitle');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
}

function renderHeader() {
  if (!currentUser) return;
  const pastorals = dataService.getPastorals();
  const pastoralMap = Object.fromEntries(pastorals.map((p) => [p.id, p]));
  const summary = getUserRoleSummary(currentUser, pastorals);
  const isFam = isFamilyAccount(currentUser);

  const badgeEl = document.getElementById('header-user-badge');
  badgeEl.innerHTML = `
    <div class="w-7 h-7 rounded-lg ${isFam ? 'bg-[#B45309] text-white' : 'bg-[#3E2723] text-amber-400'} text-[11px] font-extrabold flex items-center justify-center shrink-0">
      ${isFam ? '<i data-lucide="users" class="w-3.5 h-3.5"></i>' : escapeHtml(getInitials(currentUser.name))}
    </div>
    <div class="flex items-center gap-1.5 min-w-0">
      <span class="text-xs font-extrabold text-[#3E2723] truncate max-w-[90px] sm:max-w-[130px]">${escapeHtml(isFam ? currentUser.name.split('(')[0].trim() : getFirstName(currentUser.name))}</span>
      ${
        isFam
          ? renderFamilyAccountBadge(currentUser, { compact: true })
          : `<span class="text-[#D7C4B2] hidden sm:inline">•</span>
             <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${summary.badgeClass}">
               ${escapeHtml(summary.label)}
             </span>`
      }
    </div>
    <i data-lucide="user-cog" class="w-3.5 h-3.5 text-[#B45309] shrink-0 hidden sm:block"></i>
  `;

  const switcherBox = document.getElementById('quick-profile-switcher-box');
  const switcher = document.getElementById('quick-profile-switcher');
  const showSwitcher = canUseQuickProfileSwitcher(currentUser);

  if (switcherBox) {
    switcherBox.classList.toggle('hidden', !showSwitcher);
    switcherBox.classList.toggle('flex', showSwitcher);
  }

  if (showSwitcher && switcher) {
    const activeUsers = dataService.getUsers().filter((u) => u.status === 'Ativo');
    const demoOrder = [
      'usr_natalia_admin',
      'usr_fam_alice_marina',
      'usr_fam_lara_victoriaa',
      'usr_fam_rafaelp_miguel',
      'usr_fam_olivia_helena1',
    ];
    const demoSet = new Set(demoOrder);
    const sorted = [
      ...demoOrder.map((id) => activeUsers.find((u) => u.id === id)).filter(Boolean),
      ...activeUsers.filter((u) => !demoSet.has(u.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    ];

    switcher.innerHTML = sorted
      .map((u) => {
        const scope = describeUserScope(u, pastoralMap);
        const displayName = isFamilyAccount(u) ? u.name : u.name;
        const shortLabel = `${displayName} — ${scope}`;
        return `<option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>${escapeHtml(shortLabel)}</option>`;
      })
      .join('');
  } else if (switcher) {
    switcher.innerHTML = '';
  }

  refreshIcons();
}

function renderSidebar() {
  if (!currentUser) return;
  const nav = document.getElementById('sidebar-nav');
  const permissions = dataService.getPermissions();
  const anyCoord = isAnyCoordinator(currentUser);
  const settings = dataService.getSettings();

  const visibleItems = MENU_ITEMS.filter((item) => canAccessMenuItem(item, currentUser, permissions));

  nav.innerHTML = visibleItems
    .map((item) => {
      if (item.external) {
        return `
          <div class="pt-2 mt-2 border-t border-white/10 flex items-center gap-1">
            <a href="${escapeHtml(settings.instagramUrl || 'https://www.instagram.com/')}" target="_blank" rel="noopener noreferrer"
              class="flex-1 flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-amber-100/80 hover:text-white hover:bg-white/10 transition">
              <span class="flex items-center gap-3">
                <i data-lucide="${item.icon}" class="w-4 h-4 text-amber-400"></i>
                ${escapeHtml(item.label)}
              </span>
              <i data-lucide="external-link" class="w-3.5 h-3.5 text-amber-200/50"></i>
            </a>
            ${
              anyCoord
                ? `<button id="btn-edit-instagram" type="button" title="Editar link do Instagram"
                    class="p-2.5 rounded-xl text-amber-200/70 hover:text-amber-400 hover:bg-white/10 transition">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                  </button>`
                : ''
            }
          </div>
        `;
      }

      const active = currentRoute === item.id;
      return `
        <button type="button" data-route="${item.id}"
          class="w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
            active
              ? 'sidebar-link-active font-semibold'
              : 'text-amber-100/80 hover:text-white hover:bg-white/10'
          }">
          <span class="flex items-center gap-3 truncate">
            <i data-lucide="${item.icon}" class="w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-amber-200/60'}"></i>
            <span class="truncate">${escapeHtml(item.label)}</span>
          </span>
          ${
            item.badge
              ? `<span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/25 font-bold">${escapeHtml(item.badge)}</span>`
              : ''
          }
        </button>
      `;
    })
    .join('');

  nav.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.route);
      setMobileSidebar(false);
    });
  });

  nav.querySelector('#btn-edit-instagram')?.addEventListener('click', openInstagramModal);
  refreshIcons();
}

function openInstagramModal() {
  const settings = dataService.getSettings();
  openModal({
    title: 'Configurar Link do Instagram',
    bodyHtml: `
      <form id="ig-form" class="space-y-4">
        <p class="text-sm text-[#5D4037]">Defina o endereço oficial do Instagram da Paróquia Santa Teresa d'Ávila.</p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#5D4037] mb-1">URL do Instagram *</label>
          <input name="instagramUrl" type="url" required value="${escapeHtml(settings.instagramUrl || 'https://www.instagram.com/')}"
            class="w-full px-3.5 py-2.5 rounded-xl border border-[#E6DACE] text-sm focus:border-[#B45309] outline-none">
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="cancel-ig-btn" class="px-4 py-2 rounded-xl border border-[#E6DACE] text-sm font-semibold text-[#5D4037] hover:bg-[#FAF6F0]">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white text-sm font-semibold transition">Salvar Link</button>
        </div>
      </form>
    `,
    onMount(bodyEl) {
      bodyEl.querySelector('#cancel-ig-btn').addEventListener('click', closeModal);
      bodyEl.querySelector('#ig-form').addEventListener('submit', (e) => {
        e.preventDefault();
        dataService.updateSettings({ instagramUrl: String(new FormData(e.target).get('instagramUrl')).trim() });
        closeModal();
        renderSidebar();
        showToast('Link do Instagram atualizado!');
      });
    },
  });
}

function navigate(routeId, { preserveSchedulesTab = false } = {}) {
  // Atalhos internos para "Minhas Datas" redirecionam automaticamente para Escalas -> aba Minhas Datas
  if (routeId === 'my_dates') {
    setSchedulesTab('my_dates');
    routeId = 'schedules';
    preserveSchedulesTab = true;
  }

  const permissions = dataService.getPermissions();
  const item = MENU_ITEMS.find((m) => m.id === routeId);
  if (!item || item.external) return;
  if (!canAccessMenuItem(item, currentUser, permissions)) {
    showToast('Você não tem permissão para acessar este módulo.', 'error');
    currentRoute = getFallbackAllowedRoute(currentUser, permissions);
  } else {
    if (routeId === 'schedules' && currentRoute !== 'schedules' && !preserveSchedulesTab) {
      resetSchedulesTab();
    }
    currentRoute = routeId;
  }
  renderSidebar();
  renderCurrentRoute();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentRoute() {
  if (!currentUser) return;
  const freshUser = dataService.getUserById(currentUser.id);
  if (freshUser) currentUser = freshUser;

  const permissions = dataService.getPermissions();
  const meta = MENU_ITEMS.find((m) => m.id === currentRoute) || MENU_ITEMS[0];
  if (!canAccessMenuItem(meta, currentUser, permissions)) {
    currentRoute = getFallbackAllowedRoute(currentUser, permissions);
  }

  const activeMeta = MENU_ITEMS.find((m) => m.id === currentRoute) || MENU_ITEMS[0];
  setHeaderContext(activeMeta.label, activeMeta.subtitle);

  const container = document.getElementById('main-content');
  const ctx = {
    user: currentUser,
    permissions,
    navigate,
    setHeaderContext,
    openFormDirectly,
    openLiturgyFor,
    onUsersChanged: () => renderHeader(),
    onPastoralsChanged: () => {
      renderHeader();
      renderSidebar();
    },
    onPermissionsChanged: () => {
      renderSidebar();
      renderCurrentRoute();
    },
    onNotificationsChanged: () => {
      renderNotificationsBell();
    },
  };

  switch (currentRoute) {
    case 'dashboard':
      renderDashboard(container, ctx);
      break;
    case 'liturgy':
      renderLiturgy(container, ctx);
      break;
    case 'my_dates':
      renderMyDates(container, ctx);
      break;
    case 'users':
      renderUsers(container, ctx);
      break;
    case 'agenda':
      renderAgenda(container, ctx);
      break;
    case 'schedules':
      renderSchedules(container, ctx);
      break;
    case 'roles':
      renderRoles(container, ctx);
      break;
    case 'locations':
      renderLocations(container, ctx);
      break;
    case 'celebration_types':
      renderCelebrationTypes(container, ctx);
      break;
    case 'forms':
      renderForms(container, ctx);
      break;
    case 'notes':
      renderNotes(container, ctx);
      break;
    case 'notices':
      renderNotices(container, ctx);
      break;
    case 'birthdays':
      renderBirthdays(container, ctx);
      break;
    case 'attendance':
      renderAttendance(container, ctx);
      break;
    case 'responses':
      renderResponses(container, ctx);
      break;
    case 'permissions':
      renderPermissions(container, ctx);
      break;
    default:
      renderDashboard(container, ctx);
      break;
  }
}

document.addEventListener('DOMContentLoaded', init);
