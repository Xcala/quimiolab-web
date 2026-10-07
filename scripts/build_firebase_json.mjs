// Genera firebase.json desde redirects.csv (tolera CRLF y BOM de Excel).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const filas = readFileSync(join(raiz, 'redirects.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(',').map((s) => s.trim()));
const redirects = filas.map(([source, destination, type]) => ({ source, destination, type: Number(type) || 301 }));
// Dominio viejo (quimiolab.com) y variantes: una sola 301 a la ruta equivalente en www.quimiolab.com.co
const hosting = {
  public: 'dist',
  cleanUrls: false,
  trailingSlash: true,
  ignore: ['firebase.json', '**/.*', '**/node_modules/**', 'archivo/**', '**/*.map'],
  redirects,
  rewrites: [
    // El rewrite al formulario solo cuando existe la Cloud Function (Fase F); antes rompería el deploy
    ...(!process.env.PUBLIC_FORM_ENDPOINT && existsSync(join(raiz, 'functions')) ? [{ source: '/api/form', function: { functionId: 'formulario', region: 'us-central1' } }] : []),
  ],
  headers: [
    { source: '**/*.@(js|css|woff2|png|jpg|jpeg|webp|svg|avif)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '**/*.html', headers: [{ key: 'Cache-Control', value: 'public, max-age=300' }] },
    { source: '**', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }] },
  ],
};
const json = { hosting };
if (existsSync(join(raiz, 'functions'))) json.functions = [{ source: 'functions', codebase: 'default', runtime: 'nodejs22', ignore: ['node_modules', '.git', 'firebase-debug.log', '*.local'] }];
if (existsSync(join(raiz, 'firestore.rules'))) json.firestore = { rules: 'firestore.rules', indexes: 'firestore.indexes.json' };
writeFileSync(join(raiz, 'firebase.json'), JSON.stringify(json, null, 2) + '\n');
console.log(`firebase.json: ${redirects.length} redirecciones, ${hosting.rewrites.length} rewrite(s)`);
