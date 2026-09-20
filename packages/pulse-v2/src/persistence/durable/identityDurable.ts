import type { IdentityRepository } from "../../domains/identity/repository";
import type { MembershipRecord } from "../../identity/identityPort";
import { V2PersistenceError } from "../v2PersistenceError";
import {
  identityStorePath,
  readJsonDocument,
  writeJsonDocument,
} from "./jsonTable";

type DurableIdentityStore = {
  auth_subjects: Array<{ subjectId: string; actorId: string }>;
  actors: Array<{ actorId: string }>;
  workspaces: Array<{ workspaceId: string }>;
  memberships: MembershipRecord[];
  create_slots: Array<{
    slotKey: string;
    workspaceId: string;
    membershipId: string;
    actorId: string;
  }>;
  nextId: number;
};

const EMPTY: DurableIdentityStore = {
  auth_subjects: [],
  actors: [],
  workspaces: [],
  memberships: [],
  create_slots: [],
  nextId: 0,
};

export function createIdentityDurableRepository(dataDir: string): IdentityRepository {
  const filePath = identityStorePath(dataDir);

  const load = (): DurableIdentityStore => {
    const doc = readJsonDocument<DurableIdentityStore>(filePath, EMPTY);
    return {
      auth_subjects: Array.isArray(doc.auth_subjects) ? doc.auth_subjects : [],
      actors: Array.isArray(doc.actors) ? doc.actors : [],
      workspaces: Array.isArray(doc.workspaces) ? doc.workspaces : [],
      memberships: Array.isArray(doc.memberships) ? doc.memberships : [],
      create_slots: Array.isArray(doc.create_slots) ? doc.create_slots : [],
      nextId: typeof doc.nextId === "number" ? doc.nextId : 0,
    };
  };

  const save = (store: DurableIdentityStore): void => {
    writeJsonDocument(filePath, store);
  };

  return {
    getActorIdBySubject(subjectId: string) {
      return load().auth_subjects.find((row) => row.subjectId === subjectId)?.actorId ?? null;
    },
    createActor() {
      const store = load();
      store.nextId += 1;
      const actorId = `actor-${store.nextId}`;
      store.actors.push({ actorId });
      save(store);
      return actorId;
    },
    bindSubject(subjectId: string, actorId: string) {
      const store = load();
      if (store.auth_subjects.some((row) => row.subjectId === subjectId || row.actorId === actorId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      store.auth_subjects.push({ subjectId, actorId });
      save(store);
    },
    listMembershipsForActor(actorId: string) {
      return load().memberships.filter((row) => row.actorId === actorId);
    },
    getMembership(membershipId: string) {
      return load().memberships.find((row) => row.membershipId === membershipId) ?? null;
    },
    insertWorkspace(workspaceId: string) {
      const store = load();
      if (store.workspaces.some((row) => row.workspaceId === workspaceId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      store.workspaces.push({ workspaceId });
      save(store);
    },
    insertMembership(membership: MembershipRecord) {
      const store = load();
      if (store.memberships.some((row) => row.membershipId === membership.membershipId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      store.memberships.push(membership);
      save(store);
    },
    allocateId(prefix: string) {
      const store = load();
      store.nextId += 1;
      const id = `${prefix}-${store.nextId}`;
      save(store);
      return id;
    },
    getCreateSlot(slotKey: string) {
      return load().create_slots.find((row) => row.slotKey === slotKey) ?? null;
    },
    putCreateSlot(slot) {
      const store = load();
      if (store.create_slots.some((row) => row.slotKey === slot.slotKey)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      store.create_slots.push(slot);
      save(store);
    },
    commitWorkspaceBootstrap(input) {
      const store = load();
      if (store.workspaces.some((row) => row.workspaceId === input.workspaceId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      if (store.memberships.some((row) => row.membershipId === input.membership.membershipId)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      if (store.create_slots.some((row) => row.slotKey === input.slot.slotKey)) {
        throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
      }
      store.workspaces.push({ workspaceId: input.workspaceId });
      store.memberships.push(input.membership);
      store.create_slots.push(input.slot);
      save(store);
    },
  };
}
