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

interface NotificationTarget {
  id: string;
  type: "phone" | "group" | "user";
  value: string;
  label: string;
}

interface WhatsAppGroup {
  id: string;
  name: string;
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
    targets: NotificationTarget[];
  };
  deadlineTargets: NotificationTarget[];
  trelloWebhookId: string | null;  sentNotifications: Record<string, number>;
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
// Componente para gerenciar multiplos destinos
function TargetManager({
  targets,
  onChange,
  groups,
  loadingGroups,
  members,
  activeUsers,
}: {
  targets: NotificationTarget[];
  onChange: (targets: NotificationTarget[]) => void;
  groups: WhatsAppGroup[];
  loadingGroups: boolean;
  members: TrelloMember[];
  activeUsers: Record<string, UserConfig>;
}) {
  const [addType, setAddType] = useState<"phone" | "group" | "user">("group");
  const [addValue, setAddValue] = useState("");
  const [addLabel, setAddLabel] = useState("");

  const addTarget = () => {
    if (!addValue) return;
    const newTarget: NotificationTarget = {
      id: `target-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: addType,
      value: addValue,
      label:
        addLabel ||
        (addType === "group"
          ? groups.find((g) => g.id === addValue)?.name || addValue
          : addType === "user"
          ? members.find((m) => m.id === addValue)?.fullName || addValue
          : addValue),
    };
    onChange([...targets, newTarget]);
    setAddValue("");
    setAddLabel("");
  };
  const removeTarget = (id: string) => {
    onChange(targets.filter((t) => t.id !== id));
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case "phone":
        return "📱";
      case "group":
        return "👥";
      case "user":
        return "👤";
      default:
        return "📨";
    }
  };

  const getTargetTypeName = (type: string) => {
    switch (type) {
      case "phone":
        return "Numero";
      case "group":
        return "Grupo";
      case "user":
        return "Usuario";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-3">
      {/* Lista de destinos existentes */}
      {targets.length > 0 && (
        <div className="space-y-2">
          {targets.map((target) => (
            <div
              key={target.id}
              className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700"
            >
              <div className="flex items-center gap-2">                <span>{getTargetIcon(target.type)}</span>
                <div>
                  <div className="text-sm text-white">{target.label}</div>
                  <div className="text-xs text-slate-500">
                    {getTargetTypeName(target.type)} &middot; {target.value}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeTarget(target.id)}
                className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {targets.length === 0 && (
        <p className="text-slate-500 text-sm italic">
          Nenhum destino configurado. Adicione pelo menos um destino abaixo.
        </p>
      )}

      {/* Adicionar novo destino */}
      <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700 space-y-3">
        <div className="text-sm font-medium text-slate-300">
          Adicionar destino
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400 w-20">Tipo:</label>
          <select
            value={addType}
            onChange={(e) => {
              setAddType(e.target.value as "phone" | "group" | "user");
              setAddValue("");
              setAddLabel("");
            }}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="group">Grupo do WhatsApp</option>
            <option value="phone">Numero direto</option>
            <option value="user">Usuario cadastrado</option>
          </select>
        </div>
        {addType === "group" && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400 w-20">Grupo:</label>
            {loadingGroups ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Carregando grupos...
              </div>
            ) : groups.length > 0 ? (
              <select
                value={addValue}
                onChange={(e) => {
                  setAddValue(e.target.value);
                  const group = groups.find((g) => g.id === e.target.value);
                  if (group) setAddLabel(group.name);
                }}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Selecione um grupo...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  placeholder="ID do grupo (ex: 120363...@g.us)"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-amber-400">
                  Nao foi possivel carregar os grupos. Digite o ID manualmente.
                </p>
              </div>
            )}
          </div>
        )}

        {addType === "phone" && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400 w-20">Numero:</label>
            <input
              type="text"
              placeholder="5511999999999"
              value={addValue}
              onChange={(e) => {
                setAddValue(e.target.value);
                setAddLabel(e.target.value);
              }}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>
        )}

        {addType === "user" && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400 w-20">Usuario:</label>
            <select
              value={addValue}
              onChange={(e) => {
                setAddValue(e.target.value);
                const member = members.find((m) => m.id === e.target.value);
                if (member) setAddLabel(member.fullName);
              }}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Selecione um usuario...</option>
              {members
                .filter((m) => activeUsers[m.id]?.enabled && (activeUsers[m.id]?.whatsappPhone || activeUsers[m.id]?.whatsappGroup))
                .map((member) => {
                  const uc = activeUsers[member.id];
                  const dest = uc?.useGroup
                    ? `Grupo: ${uc.whatsappGroup}`
                    : `Tel: ${uc.whatsappPhone}`;
                  return (
                    <option key={member.id} value={member.id}>
                      {member.fullName} ({dest})
                    </option>
                  );
                })}
              {members.filter(
                (m) => activeUsers[m.id]?.enabled && (activeUsers[m.id]?.whatsappPhone || activeUsers[m.id]?.whatsappGroup)
              ).length === 0 && (
                <option disabled>
                  Nenhum usuario com WhatsApp configurado
                </option>
              )}
            </select>
          </div>
        )}

        {addType !== "group" && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400 w-20">Nome:</label>
            <input
              type="text"
              placeholder="Nome para identificacao (opcional)"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>
        )}

        <button
          onClick={addTarget}
          disabled={!addValue}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"        >
          + Adicionar destino
        </button>
      </div>
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

  // WhatsApp groups
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

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
      targets: [],
    },
    deadlineTargets: [],
    trelloWebhookId: null,
    sentNotifications: {},
  });

  // WhatsApp Evolution API status
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);
  const [whatsappState, setWhatsappState] = useState<string>("unknown");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [connectingWa, setConnectingWa] = useState(false);

  // Test notification
  const [testPhone, setTestPhone] = useState("");
  const [testIsGroup, setTestIsGroup] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<
    "lists" | "users" | "deadlines" | "newcard" | "whatsapp" | "test"
  >("lists");

  // ---- Data Loading ----
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trelloRes, configRes, evolutionRes] = await Promise.all([
        fetch("/api/trello?action=all"),
        fetch("/api/config"),
        fetch("/api/evolution"),
      ]);

      if (trelloRes.ok) {
        const data = await trelloRes.json();
        setLists(data.lists || []);
        setMembers(data.members || []);
        setCards(data.cards || []);
        setBoardName(data.board?.name || "");
      } else {        const err = await trelloRes.json();
        setError(
          `Erro ao carregar Trello: ${err.error}. Verifique suas credenciais.`
        );
      }

      if (configRes.ok) {
        const cfg = await configRes.json();
        setConfig((prev) => ({
          ...prev,
          ...cfg,
          newCardNotifications: {
            ...prev.newCardNotifications,
            ...(cfg.newCardNotifications || {}),
            targets: cfg.newCardNotifications?.targets || [],
          },
          deadlineTargets: cfg.deadlineTargets || [],
        }));
      }

      if (evolutionRes.ok) {
        const status = await evolutionRes.json();
        setWhatsappConnected(status.connected);
        setWhatsappState(status.state || "unknown");
      }
    } catch (e: any) {
      setError(`Erro de conexao: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load WhatsApp groups
  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch("/api/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "groups" }),
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsappGroups(data.groups || []);
      }
    } catch (e) {
      console.error("Erro ao carregar grupos:", e);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  // WhatsApp QR Code / Connection
  const fetchQrCode = useCallback(async () => {
    setLoadingQr(true);
    try {
      const res = await fetch("/api/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.qrcode) {
          setQrCode(data.qrcode);
        }
      }
    } catch (e) {
      console.error("Erro ao obter QR code:", e);
    } finally {
      setLoadingQr(false);
    }
  }, []);

  const createAndConnect = useCallback(async () => {
    setConnectingWa(true);
    setError(null);
    try {
      // Primeiro tenta criar a instancia (retorna QR code se nova)
      const createRes = await fetch("/api/evolution", {        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      if (createRes.ok) {
        const data = await createRes.json();
        if (data.qrcode) {
          setQrCode(data.qrcode);
          setConnectingWa(false);
          return;
        }
      }
      // Se ja existe, busca QR code
      await fetchQrCode();
    } catch (e: any) {
      // Se deu erro na criacao (instancia ja existe), tenta conectar
      try {
        await fetchQrCode();
      } catch (e2: any) {
        setError(`Erro ao conectar WhatsApp: ${e2.message}`);
      }
    } finally {
      setConnectingWa(false);
    }
  }, [fetchQrCode]);

  const disconnectWhatsApp = useCallback(async () => {
    setConnectingWa(true);
    setError(null);
    try {
      const res = await fetch("/api/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (res.ok) {
        setWhatsappConnected(false);
        setWhatsappState("close");
        setQrCode(null);
        setWhatsappGroups([]);
        setSuccess("WhatsApp desconectado com sucesso!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        setError(`Erro ao desconectar: ${err.error}`);
      }
    } catch (e: any) {
      setError(`Erro ao desconectar: ${e.message}`);
    } finally {
      setConnectingWa(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (whatsappConnected) {
      loadGroups();
    }
  }, [whatsappConnected, loadGroups]);

  // Auto-refresh connection status while waiting for QR scan
  useEffect(() => {
    if (!qrCode || whatsappConnected) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/evolution");
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setWhatsappConnected(true);
            setWhatsappState("open");
            setQrCode(null);
            setSuccess("WhatsApp conectado com sucesso!");
            setTimeout(() => setSuccess(null), 3000);
            loadGroups();
          }
        }      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [qrCode, whatsappConnected, loadGroups]);

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
        setSuccess("Configuracao salva com sucesso!");
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
      setError("Informe o numero ou grupo para teste");
      return;
    }
    setTestSending(true);
    setError(null);
    try {
      const res = await fetch("/api/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: testPhone, isGroup: testIsGroup }),
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
          `Verificacao concluida! ${data.cardsChecked} cards verificados, ${
            data.results?.filter((r: any) => r.sent).length || 0
          } notificacoes enviadas.`
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

  // ---- Cards com prazo proximo ----
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
      (a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime()    );

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
              Quadro:{" "}
              <span className="text-blue-400">{boardName}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-slate-400">WhatsApp</div>
              <StatusBadge connected={whatsappConnected} />
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
                "💾 Salvar Configuracoes"
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
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">            <div className="text-3xl font-bold text-white">
              {cards.length}
            </div>
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
            { id: "whatsapp" as const, label: "📱 WhatsApp" },
            { id: "lists" as const, label: "📁 Listas" },
            { id: "users" as const, label: "👤 Usuarios" },
            { id: "deadlines" as const, label: "⏰ Prazos" },
            { id: "newcard" as const, label: "🆕 Novo Card" },
            { id: "test" as const, label: "🧪 Teste" },
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

        {/* Tab: WhatsApp */}
        {activeTab === "whatsapp" && (
          <Card title="Conexao WhatsApp" icon="📱">
            <div className="space-y-6">
              {/* Status atual */}
              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <div>
                  <div className="text-sm font-medium text-white">Status da Conexao</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Estado: {whatsappState === "open" ? "Conectado" : whatsappState === "connecting" ? "Conectando..." : "Desconectado"}
                  </div>
                </div>
                <StatusBadge connected={whatsappConnected} />
              </div>

              {/* Acoes */}
              <div className="flex flex-wrap gap-3">
                {!whatsappConnected && (
                  <button
                    onClick={createAndConnect}
                    disabled={connectingWa}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {connectingWa ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Gerando QR Code...
                      </>
                    ) : (                      "🔗 Conectar WhatsApp"
                    )}
                  </button>
                )}
                {whatsappConnected && (
                  <button
                    onClick={disconnectWhatsApp}
                    disabled={connectingWa}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {connectingWa ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      "❌ Desconectar WhatsApp"
                    )}
                  </button>
                )}
                {!whatsappConnected && qrCode && (
                  <button
                    onClick={fetchQrCode}
                    disabled={loadingQr}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {loadingQr ? "Atualizando..." : "🔄 Atualizar QR Code"}
                  </button>
                )}
              </div>

              {/* QR Code */}
              {!whatsappConnected && qrCode && (
                <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-4 max-w-sm mx-auto">
                  <p className="text-gray-800 text-sm font-medium text-center">
                    Escaneie o QR Code com o WhatsApp
                  </p>
                  <img
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                  <p className="text-gray-500 text-xs text-center">
                    Abra o WhatsApp no celular > Menu > Dispositivos conectados > Conectar dispositivo
                  </p>
                  <div className="flex items-center gap-2 text-blue-600 text-xs">
                    <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Aguardando leitura do QR Code...
                  </div>
                </div>
              )}

              {/* Conectado - info */}
              {whatsappConnected && (
                <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span>✅</span>
                    WhatsApp conectado e pronto para enviar notificacoes!
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {whatsappGroups.length > 0
                      ? `${whatsappGroups.length} grupos encontrados.`
                      : "Carregando grupos..."}
                    {" "}Para trocar de WhatsApp, desconecte e escaneie um novo QR Code.
                  </p>
                </div>
              )}

              {/* Instrucoes */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-white mb-2">ℹ️ Como funciona</h4>
                <div className="text-xs text-slate-400 space-y-2">
                  <p>1. Clique em "Conectar WhatsApp" para gerar um QR Code.</p>
                  <p>2. Abra o WhatsApp no celular e escaneie o QR Code.</p>
                  <p>3. Pronto! O sistema usara esse WhatsApp para enviar alertas.</p>
                  <p>4. Para trocar de numero, desconecte e escaneie com outro celular.</p>
                </div>
              </div>
            </div>
          </Card>        )}

        {/* Tab: Listas */}
        {activeTab === "lists" && (
          <Card title="Gerenciar Listas" icon="📁">
            <p className="text-slate-400 text-sm mb-4">
              Ative as listas que devem gerar notificacoes de prazo. Apenas
              cards nas listas ativas serao monitorados.
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
                        {listCards.length} cards ({withDue.length} com prazo)
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

        {/* Tab: Usuarios */}
        {activeTab === "users" && (
          <Card title="Gerenciar Usuarios" icon="👤">
            <p className="text-slate-400 text-sm mb-4">
              Ative usuarios e vincule um numero de WhatsApp ou grupo para
              cada um. Estes usuarios podem ser selecionados como destino nas
              notificacoes de Novo Card e Prazos.
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
                          @{member.username} &middot; {memberCards.length}{" "}
                          cards
                        </div>
                      </div>
                      <Toggle
                        enabled={userConf.enabled}
                        onChange={() => toggleUser(member.id)}
                      />
                    </div>
                    {userConf.enabled && (
                      <div className="mt-3 pl-4 border-l-2 border-blue-600 space-y-3">                        <div className="flex items-center gap-3">
                          <label className="text-sm text-slate-400 w-32">
                            Enviar para:
                          </label>
                          <select
                            value={
                              userConf.useGroup ? "group" : "phone"
                            }
                            onChange={(e) =>
                              updateUserWhatsApp(
                                member.id,
                                "useGroup",
                                e.target.value === "group"
                              )
                            }
                            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                          >
                            <option value="phone">Numero direto</option>
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
                              Grupo:
                            </label>
                            {whatsappGroups.length > 0 ? (
                              <select
                                value={userConf.whatsappGroup}
                                onChange={(e) =>
                                  updateUserWhatsApp(
                                    member.id,
                                    "whatsappGroup",
                                    e.target.value
                                  )
                                }
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                              >
                                <option value="">
                                  Selecione um grupo...
                                </option>
                                {whatsappGroups.map((group) => (
                                  <option
                                    key={group.id}
                                    value={group.id}
                                  >
                                    {group.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="ID do grupo"
                                value={userConf.whatsappGroup}
                                onChange={(e) =>
                                  updateUserWhatsApp(
                                    member.id,
                                    "whatsappGroup",                                    e.target.value
                                  )
                                }
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                              />
                            )}
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
            <Card title="Configuracao de Prazos" icon="⏰">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-slate-400">
                    Notificar com antecedencia de:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={config.hoursBeforeDue}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        hoursBeforeDue:
                          parseInt(e.target.value) || 6,
                      }))
                    }
                    className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white text-center"
                  />
                  <span className="text-sm text-slate-400">horas</span>
                </div>
                <p className="text-xs text-slate-500">
                  O sistema verifica automaticamente a cada dia (8h UTC) e
                  envia notificacoes para cards dentro da janela configurada.
                  Cada usuario ativo recebe a notificacao no WhatsApp vinculado.
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

            <Card title="Destinos adicionais de prazo" icon="📨">
              <p className="text-slate-400 text-sm mb-4">
                Alem dos usuarios individuais (configurados na aba Usuarios),
                voce pode adicionar destinos extras para receber todas as
                notificacoes de prazo. Por exemplo, um grupo do WhatsApp da
                equipe.
              </p>
              <TargetManager
                targets={config.deadlineTargets || []}
                onChange={(targets) =>
                  setConfig((prev) => ({
                    ...prev,
                    deadlineTargets: targets,
                  }))
                }
                groups={whatsappGroups}
                loadingGroups={loadingGroups}
                members={members}
                activeUsers={config.activeUsers}
              />
            </Card>
            {upcomingCards.length > 0 && (
              <Card title="Cards com Prazo Proximo" icon="⚠️">
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
                          members.find((m) => m.id === id)
                            ?.fullName || "?"
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
                            {listName} &middot;{" "}
                            {memberNames || "Sem responsavel"}
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
              </Card>
            )}

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
                          </div>                        </div>
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
          <Card title="Notificacao de Novo Card" icon="🆕">
            <p className="text-slate-400 text-sm mb-4">
              Receba notificacoes quando um novo card for criado ou movido
              para listas especificas. Requer webhook do Trello configurado.
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
                label="Ativar notificacoes de novo card"
              />

              {config.newCardNotifications.enabled && (
                <div className="mt-4 space-y-6 pl-4 border-l-2 border-green-600">
                  {/* Listas monitoradas */}
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
                    <p className="text-xs text-slate-500 mt-2">
                      Se nenhuma lista for selecionada, todas as listas serao monitoradas.
                    </p>
                  </div>

                  {/* Destinos de notificacao */}
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">
                      Destinos da notificacao:
                    </label>
                    <TargetManager
                      targets={
                        config.newCardNotifications.targets || []
                      }
                      onChange={(targets) =>
                        setConfig((prev) => ({
                          ...prev,                          newCardNotifications: {
                            ...prev.newCardNotifications,
                            targets,
                          },
                        }))
                      }
                      groups={whatsappGroups}
                      loadingGroups={loadingGroups}
                      members={members}
                      activeUsers={config.activeUsers}
                    />
                  </div>

                  {/* Webhook config */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="text-sm font-medium text-white mb-2">
                      ⚙️ Configurar Webhook do Trello
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                      Para receber notificacoes em tempo real, e necessario
                      criar um webhook no Trello.
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
                        ✅ Webhook ativo:{" "}
                        {config.trelloWebhookId}
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
          <Card title="Testar Notificacao" icon="🧪">
            <p className="text-slate-400 text-sm mb-4">
              Envie uma mensagem de teste para verificar se a integracao com
              o WhatsApp esta funcionando.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">                <label className="text-sm text-slate-400 w-28">
                  Tipo:
                </label>
                <select
                  value={testIsGroup ? "group" : "phone"}
                  onChange={(e) =>
                    setTestIsGroup(e.target.value === "group")
                  }
                  className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="phone">Numero direto</option>
                  <option value="group">Grupo</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-28">
                  {testIsGroup ? "Grupo:" : "Numero:"}
                </label>
                {testIsGroup && whatsappGroups.length > 0 ? (
                  <select
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecione um grupo...</option>
                    {whatsappGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder={
                      testIsGroup
                        ? "ID do grupo (ex: 120363...@g.us)"
                        : "5511999999999"
                    }
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                )}
              </div>
              <button
                onClick={sendTestNotification}
                disabled={testSending || !testPhone}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {testSending
                  ? "Enviando..."
                  : "📧 Enviar Mensagem de Teste"}
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-slate-600">
        Trello WhatsApp Notifier - Powered by Evolution API + Trello API -
        Vercel Cron diario as 8h UTC
      </footer>
    </div>
  );
}