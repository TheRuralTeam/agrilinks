# Auditoria de reconciliação do histórico Supabase — 18/11/2026

## Âmbito e método

Auditoria somente de leitura ao projecto Supabase `oqcrfqtlfqwrxxmsjpaf` e ao directório `supabase/migrations/` da branch `main` do repositório `TheRuralTeam/agrilinks`. Foram comparadas as versões do ledger remoto com os prefixos temporais e nomes dos ficheiros locais. A comparação por nome normaliza diferenças de timestamp e sufixos temporais embutidos no nome remoto. Não foi executado `db push`, `migration repair`, `apply_migration`, DDL, alteração de dados nem qualquer operação de reset/merge.

## Resultado quantitativo

| Indicador | Resultado |
|---|---:|
| Ficheiros SQL locais na main | 183 |
| Registos no ledger remoto | 208 |
| Correspondências exactas por versão | 55 |
| Registos remotos com nome | 145 |
| Remotos com nome que correspondem a ficheiro local pelo nome normalizado | 101 |
| Remotos com nome sem ficheiro local correspondente | 44 |
| Registos remotos sem nome | 63 |
| Sem nome, com ficheiro local temporalmente próximo (até 60 s) | 41 |
| Sem nome, sem correspondência temporal próxima (>60 s) | 22 |

**Conclusão:** o desvio não é simplesmente “25 migrations em falta”. Existem versões de timestamp divergente, entradas antigas sem nome e migrations remotas sem ficheiro recuperável na branch actual. A correspondência por nome é indicativa, não prova equivalência do SQL.

## A. Registos remotos nomeados sem ficheiro local correspondente

Estas 44 entradas exigem recuperar o SQL original de uma fonte histórica ou confirmar o respectivo efeito no schema. Não criar ficheiros vazios nem atribuir nomes por suposição.

| Versão remota | Nome registado |
|---|---|
| `20260806004552` | `4dcdcb25-d2f8-478e-ad63-7ea4e26dd600` |
| `20260806004640` | `d1749350-ee86-417e-8624-4495790df179` |
| `20260919000000` | `api_rate_limits` |
| `20261003010000` | `freight_load_location_history` |
| `20261003020000` | `nominatim_geocoding_proxy` |
| `20261003130000` | `admin_user_metrics` |
| `20261003140000` | `admin_operational_metrics` |
| `20261004120000` | `order_freight_gps_fulfillment` |
| `20261004130000` | `pre_order_buyer_cancellation` |
| `20261005100000` | `freight_pricing_and_stock_reservations` |
| `20261006100000` | `freight_taxi_style_pricing` |
| `20261006221756` | `marketplace_transactional_pre_order` |
| `20261006222808` | `marketplace_smart_checkout_foundation` |
| `20261006222945` | `marketplace_payment_webhook_settlement` |
| `20261006230818` | `admin_pre_order_15_day_trash` |
| `20261007080314` | `normalizar_localizacoes_angola_2026` |
| `20261007110108` | `firewall_security_layer` |
| `20261007110149` | `firewall_service_role_rpc_wrappers` |
| `20261007195919` | `trusted_login_devices_and_ip_controls` |
| `20261007195932` | `registration_ip_guard` |
| `20261007200042` | `trusted_devices_and_recovery_codes` |
| `20261007200933` | `trusted_login_security_pin_policy` |
| `20261007200939` | `move_firewall_policy_private` |
| `20261007220347` | `corrigir_ambiguidade_rpc_pre_order_20261007` |
| `20261008101546` | `integrate_p2p_payment_lifecycle_20261008` |
| `20261008124445` | `20261008130000_endurecer_execucao_funcoes_internas` |
| `20261008125355` | `endurecer_mensagens_contra_idor_20261008` |
| `20261008183535` | `20261008170000_idempotencia_transferencias_internas_e_frete` |
| `20261008183545` | `20261008170500_corrigir_idempotencia_transferencias` |
| `20261008183558` | `20261008171000_remover_indice_pagamento_duplicado` |
| `20261008183644` | `20261008172000_fechar_execucao_publica_rpc` |
| `20261008183932` | `20261008173000_endurecer_contacto_publico` |
| `20261008183946` | `20261008173500_reduzir_pii_perfil_publico` |
| `20261008184325` | `20261008180000_corrigir_atomicidade_webhook_pagamentos` |
| `20261008184409` | `20261008181000_remover_indice_wallets_duplicado` |
| `20261008185236` | `20261008185000_endurecer_expiracao_p2p` |
| `20261008185942` | `20261008190000_corrigir_recursao_reserva_stock` |
| `20261008190006` | `20261008191500_corrigir_liberacao_reserva_e_guard_cancelamento` |
| `20261008203450` | `endurecer_cancelamento_frete_pedido` |
| `20261013083057` | `20261013100000_create_proforma_invoices` |
| `20261013094717` | `20261013120000_admin_only_proformas` |
| `20261016112951` | `sync_agent_tasks_with_sourcing_status` |
| `20261019214825` | `fix_pre_order_buyer_id_column` |
| `20261101071101` | `sourcing_rpc_only_writes` |

## B. Registos remotos sem nome com correspondência temporal provável

A proximidade temporal é apenas uma pista; validar o conteúdo SQL antes de associar formalmente. O nome remoto está vazio.

| Versão remota | Ficheiro local candidato | Diferença |
|---|---|---:|
| `20251024101313` | `20251024101318_9dd27411-6a8d-4a35-8a3d-ea2c4151b7ae.sql` | 5s |
| `20251102025755` | `20251102025757_6c325bd9-f2f5-4f86-b296-8f37c09b7bbe.sql` | 2s |
| `20251102030039` | `20251102030041_c49707c4-a8bd-4154-abfa-bf35849642a4.sql` | 2s |
| `20251104003627` | `20251104003630_8395bce6-bbea-45db-9aab-ac871c3b57be.sql` | 3s |
| `20251105095441` | `20251105095443_0df193fb-c1c6-4850-af5b-7342069ba0ac.sql` | 2s |
| `20251105095532` | `20251105095534_abe88fbf-55ad-4425-8b5b-503924ed0268.sql` | 2s |
| `20251105095637` | `20251105095640_94cbdfe3-ae2b-4b81-9943-217f22b9bf5a.sql` | 3s |
| `20251105095750` | `20251105095752_0eeb6d01-8def-4691-8090-a51e09fbfe8e.sql` | 2s |
| `20251106114353` | `20251106114356_8345bbc9-5665-4393-ac2d-b6a63a6554a3.sql` | 3s |
| `20251106114439` | `20251106114441_6358ab19-9b47-4a9d-a8f4-ac650314edec.sql` | 2s |
| `20251106120618` | `20251106120620_10ad9fe4-c0d4-4bf4-b37e-9eb2331ee26d.sql` | 2s |
| `20251106120745` | `20251106120746_760d9679-b250-4c09-b384-2e9f36d70044.sql` | 1s |
| `20251201133832` | `20251201133834_8da20380-b827-42a5-b67f-bda7bfc85a3d.sql` | 2s |
| `20251203044744` | `20251203044748_466a806e-bdbb-47d8-a3ec-424c1692b1ae.sql` | 4s |
| `20251203044839` | `20251203044841_25deee48-33dd-4cf2-bfb3-6d08f06a0f0b.sql` | 2s |
| `20251203050453` | `20251203050455_40e1598b-d59b-4100-b9d2-2ed187848f10.sql` | 2s |
| `20251204113035` | `20251204113037_11adb1c1-2933-4ef4-9a46-4337a1535611.sql` | 2s |
| `20251210131753` | `20251210131755_a3d28d84-9e7c-41af-8982-84e7221b1b9a.sql` | 2s |
| `20251215032034` | `20251215032037_a0129d1c-25fd-4ff8-b851-971c24937315.sql` | 3s |
| `20251215033158` | `20251215033201_3fbb1a1b-110a-4e90-88a6-7d11577d7317.sql` | 43s |
| `20251215113859` | `20251215113901_b708cdd1-276a-4295-81d7-471de1d54257.sql` | 42s |
| `20251217002631` | `20251217002633_0380fe8c-2d14-4ae0-9e4a-8ab847ec9fba.sql` | 2s |
| `20251219153920` | `20251219153922_5325343a-80d9-4b3e-8641-a8da8aee3c5b.sql` | 2s |
| `20251227193538` | `20251227193540_671a6fde-61ed-4863-b8f1-1a6761a3e58a.sql` | 2s |
| `20251228232816` | `20251228232819_99c17764-06f3-4b5f-a6e5-4e1e5edfb7ad.sql` | 3s |
| `20251228234250` | `20251228234252_d86961aa-9909-4cf9-99ce-f4dfb58df369.sql` | 2s |
| `20251229073857` | `20251229073900_4b996dca-86fc-4696-a26b-ed4570a28a5a.sql` | 43s |
| `20251229090627` | `20251229090629_403655bd-8b5a-4315-b4ab-ae960fc3e538.sql` | 2s |
| `20251229091710` | `20251229091713_1618a93c-efd7-4d88-853c-c513f27ba224.sql` | 3s |
| `20251229092139` | `20251229092141_4cd81443-26ff-4e05-9128-f6d0b7ad7c7d.sql` | 2s |
| `20251229092943` | `20251229092945_8b92170a-db05-4cf5-a467-c1ea646b7b62.sql` | 2s |
| `20260105145932` | `20260105145934_2a866f51-027b-43e0-b4ba-56253db06936.sql` | 2s |
| `20260105150028` | `20260105150030_bebf9699-dd6b-46f9-a559-707babf964fa.sql` | 2s |
| `20260105163205` | `20260105163207_0f7af622-69aa-485e-ab79-4535d7825cb5.sql` | 2s |
| `20260105163448` | `20260105163450_17d5d110-5cdf-437f-abb9-5931006329ff.sql` | 2s |
| `20260120143707` | `20260120143710_886af7c3-6804-4148-a5a5-e53bfba3e778.sql` | 3s |
| `20260207115918` | `20260207115921_5c144e77-2893-46ec-83bf-ca216eeab750.sql` | 3s |
| `20260207230004` | `20260207230007_56a16699-40ab-49e3-9195-995eaff03e74.sql` | 3s |
| `20260503055602` | `20260503055605_c46074b7-27d2-4d9d-a852-7b958cf78e7f.sql` | 3s |
| `20260504005144` | `20260504005147_769ac851-d13e-4f0b-af43-5a3dc84a60b4.sql` | 3s |
| `20260506022840` | `20260506022844_b61b16cc-e102-4b68-a3e4-e3c7f4cc2270.sql` | 4s |

## C. Registos remotos sem nome sem candidato temporal próximo

Estas versões não têm nome no ledger e não apresentam ficheiro local num intervalo de 60 segundos. A recuperação requer Git histórico/backups ou evidência de alterações no schema.

| Versão remota |
|---|
| `20251022110852` |
| `20251022113559` |
| `20251024093516` |
| `20251107143143` |
| `20251107143222` |
| `20251107143259` |
| `20251107143417` |
| `20251107152454` |
| `20251108042130` |
| `20251108042733` |
| `20251108183144` |
| `20251112093255` |
| `20251112093333` |
| `20251112124923` |
| `20251113233038` |
| `20251113233739` |
| `20251114115939` |
| `20251114120307` |
| `20251114120903` |
| `20260410010425` |
| `20260410010504` |
| `20260412235841` |

## D. Plano seguro de reconciliação

1. Congelar qualquer `db push`, `migration repair`, reset, rebase ou merge de branch Supabase até fechar esta auditoria.
2. Fazer backup verificável do banco e exportar o schema actual (sem dados sensíveis) para referência.
3. Recuperar os SQLs originais dos 44 registos nomeados e das 22 versões sem nome sem candidato temporal; pesquisar Git refs antigas, backups de CI/ambiente e artefactos de deploy.
4. Para os 41 registos sem nome com timestamp próximo, comparar o conteúdo SQL recuperado com o ficheiro local candidato; não confiar apenas na proximidade temporal.
5. Para os 101 registos nomeados que correspondem por nome mas têm timestamp diferente, confirmar o conteúdo e registar explicitamente a correspondência versão remota ↔ ficheiro local.
6. Só depois de confirmar o SQL e o schema, preparar uma branch de reconciliação com os ficheiros originais e validar `supabase migration list` num ambiente isolado.
7. Não usar `migration repair --status applied` para ocultar ficheiros ausentes: isso altera o ledger sem recuperar a fonte e pode mascarar divergência real.

## Estado de segurança

- O projecto Supabase de produção não foi alterado nesta auditoria.
- A branch `main` não foi alterada.
- Nenhuma migration foi aplicada, reparada ou removida.
- Não existe evidência suficiente para afirmar que todos os 208 registos têm a fonte SQL correspondente na branch actual.

## Referências

- Repositório: https://github.com/TheRuralTeam/agrilinks/tree/main/supabase/migrations
- Projecto Supabase: `oqcrfqtlfqwrxxmsjpaf`
- Data da auditoria: 18/11/2026

## E. Pesquisa de recuperação em refs e artefactos — 18/11/2026

Foi feita uma segunda pesquisa read-only nas fontes históricas disponíveis:

- GitHub: 56 branches listadas; foram inspeccionadas refs históricas relevantes, incluindo `restauracao`, `security/firewall-layer`, `security/revoke-public-trigger-rpc-execution`, `security/sourcing-rpc-only-writes`, `qa/production-stabilization-2026-10-07`, `audit/e2e-functional-hardening`, `auditoria/cache-seguro-pwa-20261009` e `qa/libertar-previews-publicacao-20261010`.
- A branch `restauracao` contém 60 ficheiros SQL. Os 41 candidatos temporais (registos remotos sem nome) estão todos presentes nessa branch e têm o mesmo blob SHA que os respectivos ficheiros da `main` (41/41). Isto confirma que os ficheiros candidatos são idênticos entre as duas refs; não prova, por si só, que cada SQL foi exactamente o executado no remoto.
- A branch `restauracao` não acrescenta ficheiros SQL exclusivos em relação à `main`.
- Não foi encontrada, nas refs históricas inspeccionadas, correspondência por nome normalizado para os registos remotos nomeados que continuam sem ficheiro na `main`.
- O endpoint de tags devolveu lista vazia.
- A execução CI do PR #61 terminou com sucesso; a consulta de artefactos dessa execução devolveu zero artefactos.
- O projecto Supabase tem apenas a branch `main`; não existem branches de preview/desenvolvimento do projecto para consultar.

### Resultado desta pesquisa

Os 41 registos sem nome com candidato temporal ficam classificados como **correspondência forte por proximidade temporal e identidade do ficheiro entre refs**, mas ainda sem prova criptográfica de correspondência com o SQL aplicado remotamente.

Os 44 registos nomeados sem ficheiro e os 22 registos sem nome sem candidato temporal continuam **sem fonte SQL recuperada**. Não foram criados ficheiros SQL substitutos, nem se inferiu conteúdo a partir do schema actual.

### Próxima acção técnica segura

Para os 66 registos ainda sem fonte, a recuperação terá de vir de uma cópia local antiga, exportação/backup do projecto, histórico de terminal/CLI, artefactos externos ou outro repositório/ambiente de desenvolvimento. O ledger remoto e o schema actual não contêm o texto original das migrations. Até existir essa fonte, manter bloqueados `db push`, `migration repair` e qualquer alteração ao histórico remoto.


## F. Nova descoberta: SQL preservado no ledger remoto — 18/11/2026

Uma consulta read-only à definição e aos dados de `supabase_migrations.schema_migrations` identificou as colunas `statements` e `rollback`, além de `version` e `name`.

Resultado confirmado no projecto remoto:

| Indicador | Resultado |
|---|---:|
| Registos totais | 208 |
| Registos com `statements IS NOT NULL` | 208 |
| Registos com array `statements` não vazio | 208 |
| Registos com `rollback` não nulo | 0 |
| Registos com 1 elemento em `statements` | 193 |
| Registos com múltiplos elementos em `statements` | 15 |

### Validação de conteúdo

- Na versão `20261101010028`, o único elemento de `statements` corresponde ao conteúdo do ficheiro `supabase/migrations/20261101010028_sourcing_purchase_lifecycle.sql` na branch `main`, byte a byte até ao fim do SQL armazenado. O ficheiro local acrescenta apenas o wrapper terminal `commit;` e a quebra de linha final, ausentes no texto armazenado.
- Na versão `20260917170000`, o ledger contém 19 elementos ordenados em `statements`; o início do primeiro elemento corresponde ao início do ficheiro local `20260917170000_auth_rpc_hardening.sql`. Os elementos são segmentos SQL, não um ficheiro serializado byte a byte; a reconstrução deve preservar a ordem e reintroduzir separadores/terminadores SQL de forma controlada.

### Consequência para a recuperação

A conclusão anterior de que o ledger remoto não contém o SQL original fica **revogada**. O ledger conserva os textos SQL executados para os 208 registos, embora a representação em array não garanta reprodução byte a byte do ficheiro original, incluindo comentários, espaçamento e wrappers transaccionais.

Isto fornece uma fonte primária para recuperar os comandos SQL aplicados nas 66 versões que não tinham ficheiro local correspondente. Antes de criar ficheiros de migration recuperados, é necessário:
1. exportar e preservar os arrays `statements` completos, com as versões e nomes;
2. reconstruir cada ficheiro mantendo a ordem dos elementos e sem executar SQL;
3. validar a reconstrução contra os ficheiros locais conhecidos, incluindo migrations de um e de múltiplos elementos;
4. marcar explicitamente a proveniência como **recuperado do ledger remoto**, sem afirmar identidade byte a byte quando não demonstrada;
5. comparar os 41 candidatos sem nome com os respectivos ficheiros locais antes de associar formalmente as versões.

Nenhuma migration foi executada, reparada ou alterada no projecto remoto. O backup lógico local continua pendente; esta descoberta não o substitui.


## G. Validação cruzada do conteúdo SQL — 18/11/2026

A comparação foi aprofundada usando os arrays `statements` do ledger e os ficheiros locais, removendo apenas diferenças de comentários, espaços e terminadores para comparar o conteúdo SQL efectivo.

| Grupo | Resultado |
|---|---:|
| Registos sem nome com candidato temporal | 41/41 correspondem ao SQL do ledger |
| Registos nomeados com ficheiro por nome, mas timestamp diferente | 45/49 correspondem |
| Registos com versão exacta já representada localmente | 54/55 correspondem |
| Divergências de conteúdo identificadas | 5 |

### Cinco divergências que exigem tratamento separado

| Versão remota | Ficheiro local candidato | Observação |
|---|---|---|
| `20261009120808` | `20261009120808_secure_email_outbox_worker.sql` | Mesmo prefixo de versão, conteúdo SQL divergente |
| `20261006222001` | `20261006234000_marketplace_reservation_lifecycle.sql` | Nome correspondente, conteúdo divergente |
| `20261007060202` | `20261007070000_freight_load_qr_access_and_pdf.sql` | Nome correspondente, conteúdo divergente |
| `20261008102346` | `20261008143000_p2p_transaction_history_and_receipts.sql` | Nome correspondente, conteúdo divergente |
| `20261014090931` | `20261014110000_driver_accept_load_pickup_and_gps_workflow.sql` | Nome correspondente, conteúdo divergente |

Não associar nem renomear automaticamente estes cinco pares. O SQL remoto deve ser preservado como evidência independente e as versões locais devem ser revistas antes de qualquer reconciliação.

### Duplicados detectados na recuperação inicial

Três das 66 versões inicialmente reconstruídas já tinham um ficheiro local com o mesmo prefixo de versão e SQL equivalente. Os ficheiros reconstruídos duplicados foram removidos da branch; os ficheiros locais originais foram preservados:

- `20261008124445`
- `20261013083057`
- `20261013094717`

Assim, permanecem **63 ficheiros SQL novos** recuperados do ledger, sem duplicar os três ficheiros já existentes.

### Estado de validação

- A execução CI #1169 do PR #61 terminou com sucesso antes desta actualização documental e da remoção dos três duplicados.
- Os 41 candidatos temporais estão confirmados por equivalência do SQL, mas ainda não foram renomeados para as versões remotas.
- Os 45 pares nomeados equivalentes também aguardam reconciliação de timestamps.
- Os cinco pares divergentes permanecem bloqueados para revisão individual.
- O backup lógico local continua pendente.
- Nenhuma operação de escrita, DDL, repair ou aplicação de migrations foi executada no Supabase remoto.



## H. Correcção metodológica da comparação SQL — 18/11/2026

Esta secção **substitui os resultados de equivalência positiva apresentados na secção G**. Uma reavaliação identificou que a normalização usada anteriormente removia whitespace de forma demasiado agressiva. Esse procedimento não preserva necessariamente fronteiras entre tokens SQL e, por isso, não é adequado para provar equivalência. Os totais positivos anteriormente apresentados (41/41, 45/49 e 54/55) ficam retirados até serem repetidos com um comparador SQL lexical/token-aware, que preserve literais, identificadores entre aspas, operadores e fronteiras de tokens.

### Cinco divergências revalidadas

Foi feita uma comparação directa dos arrays `statements` do ledger remoto com os ficheiros locais correspondentes. Nos cinco casos abaixo, as diferenças observadas são diferenças de conteúdo SQL, e não apenas de timestamp ou formatação:

| Versão remota | Ficheiro local | Diferença material observada |
|---|---|---|
| `20261009120808` | `20261009120808_secure_email_outbox_worker.sql` | O ledger começa por criar a função `is_valid_email_outbox_worker_secret`; o ficheiro local começa por um bloco `DO` que verifica/cria o segredo no Vault antes de definir a função. Os conteúdos não são equivalentes. |
| `20261006222001` | `20261006234000_marketplace_reservation_lifecycle.sql` | O ledger começa pelas funções de libertação/consumo/expiração de reservas; o ficheiro local começa por alterações de estrutura a `products` e `pre_orders`, incluindo colunas de reserva. |
| `20261007060202` | `20261007070000_freight_load_qr_access_and_pdf.sql` | A função remota autoriza o papel `support`; o ficheiro local usa `support_agent`. A diferença altera a condição de autorização. |
| `20261008102346` | `20261008143000_p2p_transaction_history_and_receipts.sql` | O ledger revoga privilégios da função de autorização de `PUBLIC`; o ficheiro local revoga de `PUBLIC, anon`. A diferença altera explicitamente os privilégios. |
| `20261014090931` | `20261014110000_driver_accept_load_pickup_and_gps_workflow.sql` | A ordem e o conteúdo inicial diferem: o ledger começa pela definição de `accept_freight_load`; o ficheiro local começa por adicionar `driver_arrived_at` antes das funções. |

**Decisão:** manter estes cinco pares separados. Não renomear, substituir, combinar nem marcar como equivalentes. Preservar os SQLs do ledger e os ficheiros locais como duas fontes distintas até revisão individual.

### Estado das outras correspondências

- Os 41 candidatos sem nome continuam a ter identidade de blob entre as branches `main` e `restauracao`; isso confirma identidade entre refs Git, mas não prova equivalência com o SQL do ledger remoto.
- Os resultados positivos de equivalência SQL da secção G ficam suspensos. Não usar os números 41/41, 45/49 ou 54/55 como base para reconciliação.
- Os 63 ficheiros recuperados continuam identificados como reconstruídos a partir dos arrays `statements` do ledger. A recuperação preserva o SQL registado, mas não prova identidade byte a byte com os ficheiros originais que foram executados.
- A comparação positiva deve ser refeita com tokenização SQL que preserve literais e fronteiras lexicais. Até lá, apenas divergências materiais observadas directamente podem ser classificadas como divergentes.

### CI e segurança

- O workflow CI #1170, associado ao commit `9a860d3b5502f87a2985642a4825d434e98039fc`, terminou com sucesso; o job `build` e todos os passos apresentados ficaram concluídos com sucesso.
- A execução não produziu artefactos.
- O backup lógico local continua pendente.
- Esta actualização é documental. Não foi executado DDL, `db push`, `migration repair`, reset, nem qualquer escrita no Supabase remoto.
- A reconciliação continua bloqueada até existir backup verificável e uma comparação SQL fiável de todos os pares candidatos.


## I. Comparação lexical dos cinco pares bloqueados — 18/11/2026

Foi executada uma comparação token-aware read-only entre os arrays `statements` do ledger remoto e os ficheiros locais da branch de auditoria. O comparador ignora whitespace e comentários SQL, mas preserva tokens, literais, identificadores entre aspas, operadores e blocos dollar-quoted como unidades indivisíveis. Não é um parser PostgreSQL completo; serve para confirmar diferenças lexicais e não para certificar equivalência semântica global.

| Versão remota | Tokens ledger | Tokens ficheiro local | Resultado |
|---|---:|---:|---|
| `20261009120808` | 55 | 61 | Divergente desde o primeiro token: ledger inicia a função; ficheiro local inicia um bloco `DO` de criação/verificação do segredo Vault |
| `20261006222001` | 159 | 366 | Divergente desde o primeiro token: ledger inicia funções de ciclo de vida; ficheiro local inicia alterações de schema |
| `20261007060202` | 205 | 205 | Divergente no corpo dollar-quoted da função: papel remoto `support`, ficheiro local `support_agent` |
| `20261008102346` | 500 | 502 | Divergente nos privilégios: ledger revoga de `PUBLIC`; ficheiro local revoga de `PUBLIC, anon` |
| `20261014090931` | 80 | 80 | Divergente desde o primeiro token: ledger inicia a função `accept_freight_load`; ficheiro local inicia por `ALTER TABLE` para adicionar `driver_arrived_at` |

### Conclusão desta comparação

- Os cinco pares são lexicalmente diferentes. Não são diferenças de timestamp ou whitespace.
- No caso QR, a divergência `support` vs `support_agent` altera directamente a autorização de consulta.
- No caso P2P, a divergência na lista de roles afecta os privilégios revogados.
- Os outros três pares apresentam estruturas/ordens de operações distintas, não devendo ser combinados nem substituídos automaticamente.
- Esta comparação valida apenas os cinco pares indicados. Os restantes candidatos continuam sem certificação lexical; os totais positivos anteriormente indicados na secção G permanecem retirados.

### Estado de CI do commit de auditoria

- Commit auditado: `9f063782bf9d63b2131a94f3eb23d855e01ac7a6`.
- Check Vercel reportado para esse commit: `success`.
- Não foi devolvido um workflow run GitHub Actions associado ao SHA consultado; portanto, não declarar o CI completo como aprovado para este commit com base apenas no check Vercel.
- O workflow #1170 relativo ao commit anterior `9a860d3` permanece registado como concluído com sucesso na secção H.

A comparação foi read-only. Nenhuma migration foi aplicada, reparada ou renomeada; nenhuma alteração foi feita ao ledger remoto. O backup lógico verificável continua pendente.
