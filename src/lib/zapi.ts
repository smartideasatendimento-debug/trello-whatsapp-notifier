// ============================================
// Z-API Client (WhatsApp)
// ============================================

function getZApiConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token) {
    throw new Error("ZAPI_INSTANCE_ID e ZAPI_TOKEN sao obrigatorios");
  }
  return { instanceId, token, clientToken };
}

function getBaseUrl() {
  const { instanceId, token } = getZApiConfig();
  return `https://api.z-api.io/instances/${instanceId}/token/${token}`;
}

function getHeaders(): Record<string, string> {
  const { clientToken } = getZApiConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (clientToken) {
    headers["Client-Token"] = clientToken;
  }
  return headers;
}

// Formata numero para o padrao Z-API: 5511999999999
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
}

// Formata ID de grupo para Z-API
function formatGroupId(groupId: string): string {
  if (groupId.includes("@g.us")) return groupId;
  const cleaned = groupId.replace(/\D/g, "");
  return `${cleaned}@g.us`;
}

export interface SendMessageResult {
  zapiMessageId: string;
  messageId: string;
  id: string;
}

// Enviar mensagem de texto para um numero
export async function sendTextMessage(
  phone: string,
  message: string
): Promise<SendMessageResult> {
  const baseUrl = getBaseUrl();
  const formattedPhone = formatPhone(phone);
  const res = await fetch(`${baseUrl}/send-text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ phone: formattedPhone, message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API erro ao enviar mensagem: ${text}`);
  }
  return res.json();
}

// Enviar mensagem para grupo
export async function sendGroupMessage(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  const baseUrl = getBaseUrl();
  const formattedGroup = formatGroupId(groupId);
  const res = await fetch(`${baseUrl}/send-text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ phone: formattedGroup, message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API erro ao enviar para grupo: ${text}`);
  }
  return res.json();
}

// Listar grupos disponiveis
export async function listGroups(): Promise<
  { id: string; name: string; participants: number }[]
> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/chats`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API erro ao listar grupos: ${text}`);
  }
  const chats = await res.json();
  return chats
    .filter((chat: any) => chat.isGroup)
    .map((chat: any) => ({
      id: chat.phone,
      name: chat.name || chat.phone,
      participants: chat.participants?.length || 0,
    }));
}

// Verificar status da conexao
export async function checkConnectionStatus(): Promise<{
  connected: boolean;
  smartphoneConnected: boolean;
}> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/status`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    return { connected: false, smartphoneConnected: false };
  }
  const data = await res.json();
  return {
    connected: data.connected || false,
    smartphoneConnected: data.smartphoneConnected || false,
  };
}

// Enviar mensagem (detecta automaticamente se eh grupo ou numero)
export async function sendNotification(
  target: string,
  message: string,
  isGroup: boolean = false
): Promise<SendMessageResult> {
  if (isGroup) {
    return sendGroupMessage(target, message);
  }
  return sendTextMessage(target, message);
}

// Formatar mensagem de notificacao de prazo
export function formatDeadlineMessage(
  cardName: string,
  dueDate: string,
  listName: string,
  memberNames: string[],
  cardUrl: string,
  hoursRemaining: number
): string {
  const due = new Date(dueDate);
  const formattedDate = due.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let timeText: string;
  if (hoursRemaining < 1) {
    const minutes = Math.round(hoursRemaining * 60);
    timeText = `${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  } else {
    const hours = Math.round(hoursRemaining);
    timeText = `${hours} hora${hours !== 1 ? "s" : ""}`;
  }

  const members =
    memberNames.length > 0 ? memberNames.join(", ") : "Sem responsavel";

  return (
    "\u26A0\uFE0F *ALERTA DE PRAZO - TRELLO*\n\n" +
    "\uD83D\uDCCB *Card:* " + cardName + "\n" +
    "\uD83D\uDCC2 *Lista:* " + listName + "\n" +
    "\uD83D\uDC64 *Responsavel:* " + members + "\n" +
    "\uD83D\uDCC5 *Vencimento:* " + formattedDate + "\n" +
    "\u23F0 *Tempo restante:* " + timeText + "\n\n" +
    "\uD83D\uDD17 " + cardUrl
  );
}

// Formatar mensagem de novo card
export function formatNewCardMessage(
  cardName: string,
  listName: string,
  memberNames: string[],
  cardUrl: string
): string {
  const members =
    memberNames.length > 0 ? memberNames.join(", ") : "Sem responsavel";

  return (
    "\uD83C\uDD95 *NOVO CARD - TRELLO*\n\n" +
    "\uD83D\uDCCB *Card:* " + cardName + "\n" +
    "\uD83D\uDCC2 *Lista:* " + listName + "\n" +
    "\uD83D\uDC64 *Responsavel:* " + members + "\n\n" +
    "\uD83D\uDD17 " + cardUrl
  );
}

// Formatar mensagem de card movido
export function formatCardMovedMessage(
  cardName: string,
  listAfterName: string,
  listBeforeName: string,
  memberNames: string[],
  cardUrl: string
): string {
  const members =
    memberNames.length > 0 ? memberNames.join(", ") : "Sem responsavel";

  return (
    "\uD83D\uDCE6 *CARD MOVIDO - TRELLO*\n\n" +
    "\uD83D\uDCCB *Card:* " + cardName + "\n" +
    "\uD83D\uDCC2 *Movido para:* " + listAfterName + "\n" +
    "\uD83D\uDD04 *Veio de:* " + listBeforeName + "\n" +
    "\uD83D\uDC64 *Responsavel:* " + members + "\n\n" +
    "\uD83D\uDD17 " + cardUrl
  );
}
// ============================================
// Z-API Client (WhatsApp)
// ============================================

function getZApiConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !token) {
    throw new Error("ZAPI_INSTANCE_ID e ZAPI_TOKEN sÃ£o obrigatÃ³rios");
  }

  return { instanceId, token, clientToken };
}

function getBaseUrl() {
  const { instanceId, token } = getZApiConfig();
  return `https://api.z-api.io/instances/${instanceId}/token/${token}`;
}

function getHeaders(): Record<string, string> {
  const { clientToken } = getZApiConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (clientToken) {
    headers["Client-Token"] = clientToken;
  }
  return headers;
}

// Formata nÃºmero para o padrÃ£o Z-API: 5511999999999
function formatPhone(phone: string): string {
  // Remove tudo que nÃ£o Ã© nÃºmero
  let cleaned = phone.replace(/\D/g, "");

  // Se nÃ£o comeÃ§a com 55, adiciona
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }

  return cleaned;
}

// Formata ID de grupo para Z-API
function formatGroupId(groupId: string): string {
  // Se jÃ¡ estÃ¡ no formato correto, retorna
  if (groupId.includes("@g.us")) return groupId;

  // Remove caracteres nÃ£o numÃ©ricos
  const cleaned = groupId.replace(/\D/g, "");
  return `${cleaned}@g.us`;
}

export interface SendMessageResult {
  zapiMessageId: string;
  messageId: string;
  id: string;
}

// Enviar mensagem de texto para um nÃºmero
export async function sendTextMessage(
  phone: string,
  message: string
): Promise<SendMessageResult> {
  const baseUrl = getBaseUrl();
  const formattedPhone = formatPhone(phone);

  const res = await fetch(`${baseUrl}/send-text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      phone: formattedPhone,
      message,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API erro ao enviar mensagem: ${text}`);
  }

  return res.json();
}

// Enviar mensagem para grupo
export async function sendGroupMessage(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  const baseUrl = getBaseUrl();
  const formattedGroup = formatGroupId(groupId);

  const res = await fetch(`${baseUrl}/send-text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      phone: formattedGroup,
      message,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API erro ao enviar para grupo: ${text}`);
  }

  return res.json();
}

// Listar grupos disponÃ­veis
export async function listGroups(): Promise<
  { id: string; name: string; participants: number }[]
> {
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/chats`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API erro ao listar grupos: ${text}`);
  }

  const chats = await res.json();

  // Filtra apenas grupos
  return chats
    .filter((chat: any) => chat.isGroup)
    .map((chat: any) => ({
      id: chat.phone,
      name: chat.name || chat.phone,
      participants: chat.participants?.length || 0,
    }));
}

// Verificar status da conexÃ£o
export async function checkConnectionStatus(): Promise<{
  connected: boolean;
  smartphoneConnected: boolean;
}> {
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/status`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    return { connected: false, smartphoneConnected: false };
  }

  const data = await res.json();
  return {
    connected: data.connected || false,
    smartphoneConnected: data.smartphoneConnected || false,
  };
}

// Enviar mensagem (detecta automaticamente se Ã© grupo ou nÃºmero)
export async function sendNotification(
  target: string,
  message: string,
  isGroup: boolean = false
): Promise<SendMessageResult> {
  if (isGroup) {
    return sendGroupMessage(target, message);
  }
  return sendTextMessage(target, message);
}

// Formatar mensagem de notificaÃ§Ã£o de prazo
export function formatDeadlineMessage(
  cardName: string,
  dueDate: string,
  listName: string,
  memberNames: string[],
  cardUrl: string,
  hoursRemaining: number
): string {
  const due = new Date(dueDate);
  const formattedDate = due.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let timeText: string;
  if (hoursRemaining < 1) {
    const minutes = Math.round(hoursRemaining * 60);
    timeText = `${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  } else {
    const hours = Math.round(hoursRemaining);
    timeText = `${hours} hora${hours !== 1 ? "s" : ""}`;
  }

  const members =
    memberNames.length > 0 ? memberNames.join(", ") : "Sem responsÃ¡vel";

  return (
    `â ï¸ *ALERTA DE PRAZO - TRELLO*\n\n` +
    `ð *Card:* ${cardName}\n` +
    `ð *Lista:* ${listName}\n` +
    `ð¤ *ResponsÃ¡vel:* ${members}\n` +
    `ð *Vencimento:* ${formattedDate}\n` +
    `â° *Tempo restante:* ${timeText}\n\n` +
    `ð ${cardUrl}`
  );
}

// Formatar mensagem de novo card
export function formatNewCardMessage(
  cardName: string,
  listName: string,
  memberNames: string[],
  cardUrl: string
): string {
  const members =
    memberNames.length > 0 ? memberNames.join(", ") : "Sem responsÃ¡vel";

  return (
    `ð *NOVO CARD - TRELLO*\n\n` +
    `ð *Card:* ${cardName}\n` +
    `ð *Lista:* ${listName}\n` +
    `ð¤ *ResponsÃ¡vel:* ${members}\n\n` +
    `ð ${cardUrl}`
  );
}
