/**
 * Equipo de Quimiolab en Firestore (colección «equipo»), compartido por la tarjeta virtual y la firma de correo.
 * Las dos herramientas (src/admin/herramientas/*.html) siguen funcionando solas en el navegador; este módulo les
 * suma el ingreso con la cuenta autorizada (mismo enlace al correo / Google del panel) y una sincronización en
 * vivo en las dos direcciones:
 *  - tarjeta: el equipo viene de Firestore; agregar, editar o borrar una persona se sube;
 *  - firma: «Persona del equipo» llena los datos; editar nombre, cargo, celular, correo o foto actualiza su ficha.
 * Lo que cambia en una herramienta aparece en la otra (onSnapshot), sin recargar.
 * Documento por persona: { nombre, cargo, correo, cel, ciudad, foto (JPEG data URL), orden, by, at }.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { firebaseConfig, ADMINS } from '../editor/config';
import { completarEnlace, formularioIngreso } from '../editor/ingreso';

type Persona = { id?: string; nombre: string; cargo: string; correo: string; cel: string; ciudad: string; foto: string | null; orden?: number };
const COLECCION = 'equipo';
const CAMPOS = ['nombre', 'cargo', 'correo', 'cel', 'ciudad', 'foto'] as const;
const ESPERA = 1200; // ms sin cambios antes de subir

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
.eq-sel{font:inherit;padding:8px 10px;border:1px solid #C9D3E3;border-radius:8px;width:100%;margin-top:4px}
.eq-ayuda{font-size:12px;color:#55627A;margin:4px 0 0}`;

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
    <p class="eq-nota">Con tu correo autorizado ves al equipo guardado y lo que cambies queda para todos, en la tarjeta y en la firma.</p></div>`;
  const caja = m.querySelector('.eq-caja')!;
  caja.append(formularioIngreso(auth, { btn: 'eq-btn', primario: '', campo: 'eq-campo', nota: 'eq-nota' }, error));
  const cerrar = document.createElement('button'); cerrar.type = 'button'; cerrar.className = 'eq-btn eq-claro'; cerrar.textContent = 'Cerrar';
  cerrar.style.marginTop = '10px'; cerrar.addEventListener('click', () => m.remove()); caja.append(cerrar);
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  document.body.append(m);
  m.querySelector<HTMLInputElement>('input')?.focus();
}

const limpia = (d: any, id: string): Persona => ({ id, nombre: d.nombre || '', cargo: d.cargo || '', correo: d.correo || '', cel: d.cel || '',
  ciudad: d.ciudad || 'Bogotá', foto: d.foto || null, orden: d.orden });

/** Escucha la colección en vivo; `cb` recibe el equipo ordenado. */
function escuchar(db: Firestore, cb: (equipo: Persona[]) => void, alFallar: () => void) {
  return onSnapshot(collection(db, COLECCION), (snap) => {
    cb(snap.docs.map((d) => limpia(d.data(), d.id))
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre)));
  }, (e) => { console.error(e); alFallar(); });
}

const idDe = (p: Persona) => (p.correo.split('@')[0] || p.nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'persona-' + Date.now();
const huella = (p: Partial<Persona>) => JSON.stringify(CAMPOS.map((c) => p[c] ?? ''));

async function guardarPersona(db: Firestore, id: string, p: Partial<Persona>, usuario: string, orden?: number) {
  const datos: Record<string, unknown> = { by: usuario, at: serverTimestamp() };
  CAMPOS.forEach((c) => { if (c in p) datos[c] = p[c] ?? (c === 'foto' ? null : ''); });
  if (orden !== undefined) datos.orden = orden;
  await setDoc(doc(db, COLECCION, id), datos, { merge: true });
}

/* ── tarjeta: el equipo de Firestore manda; cada cambio local se sube ── */
function conectarTarjeta(db: Firestore, usuario: string, aviso: (t: string) => void) {
  const A = w.GA_APP;
  const subido = new Map<string, string>(); // id → huella de lo que hay en Firestore
  let primera = true, reloj: number | undefined, subiendo = false;

  const refrescar = () => { if (!A.editado) A.reconstruir(); w.GA_UI?.refrescarTodo(); };

  const sincronizar = async () => {
    if (subiendo) { clearTimeout(reloj); reloj = window.setTimeout(sincronizar, ESPERA); return; }
    subiendo = true;
    const lista: Persona[] = A.equipo;
    const vivos = new Set<string>();
    try {
      for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        if (!p.id) { let id = idDe(p); while (vivos.has(id) || subido.has(id)) id += '-2'; p.id = id; }
        vivos.add(p.id);
        const h = huella(p);
        if (subido.get(p.id) === h) continue;
        await guardarPersona(db, p.id, p, usuario, subido.has(p.id) ? undefined : i);
        subido.set(p.id, h);
      }
      for (const id of [...subido.keys()]) if (!vivos.has(id)) { await deleteDoc(doc(db, COLECCION, id)); subido.delete(id); }
      aviso(`Equipo guardado en Quimiolab · ${lista.length} personas`);
    } catch (e) {
      console.error(e);
      aviso('No se pudo guardar el equipo en Quimiolab. Revisa la conexión; tus cambios siguen en este navegador.');
    } finally { subiendo = false; }
  };

  const previo = A.alGuardar;
  A.alGuardar = (que: string, e: unknown) => {
    if (previo) previo(que, e);
    if (que === 'cambio' && !primera) { clearTimeout(reloj); reloj = window.setTimeout(sincronizar, ESPERA); }
  };

  return escuchar(db, (remoto) => {
    if (primera) {
      primera = false;
      remoto.forEach((p) => subido.set(p.id!, huella(p)));
      if (remoto.length) { A.setEquipo(remoto.map((p) => ({ ...p }))); A.activo = 0; refrescar(); }
      // Firestore vacío: lo que hay en este navegador es el punto de partida
      else if (A.equipo.some((p: Persona) => p.correo && !/^nombre@/.test(p.correo))) sincronizar();
      aviso(`Equipo de Quimiolab · ${remoto.length} personas. Lo que cambies aquí también cambia en la firma de correo.`);
      return;
    }
    // cambios que llegan de la firma o de otra persona
    const lista: Persona[] = A.equipo;
    let cambio = false;
    const ids = new Set(remoto.map((p) => p.id));
    for (const r of remoto) {
      const h = huella(r);
      if (subido.get(r.id!) === h) continue; // ya lo teníamos (o es el eco de lo que subimos)
      subido.set(r.id!, h);
      const local = lista.find((p) => p.id === r.id);
      if (local) { if (huella(local) !== h) { CAMPOS.forEach((c) => { (local as any)[c] = r[c]; }); cambio = true; } }
      else { lista.push({ ...r }); cambio = true; }
    }
    for (let i = lista.length - 1; i >= 0; i--) {
      const id = lista[i].id;
      if (id && subido.has(id) && !ids.has(id)) { lista.splice(i, 1); subido.delete(id); cambio = true; }
    }
    if (cambio) {
      if (A.activo >= lista.length) A.activo = 0;
      refrescar();
      aviso('El equipo se actualizó con cambios hechos en la firma de correo o por otra persona.');
    }
  }, () => aviso('No se pudo leer el equipo de Quimiolab. Recarga la página.'));
}

/* ── firma: «Persona del equipo» llena los datos; lo que se edite se guarda en su ficha ── */
function conectarFirma(db: Firestore, usuario: string, aviso: (t: string) => void) {
  const A = w.GAF_APP;
  const R = w.GAF_RECURSOS;
  const LS = 'ql_equipo_firma';
  let equipo: Persona[] = [];
  let elegido = ''; try { elegido = localStorage.getItem(LS) || ''; } catch { /* nada */ }
  let aplicando = false, pendiente = false, reloj: number | undefined, primera = true;

  const ancla = document.getElementById('f-nombre')?.closest('.grid2');
  const caja = document.createElement('div'); caja.style.margin = '0 0 14px';
  caja.innerHTML = `<label for="eq-persona" style="font-weight:700;font-size:13px">Persona del equipo</label>
    <select id="eq-persona" class="eq-sel"></select>
    <p class="eq-ayuda">Lo que cambies aquí (nombre, cargo, celular, correo o foto) también cambia en su tarjeta virtual.</p>`;
  ancla?.before(caja);
  const sel = caja.querySelector('select')!;

  const desdeFirma = (): Partial<Persona> => {
    const d = A.datos;
    const foto = A.recursos.foto && A.recursos.foto !== R.foto && /^data:image\//.test(A.recursos.foto) ? A.recursos.foto : undefined;
    const p: Partial<Persona> = { nombre: d.nombre || '', cargo: d.cargo || '', correo: d.correo || '', cel: String(d.cel || '').replace(/^cel\.?\s*/i, '') };
    if (foto) p.foto = foto;
    return p;
  };
  const igual = (a: Partial<Persona>, b: Persona) => (['nombre', 'cargo', 'correo', 'cel', 'foto'] as const).every((c) => !(c in a) || (a[c] ?? '') === (b[c] ?? ''));

  const aplicar = (p: Persona) => {
    aplicando = true;
    Object.assign(A.datos, { nombre: p.nombre, cargo: p.cargo, cel: p.cel ? 'Cel. ' + p.cel : '', correo: p.correo });
    A.recursos.foto = p.foto || R.foto;
    document.getElementById('foto-mini')?.setAttribute('src', A.recursos.foto);
    A.refrescarTodo?.(); A.pintar(); A.guardar();
    aplicando = false;
  };

  const opciones = () => {
    sel.innerHTML = `<option value="">— Elige para llenar tus datos —</option>` +
      equipo.map((p) => `<option value="${p.id}">${p.nombre.replace(/</g, '&lt;')}</option>`).join('');
    sel.value = equipo.some((p) => p.id === elegido) ? elegido : '';
  };

  sel.addEventListener('change', () => {
    elegido = sel.value; try { localStorage.setItem(LS, elegido); } catch { /* nada */ }
    const p = equipo.find((x) => x.id === elegido); if (p) aplicar(p);
  });

  const subir = async () => {
    const p = equipo.find((x) => x.id === elegido);
    const nuevo = desdeFirma();
    try {
      if (p && !igual(nuevo, p)) { await guardarPersona(db, p.id!, nuevo, usuario); aviso(`Ficha de ${nuevo.nombre || p.nombre} actualizada · también cambia en su tarjeta`); }
    } catch (e) { console.error(e); aviso('No se pudo guardar en Quimiolab. Revisa la conexión; tu firma sigue en este navegador.'); }
    finally { pendiente = false; }
  };

  const previo = A.alGuardar;
  A.alGuardar = (que: string) => {
    if (previo) previo(que);
    if (que === 'cambio' && !aplicando && elegido) { pendiente = true; clearTimeout(reloj); reloj = window.setTimeout(subir, ESPERA); }
  };

  return escuchar(db, (remoto) => {
    equipo = remoto; opciones();
    const p = equipo.find((x) => x.id === elegido);
    // al abrir, o si la ficha cambió desde la tarjeta (y no hay una edición local esperando), la firma se pone al día
    if (p && (primera || (!pendiente && !igual(desdeFirma(), p)))) aplicar(p);
    if (primera) aviso(`Equipo de Quimiolab · ${remoto.length} personas. Elige la persona en «Tus datos».`);
    primera = false;
  }, () => aviso('No se pudo leer el equipo de Quimiolab. Recarga la página.'));
}

async function iniciar() {
  if (!herramienta || !firebaseConfig.apiKey) return;
  const barra = montarBarra();
  const app = initializeApp(firebaseConfig, 'equipo');
  const auth = getAuth(app);
  const db = getFirestore(app);
  const error = await completarEnlace(auth);
  let dejar: (() => void) | null = null;
  const pintar = (html: string) => { barra.innerHTML = html; };
  onAuthStateChanged(auth, (user: User | null) => {
    dejar?.(); dejar = null;
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
    document.querySelector('.eq-modal')?.remove();
    pintar(`<span class="eq-texto">Cargando el equipo de Quimiolab…</span><span class="eq-esp"></span><small>${correo}</small><button type="button" class="eq-btn eq-claro">Salir</button>`);
    barra.querySelector('button')!.addEventListener('click', () => signOut(auth).then(() => location.reload()));
    const aviso = (t: string) => { const s = barra.querySelector('.eq-texto'); if (s) s.textContent = t; };
    dejar = herramienta === 'tarjeta' ? conectarTarjeta(db, correo, aviso) : conectarFirma(db, correo, aviso);
  });
}

iniciar();
