# Estado operacional e plano de release

> Documento de acompanhamento. Actualizar sempre que uma tarefa muda de estado. O estado abaixo reflecte evidências disponíveis em 27-11-2026; não substitui testes no ambiente real.

## Estado confirmado / reportado

| Área | Estado | Evidência / limite |
|---|---|---|
| Pré-compras — backend | Migration reportada como aplicada no Supabase de produção | Migration versionada em `supabase/migrations/20261126180000_supplier_preorder_inbox.sql`; verificação anterior reportou política, trigger, Realtime e backfill. Revalidar antes de nova operação |
| Pré-compras — frontend | Integrado na `main` via PR #79 | [PR #79](https://github.com/TheRuralTeam/agrilinks/pull/79); [commit de integração](https://github.com/TheRuralTeam/agrilinks/commit/680934a2df90a2bbb7b5a6faf98f0014f298098f) |
| Pré-compras — produção E2E | Pendente | Falta confirmar fornecedor recebe, visualiza e responde a pedido na aplicação publicada |
| Gestão de entregas Admin | Alterações integradas na `main` segundo histórico de commits | Exige teste funcional e revisão de permissões |
| Compromisso/manutenção motorista | Alterações e migrations no repositório | Confirmar migration aplicada e validação no servidor; não confiar apenas no bloqueio da UI |
| Distância OSRM/snapped points | Correcções integradas segundo histórico | Repetir cenários rurais e limites |
| Tracking GPS | Auditoria estática da branch concluída em 27-11-2026; integração bloqueada até isolamento do escopo | Branch `feat/buyer-live-tracking-supplier-handover-receipt` está 113 commits à frente e 19 atrás de `main` e inclui alterações financeiras/checkout. Foram identificados bloqueios no início automático, fim do tracking no mapa e limites da fila offline. Ver [auditoria](TRACKING_BRANCH_AUDIT_2026-11-27.md). Testes Android físicos e E2E continuam pendentes |
| Vercel Production | Bloqueio de acesso e erro de deployment reportados | O projecto pertence à equipa `agrilink-s-projects`; a sessão actual não tem permissão para publicar ou ler logs |
| README/documentação | Índice e runbooks em construção | Este commit adiciona documentação operacional complementar |

## Dependências externas

### Acesso Vercel
O projecto `agrilink` está sob a equipa Vercel `agrilink-s-projects`. O utilizador que administra essa equipa deve:
1. Confirmar ligação ao repositório `TheRuralTeam/agrilinks`.
2. Confirmar Production Branch = `main`.
3. Consultar Build Logs do deployment Production com erro.
4. Rever a regra Ignored Build Step; não a remover sem perceber a intenção.
5. Criar novo deployment a partir do HEAD actual de `main`.
6. Partilhar URL, SHA, estado final e logs de build.

A conta ChatGPT/integração sem autorização na equipa não consegue criar deployment nem consultar detalhes privados. Não contornar esta limitação criando um projecto Vercel alternativo.

## Branch de integração isolada criada — 27-11-2026

Foi criada a branch `feat/integrate-driver-gps-tracking` directamente a partir do HEAD de `main` (`1047e14c009fa8b12af1e42edefc59be457fc7fe`). A branch de origem `feat/buyer-live-tracking-supplier-handover-receipt` não foi integrada. A branch nova começa limpa, sem portar ainda código ou migrations da origem. O plano e os critérios estão em [ISOLATED_TRACKING_INTEGRATION.md](ISOLATED_TRACKING_INTEGRATION.md). A criação foi confirmada; implementação e QA continuam pendentes.

## Ordem de execução

1. **Resolver produção Vercel:** corrigir build ou regra de ignore; publicar HEAD de main.
2. **Validar pré-compras E2E:** comprador cria; fornecedor recebe notificação; pedido aparece; fornecedor aceita/rejeita; comprador vê estado.
3. **Validar regressões de marketplace e autenticação.**
4. **Prioridade actual — tracking GPS:** rever a branch `feat/buyer-live-tracking-supplier-handover-receipt` face à `main`; confirmar evento de recolha, autorização por entrega, estados do mapa, fila offline, sincronização idempotente, migrations/RLS e consumo de bateria.
5. Testar em Android real: rede estável/intermitente, modo avião, GPS desligado, segundo plano, permissões e reinício.
6. Integrar tracking apenas após revisão do diff e QA; depois publicar e validar E2E em Production.
7. Validar Admin/entregas/manutenção/rotas com perfis reais.
8. Actualizar este documento e README com os SHAs e resultados observados.

## Registo de release

Preencher para cada publicação:

| Campo | Valor |
|---|---|
| Data/hora (UTC) | Pendente |
| Ambiente | Production |
| Branch | `main` |
| Commit SHA | Pendente — usar HEAD no momento do deploy |
| URL do deployment | Pendente |
| Estado Vercel | Pendente |
| Build logs | Pendente |
| Smoke tests | Pendente |
| E2E comprador-fornecedor | Pendente |
| Responsável que confirmou | Pendente |

## Regras para status

Não usar “resolvido”, “publicado” ou “funcional em produção” apenas porque:
- existe um commit;
- um PR foi merged;
- uma migration existe no repositório;
- um Preview está Ready;
- um check genérico do GitHub está verde.

Exigir a evidência correspondente ao ambiente e ao fluxo em questão.
