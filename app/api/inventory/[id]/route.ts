import { NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { getProduct } from "@/lib/inventory-store";
import { errorResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const authError = await authenticate(request);
  if (authError) return authError;
  try {
    const product = await getProduct(params.id);
    if (!product) return errorResponse(404, "Product not found");
    return NextResponse.json(product);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load product";
    return errorResponse(500, message);
  }
}
