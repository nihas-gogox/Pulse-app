import path from "node:path";
import { assertV2ForbiddenImports, scanV2ForbiddenImports } from "../src/architecture/v2ImportGuard";

const SRC = path.join(__dirname, "../src");

describe("V2 does not import production Pulse", () => {
  it("has no imports of features/, lib/supabase, or packages/platform/identity", () => {
    expect(scanV2ForbiddenImports(SRC)).toEqual([]);
    expect(() => assertV2ForbiddenImports(SRC)).not.toThrow();
  });
});
