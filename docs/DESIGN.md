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
Exercise        { id, name, muscleGroup (texto livre), equipment, isCompound?, aliases?, notes?, createdAt }
Routine         { id, name ("A"), description?, order, items: RoutineItem[] }
RoutineItem     { exerciseId, alternativeIds?, targetSets, targetRepsMin, targetRepsMax, rirMin?, rirMax? }
Session         { id, kind ('gym'|'run'), routineId?, name, startedAt, endedAt?, distanceKm?, durationSec? }
Setting         { key, value }   → 'weekPlan': 7 slots (rest | run | routine)
SetEntry        { id, sessionId, exerciseId, setNumber, weightKg, reps, isWarmup, rpe?, doneAt }
ExerciseLog     { id, sessionId, exerciseId, decision (manter|aumentar|diminuir|null), note?, raw? }
BodyWeight      { id, date, kg }                       (fase 4)
```

`ExerciseLog` é um por exercício por sessão e guarda a decisão para o próximo treino e o texto original digitado.

## O programa

Três treinos full body, A, B e C, com 2 séries por exercício. Compostos (marcados com *) em 6–8 reps com RIR 1–2; isolados em 8–10 ou 10–12 com RIR 0–1. Alguns itens aceitam alternativa ("Remada Baixa no Cabo ou Remada em Máquina", "Leg Press ou Cadeira Extensora"). O treino B tem Agachamento, Levantamento Terra e Desenvolvimento como compostos. Plano da semana: Seg A, Ter corrida, Qua B, Qui corrida, Sex C. Tudo isso é carregado na primeira abertura por `src/db/seed.ts` e editável na tela Treinos. Quando o programa muda no código, `PROGRAM_VERSION` sobe e uma migração ajusta bancos existentes sem apagar histórico.

**Próximo treino**: sempre o próximo na sequência depois do último treino registrado (A → B → C → A), porque o dia da semana varia. O plano só informa; se coincidir, o motivo aparece como "plano de hoje", e em dia de corrida o painel avisa. Exercícios pulados não mudam a sequência: aparecem como "Pulados" no detalhe da sessão e como "6 de 8 exercícios" no histórico. Se um exercício não aparece em 2 ou mais treinos seguidos da mesma rotina (nem sua alternativa), o painel mostra o aviso "Sendo pulados" com a contagem e a última vez, e a lista do próximo treino marca "pulado N×" (`src/lib/skips.ts`).

Índices Dexie: `SetEntry` por `[exerciseId+doneAt]` (busca "última vez" e gráfico de progresso) e por `sessionId`. `Session` por `startedAt`.

Regras derivadas, calculadas e não armazenadas:

- **Volume** da sessão = soma de `weightKg × reps` das séries que não são aquecimento.
- **1RM estimado** (Epley) = `peso × (1 + reps / 30)`.
- **PR** de um exercício = maior `weightKg` com `reps ≥ 1`, e maior 1RM estimado. Dois recordes separados.
- **Sugestão de progressão**: se todas as séries alvo foram cumpridas no limite superior de reps, sugerir `+2,5 kg` (barra) ou `+1 kg` (halter) na próxima sessão.

## Sincronização entre aparelhos

Sem servidor próprio: o banco inteiro vai em JSON para um **Gist privado** da conta do GitHub do usuário (`src/sync/`). Token clássico com escopo `gist`, colado em Ajustes nos dois aparelhos; o app acha o Gist pela descrição ou cria um.

- **Quando**: ao abrir, ao voltar para o app, quando a internet volta e uns 3 s depois de qualquer gravação local (hooks do Dexie avisam).
- **Como**: baixa o remoto, mescla com o local, aplica o resultado e envia se mudou. Nunca envia sem antes mesclar.
- **Mesclagem** (`merge.ts`, testada): exercícios, treinos, sessões e ajustes têm `updatedAt` carimbado automaticamente; em conflito vence o mais recente, empate fica com o local. Sessão é documento: séries e logs vêm do lado cuja sessão venceu, e qualquer mudança em série sobe o carimbo da sessão. Apagamentos deixam **tombstone**, que vence registros mais antigos que ele. Exercícios e treinos com o mesmo nome em ids diferentes são unificados com remapeamento de ids (séries, logs, itens de treino, plano da semana).
- **Primeiro aparelho** cria o Gist com o local. **Segundo aparelho** sem treinos adota o remoto inteiro, para os A/B/C recém-semeados não competirem com os já editados.
- **Importar backup** substitui o local e sobrescreve o Gist.
- O token fica no `localStorage` de cada aparelho, fora do snapshot.

## Telas

Seis seções: **Evolução · Anotar · Histórico · Treinos · Exercícios · Ajustes**. No PC, barra lateral fixa à esquerda e conteúdo largo. No celular, abas embaixo (Exercícios fica acessível por Treinos).

### 1. Evolução (tela inicial, foco no PC)
- **Esta semana**: sete dias com o plano (A, B, C, C de corrida, traço para descanso). Feito fica preenchido, hoje destacado, planejado e não feito fica com contorno tracejado. Dia fora do plano não é erro: a sequência A → B → C continua de onde parou.
- Filtro de período em uma linha: 30 dias, 90 dias, 6 meses, 1 ano, tudo. Vale para tudo abaixo.
- **Gráfico de carga máxima por sessão**, até quatro exercícios ao mesmo tempo, com tooltip que mostra reps de cada série. Cores de série em ordem fixa, validadas para daltonismo (`--chart-1..4`).
- **Próximo treino**: qual treino é (plano de hoje ou sequência), a lista de exercícios com alvo (séries × faixa · RIR), última carga e reps, e a carga sugerida quando marcou aumentar ou diminuir (2,5 kg em barra e halter, 5 kg em máquina e cabo). Botão "Anotar treino X".
- Cinco números: treinos, corridas (com km), exercícios acompanhados, recordes, marcados para aumentar.
- Tabela de todos os exercícios: carga atual, reps, variação no período, decisão, última vez. Selo PR quando a última sessão foi recorde.
- Heatmap de frequência das últimas 26 semanas. Corridas contam como dia ativo.

### 2. Anotar (foco no celular)
- Chips de modo: Treino A / B / C (o sugerido vem marcado), Corrida, Livre. Vem de `?treino=` quando chega pelo botão do painel.
- **Rápido** (padrão quando há treino escolhido): uma linha por exercício com a carga da última vez já preenchida (ou a sugerida, se marcou aumentar) e um campo de reps por série alvo (2 no programa atual). A decisão vem sugerida pela faixa: todas as séries no topo da faixa → aumentar; alguma abaixo do mínimo → diminuir; senão manter. Um toque troca. "Pular" tira o exercício da sessão; sem reps também fica de fora. Item com alternativa tem um seletor para trocar o exercício.
- **Texto**: o modo original, abaixo. Segue sendo o caminho para colar histórico e para corrida.
- **Preencher com o treino X e a última carga**: gera uma linha por exercício do treino com a última carga (ou a sugerida, se marcou aumentar) e as reps da última vez. Se da última vez foi feita a alternativa, mantém a alternativa. Você só edita os números.
- Caixa de texto com o formato do WhatsApp, rascunho salvo automaticamente, seletor de dia.
- Abaixo, "o que entendi": cada linha com nome, peso, reps, decisão, avisos e o alvo da rotina. Reps fora da faixa ficam em amarelo. Nomes desconhecidos ganham o selo "novo".
- Salvar grava uma sessão de musculação por dia (com a rotina escolhida) e uma sessão por linha de corrida. Nomes casam com a biblioteca por nome ou alias exato (sem acento e caixa) ou por prefixo único quando têm duas ou mais palavras.
- Aceita histórico inteiro colado, com linhas de data separando os dias e prefixos de exportação do WhatsApp.

### 3. Histórico
- Lista por data com totais do mês (treinos e corridas). Corrida mostra distância, tempo e ritmo. Detalhe da sessão mostra cada exercício com carga, reps e decisão, e tem "Copiar como texto".

### 4. Treinos
- Plano da semana: sete seletores (descanso, corrida ou um treino).
- Um card por treino com os exercícios, alvo de séries × reps e RIR, alternativas. Editar: mudar números, reordenar, remover, adicionar exercício (composto entra como 2×6–8 RIR 1–2, isolado como 2×10–12 RIR 0–1), renomear, apagar. Novo treino.

### 5. Exercícios
- Busca, filtro por grupo muscular (as categorias do programa), cadastro com grupo livre e flag de composto. Detalhe com carga atual, recorde, 1RM estimado, gráfico e lista de sessões com decisão. Edição de nome, grupo, equipamento, composto, outros nomes aceitos e anotações fixas.

### 6. Ajustes
- Sincronização (token, status, sincronizar agora, desconectar), tema, backup JSON (exportar e importar), exportação de todo o histórico no formato de texto original.

### Treino em andamento (secundário)
- Lançamento série a série com coluna "anterior", cronômetro e aquecimento. Existe, mas o caminho principal no celular é Anotar.

## Fases

1. **Feito**: anotar por texto, importação do WhatsApp, painel de evolução com gráfico, próximo treino, tabela, heatmap, histórico, exercícios, backup e exportação em texto, rotinas A/B/C com RIR, plano semanal, corrida, preenchimento do treino do dia.
2. **Refino do painel**: comparar períodos (este mês vs. anterior), volume semanal por grupo muscular, meta por exercício com linha no gráfico, marcar semanas de deload e lesões para explicar quedas, gráfico de ritmo e distância das corridas.
3. **Feito também**: PWA no GitHub Pages com ícones, sincronização PC ↔ celular via Gist.
4. **Extras**: peso corporal, calculadora de anilhas, RIR anotado por série.

## Fora de escopo por agora

Login, servidor, planos de treino prontos, rede social. Podem entrar depois sem mudar o modelo de dados.
