# Auditoria do sistema geográfico e logístico — 2026-10-07

## Objetivo
Validar o mapa como camada transversal da AgriLink: publicação de produtos, ficha técnica, marketplace, pré-compra, compra, origem, destino, cálculo de rota, frete, motorista, GPS, rastreio, entrega, agentes, pontos de agregação e administração.

## Estado atual observado

| Área | Estado | Evidência |
|---|---|---|
| Publicação de produto | 🟡 | O formulário grava latitude/longitude quando fornecidas, mas aceitava publicação sem coordenadas. |
| Origem do produto | 🟡 | `products.location_lat/location_lng` existem e são usadas no marketplace. |
| Ficha técnica | 🟡 | A ficha apresenta província/município e coordenadas de origem. |
| Marketplace | 🟢/🟡 | Produtos usam coordenadas reais quando disponíveis; distância pode ser calculada por rota/posição. |
| Pré-compra | 🟢/🟡 | `pre_orders` possui `destination_lat/destination_lng`; a regra exige origem do produto e valida o destino. |
| Compra | 🟡 | O destino é geocodificado, mas a cadeia completa até `orders` ainda não está comprovada por dados reais. |
| Rota | 🟢 estrutural | `calculateFreightRoute` usa OSRM e retorna distância/duração. |
| Frete | 🟢 estrutural | `freight_loads` guarda origem, destino, rota, motorista e estado. |
| GPS motorista | 🟡 | Existe `freight_load_locations` e partilha via geolocation; atualmente não há registos reais. |
| Histórico GPS | 🟡 | Existe `freight_load_location_history`, mas atualmente sem registos. |
| Entrega | 🟡 | Existe `delivery_tracking`, porém sem registos reais no momento da auditoria. |
| Mapa logístico | 🟡 | A versão QA passou a usar fretes/GPS reais, mas o E2E ainda não foi comprovado. |
| Privacidade geográfica | 🔴/🟡 | A rota pública de produto expunha coordenadas exatas da origem. |
| Província/município | 🟡 | Há fonte central com 21 províncias, mas a cobertura/nomenclatura dos municípios deve ser validada contra fonte oficial antes de declarar 100%. |
| Pontos de agregação | 🟡 | Existem referências na UI, mas operação/coordenadas precisam de validação operacional. |

## Baseline da base de dados
- Produtos: 2
- Produtos com coordenadas: 2
- Produtos com província + município: 2
- Pré-compras: 12
- Pré-compras com destino geográfico: 4
- Fretes: 1
- Fretes com origem + destino: 1
- Fretes atribuídos a motorista: 0
- Localizações GPS actuais: 0
- Histórico GPS: 0
- Registos de entrega: 0

A ausência de GPS/entregas reais significa que rastreio e entrega ainda não podem ser classificados como operacionalmente comprovados.

## Cadeia geográfica alvo
produto/origem → pré-compra/destino → pedido → frete → motorista → GPS → entrega

Cada etapa deve conservar a ligação por IDs e não reconstruir informação apenas a partir de texto da interface.

## Regras de qualidade
1. Produto activo sem origem geográfica não deve entrar no fluxo normal de compra.
2. Destino de compra deve possuir texto e par de coordenadas válido.
3. Rota deve usar origem/destino persistidos, não coordenadas artificiais.
4. ETA deve vir da rota persistida ou de cálculo real, nunca de texto fixo.
5. GPS só deve ser mostrado quando existir localização real e recente.
6. Estado de entrega deve vir do estado real do frete/pedido.
7. Localização pública de produtor deve ser protegida; não expor coordenada exacta de uma machamba sem regra de privacidade.
8. Província e município devem vir da mesma fonte de verdade.
9. Falha de geocoding não deve criar destino fictício.
10. Nenhuma interface deve apresentar progresso logístico calculado a partir de quantidade de produtos.

## Próximas correções
- Tornar coordenada de origem obrigatória na publicação.
- Proteger a visualização pública da localização exacta do produto.
- Validar o fluxo destino → pré-compra → pedido → frete.
- Validar/ligar entrega ao frete e ao pedido.
- Validar GPS real em dispositivo.
- Rever municípios de Angola contra fonte oficial.
- Criar testes de integração para a cadeia geográfica.