/**
 * Pulse mascot illustration set (`assets/illustrations`, uuid-named exports).
 *
 * Wide banner canvases. Setting width and height independently distorts the
 * drawing, so pair every render with the entry's `aspect` (see
 * `PulseMascotBanner`). The exported files carried `preserveAspectRatio="none"`
 * and `style="display:block"` (invalid in React Native); both were stripped.
 */
import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

import AuctionGavel from "@/assets/illustrations/a23577bc-e6e9-461c-8eb0-dfc8d23fa85a.svg";
import BiddingDesk from "@/assets/illustrations/a235771f-ac23-4bef-aada-220a30601c7c.svg";
import BoxTruckOnRoad from "@/assets/illustrations/a2355d4e-0d2d-42d6-925c-b4474a83276f.svg";
import BroadcastSignal from "@/assets/illustrations/a235613a-4b36-400c-8264-c02008cbb537.svg";
import CashDesk from "@/assets/illustrations/a2357077-0df9-4153-be46-21a25285bc8c.svg";
import DriverAtWarehouse from "@/assets/illustrations/a2356b5c-e668-4bc2-9f5f-eb2f79e483fd.svg";
import HaulageOutline from "@/assets/illustrations/a2356803-4df4-4bbc-a683-26a82a1ec5be.svg";
import LaptopAlert from "@/assets/illustrations/a2357313-0f9b-42a7-aef3-93da523fe047.svg";
import LaptopTracking from "@/assets/illustrations/a235742c-bce7-4ceb-a18d-1f847d2a5ad8.svg";
import LoadsPileUp from "@/assets/illustrations/a23562f6-3175-48ea-aee1-c1f15068862a.svg";
import MobileChat from "@/assets/illustrations/a2356c97-365a-4a86-9bc2-e3781580ce1e.svg";
import MoneyGrowth from "@/assets/illustrations/a23570e8-a950-4025-8b43-d99971733932.svg";
import PhoneVerifiedMessage from "@/assets/illustrations/a2356d32-aa30-4e84-a51f-ab57eb9ffb84.svg";
import SavingsDeposit from "@/assets/illustrations/a23571aa-eede-49cc-8fe8-29469f8f2aec.svg";
import SavingsPiggy from "@/assets/illustrations/a2357159-52e0-4ff2-8e1a-f6a675a86fef.svg";
import SendMessage from "@/assets/illustrations/a2356e3b-adc9-4370-be4e-24eae6b66098.svg";
import SpotlightCamera from "@/assets/illustrations/a2356452-95fc-4b1b-a7eb-46e6ba023382.svg";
import TabletTracking from "@/assets/illustrations/a2357390-006b-47ec-93aa-182d32f07438.svg";

export type PulseMascotIllustrationId =
  | "auctionGavel"
  | "biddingDesk"
  | "boxTruckOnRoad"
  | "broadcastSignal"
  | "cashDesk"
  | "driverAtWarehouse"
  | "haulageOutline"
  | "laptopAlert"
  | "laptopTracking"
  | "loadsPileUp"
  | "mobileChat"
  | "moneyGrowth"
  | "phoneVerifiedMessage"
  | "savingsDeposit"
  | "savingsPiggy"
  | "sendMessage"
  | "spotlightCamera"
  | "tabletTracking";

export type PulseMascotIllustration = {
  Art: ComponentType<SvgProps>;
  /** Source canvas width / height. */
  aspect: number;
  /** What the drawing shows, so callers can pick without opening the file. */
  description: string;
};

const WIDE = 1536 / 672;

export const PULSE_MASCOT_ILLUSTRATIONS: Record<
  PulseMascotIllustrationId,
  PulseMascotIllustration
> = {
  auctionGavel: {
    Art: AuctionGavel,
    aspect: WIDE,
    description: "Mascot at an auction podium holding a gavel",
  },
  biddingDesk: {
    Art: BiddingDesk,
    aspect: WIDE,
    description: "Mascot at a laptop raising a BID paddle",
  },
  boxTruckOnRoad: {
    Art: BoxTruckOnRoad,
    aspect: 1184 / 864,
    description: "Mascot driving a box truck on the road",
  },
  broadcastSignal: {
    Art: BroadcastSignal,
    aspect: 1632 / 640,
    description: "Mascot radiating out to chat, cloud, wifi and search nodes",
  },
  cashDesk: {
    Art: CashDesk,
    aspect: WIDE,
    description: "Mascot counting cash beside a laptop",
  },
  driverAtWarehouse: {
    Art: DriverAtWarehouse,
    aspect: WIDE,
    description: "Mascot in a driver cap in front of a truck and racking",
  },
  haulageOutline: {
    Art: HaulageOutline,
    aspect: WIDE,
    description: "Line-art articulated truck with a driver",
  },
  laptopAlert: {
    Art: LaptopAlert,
    aspect: WIDE,
    description: "Worried mascot at a laptop — error and empty states",
  },
  laptopTracking: {
    Art: LaptopTracking,
    aspect: WIDE,
    description: "Mascot leaning into a laptop showing a tracking map",
  },
  loadsPileUp: {
    Art: LoadsPileUp,
    aspect: WIDE,
    description: "Cheering mascot beside a truck stacked with boxes",
  },
  mobileChat: {
    Art: MobileChat,
    aspect: WIDE,
    description: "Mascot holding a phone with a chat bubble",
  },
  moneyGrowth: {
    Art: MoneyGrowth,
    aspect: WIDE,
    description: "Mascot holding cash next to a growing plant",
  },
  phoneVerifiedMessage: {
    Art: PhoneVerifiedMessage,
    aspect: WIDE,
    description: "Mascot with a phone and a confirmed message bubble",
  },
  savingsDeposit: {
    Art: SavingsDeposit,
    aspect: WIDE,
    description: "Mascot feeding a coin into a piggy bank",
  },
  savingsPiggy: {
    Art: SavingsPiggy,
    aspect: WIDE,
    description: "Mascot saving coins into a piggy bank at a laptop",
  },
  sendMessage: {
    Art: SendMessage,
    aspect: WIDE,
    description: "Mascot sending a message from a phone",
  },
  spotlightCamera: {
    Art: SpotlightCamera,
    aspect: WIDE,
    description: "Close-up mascot holding a camera",
  },
  tabletTracking: {
    Art: TabletTracking,
    aspect: WIDE,
    description: "Mascot holding a tablet with a delivery tracking map",
  },
};
