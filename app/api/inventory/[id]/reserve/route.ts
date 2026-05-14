import { authenticate } from "@/lib/authenticate";
import { reserve } from "@/lib/inventory-store";
import { errorResponse, handleMutation, readJsonBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const authError = await authenticate(request);
  if (authError) return authError;
  const body = await readJsonBody(request);
  if (!body) return errorResponse(400, "Invalid JSON body");
  return handleMutation(await reserve(params.id, body.quantity));
}
