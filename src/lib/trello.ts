// ============================================
// Trello API Client
// ============================================

const TRELLO_BASE_URL = "https://api.trello.com/1";

function getCredentials() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new Error("TRELLO_API_KEY e TRELLO_TOKEN sÃ£o obrigatÃ³rios");
  }
  return { key, token };
}

async function trelloFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const { key, token } = getCredentials();
  const searchParams = new URLSearchParams({ key, token, ...params });
  const url = `${TRELLO_BASE_URL}${endpoint}?${searchParams}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API error (${res.status}): ${text}`);
  }
  return res.json();
}

// --- Types ---

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  idList: string;
  idMembers: string[];
  url: string;
  labels: { id: string; name: string; color: string }[];
  shortUrl: string;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
}

// --- API Functions ---

export async function getBoard(boardId: string): Promise<TrelloBoard> {
  return trelloFetch<TrelloBoard>(`/boards/${boardId}`, {
    fields: "id,name,url",
  });
}

export async function getBoardLists(boardId: string): Promise<TrelloList[]> {
  return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists`, {
    filter: "open",
    fields: "id,name,closed,pos",
  });
}

export async function getBoardCards(boardId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(`/boards/${boardId}/cards`, {
    fields: "id,name,desc,due,dueComplete,idList,idMembers,url,labels,shortUrl",
  });
}

export async function getBoardMembers(boardId: string): Promise<TrelloMember[]> {
  return trelloFetch<TrelloMember[]>(`/boards/${boardId}/members`, {
    fields: "id,fullName,username,avatarUrl",
  });
}

export async function getCardsWithUpcomingDue(
  boardId: string,
  hoursBeforeDue: number
): Promise<(TrelloCard & { listName?: string; memberNames?: string[] })[]> {
  const [cards, lists, members] = await Promise.all([
    getBoardCards(boardId),
    getBoardLists(boardId),
    getBoardMembers(boardId),
  ]);

  const listMap = new Map(lists.map((l) => [l.id, l.name]));
  const memberMap = new Map(members.map((m) => [m.id, m.fullName]));

  const now = new Date();
  const threshold = new Date(now.getTime() + hoursBeforeDue * 60 * 60 * 1000);

  return cards
    .filter((card) => {
      if (!card.due || card.dueComplete) return false;
      const dueDate = new Date(card.due);
      return dueDate > now && dueDate <= threshold;
    })
    .map((card) => ({
      ...card,
      listName: listMap.get(card.idList),
      memberNames: card.idMembers.map((id) => memberMap.get(id) || "Desconhecido"),
    }));
}

export async function getListCards(listId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(`/lists/${listId}/cards`, {
    fields: "id,name,desc,due,dueComplete,idList,idMembers,url,labels,shortUrl",
  });
}

// --- Webhook Management ---

export async function createWebhook(
  callbackURL: string,
  idModel: string,
  description: string
): Promise<{ id: string }> {
  const { key, token } = getCredentials();
  const res = await fetch(`${TRELLO_BASE_URL}/webhooks?key=${key}&token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callbackURL, idModel, description }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao criar webhook: ${text}`);
  }
  return res.json();
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  const { key, token } = getCredentials();
  const res = await fetch(
    `${TRELLO_BASE_URL}/webhooks/${webhookId}?key=${key}&token=${token}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao deletar webhook: ${text}`);
  }
}

export async function listWebhooks(): Promise<{ id: string; callbackURL: string; idModel: string }[]> {
  const { key, token } = getCredentials();
  return trelloFetch(`/tokens/${token}/webhooks`);
}
