import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '../../../..');

describe('create_execution_plan_with_graph order-claim contract', () => {
  const migration = readFileSync(
    join(repoRoot, 'supabase/migrations/20270915101200_claim_sales_orders_in_execution_plan_graph.sql'),
    'utf8',
  );
  const orchestrator = readFileSync(
    join(repoRoot, 'packages/domain/lib/platform/orchestration/ExecutionOrchestrator.ts'),
    'utf8',
  );

  it('claims sales orders inside the existing graph RPC (no new RPC / p_order_ids)', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_execution_plan_with_graph(');
    expect(migration).toContain('p_org_id uuid');
    expect(migration).toContain('p_client_plan_id text');
    expect(migration).toContain('p_allocations jsonb');
    expect(migration).toContain('p_orders jsonb');
    expect(migration).not.toContain('p_order_ids');
    expect(migration).toContain("AND execution_plan_id IS NULL");
    expect(migration).toContain("AND status = 'Pending Consolidation'");
    expect(migration).toContain('GET DIAGNOSTICS v_claimed = ROW_COUNT');
    expect(migration).toContain('Could not claim all selected sales orders for this execution plan');
  });

  it('derives the claim set from allocation orderIds, matching p_orders', () => {
    expect(migration).toContain("SELECT DISTINCT (a->>'orderId')::uuid");
    expect(migration).toContain("SELECT DISTINCT (o->>'orderId')::uuid");
    expect(migration).toContain('Order payload does not match shipment allocations');
  });

  it('does not re-claim on same-plan correlation retry', () => {
    expect(migration).toContain('ep.correlation_id = p_client_plan_id');
    expect(migration).toContain('RETURN QUERY SELECT v_plan_id, v_plan_number');
  });

  it('Convert path does not call markPlannedForExecutionPlan after the RPC', () => {
    expect(orchestrator).not.toMatch(/OrderService\.markPlannedForExecutionPlan/);
  });
});
