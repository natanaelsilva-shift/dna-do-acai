# Impressão automática de comandas com PrintNode

## Como funciona

O pedido completo é salvo em `public.orders`, inclusive os itens e os
complementos no campo JSONB `items`. Um trigger `AFTER INSERT` cria uma linha em
`public.print_jobs`. O Database Webhook chama a Edge Function `print-order`, que
reivindica o trabalho de forma atômica, monta a comanda ESC/POS e envia para o
PrintNode.

O índice único parcial de `print_jobs` permite apenas um trabalho automático por
pedido. Reimpressões manuais são trabalhos separados, marcados como `manual`,
com data, hora e usuário solicitante.

## 1. Aplicar a migration

Execute a migration abaixo no SQL Editor do projeto Supabase ou por meio do
Supabase CLI:

```text
supabase/migrations/20260726050000_printnode_automatic_printing.sql
```

Ela cria:

- `public.print_settings`;
- `public.print_jobs`;
- trigger automático após a criação do pedido;
- sincronização discreta do estado de impressão no pedido;
- funções RPC protegidas para o painel e para a Edge Function.

A impressão automática começa desativada para evitar falhas antes de os secrets,
o webhook e o PrintNode Client estarem prontos.

## 2. Instalar e identificar a impressora

1. Crie ou acesse a conta da loja em
   [PrintNode](https://www.printnode.com/).
2. No computador conectado à impressora térmica, baixe e instale o PrintNode
   Client.
3. Entre no Client com a mesma conta.
4. Confirme que a impressora aparece online no painel do PrintNode.
5. Copie o ID numérico da impressora no painel do PrintNode. Esse número será o
   valor de `PRINTNODE_PRINTER_ID`.

O PrintNode Client precisa permanecer aberto no computador da loja. A impressora
deve estar ligada, com papel e instalada corretamente no Windows.

## 3. Cadastrar os secrets

Cadastre os valores somente nos secrets das Edge Functions:

```bash
supabase secrets set PRINTNODE_API_KEY="SUA_CHAVE"
supabase secrets set PRINTNODE_PRINTER_ID="123456"
supabase secrets set PRINT_WEBHOOK_SECRET="UM_SEGREDO_LONGO_E_ALEATORIO"
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos automaticamente pelo
ambiente das Edge Functions. Não copie a chave `service_role` nem a API key do
PrintNode para o frontend, `.env.local` ou arquivos versionados.

## 4. Publicar a Edge Function

```bash
supabase functions deploy print-order --no-verify-jwt
```

A validação de origem é feita pelo header secreto do webhook, e não por JWT de
usuário.

## 5. Configurar o Database Webhook

No Dashboard do Supabase, abra **Database > Webhooks** e crie:

- Nome: `print-new-job`;
- Tabela: `public.print_jobs`;
- Evento: `INSERT`;
- Método: `POST`;
- URL: `https://SEU_PROJECT_REF.supabase.co/functions/v1/print-order`;
- Header: `x-print-webhook-secret`;
- Valor do header: exatamente o mesmo valor de `PRINT_WEBHOOK_SECRET`.

Use o webhook em `print_jobs`, não diretamente em `orders`. Assim pedidos
automáticos, reimpressões e testes passam pela mesma fila e pelo mesmo controle
de idempotência.

## 6. Testar e ativar

No painel administrativo:

1. Abra **Configurações**.
2. Em **Comandas automáticas com PrintNode**, clique em
   **Imprimir comanda de teste**.
3. Confirme no papel e no painel do PrintNode que o trabalho foi aceito.
4. Clique em **Ativar automática**.

O botão salva a configuração em `public.print_settings`; ela não depende de
estado local do navegador.

Nos cards dos pedidos são exibidos os estados:

- impressão pendente;
- imprimindo;
- impresso;
- falha na impressão.

Em caso de falha, use **Tentar novamente**. Para uma segunda via intencional,
use **Reimprimir comanda** e confirme a ação. O QZ Tray permanece disponível
apenas como contingência local e não é mais acionado ao receber ou aceitar um
pedido.

## Testes e diagnóstico

Os testes puros da formatação estão em
`supabase/functions/_shared/receipt_test.ts` e podem ser executados com:

```bash
deno test supabase/functions/_shared/receipt_test.ts
```

Antes de liberar em produção, valide nesta ordem:

| Cenário | Como validar |
| --- | --- |
| Pedido simples, retirada e Pix | Finalize um pedido de cada tipo e confira dados, total e forma de pagamento. |
| Vários produtos, personalizado e combo | Compare todos os itens, quantidades, grupos e adicionais com o painel. |
| Observação e texto grande | Use uma observação longa e confirme a quebra de linha sem `undefined` ou `null`. |
| Entrega | Confira endereço, bairro e taxa de entrega. |
| Dinheiro com troco | Confira forma de pagamento e valor para troco. |
| Impressora desligada ou Client offline | Use a comanda de teste e confira o erro no PrintNode/`print_jobs`, sem alterar o pedido. |
| Webhook repetido e simultâneo | Reenvie o mesmo payload do webhook; o `provider_job_id` original deve permanecer único. |
| Reimpressão manual | Confirme a ação no pedido e confira um novo job `kind = 'manual'` com `requested_by`. |
| Caracteres acentuados | O formatador converte para ASCII legível em impressoras ESC/POS genéricas, evitando caracteres corrompidos. |
| Build | Execute `npm run type-check`, `npm run lint` e `npm run build`. |

Para testar indisponibilidade, desligue temporariamente a impressora ou encerre
o PrintNode Client, envie uma comanda de teste e acompanhe o trabalho no painel
do PrintNode e em `public.print_jobs`.

Webhooks repetidos e chamadas simultâneas não reenviam o mesmo trabalho
automático: apenas uma chamada consegue mudar `pending` para `processing`.
Respostas HTTP explicitamente temporárias do PrintNode usam no máximo o número
de tentativas definido em `print_settings` (padrão: 3). Uma falha de rede sem
resposta confirmada não é reenviada automaticamente, pois o primeiro envio pode
ter sido aceito e uma repetição poderia imprimir duas vias.

## Limitações operacionais

O status `printed` significa que a API do PrintNode aceitou o trabalho e
devolveu um ID, não que um sensor confirmou fisicamente a saída do papel. Falta
de papel, impressora desligada ou PrintNode Client offline devem ser
acompanhados também no painel do PrintNode.

Este projeto não possui confirmação automática de pagamento online. As formas
atuais (Pix, cartão e dinheiro na entrega/retirada) preservam a regra existente:
o trabalho é criado quando o pedido completo entra com status `Novo`.
