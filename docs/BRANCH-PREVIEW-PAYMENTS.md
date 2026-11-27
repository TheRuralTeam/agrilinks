# Executar a branch de pagamentos em ambiente separado

Esta branch não altera a branch `main`. Para executar a versão de teste localmente:

```bash
git clone https://github.com/TheRuralTeam/agrilinks.git
cd agrilinks
git fetch origin
git switch --track origin/feat/admin-bank-payment-methods
npm ci
```

Crie o ficheiro `.env.local` com as variáveis de desenvolvimento documentadas em `.env.example`. Não copie chaves `service_role`, tokens Vercel ou credenciais de produção para o browser.

Execute os controlos:

```bash
npm run audit:migrations
npm run lint
npm run type-check:strict
npm test -- --run
npm run build
```

Inicie a aplicação:

```bash
npm run dev -- --host 0.0.0.0
```

Abra o endereço local indicado pelo Vite. Para manter o ambiente isolado, utilize um projeto Supabase de staging com as suas próprias credenciais e aplique as migrations de staging antes de testar operações bancárias.

**Não use o projeto Supabase de produção para testes de criação, edição, ativação ou arquivo.** A conta bancária fornecida está pendente de verificação e não deve ser ativada em testes.
