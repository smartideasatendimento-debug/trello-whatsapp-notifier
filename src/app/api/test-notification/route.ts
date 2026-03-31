import { NextRequest, NextResponse } from "next/server";
import { sendNotification, checkConnectionStatus } from "@/lib/evolution";

// GET - Verificar status da conexao WhatsApp
export async function GET() {
  try {
    const status = await checkConnectionStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, smartphoneConnected: false, error: error.message },
      { status: 200 }
    );
  }
}

// POST - Enviar mensagem de teste
export async function POST(req: NextRequest) {
  try {
    const { target, isGroup } = await req.json();
    if (!target) {
      return NextResponse.json(
        { error: "Informe o destino (target)" },
        { status: 400 }
      );
    }

    const message =
      `*\u{2705} Teste de Notificacao *\n\n` +
      `Este e um teste do sistema Trello WhatsApp Notifier.\n` +
      `Se voce recebeu esta mensagem, a integracao esta funcionando!\n\n` +
      `\u{1F4C5} ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

    await sendNotification(target, message, isGroup);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao enviar teste:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
