import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "La creación manual de ventas ya no está disponible." }, { status: 405 });
}
