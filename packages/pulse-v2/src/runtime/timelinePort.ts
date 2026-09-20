import type { TimelineCommandEntry, TimelineEntry } from "../../../../contracts/src/timeline/timeline-entry";

/**
 * Command-only Timeline persistence. Not authorization. Not Command Store.
 * list() is a local inspect/restart read, not a Gateway query API.
 */
export type TimelineRepository = {
  appendCommand(entry: TimelineCommandEntry): void;
  list(): TimelineEntry[];
};
