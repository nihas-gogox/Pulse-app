import { productRepository } from '../repositories/productRepository';
import type {
  CreatePlatformProductInput,
  PlatformProduct,
  UpdatePlatformProductInput,
  WorkspaceId,
} from '../types/master-data';

/** Platform product catalog — shared by Commerce, Core cargo refs, and future products. */
export const ProductService = {
  list(workspaceId: WorkspaceId): Promise<PlatformProduct[]> {
    return productRepository.list(workspaceId);
  },
  count(workspaceId: WorkspaceId): Promise<number> {
    return productRepository.count(workspaceId);
  },
  create(workspaceId: WorkspaceId, input: CreatePlatformProductInput): Promise<PlatformProduct> {
    return productRepository.create(workspaceId, input);
  },
  update(
    workspaceId: WorkspaceId,
    productId: string,
    input: UpdatePlatformProductInput,
  ): Promise<PlatformProduct> {
    return productRepository.update(workspaceId, productId, input);
  },
  delete(workspaceId: WorkspaceId, productId: string): Promise<void> {
    return productRepository.softDelete(workspaceId, productId);
  },
};
