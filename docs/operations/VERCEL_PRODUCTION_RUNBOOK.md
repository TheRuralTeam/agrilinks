# Runbook — publicação de produção na Vercel

## Objectivo

Publicar a versão integrada da AgriLink a partir da branch `main`, mantendo o projecto e domínio de produção existentes.

## Pré-requisitos

- Acesso de membro autorizado à equipa Vercel `agrilink-s-projects`.
- Projecto Vercel `agrilink` ligado ao repositório `TheRuralTeam/agrilinks`.
- Variáveis de ambiente Production configuradas no projecto.
- Production Branch definida como `main`.
- Dependências e build scripts coerentes com `package.json`.

## Procedimento

1. Abrir o projecto `agrilink` na equipa correcta.
2. Abrir **Settings → Git** e confirmar repositório e Production Branch.
3. Abrir **Deployments** e seleccionar o deployment Production em erro.
4. Abrir **Build Logs** e guardar a mensagem de erro integral, incluindo etapa e comando.
5. Distinguir erro de build, erro de instalação, variável ausente, falha de framework e deployment ignorado.
6. Rever **Ignored Build Step**. Se o resultado for `Ignored`, verificar a condição configurada e se o commit é considerado sem alterações relevantes. Não desactivar a regra sem aprovação do responsável.
7. Corrigir a causa na configuração/código apropriado e submeter alteração revista.
8. Criar deployment de Production a partir do HEAD de `main`. Confirmar o SHA seleccionado antes de iniciar.
9. Esperar pelo estado final `Ready`; confirmar domínio/alias de produção.
10. Executar smoke tests e os testes E2E aplicáveis.
11. Registar SHA, URL, estado, logs e testes no [registo de release](PROJECT_STATUS_AND_RELEASE.md#registo-de-release).

## Diagnóstico

### Deployment `Ignored`
Significa que a Vercel não construiu/publicou aquele commit por decisão da regra de build ignorado. Não é, isoladamente, prova de falha de compilação. Verificar regra e commit alvo.

### Deployment `Error`
Abrir Build Logs e identificar o primeiro erro causal. Não corrigir com base apenas no estado vermelho ou no resumo do deployment.

### Preview `Ready`, Production não actualizado
Preview pode pertencer a branch de feature e URL distinta. Confirmar branch, SHA, target e alias. Não considerar Preview como publicação de produção.

### Acesso 403
A integração não tem permissão na equipa/projecto. O administrador deve conceder acesso adequado ou executar o deployment. Não criar projecto paralelo nem expor credenciais.

## Rollback

1. Identificar último deployment Production conhecido como estável.
2. Rever alterações e impacto de migrations. Rollback de frontend não reverte automaticamente migrations Supabase.
3. Reverter para deployment anterior pela funcionalidade de rollback da Vercel, conforme autorização.
4. Validar login, marketplace, pré-compras e entregas.
5. Registar motivo, deployment revertido, SHA e plano de correcção.

## Smoke tests mínimos

- Página inicial carrega sem erro de runtime.
- Login e logout funcionam.
- Marketplace carrega e detalhe de produto abre.
- Publicação de produto funciona para perfil autorizado.
- Comprador consegue iniciar pré-compra.
- Fornecedor consegue abrir pedidos recebidos.
- Admin e motorista só vêem funções permitidas ao seu perfil.

Nunca registar valores de variáveis de ambiente ou segredos nos logs deste documento.
