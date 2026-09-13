import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json({ error: "Las tiendas se crean desde el panel de superadmin." }, { status: 403 });
}
