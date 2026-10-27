# Pedidos pelo WhatsApp (AtendeIA)

O atendimento automático do WhatsApp (AtendeIA) usa **este site como fonte única** de produtos, preços,
promoções, complementos, adicionais, status da loja e formas de pagamento. Nenhum preço é cadastrado no AtendeIA.

## Rotas (servidor → servidor, assinadas)

| Rota | Uso |
| --- | --- |
| `GET /api/integrations/atendeia/menu` | Cardápio publicado com o preço de agora (promoção só enquanto ativa), produtos ativos, limites 3/4/5, adicionais, colher/guardanapo, status aberto/fechado e checkout (entrega a combinar; Pix, cartão na entrega, dinheiro). |
| `POST /api/integrations/atendeia/quote` | Cotação de um carrinho com `quoteOrderItems` (mesma função do checkout). Não grava nada. |
| `POST /api/integrations/atendeia/orders` | Pedido confirmado pelo cliente. Recalcula tudo, recusa com 409 se o valor mudou ou a loja fechou, valida com `validateCheckout` e grava em `orders` com `request_id` (idempotente). |

Assinatura: cabeçalho `x-atendeia-signature: t=<unix>,v1=<HMAC-SHA256>` sobre `t.MÉTODO.caminho.corpo`,
com `ATENDEIA_INTEGRATION_SECRET` (somente servidor, ≥ 32 caracteres). Sem a variável, as rotas respondem 503.

## No painel

Os pedidos entram na mesma tabela e no mesmo fluxo do site: alerta de novo pedido, impressão automática
(uma por pedido, pelo trigger existente), botões de status e taxa de entrega. Aparecem com o selo
**WHATSAPP · ATENDIMENTO AUTOMÁTICO** e a observação "Pedido feito pelo WhatsApp (AtendeIA). Pagamento
aguardando confirmação da loja." (impressa na comanda). Cada copo sai separado, com seus complementos.

Com `ATENDEIA_STATUS_WEBHOOK_URL`, cada mudança de status de um pedido do WhatsApp é avisada ao AtendeIA
(depois da resposta ao painel; falhas não afetam o painel).

Não há migração nova: usa as colunas existentes (`request_id`, `whatsapp_payload`, `notes`).
Testes: `tests/atendeia.test.mjs`. Detalhes da implantação: `docs/PEDIDOS-CARDAPIO.md` no AtendeIA.
