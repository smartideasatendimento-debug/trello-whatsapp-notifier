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

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
}

// Extrai o ID numerico do grupo, removendo @g.us se presente
function extractGroupPhone(groupId: string): string {
  return groupId.replace("@g.us", "").trim();
}

export interface SendMessageResult {
  zapiMessageId: string;
  messageId: string;
  id: string;
}

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

export async function sendGroupMessage(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  const baseUrl = getBaseUrl();
  // Z-API usa campo "phone" com o ID do grupo SEM @g.us
  const groupPhone = extractGroupPhone(groupId);

  console.log(`Z-API sendGroupMessage: groupId=${groupId}, groupPhone=${groupPhone}`);

  const res = await fetch(`${baseUrl}/send-text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ phone: groupPhone, message }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Z-API grupo falhou com phone=${groupPhone}: ${errorText}`);
    throw new Error(`Z-API erro ao enviar para grupo (phone=${groupPhone}): ${errorText}`);
  }
  return res.json();
}

// Listar grupos via /chats e filtrar apenas grupos
export async function listGroups(): Promise<
  { id: string; name: string }[]
> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/chats?page=1&pageSize=200`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API erro ao listar chats: ${text}`);
  }
  const chats = await res.json();
  if (!Array.isArray(chats)) return [];
  return chats
    .filter((c: any) => c.isGroup || c.phone?.includes("@g.us") || c.isGroupV4)
    .map((c: any) => ({
      id: c.phone || c.chatId || "",
      name: c.name || c.contact?.name || c.phone || "Sem nome",
    }));
}

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

export function formatDeadlineMessage(
  cardName: string,
  dueDate: string,
  listName: string,
  memberNames: string[],
  cardUrl: string,
  hoursRemaining: number,
  boardName?: string
): string {
  const due = new Date(dueDate);
  const formattedDate = due.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
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
    memberNames.length > 0 ? memberNames.join(" e ") : "Sem responsavel";
  const board = boardName || "Trello";

  return (
    `*\u{1F6A8} Prazo Proximo - ${board} \u{1F6A8}*\n\n` +
    `\u{1F4CB}: ${cardName}\n\n` +
    `*\u{1F4C5} Vencimento:* ${formattedDate}\n` +
    `*\u{23F3} Tempo restante:* ${timeText}\n` +
    `*\u{1F4C2} Lista:* ${listName}\n` +
    `*\u{1F464} Responsavel:* ${members}\n` +
    `\u{1F517} ${cardUrl}`
  );
}

export function formatNewCardMessage(
  cardName: string,
  listName: string,
  memberNames: string[],
  cardUrl: string,
  boardName?: string
): string {
  const members =
    memberNames.length > 0 ? memberNames.join(" e ") : "Sem responsavel";
  const board = boardName || "Trello";

  return (
    `*\u{1F195} Novo Card - ${board} \u{1F195}*\n\n` +
    `\u{1F4CB}: ${cardName}\n\n` +
    `*\u{1F4C2} Lista:* ${listName}\n` +
    `*\u{1F464} Responsavel:* ${members}\n` +
    `\u{1F517} ${cardUrl}`
  );
}

export function formatCardMovedMessage(
  cardName: string,
  listAfterName: string,
  listBeforeName: string,
  memberNames: string[],
  cardUrl: string,
  boardName?: string,
  dueDate?: string | null
): string {
  const members =
    memberNames.length > 0 ? memberNames.join(" e ") : "Sem responsavel";
  const board = boardName || "Trello";

  let dueLine = "";
  if (dueDate) {
    const due = new Date(dueDate);
    const formattedDue = due.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    dueLine = `*\u{23F3} Prazo:* ${formattedDue}\n`;
  } else {
    dueLine = `*\u{23F3} Prazo:* Sem prazo definido\n`;
  }

  return (
    `*\u{1F6A8} Cliente Atualizado - ${board} \u{1F6A8}*\n\n` +
    `\u{1F4CB}: ${cardName}\n\n` +
    `\u{2199}\u{FE0F} Saiu de: ${listBeforeName}\n` +
    `\u{2197}\u{FE0F} Entrou em: ${listAfterName}\n\n` +
    `*\u{1F464} Responsavel:* ${members}\n` +
    dueLine +
    `\u{1F517} ${cardUrl}`
  );
}
