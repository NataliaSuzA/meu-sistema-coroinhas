/**
 * Serviço de Autenticação integrado ao Firebase Authentication (E-mail e Senha)
 * - Permite login normal com e-mail e senha cadastrados no Cloud Firestore
 * - Provisiona automaticamente a conta no Firebase Auth no primeiro acesso de
 *   usuários cadastrados pela Coordenação (ou pelo Seed inicial)
 * - Mantém fallback resiliente caso o provedor E-mail/Senha ainda não esteja
 *   habilitado no console do Firebase
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
   * Se o usuário foi cadastrado pela Coordenação no Firestore e está fazendo o primeiro
   * acesso, cria automaticamente a credencial no Firebase Auth quando a senha confere.
   */
  async loginWithCredentials(rawEmail, rawPassword) {
    const email = String(rawEmail || '').trim().toLowerCase();
    const password = String(rawPassword || '');
    const found = dataService.getUsers().find((u) => String(u.email || '').trim().toLowerCase() === email);

    if (!found) {
      return {
        ok: false,
        error: 'E-mail não encontrado. Verifique se digitou corretamente ou solicite seu cadastro à Coordenação.',
      };
    }

    if (found.status !== 'Ativo') {
      return {
        ok: false,
        error: `Acesso indisponível: este usuário está com status "${found.status}".`,
      };
    }

    const expectedPass = String(found.password || 'pastoral2026');

    // 1. Tenta autenticar diretamente no Firebase Authentication
    try {
      await signInWithEmailAndPassword(auth, email, password);
      authProviderActive = true;
      return { ok: true, user: found, mode: 'firebase-auth' };
    } catch (err) {
      // Se o provedor E-mail/Senha ainda não foi ativado no Console, valida contra o Firestore
      if (isProviderDisabledError(err)) {
        authProviderActive = false;
        if (password !== expectedPass) {
          return {
            ok: false,
            error: 'Senha incorreta. Verifique sua senha e tente novamente.',
          };
        }
        return { ok: true, user: found, mode: 'firestore-fallback' };
      }

      // 2. Primeiro acesso de conta cadastrada pela Coordenação no Firestore:
      //    se a senha digitada confere com a senha inicial cadastrada, provisiona no Firebase Auth
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
          if (createErr?.code === 'auth/email-already-in-use') {
            return {
              ok: false,
              error: 'Senha incorreta. Caso tenha alterado sua senha anteriormente, utilize a nova senha.',
            };
          }
          if (createErr?.code === 'auth/weak-password') {
            // Senha cadastrada anteriormente com menos de 6 caracteres: permite entrar e orienta troca em Meu Perfil
            return { ok: true, user: found, mode: 'firestore-fallback' };
          }
          return { ok: true, user: found, mode: 'firestore-fallback' };
        }
      }

      return {
        ok: false,
        error: 'Senha incorreta. Verifique seus dados ou fale com a Coordenação.',
      };
    }
  },

  /**
   * Altera a senha do usuário no Firebase Authentication e sincroniza no Cloud Firestore.
   */
  async updatePasswordForUser(user, currentPassword, newPassword) {
    const fresh = dataService.getUserById(user.id) || user;
    const storedPass = String(fresh.password || 'pastoral2026');
    const email = String(fresh.email || '').trim().toLowerCase();

    let authenticatedInFirebase = false;

    if (authProviderActive && email) {
      try {
        if (auth.currentUser && auth.currentUser.email?.toLowerCase() === email) {
          const cred = EmailAuthProvider.credential(email, currentPassword);
          await reauthenticateWithCredential(auth.currentUser, cred);
          await updatePassword(auth.currentUser, newPassword);
          authenticatedInFirebase = true;
        } else {
          try {
            const res = await signInWithEmailAndPassword(auth, email, currentPassword);
            await updatePassword(res.user, newPassword);
            authenticatedInFirebase = true;
          } catch (signInErr) {
            if (isProviderDisabledError(signInErr)) {
              authProviderActive = false;
            } else if (storedPass === currentPassword) {
              try {
                await createUserWithEmailAndPassword(auth, email, newPassword);
                authenticatedInFirebase = true;
              } catch (cErr) {
                if (isProviderDisabledError(cErr)) authProviderActive = false;
              }
            }
          }
        }
      } catch (err) {
        if (isProviderDisabledError(err)) {
          authProviderActive = false;
        } else if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
          return { ok: false, error: 'A senha atual informada está incorreta.' };
        }
      }
    }

    if (!authenticatedInFirebase && storedPass !== currentPassword) {
      return { ok: false, error: 'A senha atual informada está incorreta.' };
    }

    // Sincroniza no Firestore (usando a senha atual armazenada para não falhar caso já tenha sido alterada no Auth)
    const updated = dataService.updateOwnPassword(fresh.id, storedPass, newPassword);
    return updated;
  },

  /**
   * Sincroniza silenciosamente sessão do Firebase Auth ao alternar perfil (Admin Geral / localhost).
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
