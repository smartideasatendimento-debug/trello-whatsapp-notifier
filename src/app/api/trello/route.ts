import { NextRequest, NextResponse } from "next/server";
import {
  getBoard,
  getBoardLists,
  getBoardCards,
  getBoardMembers,
  createWebhook,
  deleteWebhook,
  listWebhooks,
} from "@/lib/trello";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const boardId = process.env.TRELLO_BOARD_ID || "h4XEGbpc";

  try {
    switch (action) {
      case "board":
        const board = await getBoard(boardId);
        return NextResponse.json(board);

      case "lists":
        const lists = await getBoardLists(boardId);
        return NextResponse.json(lists);

      case "cards":
        const cards = await getBoardCards(boardId);
        return NextResponse.json(cards);

      case "members":
        const members = await getBoardMembers(boardId);
        return NextResponse.json(members);

      case "webhooks":
        const webhooks = await listWebhooks();
        return NextResponse.json(webhooks);

      case "all": {
        const [b, l, c, m] = await Promise.all([
          getBoard(boardId),
          getBoardLists(boardId),
          getBoardCards(boardId),
          getBoardMembers(boardId),
        ]);
        return NextResponse.json({
          board: b,
          lists: l,
          cards: c,
          members: m,
        });
      }

      default:
        return NextResponse.json(
          { error: "Ação inválida. Use: board, lists, cards, members, webhooks, all" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Trello API error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao acessar Trello API" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, listId, callbackUrl, webhookId } = body;

    switch (action) {
      case "create-webhook": {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        const url = callbackUrl || `${appUrl}/api/webhook`;
        const boardId = process.env.TRELLO_BOARD_ID || "h4XEGbpc";

        // Resolve the full board ID (Trello webhooks require the full 24-char hex ID)
        let modelId = listId;
        if (!modelId) {
          const boardData = await getBoard(boardId);
          modelId = boardData.id;
        }

        const webhook = await createWebhook(
          url,
          modelId,
          `Trello WhatsApp Notifier - ${modelId}`
        );
        return NextResponse.json(webhook);
      }

      case "delete-webhook": {
        if (!webhookId) {
          return NextResponse.json(
            { error: "webhookId é obrigatório" },
            { status: 400 }
          );
        }
        await deleteWebhook(webhookId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: "Ação inválida" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Trello webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Erro na operação de webhook" },
      { status: 500 }
    );
  }
}
