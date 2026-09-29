import { expect, test, type Page, type Route } from '@playwright/test';
import { signIn } from '../support/auth';

/**
 * E2E (Playwright / web): Compliance Table view — Dinesh sir's changes
 * (docs/compliance/dinesh/CONTRACT.md AC-1, AC-9, AC-13, AC-16..AC-29).
 *
 * Needs the dedicated QA identity from e2e/.env.e2e (E2E_EMAIL / E2E_PASSWORD) and an
 * org with at least one unverified trip in Compliance Pending; skipped otherwise.
 *
 * SAFETY: this spec never writes to the database. Every compliance write RPC
 * (decline_trip_compliance, mark_trip_compliance_verified) is intercepted with
 * page.route and fulfilled locally, so it can run against the shared project.
 * The decline migration isn't applied yet, so the real RPC wouldn't exist anyway.
 * Reads (trips / trip_documents) still hit the linked project read-only.
 */

const HAS_QA_IDENTITY = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

const DECLINE_RPC = '**/rest/v1/rpc/decline_trip_compliance';
const VERIFY_RPC = '**/rest/v1/rpc/mark_trip_compliance_verified';

type RpcCall = { body: Record<string, unknown> };

async function interceptRpc(
  page: Page,
  pattern: string,
  respond: (call: RpcCall, n: number) => { status: number; body: unknown },
): Promise<RpcCall[]> {
  const calls: RpcCall[] = [];
  await page.route(pattern, async (route: Route) => {
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    calls.push({ body });
    const { status, body: resBody } = respond({ body }, calls.length);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(resBody) });
  });
  return calls;
}

async function openTable(page: Page): Promise<void> {
  await page.goto('/compliance');
  await page.getByLabel('Table view').first().click();
  await expect(page.getByText('E-way Bill', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

/** First row that still offers Decline (unverified trip); skips the test when there is none. */
async function firstDeclinableTripId(page: Page): Promise<string> {
  const decline = page.locator('[data-testid^="compliance-decline-"]');
  const first = decline.first();
  const visible = await first.isVisible().catch(() => false);
  test.skip(!visible, 'No unverified trip with Decline in this org — seed one Compliance Pending trip.');
  const id = (await first.getAttribute('data-testid'))!.replace('compliance-decline-', '');
  return id;
}

test.describe('Compliance table view', () => {
  test.skip(!HAS_QA_IDENTITY, 'Needs E2E_EMAIL / E2E_PASSWORD (dedicated QA identity) in e2e/.env.e2e');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('columns and actions: E-way Bill between To and Trip; no Verify Docs / View Trip', async ({ page }) => {
    await openTable(page);
    const headers = await page.getByText(/^(From|To|E-way Bill|Trip|Vehicle|Driver)$/).allInnerTexts();
    const order = ['From', 'To', 'E-way Bill', 'Trip', 'Vehicle', 'Driver'];
    expect(headers.slice(0, order.length)).toEqual(order);
    await expect(page.getByText('Verify Docs', { exact: true })).toHaveCount(0);
    await expect(page.getByText('View Trip', { exact: true })).toHaveCount(0);
  });

  test('status pill opens the scoped review sheet and closes back to the table', async ({ page }) => {
    await openTable(page);
    const pill = page.locator('[data-testid^="compliance-status-trip-"]').first();
    await expect(pill).toHaveText(/Pending|Approved/);
    await pill.click();
    const close = page.getByLabel('Close', { exact: true }).last();
    await expect(close).toBeVisible();
    await close.click();
    await expect(pill).toBeVisible();
  });

  test('decline: short reason blocked, cancel makes no RPC call', async ({ page }) => {
    const calls = await interceptRpc(page, DECLINE_RPC, () => ({ status: 204, body: null }));
    await openTable(page);
    const tripId = await firstDeclinableTripId(page);
    await page.getByTestId(`compliance-decline-${tripId}`).click();
    const input = page.getByTestId('compliance-decline-reason-input');
    await expect(input).toBeVisible();
    await input.pressSequentially('ab');
    await expect(page.getByTestId('compliance-decline-submit')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('compliance-decline-cancel').click();
    await expect(page.getByTestId('compliance-decline-modal')).toHaveCount(0);
    expect(calls).toHaveLength(0);
  });

  test('decline: success sends trimmed reason once, shows Declined pill, trip stays pending', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls: RpcCall[] = [];
    await page.route(DECLINE_RPC, async (route) => {
      calls.push({ body: (route.request().postDataJSON() ?? {}) as Record<string, unknown> });
      await gate;
      await route.fulfill({ status: 204, body: '' });
    });
    page.on('dialog', (d) => void d.accept());

    await openTable(page);
    const tripId = await firstDeclinableTripId(page);
    await page.getByTestId(`compliance-decline-${tripId}`).click();
    await page.getByTestId('compliance-decline-reason-input').pressSequentially('  E2E: LR is blurry  ');
    const submit = page.getByTestId('compliance-decline-submit');
    await submit.click();
    // Duplicate submission while in flight is ignored.
    await expect(submit).toHaveText('Submitting…');
    await submit.click({ force: true }).catch(() => {});
    release();

    await expect(page.getByTestId('compliance-decline-modal')).toHaveCount(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ p_trip_id: tripId, p_reason: 'E2E: LR is blurry' });
    expect(typeof calls[0].body.p_idempotency_key).toBe('string');
    await expect(page.getByTestId(`compliance-declined-${tripId}`)).toContainText('Declined');
    // Still offers Verify/Decline → still in Compliance Pending.
    await expect(page.getByTestId(`compliance-decline-${tripId}`)).toBeVisible();
  });

  test('decline failure (not authorized) keeps modal open with reason; retry reuses the idempotency key', async ({ page }) => {
    const calls = await interceptRpc(page, DECLINE_RPC, () => ({
      status: 400,
      body: { code: 'P0001', message: 'not authorized to decline compliance for this organization' },
    }));
    await openTable(page);
    const tripId = await firstDeclinableTripId(page);
    await page.getByTestId(`compliance-decline-${tripId}`).click();
    const input = page.getByTestId('compliance-decline-reason-input');
    await input.pressSequentially('E2E unauthorized');
    await page.getByTestId('compliance-decline-submit').click();
    await expect(page.getByTestId('compliance-decline-error')).toHaveText(
      "You don't have permission to decline compliance for this trip.",
    );
    await expect(input).toHaveValue('E2E unauthorized');
    await page.getByTestId('compliance-decline-submit').click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1].body.p_idempotency_key).toBe(calls[0].body.p_idempotency_key);
    await expect(page.getByTestId(`compliance-declined-${tripId}`)).toHaveCount(0);
  });

  test('refresh: table reloads without losing the view data', async ({ page }) => {
    await openTable(page);
    await page.reload();
    await page.getByLabel('Table view').first().click();
    await expect(page.getByText('E-way Bill', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('verify failure shows the server error and the row stays', async ({ page }) => {
    const calls = await interceptRpc(page, VERIFY_RPC, () => ({
      status: 400,
      body: { code: 'P0001', message: 'required documents not yet verified: {lr}' },
    }));
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.accept();
    });
    await openTable(page);
    const enabled = page.locator('[data-testid^="compliance-verify-"]:not([aria-disabled="true"])').first();
    test.skip(!(await enabled.isVisible().catch(() => false)), 'No trip with all trip docs approved.');
    const testId = (await enabled.getAttribute('data-testid'))!;
    await enabled.click();
    await expect.poll(() => calls.length).toBe(1);
    await expect(page.getByTestId(testId)).toHaveText('Verify');
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  });
});
