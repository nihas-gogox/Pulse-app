/** Workspace-scoped platform master data types — product-agnostic. */

export type WorkspaceId = string;

export type PlatformCustomer = {
  id: string;
  workspaceId: WorkspaceId;
  name: string;
  legalName: string | null;
  tradeName: string | null;
  phone: string;
  email: string | null;
  gstin: string | null;
  address: string | null;
  state: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformWarehouse = {
  id: string;
  workspaceId: WorkspaceId;
  clientId: string;
  name: string;
  code: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  capacityTons: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformProduct = {
  id: string;
  workspaceId: WorkspaceId;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  uom: string;
  unitPrice: number;
  weightKg: number;
  volumeM3: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  hazmat: boolean;
  fragile: boolean;
  temperatureType: string;
  status: string;
  hsnCode: string | null;
  taxRate: number;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePlatformCustomerInput = {
  name: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: string;
  tradeName?: string;
  state?: string;
  contactPerson?: string;
  panNumber?: string;
  notes?: string;
  isIntegrated?: boolean;
  createdBy?: string;
  legalName?: string;
};

export type CreatePlatformWarehouseInput = {
  clientId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  capacityTons?: number;
  warehouseCode?: string;
  warehouseZone?: string;
  localGstin?: string;
  dockCount?: number;
  managerName?: string;
  managerPhone?: string;
  contactName?: string;
  contactPhone?: string;
};

export type CreatePlatformProductInput = {
  sku: string;
  name: string;
  description?: string;
  category: string;
  uom?: string;
  unitPrice: number;
  weightKg: number;
  volumeM3: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  hazmat?: boolean;
  fragile?: boolean;
  temperatureType?: string;
  hsnCode?: string;
  taxRate?: number;
  imagePath?: string | null;
};

export type UpdatePlatformCustomerInput = {
  name?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  tradeName?: string;
  legalName?: string;
  state?: string;
  contactPerson?: string;
  panNumber?: string;
};

export type UpdatePlatformWarehouseInput = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  capacityTons?: number;
  warehouseCode?: string;
  warehouseZone?: string;
  localGstin?: string;
  dockCount?: number;
  managerName?: string;
  managerPhone?: string;
  contactName?: string;
  contactPhone?: string;
};

export type UpdatePlatformProductInput = {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  uom?: string;
  unitPrice?: number;
  weightKg?: number;
  volumeM3?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  hazmat?: boolean;
  fragile?: boolean;
  temperatureType?: string;
  hsnCode?: string;
  taxRate?: number;
  imagePath?: string | null;
};
