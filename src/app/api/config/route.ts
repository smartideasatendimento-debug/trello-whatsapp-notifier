import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig, type NotificationConfig } from "@/lib/config";

// GET - Obter configuraÃ§Ã£o atual
export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao carregar configuraÃ§Ã£o" },
      { status: 500 }
    );
  }
}

// POST - Salvar configuraÃ§Ã£o
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await saveConfig(body as NotificationConfig);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao salvar configuraÃ§Ã£o" },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar parcialmente
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await getConfig();
    const updated = { ...current, ...body };
    await saveConfig(updated);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar configuraÃ§Ã£o" },
      { status: 500 }
    );
  }
}
