export type V2PersistenceErrorKind = "duplicate" | "io";

export class V2PersistenceError extends Error {
  readonly code = "V2_PERSISTENCE_FAILED";
  readonly kind: V2PersistenceErrorKind;
  constructor(
    message: string,
    options?: { cause?: unknown; kind?: V2PersistenceErrorKind },
  ) {
    super(message);
    this.name = "V2PersistenceError";
    this.kind = options?.kind ?? "io";
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isV2PersistenceError(err: unknown): err is V2PersistenceError {
  return err instanceof V2PersistenceError;
}
