# Reconciliação do histórico de migrations — AgriLink

**Data:** 2026-10-15  
**Ramo:** `feat/multi-agent-core-audit`  
**Supabase project ref:** `oqcrfqtlfqwrxxmsjpaf`  
**Tipo de trabalho:** leitura do histórico remoto e dos ficheiros locais; nenhuma alteração foi aplicada à base de dados.

## Resultado executivo

**Não executar `supabase db push` nem aplicar as migrations multiagente/hardening em produção neste momento.** O ledger remoto e os nomes/versões locais não estão suficientemente reconciliados. O facto de uma migration existir no ledger sob um nome parecido não comprova que o seu conteúdo seja idêntico ao ficheiro local.

A listagem remota confirma que as migrations de proforma, tipos de pré-compra, políticas administrativas e referência do comprador do frete aparecem com versões remotas diferentes das versões que constam nos nomes locais.

## Colisões locais de versão

Há quatro prefixos de 14 dígitos usados por mais de um ficheiro local:

| Prefixo em colisão | Ficheiros locais |
| --- | --- |
| `20261007090000` | `fix_pre_order_acceptance_terms`; `functional_hardening_signup_identity_notifications` |
| `20261008130000` | `add_p2p_beneficiary_marketplace`; `endurecer_execucao_funcoes_internas` |
| `20261013100000` | `create_proforma_invoices`; `fix_marketplace_pre_order_result_types` |
| `20261013120000` | `admin_only_proformas`; `fix_freight_load_buyer_reference` |

Estas colisões devem ser tratadas como problema de histórico, não corrigidas por renomeação automática. Alterar o prefixo pode fazer o CLI considerar uma migration antiga como nova e repetir DDL ou alterar permissões.

## Correspondências de nomes vistas no ledger remoto

| Nome local relevante | Versão/nome que aparece no ledger remoto |
| --- | --- |
| `endurecer_execucao_funcoes_internas` | `20261008124445` / `20261008130000_endurecer_execucao_funcoes_internas` |
| `create_proforma_invoices` | `20261013083057` / `20261013100000_create_proforma_invoices` |
| `fix_marketplace_pre_order_result_types` | `20261013083950` / `fix_marketplace_pre_order_result_types` |
| `admin_only_proformas` | `20261013094717` / `20261013120000_admin_only_proformas` |
| `fix_freight_load_buyer_reference` | `20261013093538` / `fix_freight_load_buyer_reference` |

Os nomes são indícios de correspondência, não prova de equivalência de conteúdo. O ledger também contém versões anteriores sem nomes descritivos, pelo que a reconciliação deve considerar o histórico Git, o SQL local e o esquema/definições remotos.

## Sequência segura de reconciliação

1. Exportar e guardar o ledger remoto e o esquema remoto como artefactos de auditoria, sem escrita.
2. Para cada versão remota com nome correspondente, comparar o SQL local com a definição/efeito atualmente observável no esquema remoto e com os commits históricos. Marcar cada caso como **confirmado**, **divergente** ou **não verificável**.
3. Confirmar as migrations sem nome descritivo antigas através do histórico Git e dos objetos atuais; não inferir equivalência apenas pela data.
4. Criar uma base/branch de desenvolvimento isolada, restaurar nela uma cópia adequada do esquema e testar migrations novas nessa base.
5. Só depois de obter um mapa inequívoco, decidir se é necessário reparar o histórico com procedimento explícito e aprovado. Não editar manualmente o ledger de produção como atalho.
6. Aplicar as novas migrations primeiro no ambiente de desenvolvimento e validar grants, RLS, RPCs e workflows antes de qualquer decisão sobre produção.

## Migrations do núcleo multiagente

As migrations `20261014190000_restrict_internal_freight_rpc_execution.sql` e `20261014191000_create_multi_agent_orchestration_tables.sql` permanecem propostas no ramo de trabalho. A consulta remota anterior confirmou que `agent_tasks`, `agent_events` e `agent_approvals` ainda não existem no projeto. Não foram aplicadas.

A auditoria remota também identificou permissões `EXECUTE` de `anon` em algumas RPCs de frete/moderação que esta migration de hardening pretende restringir. **Essas permissões continuam por corrigir na base remota** enquanto a migration não for validada e aplicada.

## Critério para sair desta fase

- [ ] Cada migration local tem estado de reconciliação documentado.
- [ ] Nenhuma colisão é resolvida apenas renomeando ficheiros.
- [ ] As migrations novas passam numa base de desenvolvimento.
- [ ] Os grants finais são verificados com consultas read-only.
- [ ] O fluxo de CI passa e a revisão de segurança fica registada.
