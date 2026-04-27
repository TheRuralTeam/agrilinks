# Guia Completo: Verificacao de Email e Entregabilidade (Anti-Spam)

Este guia foi preparado para o dominio agrilink.ao e para o fluxo atual com Supabase + funcao send-otp-email.

Objetivo:
- Garantir que os emails de verificacao cheguem na caixa de entrada
- Reduzir ao maximo envio para spam
- Configurar DNS, seguranca e operacao de forma correta

## 1. Arquitetura atual (resumo)

Fluxo de verificacao:
1. O utilizador regista conta na aplicacao
2. A funcao send-otp-email gera OTP e envia email por SMTP
3. O utilizador abre o email e confirma a conta
4. A aplicacao valida token/codigo e marca email como confirmado

Pontos criticos de entregabilidade:
- Remetente deve ser do teu dominio (no-reply@agrilink.ao)
- DNS deve ter SPF + DKIM + DMARC corretos
- Credenciais SMTP devem ficar em secret, nunca no codigo

## 2. Preparacao antes de configurar DNS

Checklist rapido:
- Caixa no-reply@agrilink.ao existe e envia email normalmente
- Acesso ao painel DNS (Cloudflare, cPanel ou GoDaddy)
- Acesso ao servidor de email para gerar DKIM
- Supabase CLI autenticado no ambiente local

## 3. Registos DNS obrigatorios

ATENCAO IMPORTANTE:
- Deve existir apenas 1 registo SPF no dominio raiz
- Se ja existe SPF, faz merge da politica na mesma linha
- DKIM usa chave PUBLICA no DNS
- DMARC comeca em quarantine e depois vai para reject

### 3.1 SPF

Valor recomendado para SMTP proprio:
v=spf1 mx a:mail.agrilink.ao ~all

Quando usar include externo:
- Apenas se enviares por provedor externo (nao e o caso principal)

### 3.2 DKIM

Host:
default._domainkey

Valor:
v=DKIM1; k=rsa; p=COLE_AQUI_A_CHAVE_PUBLICA_DKIM

Como obter chave DKIM:
1. Entra no painel do servidor de email
2. Procura DKIM ou Email Authentication
3. Gera a chave para o dominio agrilink.ao
4. Copia apenas a chave publica sem quebras de linha

### 3.3 DMARC

Host:
_dmarc

Valor inicial (fase protegida):
v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:admin@agrilink.ao; ruf=mailto:admin@agrilink.ao; fo=1

Valor final (producao estrita):
v=DMARC1; p=reject; adkim=s; aspf=s; pct=100; rua=mailto:admin@agrilink.ao; ruf=mailto:admin@agrilink.ao; fo=1

## 4. Blocos prontos por provedor DNS

### 4.1 Cloudflare

Criar 3 registos TXT:
- Name: @
  Content: v=spf1 mx a:mail.agrilink.ao ~all
  TTL: Auto

- Name: default._domainkey
  Content: v=DKIM1; k=rsa; p=COLE_AQUI_A_CHAVE_PUBLICA_DKIM
  TTL: Auto

- Name: _dmarc
  Content: v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:admin@agrilink.ao; ruf=mailto:admin@agrilink.ao; fo=1
  TTL: Auto

Nota Cloudflare:
- TXT fica em DNS only
- Nao criar segundo SPF

### 4.2 cPanel Zone Editor

Criar 3 registos TXT:
- Name: agrilink.ao
  TXT Data: v=spf1 mx a:mail.agrilink.ao ~all
  TTL: 3600

- Name: default._domainkey.agrilink.ao
  TXT Data: v=DKIM1; k=rsa; p=COLE_AQUI_A_CHAVE_PUBLICA_DKIM
  TTL: 3600

- Name: _dmarc.agrilink.ao
  TXT Data: v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:admin@agrilink.ao; ruf=mailto:admin@agrilink.ao; fo=1
  TTL: 3600

Nota cPanel:
- Alguns paineis pedem FQDN com ponto final

### 4.3 GoDaddy

Criar 3 registos TXT:
- Name: @
  Value: v=spf1 mx a:mail.agrilink.ao ~all
  TTL: 1 Hour

- Name: default._domainkey
  Value: v=DKIM1; k=rsa; p=COLE_AQUI_A_CHAVE_PUBLICA_DKIM
  TTL: 1 Hour

- Name: _dmarc
  Value: v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:admin@agrilink.ao; ruf=mailto:admin@agrilink.ao; fo=1
  TTL: 1 Hour

## 5. Configuracao segura no Supabase

A funcao de envio deve usar secret para password SMTP.

Comandos:
1. Definir secret
supabase secrets set SMTP_PASSWORD=SUA_NOVA_SENHA --project-ref oqcrfqtlfqwrxxmsjpaf

2. Verificar secrets
supabase secrets list --project-ref oqcrfqtlfqwrxxmsjpaf

3. Deploy da funcao
supabase functions deploy send-otp-email --project-ref oqcrfqtlfqwrxxmsjpaf

4. Ler logs
supabase functions logs send-otp-email --project-ref oqcrfqtlfqwrxxmsjpaf

## 6. Validacao tecnica (obrigatoria)

### 6.1 Confirmar propagacao DNS

Comandos:
nslookup -type=TXT agrilink.ao
nslookup -type=TXT default._domainkey.agrilink.ao
nslookup -type=TXT _dmarc.agrilink.ao

Esperado:
- SPF visivel
- DKIM visivel
- DMARC visivel

### 6.2 Teste real de caixa de entrada

1. Regista uma conta nova na app
2. Confirma envio do email de verificacao
3. Testa recebimento no Gmail e Outlook
4. Abre cabecalhos do email recebido e valida:
- SPF: pass
- DKIM: pass
- DMARC: pass

### 6.3 Teste de score de reputacao

1. Acede mail-tester.com
2. Envia um email de teste para o endereco fornecido
3. Meta recomendada: 8/10 ou superior

## 7. Plano de rollout DMARC (recomendado)

Fase 1 (monitoria): p=none por 7 dias
Fase 2 (protecao): p=quarantine por 14 dias
Fase 3 (producao): p=reject apos estabilidade

Quando subir para reject:
- SPF/DKIM/DMARC estaveis por 2 a 3 semanas
- Sem taxas relevantes de falha legitima
- Sem reclamacoes de nao entrega para utilizadores validos

## 8. Boas praticas para reduzir spam

Boas praticas de conteudo:
- Assunto claro e objetivo
- Evitar linguagem agressiva/promocional exagerada
- Evitar links encurtados
- Incluir versao texto simples e HTML

Boas praticas de reputacao:
- Enviar volume baixo no inicio e aumentar gradualmente
- Remover emails invalidos e hard bounce
- Manter remetente consistente (no-reply@agrilink.ao)
- Manter Reply-To valido (suporte@agrilink.ao)

Boas praticas tecnicas:
- Rotacionar password SMTP periodicamente
- Nunca guardar credenciais em codigo ou ficheiro versionado
- Monitorar logs da funcao e taxa de falhas

## 9. Troubleshooting rapido

Problema: SPF fail
Causa comum:
- SPF duplicado
- Servidor real nao autorizado na politica

Acao:
- Unificar SPF numa unica linha
- Incluir host real de envio

Problema: DKIM fail
Causa comum:
- Chave publica incompleta
- Selector errado

Acao:
- Regerar DKIM no servidor
- Confirmar host default._domainkey

Problema: DMARC fail
Causa comum:
- Falha de alinhamento entre From e dominio autenticado

Acao:
- Garantir From no-reply@agrilink.ao
- Garantir SPF/DKIM no mesmo dominio

Problema: email ainda cai em spam com tudo pass
Causa comum:
- Reputacao do IP/dominio ainda baixa

Acao:
- Fazer warmup de envio
- Melhorar conteudo
- Monitorar score no mail-tester

## 10. Ordem de execucao recomendada (checklist final)

1. Trocar password SMTP
2. Gerar DKIM e preencher chave publica
3. Publicar SPF
4. Publicar DKIM
5. Publicar DMARC (quarantine)
6. Definir SMTP_PASSWORD no Supabase
7. Deploy da funcao send-otp-email
8. Testar registo + email de verificacao
9. Validar headers pass no Gmail/Outlook
10. Validar score no mail-tester
11. Apos estabilidade, migrar DMARC para reject

## 11. Referencias no projeto

Configuracao principal:
- [email-auth.config.yaml](email-auth.config.yaml)

Funcao de envio OTP:
- [supabase/functions/send-otp-email/index.ts](supabase/functions/send-otp-email/index.ts)

Guia adicional:
- [GUIA_EMAIL_AUTHENTICATION.md](GUIA_EMAIL_AUTHENTICATION.md)
