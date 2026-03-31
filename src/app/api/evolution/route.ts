import { NextRequest, NextResponse } from "next/server";
import {
  createInstance,
  connectInstance,
  getConnectionState,
  logoutInstance,
  listGroups,
} from "@/lib/evolution";

// GET - Verificar status da conexao
export async function GET() {
  try {
    const state = await getConnectionState();
    return NextResponse.json({
      connected: state.connected,
      state: state.state,
    });
  } catch (error: any) {
    console.error("Erro ao verificar status Evolution:", error);
    return NextResponse.json(
      { connected: false, state: "error", error: error.message },
      { status: 200 }
    );
  }
}

// POST - Acoes: create, connect, qrcode, logout, groups
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const result = await createInstance();
      return NextResponse.json(result);
    }

    if (action === "connect" || action === "qrcode") {
      const result = await connectInstance();
      return NextResponse.json({
        qrcode: result.base64 || null,
        pairingCode: result.pairingCode || null,
        count: result.count || 0,
      });
    }

    if (action === "logout") {
      const result = await logoutInstance();
      return NextResponse.json(result);
    }

    if (action === "groups") {
      const groups = await listGroups();
      return NextResponse.json({ groups });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (error: any) {
    console.error("Erro Evolution API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
