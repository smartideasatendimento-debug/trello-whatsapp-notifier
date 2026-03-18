// ============================================
// Configuration Management (Vercel KV / Fallback)
// ============================================

// Destino de notificacao
export interface NotificationTarget {
  id: string; // ID unico do destino
  type: "phone" | "group" | "user"; // tipo do destino
  value: string; // numero, ID do grupo, ou ID do membro Trello
  label: string; // nome amigavel para exibicao
}

// Tipo para configuracao de notificacao
export interface NotificationConfig {
  // Listas ativas para notificacao de prazo
  activeLists: Record<string, boolean>;

  // Usuarios ativos e seus WhatsApp vinculados
  activeUsers: Record<
    string,
    {
      enabled: boolean;
      whatsappPhone: string;
      whatsappGroup: string;
      useGroup: boolean;
    }
  >;

  // Configuracao de antecedencia (em horas)
  hoursBeforeDue: number;

  // Notificacoes de novo card
  newCardNotifications: {
    enabled: boolean;
    listIds: string[];
    whatsappTarget: string; // LEGACY - mantido para compatibilidade
    isGroup: boolean; // LEGACY - mantido para compatibilidade
    targets: NotificationTarget[]; // NOVO - multiplos destinos
  };

  // Destinos de notificacao de prazo (alem dos usuarios individuais)
  deadlineTargets: NotificationTarget[];

  // Webhook ID do Trello (se configurado)
  trelloWebhookId: string | null;

  // Registro de notificacoes ja enviadas (para evitar duplicatas)
  sentNotifications: Record<string, number>;
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
    targets: [],
  },
  deadlineTargets: [],
  trelloWebhookId: null,
  sentNotifications: {},
};

const CONFIG_KEY = "trello-notifier-config";

let memoryStore: Record<string, string> = {};

async function kvGet(key: string): Promise<string | null> {
  try {
    const { kv } = await import("@vercel/kv");
    return await kv.get<string>(key);
  } catch {
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
      // Garantir campos novos existem
      const config = { ...DEFAULT_CONFIG, ...parsed };
      if (!config.newCardNotifications.targets) {
        config.newCardNotifications.targets = [];
        // Migrar target legacy para novo formato
        if (config.newCardNotifications.whatsappTarget) {
          config.newCardNotifications.targets.push({
            id: "legacy-" + Date.now(),
            type: config.newCardNotifications.isGroup ? "group" : "phone",
            value: config.newCardNotifications.whatsappTarget,
            label: config.newCardNotifications.isGroup ? "Grupo (migrado)" : "Numero (migrado)",
          });
        }
      }
      if (!config.deadlineTargets) {
        config.deadlineTargets = [];
      }
      return config;
    }
  } catch (e) {
    console.error("Erro ao carregar configuracao:", e);
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: NotificationConfig): Promise<void> {
  try {
    await kvSet(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Erro ao salvar configuracao:", e);
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

export async function markNotificationSent(cardId: string): Promise<void> {
  const config = await getConfig();
  config.sentNotifications[cardId] = Date.now();
  // Limpar notificacoes antigas (mais de 7 dias)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [id, timestamp] of Object.entries(config.sentNotifications)) {
    if (timestamp < sevenDaysAgo) {
      delete config.sentNotifications[id];
    }
  }
  await saveConfig(config);
}
