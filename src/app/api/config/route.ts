import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/config";

// GET - Retornar configuracao atual
export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Salvar configuracao
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await saveConfig(body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
