## Problema encontrado

O prompt do agente já foi corrigido, mas ainda existe uma segunda automação no frontend (`src/pages/Chats.tsx`) que ignora essa regra:

- A função `isWorkflowRequest()` trata perguntas como `can I afford`, `buying power`, `monthly payment`, `mortgage`, `ROI`, `down payment`, etc. como gatilhos de Excel.
- Depois da resposta normal do agente, o frontend faz uma segunda chamada para `ai-chat` pedindo literalmente: `generate a detailed Excel spreadsheet with a workflow_excel uiBlock`.
- Por isso o Excel continua sendo enviado automaticamente mesmo quando o usuário só pediu uma simulação/cálculo.

## Ajuste proposto

### 1. Separar “cálculo que merece oferta” de “pedido explícito de Excel”

Em `src/pages/Chats.tsx`, substituir a lógica atual por duas intenções diferentes:

- `isExplicitExcelRequest(text)`: verdadeiro apenas quando o usuário pede claramente Excel/planilha/download/exportação, por exemplo:
  - “send me the spreadsheet”
  - “export to Excel”
  - “generate an xlsx”
  - “download this”
  - “crie uma planilha”

- `shouldOfferExcel(text)`: verdadeiro para simulações e cenários complexos em que o agente deve oferecer a planilha, mas não enviar:
  - buying power
  - affordability / can I afford
  - mortgage / monthly payment
  - ROI, cash flow, cap rate
  - renovation / remodel / flip budget
  - amortization / financing plan
  - closing costs / down payment scenarios

### 2. Remover a geração automática por palavra-chave

Remover o bloco atual:

```text
if (isWorkflowRequest(cleanedMessage)) {
  ... generate a detailed Excel spreadsheet with a workflow_excel uiBlock ...
}
```

Esse bloco é a causa direta do envio automático.

### 3. Gerar Excel somente quando houver solicitação/aceite

Criar uma função de controle que permite o Excel apenas quando:

- O usuário pediu explicitamente Excel/planilha/download no texto atual; ou
- A mensagem anterior do agente ofereceu a planilha e o usuário respondeu afirmativamente (`yes`, `sure`, `please`, `go ahead`, `send it`, `sim`, `pode`, `envie`, etc.).

Fluxo esperado:

```text
Usuário: Can I afford a $700k house with $180k income?
Agente: resposta com tabela markdown + oferta: “Want me to put this into a downloadable Excel spreadsheet?”
Usuário: yes
Agente: agora envia o Excel
```

### 4. Garantir que cálculos venham em tabela no chat

Manter a resposta principal vindo do `perplexity-chat`, que já tem a regra `NUMERIC SUMMARY FORMAT`.

No frontend, quando `shouldOfferExcel(cleanedMessage)` for verdadeiro e a resposta ainda não tiver uma oferta de planilha, acrescentar ao fim da mensagem:

```text
Want me to put this into a downloadable Excel spreadsheet?
```

Assim o comportamento fica determinístico:

- Simulação/cálculo: resposta em tabela no chat + oferta opcional.
- Aceite/pedido explícito: gera e mostra o bloco Excel.

### 5. Ajustar a chamada de geração de Excel

Quando o Excel for permitido, a chamada para `ai-chat` será mantida, mas com contexto seguro:

- Enviar a mensagem do usuário atual.
- Enviar a análise anterior quando existir.
- Pedir `workflow_excel` apenas porque a condição de opt-in já foi atendida.
- Não disparar essa chamada para cálculos comuns sem aceite.

### 6. Atualizar memória da funcionalidade

Atualizar `mem://funcionalidades/geracao-de-excel-de-workflow` para registrar:

- Frontend não pode auto-gerar Excel por keyword.
- Keywords de cálculo apenas autorizam oferta, não envio.
- Excel só é enviado por solicitação explícita ou aceite a uma oferta anterior.
- Cálculos devem aparecer primeiro como tabela markdown no chat.

## Arquivos a alterar

- `src/pages/Chats.tsx`
  - substituir `isWorkflowRequest`
  - remover geração automática por keyword
  - adicionar detecção de pedido explícito/aceite
  - adicionar oferta controlada em respostas de cálculo

- `.lovable/memory/funcionalidades/geracao-de-excel-de-workflow`
  - documentar a regra final da funcionalidade

## Fora de escopo

- Não alterar banco de dados.
- Não alterar componentes visuais de Excel.
- Não alterar o renderer de markdown/tabelas, pois já está conectado com `remark-gfm`.
- Não mexer nos limites diários ou assinatura.