import { NextResponse } from "next/server";
import type { MutationResult, StoreError } from "./inventory-store";
import type { ApiErrorBody, MutationSuccessBody } from "./types";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
} as const;

export function optionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "x-api-key, content-type",
    },
  });
}

export function errorResponse(status: number, message: string) {
  return NextResponse.json<ApiErrorBody>(
    { success: false, error: message },
    { status, headers: CORS_HEADERS },
  );
}

export function mutationErrorResponse(error: StoreError) {
  switch (error.kind) {
    case "not_found":
      return errorResponse(404, "Product not found");
    case "invalid_quantity":
      return errorResponse(
        400,
        "Invalid quantity. Must be a positive integer.",
      );
    case "reserve_exceeds_on_hand":
      return errorResponse(409, "Cannot reserve more than on-hand quantity.");
    case "release_below_zero":
      return errorResponse(409, "Cannot release more than currently reserved.");
    case "db_error":
      return errorResponse(500, `Database error: ${error.message}`);
  }
}

export async function readJsonBody(
  request: Request,
): Promise<{ quantity?: unknown } | null> {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) return null;
    return body as { quantity?: unknown };
  } catch {
    return null;
  }
}

export function handleMutation(result: MutationResult) {
  if (result.ok) {
    return NextResponse.json<MutationSuccessBody>(
      { success: true, product: result.product },
      { headers: CORS_HEADERS },
    );
  }
  return mutationErrorResponse(result.error);
}
