import { NextResponse } from "next/server";
import { listGroups } from "@/lib/evolution";

export async function GET() {
  try {
    const groups = await listGroups();
    return NextResponse.json({ groups });
  } catch (error: any) {
    console.error("Erro ao listar grupos:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao listar grupos do WhatsApp" },
      { status: 500 }
    );
  }
}
