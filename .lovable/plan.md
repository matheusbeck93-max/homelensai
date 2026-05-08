## Problema

O Google Chrome Web Store rejeitou a extensão porque o `manifest.json` declara a permissão `scripting`, mas ela não é usada em nenhum lugar do código (`background.ts`, `content.ts`, `popup.tsx`). Política: pedir só as permissões estritamente necessárias.

## Solução

Remover `"scripting"` do array `permissions` em `chrome-extension/manifest.json`. Nada mais muda.

**Antes:**
```json
"permissions": ["activeTab", "storage", "scripting"],
```

**Depois:**
```json
"permissions": ["activeTab", "storage"],
```

## Por que é seguro

- O content script é injetado via bloco `content_scripts` do manifest (declarativo), que **não** requer a permissão `scripting`.
- `scripting` só seria necessária se o código chamasse `chrome.scripting.executeScript()` ou `insertCSS()` — confirmei via `rg` que não há nenhuma chamada desse tipo.
- `activeTab` e `storage` continuam sendo usadas (badge, mensagens, `chrome.storage.local`).
- `host_permissions: ["https://*/*"]` continua igual — esse é um aviso separado (broad host permissions) que já discutimos e decidimos manter.

## Próximos passos depois da mudança

1. Rebuildar a extensão: `cd chrome-extension && npm run build` (ou o script de build do projeto que gera o ZIP em `public/`).
2. Subir um novo bump de versão no `manifest.json` (ex.: `1.0.0` → `1.0.1`) — a Chrome Web Store exige versão maior que a anterior em cada nova submissão. **Posso incluir isso no patch se quiser.**
3. Reenviar o ZIP para revisão. Como é uma correção pontual de permissão, costuma ser aprovado rápido.

## Pergunta antes de implementar

Quer que eu também já incremente a versão para `1.0.1` no mesmo patch, ou prefere fazer só a remoção da permissão como você descreveu?