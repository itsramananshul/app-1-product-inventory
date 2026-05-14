import { restock } from "@/lib/inventory-store";
import { errorResponse, handleMutation, readJsonBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse(400, "Invalid JSON body");
  return handleMutation(await restock(params.id, body.quantity));
}
