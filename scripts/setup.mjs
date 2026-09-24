#!/usr/bin/env node
/**
 * Copia arquivos .env de exemplo se ainda não existirem.
 * Uso: npm run setup (na raiz do monorepo)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const copies = [
  {
    src: path.join(root, "frontend", ".env.example"),
    dest: path.join(root, "frontend", ".env.local"),
    label: "frontend/.env.local",
  },
  {
    src: path.join(root, "backend", ".env.example"),
    dest: path.join(root, "backend", ".env"),
    label: "backend/.env",
  },
];

let created = 0;

for (const { src, dest, label } of copies) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠ Arquivo de exemplo ausente: ${src}`);
    continue;
  }

  if (fs.existsSync(dest)) {
    console.log(`✓ Já existe: ${label}`);
    continue;
  }

  fs.copyFileSync(src, dest);
  console.log(`✓ Criado: ${label}`);
  created += 1;
}

if (created > 0) {
  console.log("\nPróximo passo: npm install && npm run dev");
} else {
  console.log("\nAmbiente já configurado. Rode: npm install && npm run dev");
}
