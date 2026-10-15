# Promoção temporária de 72 horas

## Fonte e horários

O catálogo padrão continua em `src/data/menu.ts`. Após a auditoria funcional,
`useCatalog` consulta `/api/catalog`: a configuração publicada no Supabase é
compartilhada com o backend de pedidos. O localStorage guarda somente o rascunho
do administrador. Consulte [a auditoria](AUDITORIA-FUNCIONAL.md) para a configuração atual.

A campanha está em `src/data/promotion.ts`. Os valores usam **centavos inteiros**,
preservando o contrato existente do carrinho, banco, painel, WhatsApp e impressão.

- Início: **14/10/2026 às 15:52:22 — America/Sao_Paulo**.
- Fim: **17/10/2026 às 15:52:22 — America/Sao_Paulo**.
- UTC: `2026-10-14T18:52:22.000Z` até `2026-10-17T18:52:22.000Z`.
- Duração: `259200000` milissegundos, exatamente 72 horas.

| Produto | Normal | Promoção |
| --- | ---: | ---: |
| DNA Explosão 300ml | R$ 14,99 | R$ 12,99 |
| DNA Supremo 500ml | R$ 21,99 | R$ 18,99 |
| DNA Extra Supremo 700ml | R$ 28,99 | R$ 25,99 |
| Açaí Puro 300ml | R$ 12,99 | R$ 11,99 |
| Açaí Puro 500ml | R$ 18,99 | R$ 16,99 |
| Açaí Puro 700ml | R$ 24,99 | R$ 22,99 |

O início é fixo: reiniciar a aplicação, abrir outra aba ou publicar novamente não
reinicia as 72 horas. Uma publicação posterior ao início aproveita apenas o tempo
restante da janela configurada.

## Funcionamento

`getEffectivePrice` aplica o desconto somente com `início <= agora < fim`.
`product.price` mantém o valor normal. Os seis produtos ignoram preços antigos
salvos em snapshots locais; os outros produtos não recebem a campanha.

O relógio compartilhado parte do servidor, sincroniza com `/api/promotion` sem cache
e avança com `performance.now()`. A interface atualiza a cada 30 segundos e também
no instante da próxima fronteira, com timers de no máximo 30 segundos. Ao voltar
para a aba, atualiza e sincroniza novamente. Esses timers só repintam a tela:
**não controlam a validade da oferta**. O contador desaparece junto com o selo,
o preço riscado e o bloco verde. Não há tarefa agendada nem limpeza necessária.

O checkout manda IDs de produtos e escolhas. A API reconstrói os itens usando o
catálogo do servidor, valida quantidades, opções, limites e extras, e ignora nomes,
preços e descrições enviados pelo navegador. Um preço divergente retorna HTTP 409
com a cotação atual, sem salvar o pedido. O cliente vê o novo total e precisa
confirmar novamente. Extras continuam com os mesmos preços, inclusive M&M e Paçoca.

Cada item salvo mantém `unitPrice` e `totalPrice` em centavos. O painel, a comanda e
o payload de WhatsApp já usam esses snapshots; não consultam o catálogo para
recalcular pedidos históricos. A migration impede alterações posteriores desses
itens e do subtotal, preservando status, entrega e impressão.

## Configuração necessária para publicar

A auditoria posterior validou as chaves reais e corrigiu o `.env.local`.
A Vercel ainda precisa de `SUPABASE_SECRET_KEY`; a conta administrativa e as
migrations devem acompanhar a publicação. Veja o plano completo e atualizado em
[AUDITORIA-FUNCIONAL.md](AUDITORIA-FUNCIONAL.md).

A campanha mantém o início e o fim originais, inclusive se o lançamento ocorrer
depois do início. Reimplantar a aplicação não reinicia a promoção.

## Testar sem esperar três dias

Testes automatizados (Node 24):

```powershell
npm.cmd run test:promotion
npm.cmd run test:promotion:integration
npm.cmd run type-check
npm.cmd run build
```

O primeiro comando testa as regras e a migration em PostgreSQL efêmero (PGlite).
O segundo inicia uma API Supabase simulada em loopback, usa essa base efêmera e
abre Chromium com Playwright. Nenhum pedido é criado na loja real; nenhuma
impressão ou mensagem é enviada. O relógio simulado existe apenas no subprocesso
de teste. Relatórios e screenshots ficam em `local-data/promotion-tests/`.
Para outro ambiente, instale Chromium com `npx playwright install chromium` ou
informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. O teste usa a porta 3147 e precisa que
nenhum outro `next dev` esteja usando a pasta `.next/dev`.

Para uma conferência manual, defina temporariamente no `.env.local`:

```dotenv
NEXT_PUBLIC_DNA_PROMOTION_TEST_START_AT=2026-10-14T16:00:00-03:00
NEXT_PUBLIC_DNA_PROMOTION_TEST_END_AT=2026-10-14T16:02:00-03:00
```

Troque pelos horários atuais, com início no passado e fim em poucos minutos,
e inicie `npm.cmd run dev`. Mantenha card, personalizador ou carrinho abertos.
No fim, os preços normais retornam e a aparência promocional desaparece. Um item
adicionado durante a oferta passa pelo aviso e pela revalidação no checkout.
Use um banco de desenvolvimento para qualquer envio manual de pedido.

Remova essas duas variáveis ao terminar. Elas são ignoradas quando
`NODE_ENV=production`, inclusive no build. Nenhuma data de teste foi gravada no
`.env.local` existente ou na configuração de produção.

## Arquivos

- Campanha e preço: `src/data/promotion.ts`, `src/data/menu.ts`,
  `src/lib/catalog/pricing.ts`, `src/lib/catalog/customization.ts`.
- Relógio: `src/components/store/PromotionProvider.tsx`,
  `src/app/api/promotion/route.ts`, `src/app/layout.tsx`.
- Loja: `src/components/product/ProductCard.tsx`, `src/sections/MenuSection.tsx`,
  `src/components/builder/CupBuilder.tsx`,
  `src/components/builder/CustomizerProvider.tsx`, `src/app/globals.css`.
- Carrinho/checkout: `src/components/cart/CartProvider.tsx`,
  `src/components/cart/CartSheet.tsx`, `src/components/checkout/CheckoutProvider.tsx`,
  `src/lib/cart/types.ts`, `src/data/orders.ts`.
- Servidor: `src/lib/orders/pricing.ts`, `src/app/api/orders/route.ts`,
  `src/lib/supabase/order-writer.ts`.
- Painel: `src/components/AdminDashboard.tsx`,
  `src/components/product/PromotionDetails.tsx`.
- Configuração e testes: `.env.example`, `package.json`, `package-lock.json`,
  `README.md`, `tests/`, a migration acima e este documento.

## Validação executada

- `npm.cmd run test:promotion`: 15 testes aprovados, incluindo aplicação dupla da
  migration, bloqueio de insert público e imutabilidade dos valores históricos.
- `npm.cmd run test:promotion:integration`: aprovado em Chromium, com os seis
  cards, personalização, builder, carrinho, totais e API real do Next ligada ao
  PostgreSQL efêmero. Testou HTTP 409 sem gravação, nova confirmação, gravação
  normal após o fim, painel, versão mobile e ausência de erros JavaScript.
- O teste também manteve cards, carrinho e personalizador abertos durante a
  expiração, sem recarregar. O navegador usou um relógio local incorreto; o
  relógio do servidor continuou determinando a validade.
- `npm.cmd run type-check`: aprovado, sem erros TypeScript.
- `npm.cmd run build`: aprovado em produção. A primeira tentativa falhou por
  falta de conexão para baixar Bricolage Grotesque; liberar a rede resolveu sem
  mudar a tipografia do projeto.
- `git diff --check`: aprovado.

Problemas corrigidos: confiança no preço enviado pelo navegador, ausência de
validação dos IDs/limites/extras no pedido, preço congelado no carrinho e falta de
expiração da interface. Os snapshots antigos do catálogo não podem impor um
preço errado aos seis produtos da campanha.

Não foram criados pedidos no Supabase remoto nem testadas impressões físicas.
A preservação dos preços da comanda foi verificada no gerador real de texto;
o payload de WhatsApp também foi validado sem envio externo.
