import { NextResponse } from "next/server";
import { listProducts } from "@/lib/inventory-store";
import { errorResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await listProducts();
    return NextResponse.json(products);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load inventory";
    return errorResponse(500, message);
  }
}
