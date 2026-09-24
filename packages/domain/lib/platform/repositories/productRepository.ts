import { requirePlatformDb } from '@pulse/core/lib/platform/db/platformDb';
import type {
  CreatePlatformProductInput,
  PlatformProduct,
  UpdatePlatformProductInput,
  WorkspaceId,
} from '../types/master-data';

const PRODUCT_COLUMNS =
  'id,organization_id,sku,name,description,category,uom,unit_price,weight_kg,volume_m3,length_cm,width_cm,height_cm,hazmat,fragile,temperature_type,status,hsn_code,tax_rate,image_path,created_at,updated_at';

function mapRow(row: Record<string, unknown>): PlatformProduct {
  return {
    id: String(row.id),
    workspaceId: String(row.organization_id),
    sku: String(row.sku ?? ''),
    name: String(row.name ?? ''),
    description: (row.description as string | null) ?? null,
    category: String(row.category ?? 'FMCG'),
    uom: String(row.uom ?? 'unit'),
    unitPrice: Number(row.unit_price ?? 0),
    weightKg: Number(row.weight_kg ?? 0),
    volumeM3: Number(row.volume_m3 ?? 0),
    lengthCm: (row.length_cm as number | null) ?? null,
    widthCm: (row.width_cm as number | null) ?? null,
    heightCm: (row.height_cm as number | null) ?? null,
    hazmat: Boolean(row.hazmat),
    fragile: Boolean(row.fragile),
    temperatureType: String(row.temperature_type ?? 'ambient'),
    status: String(row.status ?? 'active'),
    hsnCode: (row.hsn_code as string | null) ?? null,
    taxRate: Number(row.tax_rate ?? 0),
    imagePath: (row.image_path as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export const productRepository = {
  async list(workspaceId: WorkspaceId): Promise<PlatformProduct[]> {
    const { data, error } = await requirePlatformDb()
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('organization_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  },

  async count(workspaceId: WorkspaceId): Promise<number> {
    const { count, error } = await requirePlatformDb()
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', workspaceId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async create(workspaceId: WorkspaceId, input: CreatePlatformProductInput): Promise<PlatformProduct> {
    const { data, error } = await requirePlatformDb()
      .from('products')
      .insert({
        organization_id: workspaceId,
        sku: input.sku,
        name: input.name,
        description: input.description,
        category: input.category,
        uom: input.uom ?? 'unit',
        unit_price: input.unitPrice,
        weight_kg: input.weightKg,
        volume_m3: input.volumeM3,
        length_cm: input.lengthCm,
        width_cm: input.widthCm,
        height_cm: input.heightCm,
        hazmat: input.hazmat ?? false,
        fragile: input.fragile ?? false,
        temperature_type: input.temperatureType ?? 'ambient',
        status: 'active',
        tax_rate: input.taxRate ?? 18,
        hsn_code: input.hsnCode,
        image_path: input.imagePath ?? null,
      })
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  },

  async update(
    workspaceId: WorkspaceId,
    productId: string,
    input: UpdatePlatformProductInput,
  ): Promise<PlatformProduct> {
    const patch: Record<string, unknown> = {};
    if (input.sku !== undefined) patch.sku = input.sku;
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.category !== undefined) patch.category = input.category;
    if (input.uom !== undefined) patch.uom = input.uom;
    if (input.unitPrice !== undefined) patch.unit_price = input.unitPrice;
    if (input.weightKg !== undefined) patch.weight_kg = input.weightKg;
    if (input.volumeM3 !== undefined) patch.volume_m3 = input.volumeM3;
    if (input.lengthCm !== undefined) patch.length_cm = input.lengthCm;
    if (input.widthCm !== undefined) patch.width_cm = input.widthCm;
    if (input.heightCm !== undefined) patch.height_cm = input.heightCm;
    if (input.hazmat !== undefined) patch.hazmat = input.hazmat;
    if (input.fragile !== undefined) patch.fragile = input.fragile;
    if (input.temperatureType !== undefined) patch.temperature_type = input.temperatureType;
    if (input.hsnCode !== undefined) patch.hsn_code = input.hsnCode;
    if (input.taxRate !== undefined) patch.tax_rate = input.taxRate;
    if (input.imagePath !== undefined) patch.image_path = input.imagePath;

    const { data, error } = await requirePlatformDb()
      .from('products')
      .update(patch)
      .eq('id', productId)
      .eq('organization_id', workspaceId)
      .is('deleted_at', null)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  },

  async softDelete(workspaceId: WorkspaceId, productId: string): Promise<void> {
    const { error } = await requirePlatformDb()
      .from('products')
      .update({ deleted_at: new Date().toISOString(), status: 'archived' })
      .eq('id', productId)
      .eq('organization_id', workspaceId);
    if (error) throw new Error(error.message);
  },
};
