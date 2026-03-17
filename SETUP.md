# ð Trello WhatsApp Notifier - Guia de Setup

## PrÃ©-requisitos

- Conta no [Vercel](https://vercel.com) (gratuito)
- Conta na [Z-API](https://www.z-api.io/) (vocÃª jÃ¡ tem!)
- Conta no [Trello](https://trello.com)
- Node.js 18+ instalado localmente

---

## Passo 1: Obter credenciais do Trello

### API Key:
1. Acesse: https://trello.com/power-ups/admin
2. Clique em "New" ou "Novo"
3. Preencha os dados (nome: "WhatsApp Notifier", etc.)
4. ApÃ³s criar, copie a **API Key**

### Token:
1. Com a API Key copiada, acesse no navegador:
   ```
   https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=SUA_API_KEY_AQUI
   ```
2. Autorize o acesso
3. Copie o **Token** gerado

### Board ID:
- O ID do seu quadro Ã©: `h4XEGbpc` (extraÃ­do da URL que vocÃª me passou)

---

## Passo 2: Obter credenciais da Z-API

1. Acesse o painel da Z-API: https://www.z-api.io/
2. Na sua instÃ¢ncia, copie:
   - **Instance ID**
   - **Token**
   - **Client-Token** (se disponÃ­vel)

---

## Passo 3: Deploy no Vercel

### OpÃ§Ã£o A: Deploy via GitHub (Recomendado)

1. Crie um repositÃ³rio no GitHub com os arquivos do projeto
2. Acesse https://vercel.com/new
3. Importe o repositÃ³rio
4. Configure as **Environment Variables**:
   ```
   TRELLO_API_KEY=sua_api_key
   TRELLO_TOKEN=seu_token
   TRELLO_BOARD_ID=h4XEGbpc
   ZAPI_INSTANCE_ID=seu_instance_id
   ZAPI_TOKEN=seu_token_zapi
   ZAPI_CLIENT_TOKEN=seu_client_token
   CRON_SECRET=gere_uma_senha_aleatoria
   NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
   ```
5. Clique em "Deploy"

### OpÃ§Ã£o B: Deploy via CLI

```bash
# Instale a CLI do Vercel
npm i -g vercel

# Na pasta do projeto
cd trello-whatsapp-notifier
npm install
vercel

# Siga as instruÃ§Ãµes e configure as variÃ¡veis de ambiente no painel do Vercel
```

---

## Passo 4: Configurar Vercel KV (Storage)

1. No painel do Vercel, vÃ¡ em **Storage**
2. Clique em **Create Database** â **KV (Redis)**
3. Conecte ao seu projeto
4. As variÃ¡veis `KV_REST_API_URL` e `KV_REST_API_TOKEN` serÃ£o configuradas automaticamente

---

## Passo 5: Configurar o App

1. Acesse sua URL do Vercel (ex: https://seu-app.vercel.app)
2. Na aba **Listas**: ative as listas que devem gerar notificaÃ§Ãµes
3. Na aba **UsuÃ¡rios**: ative os usuÃ¡rios e vincule seus WhatsApp
4. Na aba **Prazos**: configure a antecedÃªncia desejada (ex: 6 horas)
5. Na aba **Teste**: envie uma mensagem de teste para verificar
6. Clique em **Salvar ConfiguraÃ§Ãµes**

---

## Passo 6: Configurar Webhook (para notificaÃ§Ã£o de novo card)

1. Na aba **Novo Card**, ative a funcionalidade
2. Selecione as listas a monitorar
3. Configure o destino (WhatsApp/grupo)
4. Clique em **Criar Webhook do Trello**
5. Salve as configuraÃ§Ãµes

---

## Como Funciona

### NotificaÃ§Ãµes de Prazo
- O Vercel Cron executa a verificaÃ§Ã£o **a cada 30 minutos**
- Busca cards com prazo dentro da janela configurada
- Envia para o WhatsApp de cada responsÃ¡vel ativo
- Evita duplicatas com cooldown de 4 horas

### NotificaÃ§Ãµes de Novo Card
- O webhook do Trello notifica em **tempo real**
- Detecta criaÃ§Ã£o de cards e movimentaÃ§Ã£o entre listas
- Envia para o destino configurado

---

## Troubleshooting

| Problema | SoluÃ§Ã£o |
|----------|---------|
| Erro de Trello API | Verifique API Key e Token nas variÃ¡veis de ambiente |
| Z-API desconectado | Verifique se o WhatsApp estÃ¡ conectado no painel da Z-API |
| Cron nÃ£o executa | Verifique se o Vercel Cron estÃ¡ configurado (Vercel Pro ou Hobby) |
| Webhook nÃ£o funciona | Certifique-se de que a URL estÃ¡ acessÃ­vel publicamente |
| Sem dados no KV | Verifique se o Vercel KV estÃ¡ conectado ao projeto |
