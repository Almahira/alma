import { Command, CommandHandler } from "../cqrs/types";
import { globalLedger } from "../ledger/UniversalLedger";
import { ulid } from "ulidx";

const ACTOR = { userId: "SYS_ADMIN", role: "SUPER_ADMIN" };

export const dictionaryCommandHandlers: CommandHandler[] = [
  {
    commandType: "CREATE_DICTIONARY",
    execute: async (cmd: Command) => {
      const newId = `AGG_${ulid()}`;
      await globalLedger.appendEvent(
        "DICTIONARY_CREATED",
        newId,
        "DICTIONARY",
        1,
        cmd.payload,
        ACTOR,
      );
    },
  },
  {
    commandType: "UPDATE_DICTIONARY",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "DICTIONARY_UPDATED",
        cmd.payload.id,
        "DICTIONARY",
        nextVer,
        cmd.payload,
        ACTOR,
      );
    },
  },
  {
    commandType: "ARCHIVE_DICTIONARY",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "DICTIONARY_ARCHIVED",
        cmd.payload.id,
        "DICTIONARY",
        nextVer,
        {},
        ACTOR,
      );
    },
  },
  {
    commandType: "MERGE_DICTIONARY",
    execute: async (cmd: Command) => {
      // payload = { sourceId, targetId, category, sourceValue, targetValue }
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.sourceId)) + 1;
      await globalLedger.appendEvent(
        "DICTIONARY_MERGED",
        cmd.payload.sourceId,
        "DICTIONARY",
        nextVer,
        cmd.payload,
        ACTOR,
      );
    },
  },
];
