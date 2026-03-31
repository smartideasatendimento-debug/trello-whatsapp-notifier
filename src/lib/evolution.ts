// ============================================
// Evolution API Client (WhatsApp)
// ============================================

function getEvolutionConfig() {
  const serverUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "trello-notifier";
  if (!serverUrl || !apiKey) {
    throw new Error("EVOLUTION_API_URL e EVOLUTION_API_KEY sao obrigatorios");
  }
  // Remove trailing slash
  const baseUrl = serverUrl.replace(/\/+$/, "");
  return { baseUrl, apiKey, instanceName };
}

function getHeaders(): Record<string, string> {
  const { apiKey } = getEvolutionConfig();
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
  };
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
}
// ============================================
// Instance Management
// ============================================

export async function createInstance(): Promise<{
  instanceName: string;
  status: string;
  qrcode?: string;
}> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig();
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      rejectCall: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API erro ao criar instancia: ${text}`);
  }
  const data = await res.json();
  return {
    instanceName: data.instance?.instanceName || instanceName,
    status: data.instance?.status || "created",
    qrcode: data.qrcode?.base64 || undefined,
  };
}
export async function connectInstance(): Promise<{
  base64?: string;
  pairingCode?: string;
  code?: string;
  count?: number;
}> {
  const { baseUrl, instanceName } = getEvolutionConfig();
  const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API erro ao conectar: ${text}`);
  }
  return res.json();
}

export async function getConnectionState(): Promise<{
  state: string;
  connected: boolean;
}> {
  const { baseUrl, instanceName } = getEvolutionConfig();
  try {
    const res = await fetch(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );    if (!res.ok) {
      return { state: "close", connected: false };
    }
    const data = await res.json();
    const state = data.instance?.state || data.state || "close";
    return {
      state,
      connected: state === "open",
    };
  } catch {
    return { state: "close", connected: false };
  }
}

export async function logoutInstance(): Promise<{ success: boolean }> {
  const { baseUrl, instanceName } = getEvolutionConfig();
  const res = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API erro ao desconectar: ${text}`);
  }
  return { success: true };
}

export async function deleteInstance(): Promise<{ success: boolean }> {
  const { baseUrl, instanceName } = getEvolutionConfig();  const res = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API erro ao deletar instancia: ${text}`);
  }
  return { success: true };
}

// ============================================
// Messaging
// ============================================

export interface SendMessageResult {
  key?: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: any;
  messageTimestamp?: string;
  status?: string;
}

export async function sendTextMessage(
  phone: string,
  message: string
): Promise<SendMessageResult> {  const { baseUrl, instanceName } = getEvolutionConfig();
  const formattedPhone = formatPhone(phone);
  const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      number: formattedPhone,
      text: message,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API erro ao enviar mensagem: ${text}`);
  }
  return res.json();
}

export async function sendGroupMessage(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  const { baseUrl, instanceName } = getEvolutionConfig();
  // Evolution API usa o JID do grupo com @g.us
  let groupJid = groupId.trim();
  if (!groupJid.endsWith("@g.us")) {
    groupJid = groupJid + "@g.us";
  }

  console.log(
    `Evolution sendGroupMessage: groupId=${groupId}, groupJid=${groupJid}`
  );
  const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      number: groupJid,
      text: message,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(
      `Evolution API grupo falhou com number=${groupJid}: ${errorText}`
    );
    throw new Error(
      `Evolution API erro ao enviar para grupo (number=${groupJid}): ${errorText}`
    );
  }
  return res.json();
}

// ============================================
// Groups
// ============================================

export async function listGroups(): Promise<{ id: string; name: string }[]> {
  const { baseUrl, instanceName } = getEvolutionConfig();
  const res = await fetch(
    `${baseUrl}/group/fetchAllGroups/${instanceName}`,    {
      method: "GET",
      headers: getHeaders(),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API erro ao listar grupos: ${text}`);
  }
  const groups = await res.json();
  if (!Array.isArray(groups)) return [];
  return groups.map((g: any) => ({
    id: g.id || "",
    name: g.subject || g.name || g.id || "Sem nome",
  }));
}

// ============================================
// Helper Functions (same interface as zapi.ts)
// ============================================

export async function checkConnectionStatus(): Promise<{
  connected: boolean;
  smartphoneConnected: boolean;
}> {
  const state = await getConnectionState();
  return {
    connected: state.connected,
    smartphoneConnected: state.connected,
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

// ============================================
// Message Formatters (kept identical)
// ============================================

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
    month: "2-digit",    hour: "2-digit",
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
  cardName: string,  listName: string,
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