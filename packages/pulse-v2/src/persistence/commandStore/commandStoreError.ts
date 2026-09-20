export type CommandStoreErrorCode =
  | "COMMAND_STORE_NOT_FOUND"
  | "COMMAND_STORE_INVALID_TRANSITION";

export class CommandStoreError extends Error {
  readonly code: CommandStoreErrorCode;
  constructor(code: CommandStoreErrorCode, message: string) {
    super(message);
    this.name = "CommandStoreError";
    this.code = code;
  }
}

export function isCommandStoreError(err: unknown): err is CommandStoreError {
  return err instanceof CommandStoreError;
}
