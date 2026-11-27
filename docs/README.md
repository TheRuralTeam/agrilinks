# Documentação técnica e operacional — AgriLink

Esta pasta reúne documentação de arquitectura, operação, segurança, QA e publicação. O [README principal](../README.md) continua a ser o painel executivo de tarefas; os documentos abaixo guardam procedimentos e critérios detalhados.

## Índice

| Documento | Finalidade |
|---|---|
| [Estado operacional e release](operations/PROJECT_STATUS_AND_RELEASE.md) | Estado conhecido, bloqueios, responsáveis, evidências e sequência de release |
| [Runbook Vercel](operations/VERCEL_PRODUCTION_RUNBOOK.md) | Publicação de `main`, Build Logs, Ignored Build Step, rollback e evidência |
| [Pré-compras do fornecedor](operations/SUPPLIER_PREORDERS_RUNBOOK.md) | RLS, trigger de notificação, Realtime e testes comprador-fornecedor |
| [Tracking e entregas](operations/FREIGHT_TRACKING_RUNBOOK.md) | Requisitos de tracking, offline, permissões, entregas e testes |
| [Auditoria da branch de tracking (27-11-2026)](operations/TRACKING_BRANCH_AUDIT_2026-11-27.md) | Diff, riscos identificados, bloqueios e plano de isolamento antes do merge |
| [Segurança e dados](operations/SECURITY_AND_DATA_HANDLING.md) | Regras de acesso, GPS, dados pessoais, pagamentos e segredos |
| [QA e release checklist](qa/RELEASE_QA_CHECKLIST.md) | Critérios mínimos para validar alterações e releases |

## Convenções de estado

- **Integrado:** código incluído na branch indicada.
- **Migration no repositório:** ficheiro SQL versionado; não prova que foi aplicado remotamente.
- **Aplicado em ambiente:** execução remota confirmada por ferramenta ou evidência operacional.
- **Preview Ready:** deployment de preview compilado; não é produção.
- **Production Ready:** deployment de produção terminou com sucesso.
- **Validado E2E:** fluxo completo testado com os perfis relevantes.
- **Pendente de evidência:** não declarar concluído até obter logs, consulta, teste ou confirmação verificável.

## Princípios

1. Não documentar como concluído o que não foi verificado.
2. Não colocar tokens, passwords, service-role keys, OTPs ou dados pessoais reais em documentação.
3. Registar datas, commit SHA, ambiente, resultado e evidência para cada release.
4. Documentar comportamento esperado, falhas previsíveis, recuperação e critérios de aceitação.
5. Manter documentação técnica próxima do código e actualizar os links do README principal.
