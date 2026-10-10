# Mapa Inteligente AgriLink — implementação incremental

## Branch

`feat/intelligent-map-mobility-weather`

Esta branch deriva de `feat/agro-intelligence-foundation` para reutilizar os serviços meteorológicos e de satélite em revisão, sem alterar `main` nem activar funcionalidades em produção.

## Incluído nesta fase

- Painel meteorológico no mapa, ligado à localização do produto seleccionado, à localização pesquisada no mapa ou à geolocalização do utilizador.
- Indicadores de temperatura, humidade relativa, precipitação, vento e nebulosidade, mais uma previsão resumida de três dias.
- Origem e hora de consulta visíveis; o painel identifica os dados como previsão de modelo e não como leitura de um sensor.
- Actualização periódica do pedido meteorológico e botão de actualização manual.
- Estados explícitos para falta de localização, ausência de rede e serviço meteorológico indisponível/não configurado.
- O painel usa a Edge Function autenticada `agro-weather`; a chave do fornecedor não é exposta no frontend.
- Rotas: se o OSRM falhar, o mapa já não desenha uma linha recta como se fosse uma estrada nem apresenta a distância em linha recta como distância rodoviária.
- O rastreamento de cargas já existente na página mantém a subscrição Supabase Realtime para `freight_loads` e `freight_load_locations`.

## Limitações conhecidas / pré-requisitos

1. O serviço `agro-weather` precisa de ser implantado no ambiente de teste e do segredo comercial `OPEN_METEO_API_KEY`. Sem isso, o painel deve apresentar indisponibilidade em vez de dados inventados.
2. A função valida a sessão com Supabase Auth e aplica limite atómico de 30 consultas por utilizador em 15 minutos, usando `public.consume_api_rate_limit` através de `service_role`. Se a verificação do limite falhar, o pedido é recusado (fail closed); a chave `service_role` nunca é enviada ao frontend.
3. O painel consulta a fonte a cada 15 minutos; isto é uma frequência de consulta, não uma promessa de que o modelo meteorológico se actualiza a cada 15 minutos. A hora de consulta fica visível.
4. OSRM público fornece cálculo de trajecto, não tráfego em tempo real. A integração de trânsito exige escolher e validar um fornecedor com cobertura real em Angola, termos de utilização, limites e credenciais. Não foi adicionado um falso indicador de congestionamento.
5. A posição de um motorista só pode ser considerada em tempo real se a aplicação do motorista enviar coordenadas durante uma entrega activa, com permissões e políticas RLS verificadas. Esta branch reutiliza a leitura Realtime existente; não altera o esquema nem cria um novo emissor GPS.
6. Humidade do solo requer sensor ou fonte específica; humidade relativa do ar não é humidade do solo.
7. O catálogo de satélite é metadata de cenas. O NDVI piloto existente usa Sentinel Hub e uma área aproximada em torno de um ponto; não deve ser apresentado como diagnóstico de doença, rendimento ou humidade do solo.

## Próximas fases recomendadas

- **Trânsito e navegação:** comparar fornecedores de rotas/trânsito com cobertura confirmada para Angola; integrar apenas após configurar a chave no backend e testar as respostas de cobertura.
- **Experiência por perfil:** motorista (entrega activa, navegação, ETA e incidentes); comprador (origem/destino, estado e ETA da carga); agricultor (explorações e camadas climáticas/satélite); agente (oferta e recolhas).
- **Meteorologia ao longo da rota:** consultar pontos amostrados da rota e destacar chuva/vento potencialmente relevantes, sem transformar previsões em certezas.
- **Rastreamento do motorista:** rever o emissor de localização, intervalo adaptativo, consumo de bateria, permissões de partilha, retenção e RLS antes de ampliar a visibilidade.
- **Camadas agrícolas:** geometria real das explorações, humidade do solo proveniente de fonte válida, séries NDVI e data de aquisição/processamento.
- **Alertas inteligentes:** regras explicáveis, fonte, hora, confiança e opção para o utilizador dispensar alertas.

## Validação antes de integrar

- Executar CI e verificar lint, testes e build no head desta branch.
- Testar com sessão autenticada, token expirado/anónimo, 31.ª consulta dentro de 15 minutos (429), falha do RPC de limite (503), serviço sem chave, falha do fornecedor, coordenadas fora de Angola e perda/restauro da rede.
- Confirmar que falha de OSRM não cria polylines fictícias.
- Testar sobreposição dos painéis em desktop e telemóvel.
- Não fazer merge nem deploy de produção até revisão e aprovação.
