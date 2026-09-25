import { customerRepository } from '../repositories/customerRepository';
import type { UpdateClientHubProfileInput } from '../types/client-hub-profile';
import type {
  CreatePlatformCustomerInput,
  PlatformCustomer,
  UpdatePlatformCustomerInput,
  WorkspaceId,
} from '../types/master-data';

/** Platform customer access — Core (Clients) and Commerce (Consignees) use the same records. */
export const CustomerService = {
  list(workspaceId: WorkspaceId): Promise<PlatformCustomer[]> {
    return customerRepository.list(workspaceId);
  },
  count(workspaceId: WorkspaceId): Promise<number> {
    return customerRepository.count(workspaceId);
  },
  create(workspaceId: WorkspaceId, input: CreatePlatformCustomerInput): Promise<PlatformCustomer> {
    return customerRepository.create(workspaceId, input);
  },
  update(
    workspaceId: WorkspaceId,
    customerId: string,
    input: UpdatePlatformCustomerInput,
  ): Promise<PlatformCustomer> {
    return customerRepository.update(workspaceId, customerId, input);
  },
  delete(workspaceId: WorkspaceId, customerId: string): Promise<void> {
    return customerRepository.softDelete(workspaceId, customerId);
  },

  /** Core adapter — full client row shape (same table, richer columns). */
  listClientRecords(workspaceId: WorkspaceId): Promise<Record<string, unknown>[]> {
    return customerRepository.listClientRecords(workspaceId);
  },
  listClientRecordsWithProfiles(workspaceId: WorkspaceId): Promise<Record<string, unknown>[]> {
    return customerRepository.listClientRecordsWithProfiles(workspaceId);
  },
  findClientRecord(workspaceId: WorkspaceId, customerId: string): Promise<Record<string, unknown> | null> {
    return customerRepository.findClientRecord(workspaceId, customerId);
  },
  findClientByName(workspaceId: WorkspaceId, name: string): Promise<Record<string, unknown> | null> {
    return customerRepository.findClientByName(workspaceId, name);
  },
  findClientByPhone(workspaceId: WorkspaceId, phone: string): Promise<Record<string, unknown> | null> {
    return customerRepository.findClientByPhone(workspaceId, phone);
  },
  createClientRecord(workspaceId: WorkspaceId, input: CreatePlatformCustomerInput): Promise<Record<string, unknown>> {
    return customerRepository.createClientRecord(workspaceId, input);
  },
  updateClientRecord(
    workspaceId: WorkspaceId,
    customerId: string,
    input: UpdatePlatformCustomerInput,
  ): Promise<Record<string, unknown> | null> {
    return customerRepository.updateClientRecord(workspaceId, customerId, input);
  },
  updateHubProfile(
    workspaceId: WorkspaceId,
    customerId: string,
    input: UpdateClientHubProfileInput,
  ): Promise<void> {
    return customerRepository.updateHubProfile(workspaceId, customerId, input);
  },
};
