import { warehouseRepository } from '../repositories/warehouseRepository';
import type {
  CreatePlatformWarehouseInput,
  PlatformWarehouse,
  UpdatePlatformWarehouseInput,
  WorkspaceId,
} from '../../../../../lib/platform/types/master-data';

export const WarehouseService = {
  list(workspaceId: WorkspaceId): Promise<PlatformWarehouse[]> {
    return warehouseRepository.list(workspaceId);
  },
  count(workspaceId: WorkspaceId): Promise<number> {
    return warehouseRepository.count(workspaceId);
  },
  create(workspaceId: WorkspaceId, input: CreatePlatformWarehouseInput): Promise<PlatformWarehouse> {
    return warehouseRepository.create(workspaceId, input);
  },
  update(
    workspaceId: WorkspaceId,
    warehouseId: string,
    input: UpdatePlatformWarehouseInput,
  ): Promise<PlatformWarehouse> {
    return warehouseRepository.update(workspaceId, warehouseId, input);
  },
  delete(workspaceId: WorkspaceId, warehouseId: string): Promise<void> {
    return warehouseRepository.softDelete(workspaceId, warehouseId);
  },

  /** Core adapter — full warehouse row shape (same table, richer columns). */
  listWarehouseRecordsByClient(
    workspaceId: WorkspaceId,
    clientId: string,
  ): Promise<Record<string, unknown>[]> {
    return warehouseRepository.listWarehouseRecordsByClient(workspaceId, clientId);
  },
  findWarehouseRecordById(warehouseId: string): Promise<Record<string, unknown> | null> {
    return warehouseRepository.findWarehouseRecordById(warehouseId);
  },
  createWarehouseRecord(
    workspaceId: WorkspaceId,
    input: CreatePlatformWarehouseInput,
  ): Promise<Record<string, unknown>> {
    return warehouseRepository.createWarehouseRecord(workspaceId, input);
  },
  updateWarehouseRecord(
    workspaceId: WorkspaceId,
    warehouseId: string,
    input: UpdatePlatformWarehouseInput,
  ): Promise<Record<string, unknown> | null> {
    return warehouseRepository.updateWarehouseRecord(workspaceId, warehouseId, input);
  },
  async updateWarehouseRecordById(
    warehouseId: string,
    input: UpdatePlatformWarehouseInput,
  ): Promise<Record<string, unknown> | null> {
    const existing = await warehouseRepository.findWarehouseRecordById(warehouseId);
    if (!existing) return null;
    return warehouseRepository.updateWarehouseRecord(
      String(existing.organization_id),
      warehouseId,
      input,
    );
  },
  async deleteWarehouseRecordById(warehouseId: string): Promise<void> {
    const existing = await warehouseRepository.findWarehouseRecordById(warehouseId);
    if (!existing) return;
    await warehouseRepository.softDelete(String(existing.organization_id), warehouseId);
  },
};
