import { NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { listProducts } from "@/lib/inventory-store";
import { CORS_HEADERS, errorResponse, optionsResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authenticate(request);
  if (authError) return authError;
  try {
    const products = await listProducts();
    return NextResponse.json(products, { headers: CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load inventory";
    return errorResponse(500, message);
  }
}

export const OPTIONS = optionsResponse;
