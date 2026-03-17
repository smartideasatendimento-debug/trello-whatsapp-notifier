import { NextRequest, NextResponse } from "next/server";
import { sendNotification, checkConnectionStatus } from "@/lib/zapi";

// POST - Enviar notificaÃ§Ã£o de teste
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, isGroup, message } = body;

    if (!target) {
      return NextResponse.json(
        { error: "Informe o nÃºmero ou grupo de destino" },
        { status: 400 }
      );
    }

    const testMessage =
      message ||
      `â *TESTE - Trello WhatsApp Notifier*\n\n` +
        `Esta Ã© uma mensagem de teste.\n` +
        `Se vocÃª recebeu esta mensagem, a integraÃ§Ã£o estÃ¡ funcionando corretamente!\n\n` +
        `ð ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

    const result = await sendNotification(target, testMessage, isGroup);

    return NextResponse.json({
      success: true,
      messageId: result.zapiMessageId || result.messageId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao enviar teste" },
      { status: 500 }
    );
  }
}

// GET - Verificar status da conexÃ£o Z-API
export async function GET() {
  try {
    const status = await checkConnectionStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, error: error.message },
      { status: 500 }
    );
  }
}
