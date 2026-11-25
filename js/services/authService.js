/**
 * Serviço de Autenticação integrado ao Firebase Authentication (E-mail e Senha)
 * + fallback resiliente caso o provedor E-mail/Senha ainda não tenha sido ativado no console.
 */

import {
  EmailAuthProvider,
  auth,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from './firebaseConfig.js';
import { dataService } from './dataService.js';

let authProviderActive = true;

function isProviderDisabledError(err) {
  const code = err?.code || '';
  return (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/configuration-not-found' ||
    code === 'auth/admin-restricted-operation'
  );
}

export const authService = {
  isFirebaseAuthProviderActive() {
    return authProviderActive;
  },

  /**
   * Realiza login validando o cadastro no Firestore e autenticando no Firebase Auth.
   * Para contas de demonstração criadas pelo Seed, cria automaticamente o registro
   * no Firebase Auth no primeiro acesso se o provedor E-mail/Senha estiver ativo.
   */
  async loginWithCredentials(rawEmail, password) {
    const email = String(rawEmail || '').trim().toLowerCase();
    const found = dataService.getUsers().find((u) => String(u.email || '').toLowerCase() === email);

    if (!found) {
      return {
        ok: false,
        error: 'E-mail não encontrado. Utilize um dos perfis de demonstração abaixo ou cadastre o membro.',
      };
    }

    if (found.status !== 'Ativo') {
      return {
        ok: false,
        error: `Acesso indisponível: este usuário está com status "${found.status}".`,
      };
    }

    const expectedPass = found.password || 'pastoral2026';

    // Tenta autenticar diretamente no Firebase Authentication
    try {
      await signInWithEmailAndPassword(auth, email, password);
      authProviderActive = true;
      return { ok: true, user: found, mode: 'firebase-auth' };
    } catch (err) {
      if (isProviderDisabledError(err)) {
        authProviderActive = false;
        if (password !== expectedPass) {
          return {
            ok: false,
            error: 'Senha incorreta. (Dica de demonstração: pastoral2026 ou sua nova senha alterada em Meu Perfil).',
          };
        }
        return { ok: true, user: found, mode: 'firestore-fallback' };
      }

      // Primeiro login de conta criada pelo Seed ou pela Coordenação: provisiona no Firebase Auth se a senha conferir
      if (password === expectedPass) {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          authProviderActive = true;
          return { ok: true, user: found, mode: 'firebase-auth-provisioned' };
        } catch (createErr) {
          if (isProviderDisabledError(createErr)) {
            authProviderActive = false;
            return { ok: true, user: found, mode: 'firestore-fallback' };
          }
          // Se já existir com outra senha no Auth, rejeita
          if (createErr?.code === 'auth/email-already-in-use') {
            return {
              ok: false,
              error: 'Senha incorreta para esta conta no Firebase Authentication.',
            };
          }
          return { ok: true, user: found, mode: 'firestore-fallback' };
        }
      }

      return {
        ok: false,
        error: 'Senha incorreta. (Dica de demonstração: pastoral2026 ou sua nova senha alterada em Meu Perfil).',
      };
    }
  },

  /**
   * Altera a senha do usuário no Firebase Authentication e sincroniza no Cloud Firestore.
   */
  async updatePasswordForUser(user, currentPassword, newPassword) {
    const fresh = dataService.getUserById(user.id) || user;
    const storedPass = fresh.password || 'pastoral2026';

    if (storedPass !== currentPassword) {
      return { ok: false, error: 'A senha atual informada está incorreta.' };
    }

    const email = String(fresh.email || '').trim().toLowerCase();

    // Tenta atualizar também no Firebase Authentication
    if (authProviderActive && email) {
      try {
        if (auth.currentUser && auth.currentUser.email?.toLowerCase() === email) {
          const cred = EmailAuthProvider.credential(email, currentPassword);
          await reauthenticateWithCredential(auth.currentUser, cred);
          await updatePassword(auth.currentUser, newPassword);
        } else {
          try {
            const res = await signInWithEmailAndPassword(auth, email, currentPassword);
            await updatePassword(res.user, newPassword);
          } catch (signInErr) {
            if (isProviderDisabledError(signInErr)) {
              authProviderActive = false;
            } else {
              // Se ainda não existia no Auth, cria já com a nova senha
              try {
                await createUserWithEmailAndPassword(auth, email, newPassword);
              } catch (cErr) {
                if (isProviderDisabledError(cErr)) authProviderActive = false;
              }
            }
          }
        }
      } catch (err) {
        if (isProviderDisabledError(err)) {
          authProviderActive = false;
        }
      }
    }

    const res = dataService.updateOwnPassword(fresh.id, currentPassword, newPassword);
    return res;
  },

  /**
   * Sincroniza silenciosamente sessão do Firebase Auth ao alternar perfil de demonstração.
   */
  async syncDemoProfileSession(user) {
    if (!authProviderActive || !user?.email) return;
    try {
      const email = String(user.email).trim().toLowerCase();
      if (auth.currentUser?.email?.toLowerCase() === email) return;
      await signInWithEmailAndPassword(auth, email, user.password || 'pastoral2026');
    } catch (err) {
      if (isProviderDisabledError(err)) {
        authProviderActive = false;
      }
    }
  },

  async logout() {
    dataService.setSessionUserId(null);
    try {
      await signOut(auth);
    } catch {
      // ignora silenciosamente se não havia sessão ativa no Auth
    }
  },
};
