import { NextRequest, NextResponse } from "next/server";
import { getCardsWithUpcomingDue, getBoardMembers } from "@/lib/trello";
import {
  sendNotification,
  formatDeadlineMessage,
} from "@/lib/zapi";
import {
  getConfig,
  wasNotificationSent,
  markNotificationSent,
} from "@/lib/config";

export const maxDuration = 60; // Vercel timeout

export async function GET(req: NextRequest) {
  // Verificar autorizaÃ§Ã£o para cron jobs
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Permitir acesso via Vercel Cron ou via secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Vercel Cron envia o header automaticamente
    const isVercelCron = req.headers.get("x-vercel-cron");
    if (!isVercelCron) {
      return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });
    }
  }

  try {
    const config = await getConfig();
    const boardId = process.env.TRELLO_BOARD_ID || "h4XEGbpc";
    const hoursBeforeDue = config.hoursBeforeDue || 6;

    // Buscar cards com prazo prÃ³ximo
    const upcomingCards = await getCardsWithUpcomingDue(boardId, hoursBeforeDue);

    const results: {
      card: string;
      sent: boolean;
      target: string;
      error?: string;
    }[] = [];

    for (const card of upcomingCards) {
      // Verificar se a lista estÃ¡ ativa
      if (!config.activeLists[card.idList]) {
        results.push({
          card: card.name,
          sent: false,
          target: "N/A",
          error: "Lista nÃ£o ativa",
        });
        continue;
      }

      // Verificar se jÃ¡ foi notificado recentemente
      const alreadySent = await wasNotificationSent(card.id);
      if (alreadySent) {
        results.push({
          card: card.name,
          sent: false,
          target: "N/A",
          error: "JÃ¡ notificado recentemente",
        });
        continue;
      }

      // Calcular horas restantes
      const now = new Date();
      const dueDate = new Date(card.due!);
      const hoursRemaining = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Para cada membro do card, enviar notificaÃ§Ã£o se estiver ativo
      const membersToNotify = card.idMembers.filter(
        (memberId) => config.activeUsers[memberId]?.enabled
      );

      if (membersToNotify.length === 0) {
        // Se nenhum membro ativo, pular
        results.push({
          card: card.name,
          sent: false,
          target: "N/A",
          error: "Nenhum membro ativo vinculado",
        });
        continue;
      }

      const message = formatDeadlineMessage(
        card.name,
        card.due!,
        card.listName || "Desconhecida",
        card.memberNames || [],
        card.shortUrl || card.url,
        hoursRemaining
      );

      for (const memberId of membersToNotify) {
        const userConfig = config.activeUsers[memberId];
        const target = userConfig.useGroup
          ? userConfig.whatsappGroup
          : userConfig.whatsappPhone;

        if (!target) {
          results.push({
            card: card.name,
            sent: false,
            target: "N/A",
            error: `Sem WhatsApp configurado para membro ${memberId}`,
          });
          continue;
        }

        try {
          await sendNotification(target, message, userConfig.useGroup);
          results.push({
            card: card.name,
            sent: true,
            target: userConfig.useGroup ? "Grupo" : "Direto",
          });
        } catch (err: any) {
          results.push({
            card: card.name,
            sent: false,
            target,
            error: err.message,
          });
        }
      }

      // Marcar como notificado
      await markNotificationSent(card.id);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cardsChecked: upcomingCards.length,
      results,
    });
  } catch (error: any) {
    console.error("Erro ao verificar prazos:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao verificar prazos" },
      { status: 500 }
    );
  }
}
