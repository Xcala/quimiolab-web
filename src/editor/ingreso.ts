/**
 * Ingreso al editor y al panel: enlace al correo (sin contraseña; sirve con Outlook, Gmail o cualquier correo)
 * y, como alternativa, Google. Solo los correos de ADMINS pueden pedir el enlace; la protección real está en
 * firestore.rules (token con email_verified, que el enlace al correo marca como verificado).
 * Requiere en Firebase → Authentication → Método de acceso: «Correo electrónico/contraseña» con
 * «Vínculo del correo electrónico (acceso sin contraseña)» habilitado.
 */
import { GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, type Auth } from 'firebase/auth';
import { ADMINS } from './config';

const LS = 'ql_correo_ingreso';
const autorizado = (c: string) => ADMINS.map((a) => a.toLowerCase()).includes(c.trim().toLowerCase());

/** Dirección a la que vuelve el enlace: la misma pantalla, sin los parámetros del enlace anterior. */
function volver() {
  const u = new URL(location.href);
  ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl', 'tenantId'].forEach((p) => u.searchParams.delete(p));
  return u.origin + u.pathname + u.search.replace(/=(&|$)/g, '$1') + u.hash;
}

/** Si la página se abrió desde el enlace del correo, termina el ingreso. Devuelve un mensaje de error o null. */
export async function completarEnlace(auth: Auth): Promise<string | null> {
  if (!isSignInWithEmailLink(auth, location.href)) return null;
  let correo = '';
  try { correo = localStorage.getItem(LS) || ''; } catch { /* sin almacenamiento */ }
  // abierto en otro equipo o navegador: se confirma el correo
  if (!correo) correo = (prompt('Para terminar de entrar, escribe tu correo de Quimiolab:') || '').trim();
  if (!correo) return 'Falta tu correo para terminar de entrar.';
  try {
    await signInWithEmailLink(auth, correo, location.href);
    try { localStorage.removeItem(LS); } catch { /* nada */ }
    history.replaceState(history.state, '', volver());
    return null;
  } catch (e: any) {
    history.replaceState(history.state, '', volver());
    return e?.code === 'auth/invalid-action-code' || e?.code === 'auth/expired-action-code'
      ? 'Ese enlace ya se usó o venció. Pide uno nuevo.'
      : e?.code === 'auth/invalid-email' ? 'El correo no coincide con el del enlace. Pide uno nuevo desde este equipo.' : 'No se pudo entrar con ese enlace. Pide uno nuevo.';
  }
}

/** Formulario de ingreso: correo → enlace; debajo, Google. `clases` adapta los botones al editor o al panel. */
export function formularioIngreso(auth: Auth, clases: { btn: string; primario: string; campo: string; nota: string }, error?: string | null): HTMLElement {
  auth.languageCode = 'es'; // el correo del enlace llega en español
  const f = document.createElement('form'); f.className = 'ingreso'; f.noValidate = true;
  f.innerHTML = `
    <label class="${clases.campo}"><span>Tu correo de Quimiolab</span><input type="email" name="correo" autocomplete="email" inputmode="email" placeholder="nombre@quimiolab.com" required></label>
    <button type="submit" class="${clases.btn} ${clases.primario}">Enviarme el enlace de acceso</button>
    <p class="${clases.nota} ingreso-estado" role="status">${error ? `<b style="color:#B42318">${error}</b>` : 'Te llega un correo con un enlace para entrar. No necesitas contraseña.'}</p>
    <p class="${clases.nota} ingreso-o">¿Tu cuenta es de Google (Gmail o Google Workspace)?</p>
    <button type="button" class="${clases.btn} ingreso-google"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg> Entrar con Google</button>`;
  const input = f.querySelector<HTMLInputElement>('input')!;
  const estado = f.querySelector<HTMLElement>('.ingreso-estado')!;
  const enviar = f.querySelector<HTMLButtonElement>('button[type=submit]')!;
  try { input.value = localStorage.getItem(LS) || ''; } catch { /* nada */ }
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = input.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { estado.innerHTML = '<b style="color:#B42318">Escribe un correo válido.</b>'; input.focus(); return; }
    if (!autorizado(correo)) { estado.innerHTML = `<b style="color:#B42318">${correo} no está autorizado para editar.</b> Pide a Braindy que lo agregue.`; return; }
    enviar.disabled = true; enviar.textContent = 'Enviando…';
    try {
      await sendSignInLinkToEmail(auth, correo, { url: volver(), handleCodeInApp: true });
      try { localStorage.setItem(LS, correo); } catch { /* nada */ }
      estado.innerHTML = `<b>Listo: revisa ${correo}.</b> Abre el correo de <b>noreply@quimiolab-web.firebaseapp.com</b> y pulsa el enlace (desde este mismo equipo si puedes). Si no aparece en 2 minutos, mira en <b>Correo no deseado</b>.`;
      enviar.textContent = 'Reenviar el enlace';
    } catch (err: any) {
      console.error(err);
      estado.innerHTML = err?.code === 'auth/operation-not-allowed'
        ? '<b style="color:#B42318">El ingreso por correo aún no está activado.</b> Avísale a Braindy.'
        : '<b style="color:#B42318">No se pudo enviar el enlace.</b> Revisa tu conexión e inténtalo de nuevo.';
      enviar.textContent = 'Enviarme el enlace de acceso';
    }
    enviar.disabled = false;
  });
  f.querySelector('.ingreso-google')!.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => { if (e?.code !== 'auth/popup-closed-by-user') estado.innerHTML = '<b style="color:#B42318">No se pudo entrar con Google.</b> Si tu navegador bloqueó la ventana, permítela e inténtalo de nuevo.'; }));
  return f;
}
