# DNA do Açaí

Loja e painel administrativo em Next.js, React, TypeScript, TailwindCSS e Supabase.

## Desenvolvimento

Use Node.js 24. Instale as dependências com `npm install`, copie `.env.example` para
`.env.local` e preencha as credenciais do projeto correto:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

A chave privada fica somente no servidor. `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` são alternativas legadas; as chaves novas têm prioridade.

Prepare o banco com as migrations em `supabase/migrations/`. Confira o projeto
vinculado e execute primeiro `npx supabase db push --linked --dry-run`. Em produção,
coordene as migrations com a publicação da API e a configuração da conta administrativa.
Não reexecute `supabase/orders.sql`: ele é o bootstrap histórico com policies públicas,
substituídas pelas migrations de segurança.

Execute `npm run dev`. O painel fica em `/admin/login` e exige uma conta do Supabase
Auth com `app_metadata.role = "admin"`. Não há cadastro público.

O catálogo padrão está em `src/data/menu.ts`. O painel mantém um rascunho local;
**Publicar catálogo** grava no Supabase para todos os dispositivos. A API de pedidos
usa esse mesmo catálogo e preserva os preços históricos.

## Verificação

```powershell
npm.cmd run lint
npm.cmd run type-check
npm.cmd test
npm.cmd run test:promotion:integration
npm.cmd run build
```

Os testes usam banco efêmero e credenciais fictícias. Não enviam pedidos, mensagens
ou impressões reais. A integração requer Chromium disponível pelo Playwright.

- [Auditoria funcional, configuração externa e lançamento](docs/AUDITORIA-FUNCIONAL.md)
- [Regras e horários da promoção de 72 horas](docs/PROMOCAO-72H.md)
- [Configuração do PrintNode](docs/PRINTNODE.md)
