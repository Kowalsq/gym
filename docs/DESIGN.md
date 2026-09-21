# Ferro — documento de design

App pessoal de desenvolvimento na academia. Duas superfícies com pesos diferentes:

- **PC (principal):** tela de evolução pessoal. Histórico, gráficos de carga por exercício, o que aumentar no próximo treino, frequência. Não copia apps de treino existentes; é o painel de uma pessoa só.
- **Celular (secundário):** só anotar. Substitui a mensagem que hoje vai para o WhatsApp, no mesmo formato de texto, uma linha por exercício.

> Nome provisório. "Ferro" é curto, cabe em um ícone e remete direto ao assunto.

## O formato da anotação

É o que já é usado hoje e o app aceita exatamente assim:

```
Desenvolvimento máquina 75 10 7 manter
Remada baixa 120 10 8 manter
Crucifixo invertido 30kg 10 8 manter
Crucifixo 2x8 55kg manter
```

Nome do exercício, peso (com ou sem "kg"), repetições de cada série ou `NxR`, e a decisão para o próximo treino: **manter**, **aumentar** ou **diminuir**. Uma linha só com data (`21/09`) abre um novo dia, o que permite colar o histórico inteiro do WhatsApp de uma vez. O parser está em `src/lib/parse.ts` com testes.

## Princípios

1. **Anotar no celular leva o mesmo tempo que no WhatsApp.** Uma caixa de texto, o mesmo formato, um botão salvar. O app confere e mostra o que entendeu antes de gravar.
2. **A decisão é dado, não comentário.** "Manter" e "aumentar" são gravados e viram uma lista do que fazer no próximo treino, e um sinal no gráfico.
3. **No PC, evolução em primeiro lugar.** A tela inicial é o painel: carga ao longo do tempo por exercício, tabela com estado atual de cada exercício, frequência.
4. **Offline primeiro.** Todos os dados ficam no aparelho (IndexedDB). Nada depende de rede. Backup em JSON e exportação no formato de texto original.
5. **Pouca cerimônia.** Sem login, sem onboarding. Abre e anota.

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
ExerciseLog     { id, sessionId, exerciseId, decision (manter|aumentar|diminuir|null), note?, raw? }
BodyWeight      { id, date, kg }                       (fase 4)
```

`ExerciseLog` é um por exercício por sessão e guarda a decisão para o próximo treino e o texto original digitado.

Índices Dexie: `SetEntry` por `[exerciseId+doneAt]` (busca "última vez" e gráfico de progresso) e por `sessionId`. `Session` por `startedAt`.

Regras derivadas, calculadas e não armazenadas:

- **Volume** da sessão = soma de `weightKg × reps` das séries que não são aquecimento.
- **1RM estimado** (Epley) = `peso × (1 + reps / 30)`.
- **PR** de um exercício = maior `weightKg` com `reps ≥ 1`, e maior 1RM estimado. Dois recordes separados.
- **Sugestão de progressão**: se todas as séries alvo foram cumpridas no limite superior de reps, sugerir `+2,5 kg` (barra) ou `+1 kg` (halter) na próxima sessão.

## Telas

Cinco seções: **Evolução · Anotar · Histórico · Exercícios · Ajustes**. No PC, barra lateral fixa à esquerda e conteúdo largo. No celular, abas embaixo.

### 1. Evolução (tela inicial, foco no PC)
- Filtro de período em uma linha: 30 dias, 90 dias, 6 meses, 1 ano, tudo. Vale para tudo abaixo.
- Quatro números: treinos no período, exercícios acompanhados, recordes no período, quantos exercícios estão marcados para aumentar.
- **Gráfico de carga máxima por sessão**, até quatro exercícios ao mesmo tempo, com tooltip que mostra reps de cada série. Cores de série em ordem fixa, validadas para daltonismo (`--chart-1..4`).
- **Próximo treino**: lista do que foi marcado "aumentar" ou "diminuir" na última vez, com a carga atual e a sugerida (2,5 kg em barra e halter, 5 kg em máquina e cabo).
- Tabela de todos os exercícios: carga atual, reps, variação no período, decisão, última vez. Selo PR quando a última sessão foi recorde.
- Heatmap de frequência das últimas 26 semanas.
- No celular, um botão "Anotar treino de hoje" no topo.

### 2. Anotar (foco no celular)
- Caixa de texto com o formato do WhatsApp, rascunho salvo automaticamente, seletor de dia.
- Abaixo, "o que entendi": cada linha interpretada, com nome, peso, reps, decisão e avisos. Nomes desconhecidos ganham o selo "novo".
- Salvar grava uma sessão por dia. Nomes casam com a biblioteca por igualdade (sem acento e caixa) ou por prefixo único quando têm duas ou mais palavras. Um nome só de uma palavra nunca casa por prefixo.
- Aceita histórico inteiro colado, com linhas de data separando os dias e prefixos de exportação do WhatsApp.

### 3. Histórico
- Lista por data com totais do mês. Detalhe da sessão mostra cada exercício com carga, reps e decisão, e tem "Copiar como texto".

### 4. Exercícios
- Busca, filtro por grupo muscular, cadastro. Detalhe com carga atual, recorde, 1RM estimado, gráfico e lista de sessões com decisão. Edição de nome, grupo, equipamento e anotações fixas.

### 5. Ajustes
- Tema, backup JSON (exportar e importar), exportação de todo o histórico no formato de texto original.

### Treino em andamento (secundário)
- Lançamento série a série com coluna "anterior", cronômetro e aquecimento. Existe, mas o caminho principal no celular é Anotar.

## Fases

1. **Feito**: anotar por texto, importação do WhatsApp, painel de evolução com gráfico, próximo treino, tabela, heatmap, histórico, exercícios, backup e exportação em texto.
2. **Refino do painel**: comparar períodos (este mês vs. anterior), volume semanal por grupo muscular, meta por exercício com linha no gráfico, marcar semanas de deload e lesões para explicar quedas.
3. **Anotar mais rápido**: sugestão de linha pronta com o último treino de cada exercício para só editar o número, atalhos no celular (PWA instalada), ícones PNG.
4. **Extras**: peso corporal, calculadora de anilhas, sincronização opcional entre PC e celular via arquivo.

## Fora de escopo por agora

Login, servidor, planos de treino prontos, rede social. Podem entrar depois sem mudar o modelo de dados.
