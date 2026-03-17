// ============================================
// Configuration Management (Vercel KV / Fallback)
// ============================================

// Tipo para configuraÃ§Ã£o de notificaÃ§Ã£o
export interface NotificationConfig {
  // Listas ativas para notificaÃ§Ã£o de prazo
  activeLists: Record<string, boolean>;

  // UsuÃ¡rios ativos e seus WhatsApp vinculados
  activeUsers: Record<
    string,
    {
      enabled: boolean;
      whatsappPhone: string;
      whatsappGroup: string;
      useGroup: boolean; // true = enviar para grupo, false = enviar direto
    }
  >;

  // ConfiguraÃ§Ã£o de antecedÃªncia (em horas)
  hoursBeforeDue: number;

  // NotificaÃ§Ãµes de novo card
  newCardNotifications: {
    enabled: boolean;
    listIds: string[]; // IDs das listas monitoradas
    whatsappTarget: string; // NÃºmero ou grupo para enviar
    isGroup: boolean;
  };

  // Webhook ID do Trello (se configurado)
  trelloWebhookId: string | null;

  // Registro de notificaÃ§Ãµes jÃ¡ enviadas (para evitar duplicatas)
  sentNotifications: Record<string, number>; // cardId -> timestamp
}

const DEFAULT_CONFIG: NotificationConfig = {
  activeLists: {},
  activeUsers: {},
  hoursBeforeDue: 6,
  newCardNotifications: {
    enabled: false,
    listIds: [],
    whatsappTarget: "",
    isGroup: false,
  },
  trelloWebhookId: null,
  sentNotifications: {},
};

const CONFIG_KEY = "trello-notifier-config";

// Tenta usar Vercel KV, senÃ£o usa armazenamento em memÃ³ria
let memoryStore: Record<string, string> = {};

async function kvGet(key: string): Promise<string | null> {
  try {
    // Tentar usar Vercel KV
    const { kv } = await import("@vercel/kv");
    return await kv.get<string>(key);
  } catch {
    // Fallback para memÃ³ria (desenvolvimento local)
    return memoryStore[key] || null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value);
  } catch {
    memoryStore[key] = value;
  }
}

export async function getConfig(): Promise<NotificationConfig> {
  try {
    const stored = await kvGet(CONFIG_KEY);
    if (stored) {
      const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error("Erro ao carregar configuraÃ§Ã£o:", e);
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: NotificationConfig): Promise<void> {
  try {
    await kvSet(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Erro ao salvar configuraÃ§Ã£o:", e);
    throw e;
  }
}

export async function updateConfig(
  updates: Partial<NotificationConfig>
): Promise<NotificationConfig> {
  const current = await getConfig();
  const updated = { ...current, ...updates };
  await saveConfig(updated);
  return updated;
}

// Verificar se uma notificaÃ§Ã£o jÃ¡ foi enviada recentemente (dentro do cooldown)
export async function wasNotificationSent(
  cardId: string,
  cooldownHours: number = 4
): Promise<boolean> {
  const config = await getConfig();
  const lastSent = config.sentNotifications[cardId];
  if (!lastSent) return false;

  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  return Date.now() - lastSent < cooldownMs;
}

// Marcar notificaÃ§Ã£o como enviada
export async function markNotificationSent(cardId: string): Promise<void> {
  const config = await getConfig();
  config.sentNotifications[cardId] = Date.now();

  // Limpar notificaÃ§Ãµes antigas (mais de 7 dias)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [id, timestamp] of Object.entries(config.sentNotifications)) {
    if (timestamp < sevenDaysAgo) {
      delete config.sentNotifications[id];
    }
  }

  await saveConfig(config);
}
