import type { TimelineCommandEntry, TimelineEntry } from "../../../../contracts/src/timeline/timeline-entry";
import type { TimelineRepository } from "../../runtime/timelinePort";

export function createTimelineMemoryRepository(): TimelineRepository {
  const rows: TimelineEntry[] = [];
  return {
    appendCommand(entry: TimelineCommandEntry) {
      rows.push({ ...entry });
    },
    list() {
      return rows.map((row) => ({ ...row }));
    },
  };
}
