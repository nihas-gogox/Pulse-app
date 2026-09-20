import {
  resolveV2DatabaseTarget,
  V2EnvironmentIsolationError,
} from "../src/env/v2SupabaseEnv";
import { BLOCKED_V2_SUPABASE_PROJECT_REFS } from "../src/env/productionProjectRefs";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";

describe("V2 Supabase environment isolation", () => {
  it("does not use EXPO_PUBLIC_SUPABASE_URL even when it is production", () => {
    const target = resolveV2DatabaseTarget({
      EXPO_PUBLIC_SUPABASE_URL: `https://${BLOCKED_V2_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "not-used",
    });
    expect(target).toEqual({ mode: "memory", supabaseUrl: null });
  });

  it("rejects a blocked production project ref on PULSE_V2_SUPABASE_URL", () => {
    expect(() =>
      resolveV2DatabaseTarget({
        PULSE_V2_SUPABASE_URL: `https://${BLOCKED_V2_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
      }),
    ).toThrow(V2EnvironmentIsolationError);
  });

  it("rejects a blocked preprod project ref", () => {
    expect(() =>
      resolveV2DatabaseTarget({
        PULSE_V2_SUPABASE_URL: `https://${BLOCKED_V2_SUPABASE_PROJECT_REFS[1]}.supabase.co`,
      }),
    ).toThrow(/must not use production\/preprod/);
  });

  it("allows local Supabase without treating it as production", () => {
    const target = resolveV2DatabaseTarget({
      PULSE_V2_SUPABASE_URL: "http://127.0.0.1:54321",
      PULSE_V2_SUPABASE_ANON_KEY: "local-anon",
    });
    expect(target).toEqual({
      mode: "local-supabase",
      supabaseUrl: "http://127.0.0.1:54321",
    });
  });

  it("stops even when hosted allow-flags are set (no provisioning in this slice)", () => {
    expect(() =>
      resolveV2DatabaseTarget({
        PULSE_V2_SUPABASE_URL: "https://abcdxyzhostedv2xx.supabase.co",
        PULSE_V2_ALLOW_HOSTED: "1",
        PULSE_V2_HOSTED_PROJECT_REF: "abcdxyzhostedv2xx",
      }),
    ).toThrow(/not provisioned/);
  });

  it("gateway refuses to boot against production", () => {
    expect(() =>
      createPulseV2Gateway(
        {
          PULSE_V2_SUPABASE_URL: `https://${BLOCKED_V2_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
        },
        {
          identityPort: {
            resolveActor: () => ({ ok: false, reason: "not_found" }),
            resolveMembership: () => ({ ok: false, reason: "not_found" }),
            createWorkspace: () => ({ ok: false, reason: "not_implemented" }),
          },
        },
      ),
    ).toThrow(V2EnvironmentIsolationError);
  });
});
