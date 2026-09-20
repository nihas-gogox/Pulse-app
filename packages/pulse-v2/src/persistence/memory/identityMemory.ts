import type { IdentityRepository, IdentityAuthSubjectRow } from "../../domains/identity/repository";
import type { MembershipRecord } from "../../identity/identityPort";
import { V2PersistenceError } from "../v2PersistenceError";

type MemoryState = {
  subjects: IdentityAuthSubjectRow[];
  actors: Array<{ actorId: string }>;
  workspaces: Array<{ workspaceId: string }>;
  memberships: MembershipRecord[];
  slots: Array<{
    slotKey: string;
    workspaceId: string;
    membershipId: string;
    actorId: string;
  }>;
  nextId: number;
};

export function createIdentityMemoryRepository(): IdentityRepository {
  const state: MemoryState = {
    subjects: [],
    actors: [],
    workspaces: [],
    memberships: [],
    slots: [],
    nextId: 0,
  };

  return {
    getActorIdBySubject(subjectId: string) {
      return state.subjects.find((row) => row.subjectId === subjectId)?.actorId ?? null;
    },
    createActor() {
      state.nextId += 1;
      const actorId = `actor-${state.nextId}`;
      state.actors.push({ actorId });
      return actorId;
    },
    bindSubject(subjectId: string, actorId: string) {
      if (state.subjects.some((row) => row.subjectId === subjectId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      if (state.subjects.some((row) => row.actorId === actorId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      state.subjects.push({ subjectId, actorId });
    },
    listMembershipsForActor(actorId: string) {
      return state.memberships.filter((row) => row.actorId === actorId);
    },
    getMembership(membershipId: string) {
      return state.memberships.find((row) => row.membershipId === membershipId) ?? null;
    },
    insertWorkspace(workspaceId: string) {
      if (state.workspaces.some((row) => row.workspaceId === workspaceId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      state.workspaces.push({ workspaceId });
    },
    insertMembership(membership: MembershipRecord) {
      if (state.memberships.some((row) => row.membershipId === membership.membershipId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      state.memberships.push(membership);
    },
    allocateId(prefix: string) {
      state.nextId += 1;
      return `${prefix}-${state.nextId}`;
    },
    getCreateSlot(slotKey: string) {
      return state.slots.find((row) => row.slotKey === slotKey) ?? null;
    },
    putCreateSlot(slot) {
      if (state.slots.some((row) => row.slotKey === slot.slotKey)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      state.slots.push(slot);
    },
    commitWorkspaceBootstrap(input) {
      this.insertWorkspace(input.workspaceId);
      this.insertMembership(input.membership);
      this.putCreateSlot(input.slot);
    },
  };
}
