import test from "node:test";
import assert from "node:assert/strict";

const { canRemoveProjectMember, canTransferOwnershipToMember } = await import(
  new URL("./member-governance.ts", import.meta.url).href
);

const activeOwner = {
  id: "owner-member-id",
  role: "owner",
  membershipStatus: "active",
} as const;

const activeManager = {
  id: "manager-member-id",
  role: "manager",
  membershipStatus: "active",
} as const;

const activeMember = {
  id: "member-member-id",
  role: "member",
  membershipStatus: "active",
} as const;

const pendingMember = {
  id: "pending-member-id",
  role: "member",
  membershipStatus: "pending_invite",
} as const;

test("owners can transfer ownership only to another active member", () => {
  assert.equal(
    canTransferOwnershipToMember({
      liveModeEnabled: true,
      canTransferOwnership: true,
      viewerProjectMemberId: activeOwner.id,
      member: activeManager,
    }),
    true
  );

  assert.equal(
    canTransferOwnershipToMember({
      liveModeEnabled: true,
      canTransferOwnership: true,
      viewerProjectMemberId: activeOwner.id,
      member: activeOwner,
    }),
    false
  );

  assert.equal(
    canTransferOwnershipToMember({
      liveModeEnabled: true,
      canTransferOwnership: true,
      viewerProjectMemberId: activeOwner.id,
      member: pendingMember,
    }),
    false
  );

  assert.equal(
    canTransferOwnershipToMember({
      liveModeEnabled: false,
      canTransferOwnership: true,
      viewerProjectMemberId: activeOwner.id,
      member: activeManager,
    }),
    false
  );
});

test("owners can remove managers and members, but not themselves or owners", () => {
  assert.equal(
    canRemoveProjectMember({
      liveModeEnabled: true,
      viewerProjectMemberId: activeOwner.id,
      viewerRole: "owner",
      member: activeManager,
    }),
    true
  );

  assert.equal(
    canRemoveProjectMember({
      liveModeEnabled: true,
      viewerProjectMemberId: activeOwner.id,
      viewerRole: "owner",
      member: activeMember,
    }),
    true
  );

  assert.equal(
    canRemoveProjectMember({
      liveModeEnabled: true,
      viewerProjectMemberId: activeOwner.id,
      viewerRole: "owner",
      member: activeOwner,
    }),
    false
  );
});

test("managers can remove only active regular members", () => {
  assert.equal(
    canRemoveProjectMember({
      liveModeEnabled: true,
      viewerProjectMemberId: activeManager.id,
      viewerRole: "manager",
      member: activeMember,
    }),
    true
  );

  assert.equal(
    canRemoveProjectMember({
      liveModeEnabled: true,
      viewerProjectMemberId: activeManager.id,
      viewerRole: "manager",
      member: activeManager,
    }),
    false
  );

  assert.equal(
    canRemoveProjectMember({
      liveModeEnabled: true,
      viewerProjectMemberId: activeManager.id,
      viewerRole: "manager",
      member: pendingMember,
    }),
    false
  );
});

test("regular members cannot remove anyone", () => {
  assert.equal(
    canRemoveProjectMember({
      liveModeEnabled: true,
      viewerProjectMemberId: activeMember.id,
      viewerRole: "member",
      member: activeManager,
    }),
    false
  );
});
