import { NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { listProducts } from "@/lib/inventory-store";
import { errorResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authenticate(request);
  if (authError) return authError;
  try {
    const products = await listProducts();
    return NextResponse.json(products);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load inventory";
    return errorResponse(500, message);
  }
}
