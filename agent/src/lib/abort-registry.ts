const registry = new Map<string, AbortController>();

export function createAbortController(commandId: string): AbortController {
  const existing = registry.get(commandId);
  if (existing) return existing;
  const controller = new AbortController();
  registry.set(commandId, controller);
  return controller;
}

export function abortCommand(commandId: string): boolean {
  const controller = registry.get(commandId);
  if (!controller) return false;
  controller.abort();
  registry.delete(commandId);
  return true;
}

export function cleanupAbortController(commandId: string): void {
  registry.delete(commandId);
}
