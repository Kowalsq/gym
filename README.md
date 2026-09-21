# Ferro

App pessoal de evolução na academia. No celular você anota o treino em texto, no mesmo formato que já usava no WhatsApp; no PC você vê a evolução: carga por exercício, o que aumentar no próximo treino, frequência. PWA, funciona offline, dados ficam no aparelho.

Design, modelo de dados e fases estão em [docs/DESIGN.md](docs/DESIGN.md). Mockups das telas em [docs/mockups.html](docs/mockups.html).

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal. Para testar no celular na mesma rede: `npm run dev -- --host`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checa tipos e gera `dist/` com service worker |
| `npm run preview` | Serve o build para testar a PWA |
| `npm test` | Roda os testes (regras de volume, 1RM, PR) |
| `npm run lint` | Lint com oxlint |

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), React Router, vite-plugin-pwa, Vitest.

## Estrutura

```
src/
  db/        schema Dexie, seed de exercícios, consultas
  lib/       regras puras (métricas, formatação) e testes
  components/ shell com navegação inferior, ícones
  pages/     uma tela por arquivo (Home é o painel de evolução, QuickNote é o Anotar)
```
