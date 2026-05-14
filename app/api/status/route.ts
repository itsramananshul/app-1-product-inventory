import { NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { productCount } from "@/lib/inventory-store";
import { CORS_HEADERS, errorResponse, optionsResponse } from "@/lib/api-helpers";
import type { StatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authenticate(request);
  if (authError) return authError;
  try {
    const count = await productCount();
    const payload: StatusResponse = {
      instanceName: process.env.INSTANCE_NAME ?? "Unknown Instance",
      type: "product_inventory",
      productCount: count,
      health: "ok",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(payload, { headers: CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Status check failed";
    return errorResponse(500, message);
  }
}

export const OPTIONS = optionsResponse;
