# 📧 Guia: Autenticação de Email - Evitar Spam

## ⚠️ Por que os emails chegam no spam?

Sem **SPF, DKIM e DMARC**, os servidores de email desconfiam do teu domínio:
- ❌ Sem verificação = email vai para spam ou é rejeitado
- ✅ Com verificação = confiança total, entrega 99% garantida

---

## 🔧 Passo 1: SPF (Sender Policy Framework)

**O que faz**: Autoriza quem pode enviar email pelo teu domínio.

### Como adicionar ao teu DNS:

1. Acede ao painel de controle do DNS (GoDaddy, Cloudflare, CPanel, etc.)
2. Procura por **TXT Records** ou **SPF Records**
3. Adiciona este record:

```
Host: @
Type: TXT
Value: v=spf1 mx ~all
```

**Ou se usares servidor de email externo:**
```
v=spf1 include:mail.agrilink.ao ~all
```

---

## 🔐 Passo 2: DKIM (DomainKeys Identified Mail)

**O que faz**: Assina digitalmente cada email com tua chave privada.

### Como gerar DKIM:

1. Acede ao painel de **Webmail/cPanel** do mail.agrilink.ao
2. Procura por **Email Authentication** ou **DKIM**
3. Gera a chave (ou pede ao teu provedor)
4. Recebes algo como:

```
Selector: default
Public Key: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

5. Adiciona ao DNS:

```
Host: default._domainkey.agrilink.ao
Type: TXT
Value: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

---

## 📊 Passo 3: DMARC (Domain-based Message Authentication)

**O que faz**: Define como lidar com emails que falham SPF/DKIM.

### Como adicionar:

1. Vai ao painel de DNS
2. Adiciona este record:

```
Host: _dmarc.agrilink.ao
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:admin@agrilink.ao; ruf=mailto:admin@agrilink.ao; fo=1
```

**Explicação:**
- `p=quarantine` - Email suspeito vai para quarentena (em vez de rejeitar)
- `rua=mailto:admin@agrilink.ao` - Relatórios semanais vão para admin
- `fo=1` - Relatório se SPF OU DKIM falhar

---

## ✅ Verificar se está correto

### Test online (Google Admin Toolbox):
1. Vai a: https://toolbox.googleapps.com/apps/checkmx/
2. Introduz: `agrilink.ao`
3. Verifica se SPF, DKIM e DMARC aparecem com ✅

### Testa manualmente:
```bash
# SPF
nslookup -type=TXT agrilink.ao

# DKIM
nslookup -type=TXT default._domainkey.agrilink.ao

# DMARC
nslookup -type=TXT _dmarc.agrilink.ao
```

---

## 🚀 Mudança no Código (JÁ FEITA)

A Edge Function `send-otp-email` foi convertida para:
- ✅ Usar SMTP nativo (mail.agrilink.ao)
- ✅ Enviar como `no-reply@agrilink.ao` (teu domínio)
- ❌ Sem Resend (que usava onboarding@resend.dev)

**Deploy depois:**
```bash
cd supabase
supabase functions deploy send-otp-email
```

---

## 📋 Checklist Final

- [ ] SPF Record adicionado ao DNS
- [ ] DKIM Public Key adicionado ao DNS
- [ ] DMARC Policy adicionado ao DNS
- [ ] Esperou 24-48h para propagação DNS
- [ ] Testou com https://toolbox.googleapps.com/apps/checkmx/
- [ ] Fez deploy da função atualizada
- [ ] Testou envio de email (vai para Inbox, não spam)

---

## 💡 Dicas Extra

1. **Warmup**: Começa a enviar poucos emails por dia, aumenta gradualmente
2. **List Cleaner**: Remove emails inválidos/bounced de forma automática
3. **Headers**: Adiciona `List-Unsubscribe` nos emails
4. **Rate Limit**: Não envies +50 emails/minuto do mesmo servidor

---

## 🆘 Se ainda for para spam:

1. Verifica no Gmail: Forward para alguém do Gmail, vê em que pasta vai
2. Testa em https://www.mail-tester.com/ (vai te dar score 0-10)
3. Se score < 8, algo está mal (falta DKIM, SPF, etc)

