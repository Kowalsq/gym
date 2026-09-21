# Ferro

App pessoal de evolução na academia. No celular você anota o treino em texto, no mesmo formato que já usava no WhatsApp; no PC você vê a evolução: carga por exercício, o que aumentar no próximo treino, frequência. PWA, funciona offline, dados ficam no aparelho.

Design, modelo de dados e fases estão em [docs/DESIGN.md](docs/DESIGN.md). Mockups das telas em [docs/mockups.html](docs/mockups.html).

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal. Para testar no celular na mesma rede: `npm run dev -- --host`.

## Produção

Publicado no GitHub Pages em **https://kowalsq.github.io/gym/**. Todo push na `main` roda testes, faz o build e publica (`.github/workflows/deploy.yml`). A primeira execução liga o Pages sozinha; se falhar, em *Settings → Pages* escolha *Source: GitHub Actions* e rode o workflow de novo.

No celular, abra o endereço no Chrome e use *Adicionar à tela inicial*. O app funciona offline depois do primeiro acesso.

Os dados ficam no aparelho. Para celular e PC verem a mesma coisa, ligue a sincronização em *Ajustes*: gere um token clássico do GitHub só com o escopo `gist` (o link está na tela) e cole nos dois aparelhos. O app guarda tudo num Gist privado da sua conta e sincroniza sozinho.

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
  components/ shell (abas no celular, barra lateral no PC), gráfico, heatmap, ícones
  pages/     uma tela por arquivo (Home é o painel de evolução, QuickNote é o Anotar)
  sync/      snapshot, mesclagem (testada) e cliente do Gist
```
