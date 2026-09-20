import {
  applyIndentCommerceOrigin,
  indentIdsForCommerceLookup,
} from '@/features/trips/utils/applyIndentCommerceOrigin';

describe('applyIndentCommerceOrigin', () => {
  const freight = {
    id: 't-freight',
    indent_id: 'indent-freight',
    source_indent_id: null as string | null,
    is_commerce: false,
  };
  const commerce = {
    id: 't-commerce',
    indent_id: 'indent-plan',
    source_indent_id: null as string | null,
    is_commerce: false,
  };

  it('collects indent ids without inventing lookups', () => {
    expect(indentIdsForCommerceLookup([freight, commerce])).toEqual([
      'indent-freight',
      'indent-plan',
    ]);
  });

  it('stamps is_commerce from indent execution_plan_id only', () => {
    const stamped = applyIndentCommerceOrigin([freight, commerce], [
      { id: 'indent-freight', execution_plan_id: null },
      { id: 'indent-plan', execution_plan_id: 'plan-1' },
    ]);
    expect(stamped[0].is_commerce).toBe(false);
    expect(stamped[1].is_commerce).toBe(true);
    expect(stamped[1].execution_plan_id).toBe('plan-1');
  });

  it('keeps an already-true trip flag when indent rows are empty', () => {
    const stamped = applyIndentCommerceOrigin(
      [{ ...commerce, is_commerce: true }],
      [],
    );
    expect(stamped[0].is_commerce).toBe(true);
  });
});
