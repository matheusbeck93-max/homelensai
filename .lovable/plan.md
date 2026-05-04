## Atualização dos Documentos Legais

Atualizar os 9 documentos legais do sistema para refletir as funcionalidades reais, padronizar contato e adicionar seções obrigatórias de compliance.

### Decisões confirmadas
- **Email único de contato:** `h2@homelens-ai.com` em todos os documentos (substitui `dmca@`, `privacy@`, `support@`, `accessibility@`, `legal@`, e variações de domínio `@homelens.ai` / `@homelensais.com`)
- **Premium:** $9.97 (corrigido de $4.97)
- **Subprocessadores nomeados** na Privacy Policy
- **Effective Date:** 05/04/2026 (data de hoje)

---

### 1. Padronização global (todos os 9 documentos + Footer)

Substituir todos os emails existentes por `h2@homelens-ai.com`:
- `dmca@homelens.ai` / `dmca@homelensais.com`
- `privacy@homelens.ai` / `privacy@homelensais.com`
- `support@homelens.ai` / `support@homelensais.com`
- `accessibility@homelens.ai`
- `legal@homelens.ai`
- Qualquer outra variação encontrada

Atualizar **Effective Date** de "02/13/2026" para "05/04/2026" em todos os documentos.

---

### 2. `TermsOfService.tsx`
- Adicionar seção **"Contact Us"** com `h2@homelens-ai.com`
- Adicionar seção **"Subscription, Billing & Refunds"**:
  - Plano Free ($0) e Premium ($9.97/mês)
  - Renovação automática mensal
  - Cancelamento a qualquer momento (acesso até o fim do ciclo)
  - Política de reembolso (sem reembolso pró-rata; reembolso total em até 7 dias se nenhum recurso premium foi usado)
  - Pagamento processado por Stripe
- Adicionar menção a recursos: **Saved Analyses, Investor Calculator, Chrome Extension, Voice Input/TTS, AI Chat**
- Adicionar **Acceptable Use** (não automatizar scraping, não revender output da IA, não usar para discriminação habitacional)

### 3. `PrivacyPolicy.tsx`
- Adicionar seção **"Subprocessors"** listando:
  - **Lovable Cloud (Supabase)** — banco de dados, autenticação, storage
  - **Google AI (Gemini via Lovable AI Gateway)** — processamento de chat
  - **Perplexity** — buscas em tempo real e dados de mercado
  - **ElevenLabs** — síntese de voz (TTS)
  - **Stripe** — processamento de pagamentos
  - **Firecrawl** — extração de dados de listagens
  - **RapidAPI / Zillow56** — dados de imóveis
  - **Mapbox** — mapas
  - **Sentry** — monitoramento de erros
- Adicionar seção **"Voice Data"**: input de voz transcrito, áudio TTS efêmero (não armazenado)
- Adicionar seção **"File Attachments"**: PDFs e imagens em chat (até 5 arquivos, 10MB), processados pela IA, não retidos após sessão
- Adicionar **"Chat Prompts"**: prompts enviados a Google/Perplexity, conteúdo do imóvel também
- Atualizar contato para `h2@homelens-ai.com`

### 4. `CookiePolicy.tsx`
- Adicionar seção **"Contact Us"** com `h2@homelens-ai.com`
- Listar cookies específicos:
  - **Essenciais:** `sb-*` (autenticação Supabase), `theme` (preferência de tema), `cookie-consent` (banner)
  - **Analytics:** Sentry (monitoramento de erros)
  - **Sessão:** `chrome.storage.session` (extensão Chrome)
- Esclarecer que NÃO usamos cookies de publicidade ou tracking de terceiros

### 5. `CCPA.tsx`
- Adicionar **dados de voz** nas categorias sensíveis
- Listar **subprocessadores reais** (alinhado à Privacy Policy)
- Atualizar contato para `h2@homelens-ai.com`

### 6. `DoNotSell.tsx`, `DMCAPolicy.tsx`, `FairHousing.tsx`, `Accessibility.tsx`, `ExtensionPrivacy.tsx`
- Substituir email de contato por `h2@homelens-ai.com`
- Atualizar Effective Date
- `ExtensionPrivacy.tsx`: confirmar que menciona session isolation (`chrome.storage.session`) e ausência de tracking entre sites

### 7. Footer / componentes que exibem email
- Verificar se há email hardcoded no Footer ou em outras páginas (Contact, About) e substituir por `h2@homelens-ai.com`

---

### Arquivos a editar
- `src/pages/legal/TermsOfService.tsx`
- `src/pages/legal/PrivacyPolicy.tsx`
- `src/pages/legal/CookiePolicy.tsx`
- `src/pages/legal/CCPA.tsx`
- `src/pages/legal/DoNotSell.tsx`
- `src/pages/legal/DMCAPolicy.tsx`
- `src/pages/legal/FairHousing.tsx`
- `src/pages/legal/Accessibility.tsx`
- `src/pages/legal/ExtensionPrivacy.tsx`
- `src/components/Footer.tsx` (se aplicável)
- Eventuais outros pontos com email hardcoded (verificar via busca global)

### Fora do escopo
- Tradução para outros idiomas (mantém inglês conforme regra do projeto)
- Mudanças visuais nos documentos (apenas conteúdo)
- Aprovação jurídica formal (recomendo revisão por advogado antes de publicar)
