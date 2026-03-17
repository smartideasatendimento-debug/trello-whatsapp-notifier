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
