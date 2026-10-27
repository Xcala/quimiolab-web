/**
 * Equipo de Quimiolab en Firestore (colección «equipo») para la tarjeta virtual y la firma de correo.
 * Las dos herramientas (src/admin/herramientas/*.html) siguen funcionando solas en el navegador; este módulo
 * les suma el ingreso con la cuenta autorizada (mismo enlace al correo / Google del panel) y:
 *  - tarjeta: carga el equipo desde Firestore y sube cada persona que se agrega, edita o borra;
 *  - firma: un selector «Persona del equipo» que llena datos y foto.
 * Documento por persona: { nombre, cargo, correo, cel, ciudad, foto (JPEG data URL), orden, by, at }.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { firebaseConfig, ADMINS } from '../editor/config';
import { completarEnlace, formularioIngreso } from '../editor/ingreso';

type Persona = { id?: string; nombre: string; cargo: string; correo: string; cel: string; ciudad: string; foto: string | null; orden?: number };
const COLECCION = 'equipo';
const CAMPOS = ['nombre', 'cargo', 'correo', 'cel', 'ciudad', 'foto'] as const;

const w = window as any;
const herramienta: 'tarjeta' | 'firma' | null = w.GA_APP ? 'tarjeta' : w.GAF_APP ? 'firma' : null;

const css = `
.eq-barra{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:14px auto 0;max-width:1200px;padding:10px 16px;border-radius:12px;
  background:#E6F4FB;border:1px solid #B9E0F2;color:#001A4D;font:14px/1.4 Roboto,Arial,sans-serif;box-sizing:border-box;width:calc(100% - 32px)}
.eq-barra b{font-weight:700}.eq-barra .eq-esp{flex:1}
.eq-btn{font:700 13px Roboto,Arial,sans-serif;border:0;border-radius:99px;padding:8px 14px;cursor:pointer;background:#0097D6;color:#fff}
.eq-btn:hover{background:#0074A8}.eq-btn.eq-claro{background:#fff;color:#001A4D;border:1px solid #B9E0F2}
.eq-modal{position:fixed;inset:0;z-index:1000;background:rgba(0,26,77,.55);display:grid;place-items:center;padding:16px}
.eq-caja{background:#fff;border-radius:16px;padding:22px;max-width:420px;width:100%;font:15px/1.5 Roboto,Arial,sans-serif;color:#0E1A33}
.eq-caja h2{margin:0 0 6px;font:700 20px Poppins,Arial,sans-serif}.eq-caja .ingreso{display:grid;gap:10px;margin-top:12px}
.eq-caja label span{display:block;font-weight:700;font-size:13px;margin-bottom:4px}
.eq-caja input{width:100%;box-sizing:border-box;font:inherit;padding:9px 10px;border:1px solid #C9D3E3;border-radius:8px}
.eq-caja .eq-nota{font-size:13px;color:#55627A;margin:0}.eq-caja button{width:100%}
.eq-sel{font:inherit;padding:8px 10px;border:1px solid #C9D3E3;border-radius:8px;width:100%;margin-top:4px}`;

function montarBarra(): HTMLElement {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const barra = document.createElement('div'); barra.className = 'eq-barra'; barra.setAttribute('role', 'status');
  const cab = document.querySelector('header');
  if (cab) cab.after(barra); else document.body.prepend(barra);
  return barra;
}

function modalIngreso(auth: ReturnType<typeof getAuth>, error: string | null) {
  const m = document.createElement('div'); m.className = 'eq-modal';
  m.innerHTML = `<div class="eq-caja" role="dialog" aria-modal="true" aria-labelledby="eq-t"><h2 id="eq-t">Entrar al equipo de Quimiolab</h2>
    <p class="eq-nota">Con tu correo autorizado ves al equipo guardado y lo que cambies queda para todos.</p></div>`;
  const caja = m.querySelector('.eq-caja')!;
  caja.append(formularioIngreso(auth, { btn: 'eq-btn', primario: '', campo: 'eq-campo', nota: 'eq-nota' }, error));
  const cerrar = document.createElement('button'); cerrar.type = 'button'; cerrar.className = 'eq-btn eq-claro'; cerrar.textContent = 'Cerrar';
  cerrar.style.marginTop = '10px'; cerrar.addEventListener('click', () => m.remove()); caja.append(cerrar);
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  document.body.append(m);
  m.querySelector<HTMLInputElement>('input')?.focus();
}

async function leerEquipo(db: Firestore): Promise<Persona[]> {
  const snap = await getDocs(collection(db, COLECCION));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre))
    .map((p) => ({ id: p.id, nombre: p.nombre || '', cargo: p.cargo || '', correo: p.correo || '', cel: p.cel || '', ciudad: p.ciudad || 'Bogotá', foto: p.foto || null, orden: p.orden }));
}

const idDe = (p: Persona) => (p.correo.split('@')[0] || p.nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'persona-' + Date.now();
const huella = (p: Persona, i: number) => JSON.stringify([...CAMPOS.map((c) => p[c] ?? ''), i]);

/* ── tarjeta: el equipo de Firestore reemplaza al del navegador y cada cambio se sube ── */
function conectarTarjeta(db: Firestore, usuario: string, equipo: Persona[], aviso: (t: string) => void) {
  const A = w.GA_APP;
  const subido = new Map<string, string>();
  if (equipo.length) {
    equipo.forEach((p, i) => subido.set(p.id!, huella(p, i)));
    A.setEquipo(equipo.map((p) => ({ ...p })));
    A.activo = 0;
    if (!A.editado) A.reconstruir();
    w.GA_UI?.refrescarTodo();
  }
  let reloj: number | undefined;
  const sincronizar = async () => {
    const lista: Persona[] = A.equipo;
    const vivos = new Set<string>();
    try {
      for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        if (!p.id) { let id = idDe(p); while (vivos.has(id) || (subido.has(id) && !lista.some((x) => x.id === id))) id += '-2'; p.id = id; }
        vivos.add(p.id);
        const h = huella(p, i);
        if (subido.get(p.id) === h) continue;
        const datos: Record<string, unknown> = { orden: i, by: usuario, at: serverTimestamp() };
        CAMPOS.forEach((c) => { datos[c] = p[c] ?? (c === 'foto' ? null : ''); });
        await setDoc(doc(db, COLECCION, p.id), datos);
        subido.set(p.id, h);
      }
      for (const id of [...subido.keys()]) if (!vivos.has(id)) { await deleteDoc(doc(db, COLECCION, id)); subido.delete(id); }
      aviso(`Equipo guardado en Quimiolab · ${lista.length} personas`);
    } catch (e) {
      console.error(e);
      aviso('No se pudo guardar el equipo en Quimiolab. Revisa la conexión; tus cambios siguen en este navegador.');
    }
  };
  const previo = A.alGuardar;
  A.alGuardar = (que: string, e: unknown) => {
    if (previo) previo(que, e);
    if (que === 'cambio') { clearTimeout(reloj); reloj = window.setTimeout(sincronizar, 1200); }
  };
  // el equipo de Firestore estaba vacío: lo que hay en el navegador se sube como punto de partida
  if (!equipo.length && A.equipo.some((p: Persona) => p.correo && !/^nombre@/.test(p.correo))) sincronizar();
}

/* ── firma: selector que llena los datos de la persona ── */
function conectarFirma(equipo: Persona[]) {
  const A = w.GAF_APP;
  const ancla = document.getElementById('f-nombre')?.closest('.grid2');
  if (!ancla || !equipo.length) return;
  const caja = document.createElement('div'); caja.style.margin = '0 0 14px';
  caja.innerHTML = `<label for="eq-persona" style="font-weight:700;font-size:13px">Persona del equipo</label>
    <select id="eq-persona" class="eq-sel"><option value="">— Elige para llenar tus datos —</option>${equipo.map((p, i) => `<option value="${i}">${p.nombre.replace(/</g, '&lt;')}</option>`).join('')}</select>`;
  ancla.before(caja);
  caja.querySelector('select')!.addEventListener('change', (e) => {
    const p = equipo[+(e.target as HTMLSelectElement).value]; if (!p) return;
    Object.assign(A.datos, { nombre: p.nombre, cargo: p.cargo, cel: p.cel ? 'Cel. ' + p.cel : '', correo: p.correo });
    if (p.foto) { A.recursos.foto = p.foto; document.getElementById('foto-mini')?.setAttribute('src', p.foto); }
    A.refrescarTodo?.(); A.pintar(); A.guardar();
  });
}

async function iniciar() {
  if (!herramienta || !firebaseConfig.apiKey) return;
  const barra = montarBarra();
  const app = initializeApp(firebaseConfig, 'equipo');
  const auth = getAuth(app);
  const db = getFirestore(app);
  const error = await completarEnlace(auth);
  let listo = false;
  const pintar = (html: string) => { barra.innerHTML = html; };
  onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      pintar(`<span>El equipo de Quimiolab está guardado en la página. <b>Entra con tu correo autorizado</b> para cargarlo.</span><span class="eq-esp"></span><button type="button" class="eq-btn">Entrar</button>`);
      barra.querySelector('button')!.addEventListener('click', () => modalIngreso(auth, null));
      if (error) modalIngreso(auth, error);
      return;
    }
    const correo = (user.email || '').toLowerCase();
    if (!ADMINS.map((a) => a.toLowerCase()).includes(correo)) {
      pintar(`<span>Entraste como <b>${correo}</b>, que no tiene acceso al equipo. Pide a Braindy que lo agregue.</span><span class="eq-esp"></span><button type="button" class="eq-btn eq-claro">Salir</button>`);
      barra.querySelector('button')!.addEventListener('click', () => signOut(auth));
      return;
    }
    if (listo) return; listo = true;
    document.querySelector('.eq-modal')?.remove();
    pintar('<span>Cargando el equipo de Quimiolab…</span>');
    const aviso = (t: string) => { const s = barra.querySelector('.eq-texto'); if (s) s.textContent = t; };
    try {
      const equipo = await leerEquipo(db);
      pintar(`<span class="eq-texto">${herramienta === 'tarjeta' ? `Equipo de Quimiolab · ${equipo.length} personas. Lo que agregues o cambies se guarda para todos.` : `Equipo de Quimiolab · ${equipo.length} personas. Elige la persona en «Tus datos».`}</span><span class="eq-esp"></span><small>${correo}</small><button type="button" class="eq-btn eq-claro">Salir</button>`);
      barra.querySelector('button')!.addEventListener('click', () => signOut(auth).then(() => location.reload()));
      if (herramienta === 'tarjeta') conectarTarjeta(db, correo, equipo, aviso); else conectarFirma(equipo);
    } catch (e) {
      console.error(e);
      pintar('<span>No se pudo cargar el equipo. Revisa tu conexión y recarga la página.</span>');
    }
  });
}

iniciar();
