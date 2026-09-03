// File: packages/core_unv/src/cqrs/CommandBus.ts
import { Command, CommandHandler } from "./types";
import { CommandGuard } from "./CommandGuard";

export class CommandBus {
  private handlers = new Map<string, CommandHandler>();

  public register(handler: CommandHandler): void {
    if (this.handlers.has(handler.commandType)) {
      console.warn(
        `[COMMAND BUS] Menimpa handler untuk command: ${handler.commandType}`,
      );
    }
    this.handlers.set(handler.commandType, handler);
    console.log(`[COMMAND BUS] Registered Command: ${handler.commandType}`);
  }

  public async execute(command: Command): Promise<void> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(
        `[COMMAND BUS] Tidak ada handler untuk command: ${command.type}`,
      );
    }
    // === PEMERIKSAAN SATPAM GEDUNG UNIVERSAL ===
    CommandGuard.validate(command);
    await handler.execute(command);
  }
}

export const globalCommandBus = new CommandBus();
