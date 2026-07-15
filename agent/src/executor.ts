export interface CommandHandler {
  onProgress: (stage: string, message: string) => void;
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
}

export async function executeCommand(_cmd: any, _hooks: any): Promise<string | undefined> {
  throw new Error('executor not implemented yet (M3)');
}
