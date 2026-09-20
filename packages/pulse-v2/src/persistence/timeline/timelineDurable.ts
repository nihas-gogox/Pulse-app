import type { TimelineCommandEntry, TimelineEntry } from "../../../../contracts/src/timeline/timeline-entry";
import { readJsonTable, timelineTablePath, writeJsonTable } from "../durable/jsonTable";
import type { TimelineRepository } from "../../runtime/timelinePort";

export function createTimelineDurableRepository(dataDir: string): TimelineRepository {
  const filePath = timelineTablePath(dataDir);
  return {
    appendCommand(entry: TimelineCommandEntry) {
      const rows = readJsonTable<TimelineEntry>(filePath);
      writeJsonTable(filePath, [...rows, { ...entry }]);
    },
    list() {
      return readJsonTable<TimelineEntry>(filePath).map((row) => ({ ...row }));
    },
  };
}
