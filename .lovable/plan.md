## Problema

O agente continua enviando planilhas Excel automaticamente, mesmo sem solicitação do usuário. A causa está no prompt do `supabase/functions/ai-chat/index.ts`, onde a regra "Offer-and-Accept" (linhas 1411–1418) é **contradita por três instruções logo abaixo** que o modelo está obedecendo preferencialmente:

1. **Linha 1430**: `"To trigger Excel generation, include a 'uiBlock' field..."` — frase imperativa que parece um padrão default.
2. **Linha 1459**: `"Also generate Excel for: 'can I afford', 'how much house', 'buying power', 'monthly payment for', 'mortgage for'."` — força Excel para qualquer pergunta de affordability/mortgage, **anulando** a regra "offer-and-accept".
3. **Linha 1461**: `"Always include uiBlock alongside your conversational message."` — diz literalmente para sempre incluir o uiBlock, contradizendo a regra estrita.

Sobre as tabelas numéricas: a regra `NUMERIC SUMMARY FORMAT` está presente nos dois prompts e o renderer (`chatMarkdownComponents` + `remark-gfm`) está corretamente cabeado nos três pontos (`Chats.tsx`, `ConversationPanel.tsx`, `ChatComparisonPanel.tsx`). Os logs confirmam que `remark-gfm` está ativo. Os cálculos *devem* já estar vindo em tabela — exceto quando o modelo decide enviar Excel no lugar (que é exatamente o bug acima). Resolver o Excel também destrava o uso correto da tabela markdown.

## O que muda

### `supabase/functions/ai-chat/index.ts` — prompt do `workflow_excel`

Reescrever o bloco WORKFLOW EXCEL (linhas ~1411–1461) para eliminar TODAS as contradições:

- Remover a linha `Also generate Excel for: "can I afford", "how much house", ...`
- Remover a linha `Always include uiBlock alongside your conversational message.`
- Reescrever `To trigger Excel generation...` como **condicional**: `"ONLY when the offer-and-accept condition is met, include a uiBlock..."`
- Adicionar topo do bloco em caixa alta:
  ```
  DEFAULT BEHAVIOR: DO NOT include any uiBlock of type "workflow_excel".
  ONLY include it when (A) the user's CURRENT message explicitly asks for an Excel/spreadsheet/.xlsx/download, OR (B) the user just replied "yes/sure/please" to YOUR previous offer.
  For affordability, mortgage, buying power, monthly payment questions: answer with the NUMERIC SUMMARY FORMAT (markdown table), then optionally end with: "Want me to put this into a downloadable Excel spreadsheet?" Do NOT attach the workbook unless they accept.
  ```
- Manter os exemplos de schema do `uiBlock` apenas como referência de estrutura, prefixados por `"When (and only when) the conditions above are met, the uiBlock format is:"`.

### Reforço cruzado com o formato numérico

Adicionar uma frase explícita no bloco do Excel ligando-o ao formato de tabela:

> "Calculations belong in a markdown table inside the message (see NUMERIC SUMMARY FORMAT). The Excel workbook is a separate, opt-in deliverable — never a replacement for the in-message table."

Isso força o agente a sempre apresentar o cálculo na tabela do chat e tratar o Excel como extra opcional.

### Arquivos tocados

- `supabase/functions/ai-chat/index.ts` — reescrita do bloco WORKFLOW EXCEL (~50 linhas).
- Memória `mem://funcionalidades/geracao-de-excel-de-workflow` — atualizar para registrar que a regra "offer-and-accept" tem precedência sobre QUALQUER gatilho por palavra-chave (afford/mortgage/etc.).

### Deploy

- Redeployar apenas a edge function `ai-chat`.

## Fora de escopo

- Não tocar em `perplexity-chat` (já está correto, sem regras conflitantes de Excel).
- Não alterar `markdownComponents.tsx`, `ChatComparisonPanel.tsx`, `ConversationPanel.tsx`, `Chats.tsx` ou o `WorkflowExcelBlock.tsx` — a renderização de tabela e Excel já está correta.
- Não mudar o schema do `uiBlock` nem o tipo `WorkflowExcelBlock`.
