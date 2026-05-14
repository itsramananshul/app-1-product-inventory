export type InventoryStatus = "OK" | "LOW STOCK" | "OUT OF STOCK";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  onHand: number;
  reserved: number;
  reorderThreshold: number;
}

export interface ProductView extends Product {
  available: number;
  status: InventoryStatus;
}

export interface MutationRequest {
  quantity: number;
}

export interface ApiErrorBody {
  success: false;
  error: string;
}

export interface MutationSuccessBody {
  success: true;
  product: ProductView;
}

export interface StatusResponse {
  instanceName: string;
  type: "product_inventory";
  productCount: number;
  health: "ok";
  timestamp: string;
}
