"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================
// Types
// ============================================
interface TrelloList {
  id: string;
  name: string;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
  dueComplete: boolean;
  idList: string;
  idMembers: string[];
  shortUrl: string;
}

interface UserConfig {
  enabled: boolean;
  whatsappPhone: string;
  whatsappGroup: string;
  useGroup: boolean;
}

interface NotificationConfig {
  activeLists: Record<string, boolean>;
  activeUsers: Record<string, UserConfig>;
  hoursBeforeDue: number;
  newCardNotifications: {
    enabled: boolean;
    listIds: string[];
    whatsappTarget: string;
    isGroup: boolean;
  };
  trelloWebhookId: string | null;
  sentNotifications: Record<string, number>;
}

// ============================================
// Components
// ============================================

function StatusBadge({ connected }: { connected: boolean | null }) {
  if (connected === null)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-300">
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        Verificando...
      </span>
    );
  return connected ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-400" />
      Conectado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/50 text-red-400">
      <span className="w-2 h-2 rounded-full bg-red-400" />
      Desconectado
    </span>
  );
}

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center cursor-pointer gap-2">
      <div
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-gray-600"
        }`}
        onClick={() => onChange(!enabled)}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </label>
  );
}

function Card({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${className}`}
    >
      <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ============================================
// Main Dashboard
// ============================================
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Trello data
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [members, setMembers] = useState<TrelloMember[]>([]);
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [boardName, setBoardName] = useState("");

  // Config
  const [config, setConfig] = useState<NotificationConfig>({
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
  });

  // Z-API status
  const [zapiConnected, setZapiConnected] = useState<boolean | null>(null);

  // Test notification
  const [testPhone, setTestPhone] = useState("");
  const [testIsGroup, setTestIsGroup] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<
    "lists" | "users" | "deadlines" | "newcard" | "test"
  >("lists");

  // ---- Data Loading ----
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trelloRes, configRes, zapiRes] = await Promise.all([
        fetch("/api/trello?action=all"),
        fetch("/api/config"),
        fetch("/api/test-notification"),
      ]);

      if (trelloRes.ok) {
        const data = await trelloRes.json();
        setLists(data.lists || []);
        setMembers(data.members || []);
        setCards(data.cards || []);
        setBoardName(data.board?.name || "");
      } else {
        const err = await trelloRes.json();
        setError(
          `Erro ao carregar Trello: ${err.error}. Verifique suas credenciais nas variáveis de ambiente.`
        );
      }

      if (configRes.ok) {
        const cfg = await configRes.json();
        setConfig((prev) => ({ ...prev, ...cfg }));
      }

      if (zapiRes.ok) {
        const status = await zapiRes.json();
        setZapiConnected(status.connected);
      }
    } catch (e: any) {
      setError(`Erro de conexão: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Save Config ----
  const saveConfigToServer = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSuccess("Configuração salva com sucesso!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        setError(`Erro ao salvar: ${err.error}`);
      }
    } catch (e: any) {
      setError(`Erro ao salvar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ---- Toggle Functions ----
  const toggleList = (listId: string) => {
    setConfig((prev) => ({
      ...prev,
      activeLists: {
        ...prev.activeLists,
        [listId]: !prev.activeLists[listId],
      },
    }));
  };

  const toggleUser = (memberId: string) => {
    setConfig((prev) => ({
      ...prev,
      activeUsers: {
        ...prev.activeUsers,
        [memberId]: {
          ...(prev.activeUsers[memberId] || {
            enabled: false,
            whatsappPhone: "",
            whatsappGroup: "",
            useGroup: false,
          }),
          enabled: !prev.activeUsers[memberId]?.enabled,
        },
      },
    }));
  };

  const updateUserWhatsApp = (
    memberId: string,
    field: keyof UserConfig,
    value: string | boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      activeUsers: {
        ...prev.activeUsers,
        [memberId]: {
          ...(prev.activeUsers[memberId] || {
            enabled: false,
            whatsappPhone: "",
            whatsappGroup: "",
            useGroup: false,
          }),
          [field]: value,
        },
      },
    }));
  };

  const toggleNewCardList = (listId: string) => {
    setConfig((prev) => {
      const current = prev.newCardNotifications.listIds;
      const updated = current.includes(listId)
        ? current.filter((id) => id !== listId)
        : [...current, listId];
      return {
        ...prev,
        newCardNotifications: {
          ...prev.newCardNotifications,
          listIds: updated,
        },
      };
    });
  };

  // ---- Test Notification ----
  const sendTestNotification = async () => {
    if (!testPhone) {
      setError("Informe o número ou grupo para teste");
      return;
    }
    setTestSending(true);
    setError(null);
    try {
      const res = await fetch("/api/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: testPhone,
          isGroup: testIsGroup,
        }),
      });
      if (res.ok) {
        setSuccess("Mensagem de teste enviada com sucesso!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        setError(`Erro ao enviar teste: ${err.error}`);
      }
    } catch (e: any) {
      setError(`Erro ao enviar teste: ${e.message}`);
    } finally {
      setTestSending(false);
    }
  };

  // ---- Manual Check ----
  const runManualCheck = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/check-deadlines");
      const data = await res.json();
      if (res.ok) {
        setSuccess(
          `Verificação concluída! ${data.cardsChecked} cards verificados, ${
            data.results?.filter((r: any) => r.sent).length || 0
          } notificações enviadas.`
        );
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(`Erro: ${data.error}`);
      }
    } catch (e: any) {
      setError(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ---- Cards com prazo próximo ----
  const upcomingCards = cards
    .filter((c) => {
      if (!c.due || c.dueComplete) return false;
      const due = new Date(c.due);
      const now = new Date();
      const hoursLeft =
        (due.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft <= config.hoursBeforeDue;
    })
    .sort(
      (a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime()
    );

  const overdueCards = cards.filter((c) => {
    if (!c.due || c.dueComplete) return false;
    return new Date(c.due) < new Date();
  });

  // ---- Render ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Carregando dados do Trello...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              📋 Trello WhatsApp Notifier
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Quadro: <span className="text-blue-400">{boardName}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-slate-400">Z-API WhatsApp</div>
              <StatusBadge connected={zapiConnected} />
            </div>
            <button
              onClick={saveConfigToServer}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                "💾 Salvar Configurações"
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Alerts */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="bg-green-900/30 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
            <div className="text-3xl font-bold text-white">{cards.length}</div>
            <div className="text-sm text-slate-400">Total de Cards</div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {upcomingCards.length}
            </div>
            <div className="text-sm text-slate-400">Vencendo em Breve</div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
            <div className="text-3xl font-bold text-red-400">
              {overdueCards.length}
            </div>
            <div className="text-sm text-slate-400">Vencidos</div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">
              {Object.values(config.activeLists).filter(Boolean).length}
            </div>
            <div className="text-sm text-slate-400">Listas Ativas</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-6 border border-slate-700 overflow-x-auto">
          {[
            { id: "lists" as const, label: "📁 Listas", short: "Listas" },
            { id: "users" as const, label: "👤 Usuários", short: "Usuários" },
            {
              id: "deadlines" as const,
              label: "⏰ Prazos",
              short: "Prazos",
            },
            {
              id: "newcard" as const,
              label: "🆕 Novo Card",
              short: "Novo Card",
            },
            { id: "test" as const, label: "🧪 Teste", short: "Teste" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Listas */}
        {activeTab === "lists" && (
          <Card title="Gerenciar Listas" icon="📁">
            <p className="text-slate-400 text-sm mb-4">
              Ative as listas que devem gerar notificações de prazo. Apenas
              cards nas listas ativas serão monitorados.
            </p>
            <div className="space-y-3">
              {lists.map((list) => {
                const listCards = cards.filter(
                  (c) => c.idList === list.id
                );
                const withDue = listCards.filter((c) => c.due);
                return (
                  <div
                    key={list.id}
                    className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div>
                      <div className="font-medium text-white">
                        {list.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {listCards.length} cards ({withDue.length} com
                        prazo)
                      </div>
                    </div>
                    <Toggle
                      enabled={!!config.activeLists[list.id]}
                      onChange={() => toggleList(list.id)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Tab: Usuários */}
        {activeTab === "users" && (
          <Card title="Gerenciar Usuários" icon="👤">
            <p className="text-slate-400 text-sm mb-4">
              Ative usuários e vincule um número de WhatsApp ou grupo para
              cada um. As notificações serão enviadas para o destino
              configurado.
            </p>
            <div className="space-y-4">
              {members.map((member) => {
                const userConf = config.activeUsers[member.id] || {
                  enabled: false,
                  whatsappPhone: "",
                  whatsappGroup: "",
                  useGroup: false,
                };
                const memberCards = cards.filter((c) =>
                  c.idMembers.includes(member.id)
                );
                return (
                  <div
                    key={member.id}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-white">
                          {member.fullName}
                        </div>
                        <div className="text-xs text-slate-500">
                          @{member.username} · {memberCards.length} cards
                        </div>
                      </div>
                      <Toggle
                        enabled={userConf.enabled}
                        onChange={() => toggleUser(member.id)}
                      />
                    </div>

                    {userConf.enabled && (
                      <div className="mt-3 pl-4 border-l-2 border-blue-600 space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-slate-400 w-32">
                            Enviar para:
                          </label>
                          <select
                            value={userConf.useGroup ? "group" : "phone"}
                            onChange={(e) =>
                              updateUserWhatsApp(
                                member.id,
                                "useGroup",
                                e.target.value === "group"
                              )
                            }
                            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                          >
                            <option value="phone">
                              Número direto
                            </option>
                            <option value="group">
                              Grupo do WhatsApp
                            </option>
                          </select>
                        </div>

                        {!userConf.useGroup ? (
                          <div className="flex items-center gap-3">
                            <label className="text-sm text-slate-400 w-32">
                              WhatsApp:
                            </label>
                            <input
                              type="text"
                              placeholder="5511999999999"
                              value={userConf.whatsappPhone}
                              onChange={(e) =>
                                updateUserWhatsApp(
                                  member.id,
                                  "whatsappPhone",
                                  e.target.value
                                )
                              }
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <label className="text-sm text-slate-400 w-32">
                              ID do Grupo:
                            </label>
                            <input
                              type="text"
                              placeholder="5511999999999-1234567890@g.us"
                              value={userConf.whatsappGroup}
                              onChange={(e) =>
                                updateUserWhatsApp(
                                  member.id,
                                  "whatsappGroup",
                                  e.target.value
                                )
                              }
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Tab: Prazos */}
        {activeTab === "deadlines" && (
          <div className="space-y-6">
            <Card title="Configuração de Prazos" icon="⏰">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-slate-400">
                    Notificar com antecedência de:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={config.hoursBeforeDue}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        hoursBeforeDue: parseInt(e.target.value) || 6,
                      }))
                    }
                    className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white text-center"
                  />
                  <span className="text-sm text-slate-400">horas</span>
                </div>
                <p className="text-xs text-slate-500">
                  O sistema verificará automaticamente a cada 30 minutos e
                  enviará notificações para cards que estão dentro da janela
                  de antecedência configurada.
                </p>

                <button
                  onClick={runManualCheck}
                  disabled={saving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving
                    ? "Verificando..."
                    : "🔍 Verificar Prazos Agora"}
                </button>
              </div>
            </Card>

            <Card title="Cards com Prazo Próximo" icon="⚠️">
              {upcomingCards.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  Nenhum card com prazo dentro das próximas{" "}
                  {config.hoursBeforeDue} horas.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingCards.map((card) => {
                    const due = new Date(card.due!);
                    const now = new Date();
                    const hoursLeft =
                      (due.getTime() - now.getTime()) /
                      (1000 * 60 * 60);
                    const listName =
                      lists.find((l) => l.id === card.idList)?.name ||
                      "?";
                    const memberNames = card.idMembers
                      .map(
                        (id) =>
                          members.find((m) => m.id === id)?.fullName ||
                          "?"
                      )
                      .join(", ");

                    return (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-3 bg-amber-900/20 rounded-lg border border-amber-800/30"
                      >
                        <div>
                          <a
                            href={card.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-white hover:text-blue-400"
                          >
                            {card.name}
                          </a>
                          <div className="text-xs text-slate-400 mt-1">
                            {listName} · {memberNames || "Sem responsável"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-amber-400">
                            {hoursLeft < 1
                              ? `${Math.round(hoursLeft * 60)}min`
                              : `${Math.round(hoursLeft)}h`}
                          </div>
                          <div className="text-xs text-slate-500">
                            {due.toLocaleString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {overdueCards.length > 0 && (
              <Card title="Cards Vencidos" icon="🔴">
                <div className="space-y-2">
                  {overdueCards.map((card) => {
                    const listName =
                      lists.find((l) => l.id === card.idList)?.name ||
                      "?";
                    return (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-3 bg-red-900/20 rounded-lg border border-red-800/30"
                      >
                        <div>
                          <a
                            href={card.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-white hover:text-blue-400"
                          >
                            {card.name}
                          </a>
                          <div className="text-xs text-slate-400 mt-1">
                            {listName}
                          </div>
                        </div>
                        <div className="text-xs text-red-400">
                          Vencido em{" "}
                          {new Date(card.due!).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Tab: Novo Card */}
        {activeTab === "newcard" && (
          <Card title="Notificação de Novo Card" icon="🆕">
            <p className="text-slate-400 text-sm mb-4">
              Receba notificações quando um novo card for criado ou movido
              para listas específicas. Requer webhook do Trello configurado.
            </p>

            <div className="space-y-4">
              <Toggle
                enabled={config.newCardNotifications.enabled}
                onChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    newCardNotifications: {
                      ...prev.newCardNotifications,
                      enabled: val,
                    },
                  }))
                }
                label="Ativar notificações de novo card"
              />

              {config.newCardNotifications.enabled && (
                <div className="mt-4 space-y-4 pl-4 border-l-2 border-green-600">
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">
                      Monitorar listas:
                    </label>
                    <div className="space-y-2">
                      {lists.map((list) => (
                        <label
                          key={list.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={config.newCardNotifications.listIds.includes(
                              list.id
                            )}
                            onChange={() => toggleNewCardList(list.id)}
                            className="rounded bg-slate-700 border-slate-600 text-blue-600"
                          />
                          <span className="text-sm text-white">
                            {list.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-400 w-32">
                      Enviar para:
                    </label>
                    <select
                      value={
                        config.newCardNotifications.isGroup
                          ? "group"
                          : "phone"
                      }
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          newCardNotifications: {
                            ...prev.newCardNotifications,
                            isGroup: e.target.value === "group",
                          },
                        }))
                      }
                      className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="phone">Número direto</option>
                      <option value="group">Grupo do WhatsApp</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-400 w-32">
                      {config.newCardNotifications.isGroup
                        ? "ID do Grupo:"
                        : "WhatsApp:"}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        config.newCardNotifications.isGroup
                          ? "ID do grupo"
                          : "5511999999999"
                      }
                      value={config.newCardNotifications.whatsappTarget}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          newCardNotifications: {
                            ...prev.newCardNotifications,
                            whatsappTarget: e.target.value,
                          },
                        }))
                      }
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="text-sm font-medium text-white mb-2">
                      ⚙️ Configurar Webhook do Trello
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                      Para receber notificações em tempo real, é necessário
                      criar um webhook no Trello. Clique no botão abaixo
                      após fazer o deploy da aplicação.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/trello", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              action: "create-webhook",
                            }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setConfig((prev) => ({
                              ...prev,
                              trelloWebhookId: data.id,
                            }));
                            setSuccess(
                              "Webhook criado com sucesso! ID: " +
                                data.id
                            );
                            setTimeout(() => setSuccess(null), 5000);
                          } else {
                            setError(
                              `Erro ao criar webhook: ${data.error}`
                            );
                          }
                        } catch (e: any) {
                          setError(`Erro: ${e.message}`);
                        }
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      🔗 Criar Webhook do Trello
                    </button>
                    {config.trelloWebhookId && (
                      <p className="text-xs text-green-400 mt-2">
                        ✅ Webhook ativo: {config.trelloWebhookId}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tab: Teste */}
        {activeTab === "test" && (
          <Card title="Testar Notificação" icon="🧪">
            <p className="text-slate-400 text-sm mb-4">
              Envie uma mensagem de teste para verificar se a integração com
              o WhatsApp está funcionando.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-28">Tipo:</label>
                <select
                  value={testIsGroup ? "group" : "phone"}
                  onChange={(e) =>
                    setTestIsGroup(e.target.value === "group")
                  }
                  className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="phone">Número direto</option>
                  <option value="group">Grupo</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-28">
                  {testIsGroup ? "ID Grupo:" : "Número:"}
                </label>
                <input
                  type="text"
                  placeholder={
                    testIsGroup
                      ? "ID do grupo Z-API"
                      : "5511999999999"
                  }
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>

              <button
                onClick={sendTestNotification}
                disabled={testSending || !testPhone}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {testSending
                  ? "Enviando..."
                  : "📤 Enviar Mensagem de Teste"}
              </button>

              <div className="mt-6 bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-white mb-2">
                  💡 Como encontrar o ID do grupo?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No painel da Z-API, vá em "Chats" e localize o grupo
                  desejado. O ID do grupo está no formato{" "}
                  <code className="bg-slate-800 px-1 rounded">
                    5511999999999-1234567890@g.us
                  </code>
                  . Você também pode usar a API de listar chats para
                  encontrar os IDs.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-slate-600">
        Trello WhatsApp Notifier · Powered by Z-API + Trello API · Vercel
        Cron a cada 30 minutos
      </footer>
    </div>
  );
}
