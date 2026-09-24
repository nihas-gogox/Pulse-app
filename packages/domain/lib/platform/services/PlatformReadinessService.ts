import { CustomerService } from './CustomerService';
import { ProductService } from './ProductService';
import { WarehouseService } from './WarehouseService';
import type { WorkspaceId } from '../../../../../lib/platform/types/master-data';

export type PlatformSetupEvaluation = {
  setupComplete: boolean;
  nextStep?: string;
  counts: {
    customers: number;
    warehouses: number;
    products: number;
  };
};

async function evaluateCommerceSetup(workspaceId: WorkspaceId): Promise<PlatformSetupEvaluation> {
  const [customers, warehouses, products] = await Promise.all([
    CustomerService.count(workspaceId),
    WarehouseService.count(workspaceId),
    ProductService.count(workspaceId),
  ]);

  const setupComplete = customers > 0 && warehouses > 0 && products > 0;
  let nextStep: string | undefined;
  if (!setupComplete) {
    if (warehouses === 0) nextStep = '/warehouses';
    else if (products === 0) nextStep = '/products';
    else if (customers === 0) nextStep = '/customers';
  }

  return {
    setupComplete,
    nextStep,
    counts: { customers, warehouses, products },
  };
}

/** Centralized product setup readiness — queries platform services, not local state. */
export const PlatformReadinessService = {
  async evaluate(productId: 'commerce', workspaceId: WorkspaceId): Promise<PlatformSetupEvaluation> {
    if (productId === 'commerce') {
      return evaluateCommerceSetup(workspaceId);
    }
    return {
      setupComplete: true,
      counts: { customers: 0, warehouses: 0, products: 0 },
    };
  },
};
