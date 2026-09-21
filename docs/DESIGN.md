# Ferro — documento de design

App pessoal para registrar treinos de academia: séries, repetições e carga, com histórico e progresso por exercício. Feito para ser usado com uma mão, no celular, entre uma série e outra.

> Nome provisório. "Ferro" é curto, cabe em um ícone e remete direto ao assunto.

## Princípios

1. **Lançar uma série leva menos de 3 segundos.** Tela de treino é a mais importante; tudo nela tem alvo de toque grande (mínimo 48 px) e o teclado numérico abre já com o valor anterior preenchido.
2. **A última vez sempre visível.** Ao lançar uma série, o app mostra o que foi feito no mesmo exercício na sessão anterior. É o recurso que faz a pessoa progredir.
3. **Offline primeiro.** Todos os dados ficam no aparelho (IndexedDB). Nada depende de rede.
4. **Pouca cerimônia.** Sem login, sem onboarding longo. Abre e treina.

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| UI | React 19 + TypeScript + Vite | Rápido de iterar, tipagem ajuda no modelo de dados |
| Estilo | Tailwind CSS 4 com tokens próprios | Produtividade sem lutar contra CSS |
| Dados | Dexie (IndexedDB) | Offline, consultas por índice, migrações de schema |
| Rotas | React Router | Navegação por abas e telas de detalhe |
| PWA | vite-plugin-pwa | Instalável na tela inicial, funciona offline |
| Gráficos | SVG próprio (fase 3) | Poucos gráficos, controle total do visual |
| Testes | Vitest | Regras de PR, 1RM e volume são puras e testáveis |

Sem backend. Backup e sincronização entram depois via exportação JSON.

## Identidade visual

Referência: ferro, giz e borracha de piso de academia. Tema escuro é o principal (celular, mão suada, leitura rápida); tema claro existe e segue o mesmo sistema de tokens.

### Cores

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#141619` | `#EEF0F3` | Fundo da página |
| `--surface` | `#1E2126` | `#FFFFFF` | Cards, linhas de série |
| `--surface-2` | `#282C33` | `#E3E6EB` | Inputs, chips |
| `--line` | `#343941` | `#D2D6DD` | Bordas finas |
| `--text` | `#ECEEF1` | `#15181C` | Texto principal (giz) |
| `--muted` | `#8B929C` | `#5F6772` | Rótulos, secundário |
| `--accent` | `#FF7A1A` | `#E2620A` | Ação primária, série concluída, PR |
| `--accent-ink` | `#1A0D00` | `#FFFFFF` | Texto sobre o acento |
| `--good` | `#4CC38A` | `#1F8F5B` | Progrediu vs. última vez |
| `--warn` | `#F2C94C` | `#B08600` | Regrediu, aviso |

O laranja é o único acento. Verde e amarelo são semânticos (melhorou, piorou) e não competem com ele.

### Tipografia

- **Archivo** (700 a 800) para títulos e números grandes: carga, reps, cronômetro. Sempre com `tabular-nums` para colunas alinhadas.
- **Public Sans** (400 a 600) para texto corrido, rótulos e botões.
- Escala: 12 / 14 / 16 / 20 / 28 / 40 px. Rótulos em caixa alta com `letter-spacing: 0.06em`.

### Forma

- Raio 12 px em cards, 10 px em inputs, pílula em chips e botão primário.
- Sem sombras no tema escuro; separação por contraste de superfície. Tema claro usa sombra suave única.
- Série concluída: fundo `--accent` a 12 % e check laranja. Série pendente: superfície neutra.

## Modelo de dados

```
Exercise        { id, name, muscleGroup, equipment, notes?, createdAt }
Routine         { id, name, order, items: RoutineItem[] }
RoutineItem     { exerciseId, targetSets, targetRepsMin, targetRepsMax, restSeconds? }
Session         { id, routineId?, name, startedAt, endedAt?, notes? }
SetEntry        { id, sessionId, exerciseId, setNumber, weightKg, reps, isWarmup, rpe?, doneAt }
BodyWeight      { id, date, kg }                       (fase 4)
```

Índices Dexie: `SetEntry` por `[exerciseId+doneAt]` (busca "última vez" e gráfico de progresso) e por `sessionId`. `Session` por `startedAt`.

Regras derivadas, calculadas e não armazenadas:

- **Volume** da sessão = soma de `weightKg × reps` das séries que não são aquecimento.
- **1RM estimado** (Epley) = `peso × (1 + reps / 30)`.
- **PR** de um exercício = maior `weightKg` com `reps ≥ 1`, e maior 1RM estimado. Dois recordes separados.
- **Sugestão de progressão**: se todas as séries alvo foram cumpridas no limite superior de reps, sugerir `+2,5 kg` (barra) ou `+1 kg` (halter) na próxima sessão.

## Telas

Navegação inferior com quatro abas: **Início · Histórico · Exercícios · Ajustes**. A tela de treino em andamento cobre a navegação enquanto ativa.

### 1. Início
- Botão primário grande: **Iniciar treino**. Se houver rotinas, mostra a próxima da sequência (A → B → C) como padrão e as outras como opções.
- Semana atual em sete pontos (treinou / não treinou).
- Último treino: nome, data, duração, volume.

### 2. Treino em andamento
- Cabeçalho: nome do treino, cronômetro total, botão **Concluir**.
- Lista de exercícios. Cada exercício tem uma tabela: `#` · `Anterior` · `kg` · `Reps` · `✓`.
- Nova série já vem preenchida com os valores da série anterior. Toque no ✓ conclui e inicia o timer de descanso.
- Timer de descanso fixo no rodapé, com `+30 s` e **Pular**.
- Ações rápidas por exercício: **+ série**, **Anotação**, **Trocar exercício**.
- **Adicionar exercício** ao final para treinos livres.

### 3. Histórico
- Lista por data (mais recente no topo). Card: nome, dia, duração, volume, quantidade de PRs.
- Toque abre a sessão completa, com opção de editar valores.

### 4. Exercícios
- Busca e filtro por grupo muscular. Item mostra PR atual e data da última execução.
- Detalhe do exercício (fase 3): gráfico de carga máxima por sessão, PRs, últimas 5 sessões e anotações fixas (ajuste de banco, pegada).

### 5. Ajustes
- Rotinas (criar e ordenar), unidade, tema, exportar / importar JSON.

## Fases

1. **MVP**: exercícios, iniciar treino livre, lançar séries, histórico, "anterior" na linha da série.
2. **Rotinas e fluidez**: rotinas A/B/C, timer de descanso, repetir série, anotações por exercício.
3. **Progresso**: gráfico por exercício, PRs com aviso na hora, volume semanal por grupo muscular, 1RM estimado, sugestão de progressão.
4. **Extras**: exportar e importar, peso corporal, calculadora de anilhas, heatmap de frequência, tema claro refinado.

## Fora de escopo por agora

Login, sincronização entre aparelhos, planos de treino prontos, rede social. Podem entrar depois sem mudar o modelo de dados.
