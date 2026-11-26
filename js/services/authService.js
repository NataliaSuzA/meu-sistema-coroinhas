/**
 * Serviço de Autenticação integrado ao Firebase Authentication (E-mail e Senha)
 * Compatível com regras blindadas de produção no Cloud Firestore (`request.auth != null`):
 * - Autentica no Firebase Auth ANTES de abrir listeners ou ler coleções do Firestore
 * - Provisiona automaticamente novos usuários cadastrados pela Coordenação no Firestore
 *   no momento do primeiro acesso (verificando cadastro ativo + senha inicial e removendo
 *   a conta temporária caso os dados não confiram)
 * - Desconecta listeners do Firestore antes do signOut para evitar erros de permissão no logout
 */

import {
  EmailAuthProvider,
  auth,
  collection,
  createUserWithEmailAndPassword,
  db,
  deleteUser,
  getDocs,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from './firebaseConfig.js';
import { dataService } from './dataService.js';

export const authService = {
  /**
   * Aguarda a restauração da sessão persistida no Firebase Authentication.
   */
  async waitForAuthReady() {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    return auth.currentUser || null;
  },

  getCurrentFirebaseUser() {
    return auth.currentUser || null;
  },

  /**
   * Realiza login autenticando no Firebase Auth primeiro (garantindo `request.auth != null`
   * para as regras de produção do Cloud Firestore).
   * Se o usuário acabou de ser cadastrado pela Coordenação e ainda não existe no Firebase Auth,
   * provisiona e valida contra a coleção `users` antes de liberar o acesso.
   */
  async loginWithCredentials(rawEmail, rawPassword) {
    const email = String(rawEmail || '').trim().toLowerCase();
    const password = String(rawPassword || '');

    if (!email || !password) {
      return {
        ok: false,
        error: 'Informe seu e-mail e senha para entrar.',
      };
    }

    // 1. Tenta autenticar diretamente no Firebase Authentication
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { ok: true, firebaseUser: cred.user, mode: 'firebase-auth' };
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-email') {
        return { ok: false, error: 'E-mail inválido. Verifique o endereço digitado.' };
      }
      if (code === 'auth/too-many-requests') {
        return {
          ok: false,
          error: 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.',
        };
      }

      // 2. Primeiro acesso de conta cadastrada pela Coordenação no Firestore:
      //    tenta criar a credencial no Firebase Auth e valida imediatamente contra `users`
      if (password.length < 6) {
        return {
          ok: false,
          error: 'Senha incorreta. Verifique seus dados ou fale com a Coordenação.',
        };
      }

      try {
        const created = await createUserWithEmailAndPassword(auth, email, password);
        try {
          const snap = await getDocs(collection(db, 'users'));
          const matchedDoc = snap.docs
            .map((d) => ({ ...d.data(), id: d.data().id || d.id }))
            .find((u) => String(u.email || '').trim().toLowerCase() === email);

          if (!matchedDoc) {
            await deleteUser(created.user).catch(() => {});
            await signOut(auth).catch(() => {});
            return {
              ok: false,
              error: 'E-mail não encontrado. Verifique se digitou corretamente ou solicite seu cadastro à Coordenação.',
            };
          }

          if (matchedDoc.status !== 'Ativo') {
            await deleteUser(created.user).catch(() => {});
            await signOut(auth).catch(() => {});
            return {
              ok: false,
              error: `Acesso indisponível: este usuário está com status "${matchedDoc.status}".`,
            };
          }

          const expectedPass = String(matchedDoc.password || 'pastoral2026');
          if (password !== expectedPass) {
            await deleteUser(created.user).catch(() => {});
            await signOut(auth).catch(() => {});
            return {
              ok: false,
              error: 'Senha incorreta. Verifique seus dados ou fale com a Coordenação.',
            };
          }

          return {
            ok: true,
            user: matchedDoc,
            firebaseUser: created.user,
            mode: 'firebase-auth-provisioned',
          };
        } catch {
          await deleteUser(created.user).catch(() => {});
          await signOut(auth).catch(() => {});
          return {
            ok: false,
            error: 'Não foi possível validar seu cadastro no momento. Tente novamente.',
          };
        }
      } catch (createErr) {
        if (createErr?.code === 'auth/email-already-in-use') {
          return {
            ok: false,
            error: 'Senha incorreta. Caso tenha alterado sua senha anteriormente, utilize a nova senha.',
          };
        }
        return {
          ok: false,
          error: 'E-mail ou senha incorretos. Verifique seus dados ou fale com a Coordenação.',
        };
      }
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

    if (email && auth.currentUser?.email?.toLowerCase() === email) {
      try {
        const cred = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updatePassword(auth.currentUser, newPassword);
        authenticatedInFirebase = true;
      } catch (err) {
        if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
          return { ok: false, error: 'A senha atual informada está incorreta.' };
        }
      }
    }

    if (!authenticatedInFirebase && storedPass !== currentPassword) {
      return { ok: false, error: 'A senha atual informada está incorreta.' };
    }

    const updated = dataService.updateOwnPassword(fresh.id, storedPass, newPassword);
    return updated;
  },

  /**
   * Mantém a sessão autenticada do Firebase Auth intacta ao alternar visualização de perfil
   * (exclusivo da Coordenação Geral / localhost), preservando `request.auth != null`.
   */
  async syncDemoProfileSession() {
    // Mantém auth.currentUser ativo sem desconectar listeners do Firestore
  },

  async logout() {
    // Desconecta listeners em tempo real ANTES de encerrar a sessão do Firebase Auth
    dataService.detachListeners();
    dataService.setSessionUserId(null);
    try {
      await signOut(auth);
    } catch {
      // ignora silenciosamente se não havia sessão ativa no Auth
    }
  },
};
