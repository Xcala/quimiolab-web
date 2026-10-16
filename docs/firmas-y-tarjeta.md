# Firma de correo y tarjeta virtual — guía para el equipo de Quimiolab

Dos herramientas en el sitio, sin instalar nada y sin cuenta:

- **Firma de correo:** https://www.quimiolab.com/admin/firmas/
- **Tarjeta virtual con QR:** https://www.quimiolab.com/admin/tarjeta/

También se abren desde el panel `/admin/` (botones **Firmas** y **Tarjeta virtual**). No aparecen en Google.
**Lo que escribes queda en tu computador**: nada se sube a un servidor.

## Firma de correo (5 minutos)

1. Abre la página de firmas y escribe **nombre, cargo, celular y correo**. PBX, dirección, web, frase y aviso ya vienen con los datos de Quimiolab.
2. Escribe tu **extensión** si la tienes (se suma al PBX). Lo que dejes vacío no aparece en la firma.
3. Elige el diseño: **Institucional** (sirve para todos), **Con foto y QR** (comerciales) o **Compacta**.
4. Presiona **Copiar firma** y pégala con `Ctrl + V`:
   - **Outlook de escritorio:** Archivo → Opciones → Correo → Firmas → Nueva → pegar en el recuadro → elegir como predeterminada.
   - **Outlook web:** engranaje → Correo → Redactar y responder → Firma → pegar → Guardar.
5. Envíate un correo de prueba. Si algo se ve corrido, toma un pantallazo **del correo recibido** y envíalo a Braindy.

En el celular las apps solo aceptan texto: deja ahí una firma corta escrita a mano.

## Tarjeta virtual

1. En **Miembros de equipo**, presiona **+ Agregar** y llena nombre, cargo, correo y celular. Sube la foto si vas a usar la versión **con foto**.
2. Ajusta lo necesario (tamaño de foto, logo, QR). **El QR contiene** el contacto completo (vCard) por defecto: al escanearlo, el celular ofrece guardar el contacto.
3. **Descargar PNG** para compartir por WhatsApp o redes; **Descargar vCard (.vcf)** para enviar el contacto. **Probar QR** muestra lo que lee el código.
4. **Editor libre** permite mover y cambiar cualquier elemento; **Volver a la plantilla** deshace todo.

## Guardar el trabajo

Cada cambio se guarda solo en el navegador. Para no perderlo (al limpiar el navegador o cambiar de computador) usa **Descargar copia**: crea un archivo `.quimiolab.json` que se vuelve a cargar con **Abrir una copia**. En Chrome y Edge puedes elegir un archivo una vez y se reescribe solo.

---
Para Braindy: las páginas se generan con `node scripts/firmas_tarjeta.mjs` desde la skill `firma-y-tarjeta-virtual` (originales HTML de Grupo Alternativas) con la marca Quimiolab. Si la skill se actualiza, vuelve a correr el script y despliega. El aviso legal es genérico: confirmar con Quimiolab si tienen uno oficial.
