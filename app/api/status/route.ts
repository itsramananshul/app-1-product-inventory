import { NextResponse } from "next/server";
import { productCount } from "@/lib/inventory-store";
import { errorResponse } from "@/lib/api-helpers";
import type { StatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await productCount();
    const payload: StatusResponse = {
      instanceName: process.env.INSTANCE_NAME ?? "Unknown Instance",
      type: "product_inventory",
      productCount: count,
      health: "ok",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Status check failed";
    return errorResponse(500, message);
  }
}
