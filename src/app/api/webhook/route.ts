import { NextRequest, NextResponse } from "next/server";
import { getBoardMembers } from "@/lib/trello";
import {
  sendNotification,
  formatNewCardMessage,
  formatCardMovedMessage,
} from "@/lib/zapi";
import { getConfig, NotificationTarget } from "@/lib/config";

// HEAD - Trello verifica o webhook com um HEAD request
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

// Resolver targets para enviar notificacao
async function resolveTargets(
  targets: NotificationTarget[],
  config: Awaited<ReturnType<typeof getConfig>>
): Promise<{ target: string; isGroup: boolean; label: string }[]> {
  const resolved: { target: string; isGroup: boolean; label: string }[] = [];

  for (const t of targets) {
    if (t.type === "phone") {
      resolved.push({ target: t.value, isGroup: false, label: t.label });
    } else if (t.type === "group") {
      resolved.push({ target: t.value, isGroup: true, label: t.label });
    } else if (t.type === "user") {
      // Buscar config do usuario
      const userConfig = config.activeUsers[t.value];
      if (userConfig?.enabled) {
        const dest = userConfig.useGroup
          ? userConfig.whatsappGroup
          : userConfig.whatsappPhone;
        if (dest) {
          resolved.push({
            target: dest,
            isGroup: userConfig.useGroup,
            label: t.label,
          });
        }
      }
    }
  }

  return resolved;
}

// Enviar para multiplos destinos
async function sendToMultipleTargets(
  targets: NotificationTarget[],
  message: string,
  config: Awaited<ReturnType<typeof getConfig>>,
  legacyTarget?: string,
  legacyIsGroup?: boolean
) {
  const resolvedTargets = await resolveTargets(targets, config);

  // Se nao ha targets novos, usar legacy
  if (resolvedTargets.length === 0 && legacyTarget) {
    resolvedTargets.push({
      target: legacyTarget,
      isGroup: legacyIsGroup || false,
      label: "Legacy",
    });
  }

  const results = [];
  for (const dest of resolvedTargets) {
    try {
      await sendNotification(dest.target, message, dest.isGroup);
      results.push({ target: dest.label, sent: true });
    } catch (err: any) {
      console.error(`Erro ao enviar para ${dest.label}:`, err);
      results.push({ target: dest.label, sent: false, error: err.message });
    }
  }
  return results;
}

// POST - Trello envia eventos via POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ ok: true });
    }

    const actionType = action.type;
    const config = await getConfig();

    // Notificacao de novo card criado
    if (actionType === "createCard" && config.newCardNotifications.enabled) {
      const card = action.data?.card;
      const list = action.data?.list;

      if (!card || !list) {
        return NextResponse.json({ ok: true });
      }

      // Verificar se a lista esta sendo monitorada
      if (
        config.newCardNotifications.listIds.length > 0 &&
        !config.newCardNotifications.listIds.includes(list.id)
      ) {
        return NextResponse.json({ ok: true, reason: "Lista nao monitorada" });
      }

      const boardId = process.env.TRELLO_BOARD_ID || "h4XEGbpc";
      const members = await getBoardMembers(boardId);
      const memberMap = new Map(members.map((m) => [m.id, m.fullName]));
      const memberNames = (card.idMembers || []).map(
        (id: string) => memberMap.get(id) || "Desconhecido"
      );

      const message = formatNewCardMessage(
        card.name,
        list.name,
        memberNames,
        `https://trello.com/c/${card.shortLink || card.id}`
      );

      const results = await sendToMultipleTargets(
        config.newCardNotifications.targets || [],
        message,
        config,
        config.newCardNotifications.whatsappTarget,
        config.newCardNotifications.isGroup
      );

      return NextResponse.json({ ok: true, notified: true, results });
    }

    // Card movido para uma lista monitorada
    if (actionType === "updateCard" && action.data?.listAfter) {
      const card = action.data.card;
      const listAfter = action.data.listAfter;
      const listBefore = action.data.listBefore;

      if (
        config.newCardNotifications.enabled &&
        (config.newCardNotifications.listIds.length === 0 ||
          config.newCardNotifications.listIds.includes(listAfter.id))
      ) {
        const boardId = process.env.TRELLO_BOARD_ID || "h4XEGbpc";
        const members = await getBoardMembers(boardId);
        const memberMap = new Map(members.map((m) => [m.id, m.fullName]));
        const memberNames = (card.idMembers || []).map(
          (id: string) => memberMap.get(id) || "Desconhecido"
        );

        const message = formatCardMovedMessage(
          card.name,
          listAfter.name,
          listBefore?.name || "?",
          memberNames,
          `https://trello.com/c/${card.shortLink || card.id}`
        );

        const results = await sendToMultipleTargets(
          config.newCardNotifications.targets || [],
          message,
          config,
          config.newCardNotifications.whatsappTarget,
          config.newCardNotifications.isGroup
        );

        return NextResponse.json({ ok: true, notified: true, results });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { getBoardMembers } from "@/lib/trello";
import { sendNotification, formatNewCardMessage } from "@/lib/zapi";
import { getConfig } from "@/lib/config";

// HEAD - Trello verifica o webhook com um HEAD request
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

// POST - Trello envia eventos via POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ ok: true });
    }

    const actionType = action.type;
    const config = await getConfig();

    // NotificaÃ§Ã£o de novo card criado
    if (actionType === "createCard" && config.newCardNotifications.enabled) {
      const card = action.data?.card;
      const list = action.data?.list;

      if (!card || !list) {
        return NextResponse.json({ ok: true });
      }

      // Verificar se a lista estÃ¡ sendo monitorada para novos cards
      if (!config.newCardNotifications.listIds.includes(list.id)) {
        return NextResponse.json({ ok: true, reason: "Lista nÃ£o monitorada" });
      }

      // Buscar nomes dos membros
      const boardId = process.env.TRELLO_BOARD_ID || "h4XEGbpc";
      const members = await getBoardMembers(boardId);
      const memberMap = new Map(members.map((m) => [m.id, m.fullName]));

      const memberNames = (card.idMembers || []).map(
        (id: string) => memberMap.get(id) || "Desconhecido"
      );

      const message = formatNewCardMessage(
        card.name,
        list.name,
        memberNames,
        `https://trello.com/c/${card.shortLink || card.id}`
      );

      const target = config.newCardNotifications.whatsappTarget;
      if (target) {
        await sendNotification(
          target,
          message,
          config.newCardNotifications.isGroup
        );
      }

      return NextResponse.json({ ok: true, notified: true });
    }

    // Card movido para uma lista monitorada
    if (actionType === "updateCard" && action.data?.listAfter) {
      const card = action.data.card;
      const listAfter = action.data.listAfter;

      if (
        config.newCardNotifications.enabled &&
        config.newCardNotifications.listIds.includes(listAfter.id)
      ) {
        const boardId = process.env.TRELLO_BOARD_ID || "h4XEGbpc";
        const members = await getBoardMembers(boardId);
        const memberMap = new Map(members.map((m) => [m.id, m.fullName]));

        const memberNames = (card.idMembers || []).map(
          (id: string) => memberMap.get(id) || "Desconhecido"
        );

        const message =
          `ð¦ *CARD MOVIDO - TRELLO*\n\n` +
          `ð *Card:* ${card.name}\n` +
          `ð *Movido para:* ${listAfter.name}\n` +
          `ð *Veio de:* ${action.data.listBefore?.name || "?"}\n` +
          `ð¤ *ResponsÃ¡vel:* ${memberNames.join(", ") || "Sem responsÃ¡vel"}\n\n` +
          `ð https://trello.com/c/${card.shortLink || card.id}`;

        const target = config.newCardNotifications.whatsappTarget;
        if (target) {
          await sendNotification(
            target,
            message,
            config.newCardNotifications.isGroup
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
