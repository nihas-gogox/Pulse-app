import type { MembershipRecord } from "../../identity/identityPort";

export type IdentityAuthSubjectRow = {
  subjectId: string;
  actorId: string;
};

export type IdentityActorRow = {
  actorId: string;
};

export type IdentityWorkspaceRow = {
  workspaceId: string;
};

export type IdentityCreateSlotRow = {
  slotKey: string;
  workspaceId: string;
  membershipId: string;
  actorId: string;
};

export type IdentityRepository = {
  getActorIdBySubject: (subjectId: string) => string | null;
  createActor: () => string;
  bindSubject: (subjectId: string, actorId: string) => void;
  listMembershipsForActor: (actorId: string) => MembershipRecord[];
  getMembership: (membershipId: string) => MembershipRecord | null;
  insertWorkspace: (workspaceId: string) => void;
  insertMembership: (membership: MembershipRecord) => void;
  allocateId: (prefix: string) => string;
  getCreateSlot: (slotKey: string) => IdentityCreateSlotRow | null;
  putCreateSlot: (slot: IdentityCreateSlotRow) => void;
  commitWorkspaceBootstrap: (input: {
    workspaceId: string;
    membership: MembershipRecord;
    slot: IdentityCreateSlotRow;
  }) => void;
};
