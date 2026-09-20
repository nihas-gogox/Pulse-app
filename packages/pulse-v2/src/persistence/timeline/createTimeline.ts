import type { TimelineRepository } from "../../runtime/timelinePort";
import { createTimelineDurableRepository } from "./timelineDurable";
import { createTimelineMemoryRepository } from "./timelineMemory";

export type TimelinePersistenceConfig =
  | { mode: "memory" }
  | { mode: "local-durable"; dataDir: string };

export function createTimeline(config: TimelinePersistenceConfig): TimelineRepository {
  if (config.mode === "memory") {
    return createTimelineMemoryRepository();
  }
  return createTimelineDurableRepository(config.dataDir);
}
