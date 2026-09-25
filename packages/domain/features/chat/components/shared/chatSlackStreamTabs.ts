import type { SlackStreamTabId } from "@pulse/features/features/chat/components/mobile/ChatSlackMobileChrome";
import { Briefcase, Hash, MessageSquare } from "lucide-react-native";
import type { ComponentType } from "react";

export type SlackStreamTabDef = {
  id: SlackStreamTabId;
  /** Mobile bottom nav label */
  shortLabel: string;
  /** Desktop sidebar label */
  longLabel: string;
  Icon: ComponentType<{ size: number; color: string; strokeWidth?: number }>;
};

export const SLACK_STREAM_TABS: SlackStreamTabDef[] = [
  { id: "network", shortLabel: "DMs", longLabel: "Direct messages", Icon: MessageSquare },
  { id: "trips", shortLabel: "Trips", longLabel: "Manual trips", Icon: Hash },
  { id: "indent", shortLabel: "Integrated", longLabel: "Integrated trips", Icon: Briefcase },
];
