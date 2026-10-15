# Auditoria funcional — DNA do Açaí

Verificação em 15/10/2026, America/Sao_Paulo. Branch: `redesign-immersive-acai`.
O estado e o diff do Git foram revisados antes das alterações. A promoção, os preços,
os pedidos existentes e a identidade visual foram preservados. Nenhum reset,
exclusão de dados, commit, deploy ou envio de mensagem foi executado.

## Resultado e alcance

O código corrigido passou no lint, TypeScript, build, 21 testes de regras/banco e
na integração com Chromium, Next real e PostgreSQL efêmero. O build local também
foi iniciado com o Supabase real: loja e status retornaram 200, status `open`,
login 200, painel sem sessão 307 para login e leitura de pedidos sem sessão 401.
Nenhum pedido real foi criado.

**A produção ainda depende do lançamento coordenado descrito abaixo.** As migrations
foram aplicadas duas vezes no banco efêmero para verificar idempotência; no banco
remoto foi executado somente `db push --dry-run`. O banco real mantém suas policies
antigas até a aplicação. A nova criação de pedidos e a publicação do catálogo
precisam das migrations; os testes desses fluxos completos usaram o banco isolado.

| Funcionalidade | Testada | Resultado | Correção |
| --- | --- | --- | --- |
| Supabase público | Sim, HTTP real | OK | Publishable vazia corrigida no .env.local; prioridade e validação centralizadas |
| Supabase privado | Sim, leitura real | OK local | Secret recuperada do projeto autenticado, validada e salva somente no .env.local |
| Status da loja | Sim, real e isolado | OK | Main existe, aberto; consulta com prazo; falha distinta de loja fechada |
| Abrir/fechar loja | Sim, isolado | OK | PATCH autorizado, atualização imediata e recuperação de falha |
| Login, sessão e logout | Sim, isolado | OK no código | Login com senha, verificação de app_metadata, refresh e proteção no servidor |
| Conta administrativa real | Consulta real | Pendente | E-mail informado ainda não existe no Supabase Auth |
| RLS e APIs administrativas | Sim, SQL e HTTP isolados | OK preparado | Visitante e conta comum bloqueados; papel revogado perde acesso mesmo com JWT antigo |
| Catálogo | Sim, todos os 11 produtos | OK | Publicação real no Supabase; mesmo catálogo na loja e no cálculo do pedido |
| Batidinhas | Catálogo revisado | Não cadastradas | Nenhum produto inventado |
| Complementos e extras | Sim, regras e navegador | OK | Limites 3/4/5, frutas, extras repetidos e Nutella ausente |
| Promoção de 72 horas | Sim, fronteiras e navegador | OK | Preços, início e fim preservados; expiração automática sem F5 |
| Carrinho | Sim, navegador | OK | Adição, quantidade, remoção, limpeza, limites e atualização de preços |
| Checkout | Sim, regras, HTTP e navegador | OK | Nome, DDD, entrega/retirada, endereço/número/bairro, complemento/referência, observações e troco |
| Criação do pedido | Sim, banco isolado | OK preparado | Recalcula preços, devolve 409 para revisão e impede duplicação da mesma tentativa |
| Histórico e entrega | Sim, SQL/HTTP/painel/comanda | OK | Itens/subtotal imutáveis; alterar entrega usa o subtotal salvo |
| Impressão | Sim, código, RPC e falha de fila | OK no código | Acesso administrativo; falha não desfaz o pedido; serviço físico pendente |
| Hero, imagens e vídeo | Sim, HTTP e navegador | OK | Assets acessíveis; muted, loop, playsInline, autoplay e poster/fallback |
| Responsividade | Sim, 1440/1024/768/390 | OK | Sem overflow da página/diálogos; corrigida sobreposição que bloqueava cliques no tablet |
| PWA | Sim, manifests, SW e offline | OK no navegador | Cache v6 não armazena HTML administrativo nem APIs; offline próprio e atualização sem cache do SW |
| Instalação em celular físico | Não | Pendente de aparelho | Manifests/ícones/escopo e service worker verificados; não simular teste físico |
| Segredos | Sim | OK | .env ignorado; nenhuma secret real encontrada nos arquivos versionados ou no bundle público |
| Lint, TypeScript e build | Sim | OK | Corrigidos Date.now no render e preload CommonJS dos testes |

## Configuração real auditada

- Supabase vinculado: `zvnkfdlmdgnshsxlqdki`, coincidente com o hostname do .env.local.
- Auth público: HTTP 200; status público: HTTP 200; leitura privilegiada de metadados de pedidos: HTTP 200.
- `store_settings` possui `id='main'`, `status='open'` e `updated_at`.
- `orders` e suas colunas de impressão já existem. `print_settings`, `print_jobs` e
  `catalog_settings` ainda dependem das migrations.
- O histórico remoto de migrations estava vazio; parte do schema havia sido criada
  manualmente pelo SQL antigo. Outras tabelas existentes no projeto não foram alteradas.
- A consulta do Auth encontrou uma conta, sem papel administrativo. Não é o e-mail
  `dnaacai36@gmail.com`. Nenhuma conta existente recebeu acesso por suposição.
- Vercel: projeto `dna-do-acai`, produção `https://dnadoacai.com.br`.
  A listagem de nomes encontrou `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  **Não há SUPABASE_SECRET_KEY nem SUPABASE_SERVICE_ROLE_KEY.**
  Os valores da Vercel não foram extraídos para o relatório nem considerados validados.

## Variáveis utilizadas

As obrigatórias da loja devem ser configuradas no .env.local e em Vercel Production
e Preview, apontando URL e chaves para o mesmo projeto. Nenhum valor de secret consta
neste relatório ou no .env.example.

| Variável | Uso/arquivos | Ambiente | Necessidade |
| --- | --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | lib/supabase/config.ts; order-writer.ts | Navegador + servidor | Obrigatória |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | config.ts; clientes browser/SSR; proxy.ts | Pública | Preferida e obrigatória, salvo fallback |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | config.ts | Pública | Alternativa legada |
| SUPABASE_SECRET_KEY | lib/supabase/order-writer.ts; APIs de pedidos/impressão | Privada, servidor | Obrigatória para operações privilegiadas |
| SUPABASE_SERVICE_ROLE_KEY | order-writer.ts | Privada, servidor | Alternativa legada |
| NEXT_PUBLIC_SITE_URL | app/layout.tsx | URL pública usada no servidor | Opcional; recomendada a URL canônica |
| VERCEL_URL | app/layout.tsx | Servidor | Fallback automático da hospedagem |
| NODE_ENV | data/promotion.ts; lib/supabase/config.ts | Build/runtime | Automática |
| NEXT_PUBLIC_DNA_PROMOTION_TEST_START_AT | data/promotion.ts | Desenvolvimento | Opcional; ignorada em produção |
| NEXT_PUBLIC_DNA_PROMOTION_TEST_END_AT | data/promotion.ts | Desenvolvimento | Opcional; ignorada em produção |
| WHATSAPP_BUSINESS_PHONE_NUMBER | lib/whatsapp/business.ts | Servidor | Opcional, com número padrão existente |
| WHATSAPP_BUSINESS_PHONE_NUMBER_ID | business.ts | Servidor | Só integração externa WhatsApp |
| WHATSAPP_BUSINESS_ACCOUNT_ID | business.ts | Servidor | Só integração externa WhatsApp |
| WHATSAPP_BUSINESS_ACCESS_TOKEN | business.ts | Privada, servidor | Só integração externa WhatsApp |
| WHATSAPP_ORDER_TEMPLATE_NAME | business.ts | Servidor | Opcional, template padrão |
| QZ_CERTIFICATE | api/qz/certificate | Servidor | Só impressão assinada QZ |
| QZ_PRIVATE_KEY | api/qz/sign | Privada, servidor | Só impressão assinada QZ |
| PRINT_WEBHOOK_SECRET | supabase/functions/print-order | Privada, Edge Function | Só PrintNode |
| SUPABASE_URL | print-order | Edge Function | Fornecida pelo Supabase |
| SUPABASE_SERVICE_ROLE_KEY | print-order | Privada, Edge Function | Fornecida pelo Supabase |
| PRINTNODE_API_KEY | print-order | Privada, Edge Function | Só PrintNode |
| PRINTNODE_PRINTER_ID | print-order | Edge Function | Só PrintNode |

`NEXT_PUBLIC_STORE_WHATSAPP` não é consumida pelo app e saiu do exemplo.
`VERCEL_OIDC_TOKEN` existente no ambiente não é utilizado pelo código da loja.
Variáveis `NEXT_PUBLIC_SUPABASE_SECRET_KEY` e
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` são proibidas. O next.config.ts bloqueia
o build se uma variável pública contiver chave secret ou JWT de service_role.
O diagnóstico registra somente o nome da configuração inválida ou códigos de erro,
sem corpo de pedido, token, chave completa ou dados pessoais.

Variáveis exclusivas dos testes: `DNA_TEST_CLOCK_FILE`,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `NODE_OPTIONS` e `NEXT_TELEMETRY_DISABLED`.
Não configurá-las em produção. O preload do relógio existe somente no subprocesso
isolado e não entra no app.

## Migrations

| Ordem | Arquivo | Situação |
| --- | --- | --- |
| 1 | 20260726040000_store_baseline.sql | Nova nesta auditoria; baseline aditiva para schema manual/instalação nova |
| 2 | 20260726050000_printnode_automatic_printing.sql | Preexistente, preservada |
| 3 | 20261014185222_secure_order_prices.sql | Da implementação anterior da promoção, preservada |
| 4 | 20261015010000_admin_access_and_catalog.sql | Nova nesta auditoria; RLS, catálogo, idempotência e isolamento da impressão |

**Aplicadas no remoto: nenhuma. Aplicadas no teste: todas, duas vezes cada.**
O dry-run confirmou exatamente os quatro arquivos acima, sem seeds ou alterações
de papéis globais. O seed de status usa `ON CONFLICT DO NOTHING`: não reabre uma
loja fechada nem duplica o registro main. O catálogo começa com snapshot null,
que seleciona menu.ts como fonte padrão.

Não foi seguro aplicar a restrição de RLS isoladamente: a versão antiga permite
acesso anônimo e ainda não usa a autenticação/cliente privado corrigidos. Além disso,
faltam a variável privada na Vercel e a conta administrativa real. Aplicar agora
interromperia os fluxos antigos antes de publicar a substituição.

## Pendências externas e lançamento

1. **Vercel → dna-do-acai → Settings → Environment Variables:** adicionar
   `SUPABASE_SECRET_KEY` como secret em Production e Preview. Usar a credencial
   validada do mesmo projeto que já está no .env.local, sem copiá-la para chats,
   código ou commits. Conferir URL e publishable com o dashboard do mesmo Supabase.
2. **Supabase → Authentication → Users:** criar a conta
   `dnaacai36@gmail.com` com uma senha definida pelo responsável, ou completar
   seu cadastro verificado. Não enviar a senha por chat. Depois conceder somente
   a essa identidade `app_metadata.role = "admin"`. O SQL abaixo exige exatamente
   uma conta correspondente e preserva os demais metadados:

```sql
do $$
begin
  if (select count(*) from auth.users where lower(email)='dnaacai36@gmail.com' and email_confirmed_at is not null) <> 1 then
    raise exception 'Crie e confirme a conta administrativa correta antes de continuar.';
  end if;
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb
  where lower(email)='dnaacai36@gmail.com';
end;
$$;
```

3. **Lançamento coordenado:** preparar a versão compilada com as variáveis,
   confirmar o projeto vinculado, conferir novamente o dry-run e aplicar as quatro
   migrations junto da promoção do novo deploy. Não executar orders.sql, db reset
   ou reintroduzir policies públicas para contornar falhas.

```powershell
npx.cmd --yes supabase migration list --linked
npx.cmd --yes supabase db push --linked --dry-run
# Somente no lançamento preparado:
npx.cmd --yes supabase db push --linked
```

4. **Impressão opcional:** PrintNode ainda exige a conta/chave/impressora,
   configuração da Edge Function e webhook descritos em PRINTNODE.md. QZ exige
   aplicativo local, impressora e certificado/chave quando usar assinatura.
   Nenhuma impressora física foi acionada. A impressão automática inicia desativada;
   os pedidos funcionam independentemente dela.

A integração WhatsApp existente monta o payload e oferece contato; não foi
transformada em um novo serviço de envio automático. Nenhuma mensagem foi enviada.

## Preservação da promoção

Mantida de **14/10/2026 15:52:22** até **17/10/2026 15:52:22**, horário de São Paulo.
Os seis preços promocionais continuam R$ 12,99 / 18,99 / 25,99 e
R$ 11,99 / 16,99 / 22,99. Os preços normais continuam R$ 14,99 / 21,99 / 28,99 e
R$ 12,99 / 18,99 / 24,99. A publicação não reinicia a campanha.

## Evidências reproduzíveis

```powershell
npm.cmd run lint
npm.cmd run type-check
npm.cmd test
npm.cmd run test:promotion:integration
npm.cmd run build
# Somente leitura, depois do build, com configuração real:
node tests/production-smoke.mjs
```

- 21 testes aprovados. RLS testada como anon, authenticated comum, admin e service_role.
- Chromium: páginas e diálogos em 1440, 1024, 768 e 390; todos os produtos e cinco combos.
- HTTP isolado: 201/200 em pedidos válidos/repetidos, 400 em dados inválidos, 409
  em mudança de preço/loja fechada, 401 em acesso anônimo, 503 em falha simulada.
- Código de impressão/comanda usa snapshots; falha SQL simulada da fila preservou o pedido.
- Build otimizado aprovado, com todas as rotas compiladas.
- Sem erros JavaScript na integração e sem secrets privadas no bundle estático.
- Screenshots e resultados: `local-data/promotion-tests/` (ignorado pelo Git).
- HTTP real somente leitura: `local-data/audit/production-smoke.json`.

## Arquivos alterados nesta auditoria

- Configuração: `.env.example`, `.gitignore`, `next.config.ts`, `package.json`,
  `README.md`; `.env.local` corrigido localmente, fora do Git.
- Supabase/segurança: `src/lib/supabase/{config,client,server,order-writer,admin}.ts`,
  `src/lib/server/http.ts`, `src/proxy.ts`.
- Admin: `src/app/admin/login/page.tsx`, `src/components/AdminLogin.tsx`,
  `src/app/admin/pedidos/page.tsx`, `src/components/AdminDashboard.tsx`.
- APIs: `src/app/api/{catalog,store-status,orders}/route.ts`,
  `src/app/api/orders/[id]/route.ts`, `src/app/api/orders/[id]/print/route.ts`,
  `src/app/api/printing/{settings,test}/route.ts`,
  `src/app/api/qz/{certificate,sign}/route.ts`.
- Loja/catálogo: `src/lib/catalog/{server,validation}.ts`, `src/hooks/useCatalog.ts`,
  `src/lib/store-status/{client,server}.ts`, `src/components/store/StoreProvider.tsx`,
  `src/sections/MenuSection.tsx`, `src/components/product/ProductCard.tsx`.
- Checkout/carrinho: `src/lib/checkout/{form,validation}.ts`, `src/data/orders.ts`,
  `src/components/cart/{CartProvider,CartSheet}.tsx`,
  `src/components/checkout/CheckoutProvider.tsx`.
- PWA/mídia: `public/sw.js`, `public/offline.html`,
  `src/components/ClientPwaInstall.tsx`,
  `src/components/acai-experience/AcaiExperience.tsx`, `src/app/layout.tsx`.
- Testes: `tests/{audit.test,database,backend,browser-audit,integration,production-smoke,server-clock}.mjs`.
  O preload server-clock.cjs foi convertido para ESM.
- Duas migrations novas listadas acima; `docs/PROMOCAO-72H.md` atualizado e este relatório.

As alterações anteriores da promoção em pricing, providers, dados, CSS e testes
foram mantidas. Nenhuma credencial real foi localizada nos arquivos versionados
inspecionados; não houve evidência que exigisse rotação por vazamento no código.
O histórico Git não foi reescrito.
