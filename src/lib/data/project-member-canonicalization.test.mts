import test from "node:test";
import assert from "node:assert/strict";

import type { ProjectDataset } from "../finance/types";

const { canonicalizeProjectDatasetMembers } = await import(
  new URL("./project-member-canonicalization.ts", import.meta.url).href
);
const { resolveCanonicalProjectMemberId } = await import(
  new URL("./project-member-canonicalization.ts", import.meta.url).href
);

function buildBaseDataset(): ProjectDataset {
  return {
    project: {
      id: "project-1",
      name: "Project One",
      slug: "project-one",
      currencyCode: "VND",
      status: "active",
      createdBy: "user-1",
      createdAt: "2026-03-28T00:00:00.000Z",
      updatedAt: "2026-03-28T00:00:00.000Z",
    },
    profiles: [
      {
        userId: "user-1",
        displayName: "My Nguyen",
        email: "my@example.com",
        avatarUrl: null,
        isActive: true,
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      },
    ],
    members: [],
    entries: [],
    allocations: [],
    tags: [],
    entryTags: [],
    profitDistributionRuns: [],
    profitDistributionLines: [],
    reconciliationRuns: [],
    reconciliationChecks: [],
    projectMemberActivities: [],
  };
}

test("canonicalizeProjectDatasetMembers merges stale pending rows into the active user member", () => {
  const dataset = buildBaseDataset();
  dataset.profiles.push({
    userId: "pending:member-pending",
    displayName: "My Nguyen",
    email: "my@example.com",
    avatarUrl: null,
    isActive: true,
    createdAt: "2026-03-28T00:00:00.000Z",
    updatedAt: "2026-03-28T00:00:00.000Z",
  });
  dataset.members = [
    {
      id: "member-user",
      projectId: "project-1",
      userId: "user-1",
      role: "member",
      isActive: true,
      joinedAt: "2026-03-28T00:00:00.000Z",
      leftAt: null,
      membershipStatus: "active",
      pendingEmail: null,
      displayName: "My Nguyen",
    },
    {
      id: "member-pending",
      projectId: "project-1",
      userId: "pending:member-pending",
      role: "member",
      isActive: true,
      joinedAt: "2026-03-29T00:00:00.000Z",
      leftAt: null,
      membershipStatus: "pending_invite",
      pendingEmail: "my@example.com",
      displayName: "My Nguyen",
    },
  ];
  dataset.entries = [
    {
      id: "entry-1",
      projectId: "project-1",
      entryType: "operating_expense",
      effectiveAt: "2026-03-28T00:00:00.000Z",
      description: "Expense",
      amount: 100,
      currencyCode: "VND",
      cashOutMemberId: "member-pending",
      status: "posted",
      createdBy: "user-1",
      createdAt: "2026-03-28T00:00:00.000Z",
      updatedAt: "2026-03-28T00:00:00.000Z",
    },
  ];
  dataset.allocations = [
    {
      id: "allocation-1",
      ledgerEntryId: "entry-1",
      projectMemberId: "member-pending",
      allocationType: "expense_share",
      amount: 100,
      weightPercent: 1,
      note: null,
    },
  ];

  const normalized = canonicalizeProjectDatasetMembers(dataset);

  assert.deepEqual(
    normalized.members.map((member) => member.id),
    ["member-user"]
  );
  assert.equal(normalized.entries[0]?.cashOutMemberId, "member-user");
  assert.equal(normalized.allocations[0]?.projectMemberId, "member-user");
  assert.equal(
    normalized.projectMemberCanonicalIdByAlias?.["member-pending"],
    "member-user"
  );
});

test("canonicalizeProjectDatasetMembers keeps one pending row for rejoin flows and moves history onto it", () => {
  const dataset = buildBaseDataset();
  dataset.profiles.push({
    userId: "pending:member-rejoin",
    displayName: "My Nguyen",
    email: "my@example.com",
    avatarUrl: null,
    isActive: true,
    createdAt: "2026-03-28T00:00:00.000Z",
    updatedAt: "2026-03-28T00:00:00.000Z",
  });
  dataset.members = [
    {
      id: "member-old",
      projectId: "project-1",
      userId: "user-1",
      role: "member",
      isActive: false,
      joinedAt: "2026-03-20T00:00:00.000Z",
      leftAt: "2026-03-27T00:00:00.000Z",
      membershipStatus: "active",
      pendingEmail: null,
      displayName: "My Nguyen",
    },
    {
      id: "member-rejoin",
      projectId: "project-1",
      userId: "pending:member-rejoin",
      role: "member",
      isActive: true,
      joinedAt: "2026-03-28T00:00:00.000Z",
      leftAt: null,
      membershipStatus: "pending_invite",
      pendingEmail: "my@example.com",
      displayName: "My Nguyen",
    },
  ];
  dataset.entries = [
    {
      id: "entry-1",
      projectId: "project-1",
      entryType: "capital_contribution",
      effectiveAt: "2026-03-21T00:00:00.000Z",
      description: "Capital",
      amount: 200,
      currencyCode: "VND",
      cashInMemberId: "member-old",
      status: "posted",
      createdBy: "user-1",
      createdAt: "2026-03-21T00:00:00.000Z",
      updatedAt: "2026-03-21T00:00:00.000Z",
    },
  ];
  dataset.allocations = [
    {
      id: "allocation-1",
      ledgerEntryId: "entry-1",
      projectMemberId: "member-old",
      allocationType: "capital_owner",
      amount: 200,
      weightPercent: null,
      note: null,
    },
  ];

  const normalized = canonicalizeProjectDatasetMembers(dataset);

  assert.deepEqual(
    normalized.members.map((member) => member.id),
    ["member-rejoin"]
  );
  assert.equal(normalized.entries[0]?.cashInMemberId, "member-rejoin");
  assert.equal(normalized.allocations[0]?.projectMemberId, "member-rejoin");
  assert.equal(
    normalized.projectMemberCanonicalIdByAlias?.["member-old"],
    "member-rejoin"
  );
});

test("resolveCanonicalProjectMemberId maps alias member ids onto the canonical member", () => {
  const dataset = buildBaseDataset();
  dataset.profiles.push({
    userId: "pending:member-pending",
    displayName: "My Nguyen",
    email: "my@example.com",
    avatarUrl: null,
    isActive: true,
    createdAt: "2026-03-28T00:00:00.000Z",
    updatedAt: "2026-03-28T00:00:00.000Z",
  });
  dataset.members = [
    {
      id: "member-user",
      projectId: "project-1",
      userId: "user-1",
      role: "member",
      isActive: true,
      joinedAt: "2026-03-20T00:00:00.000Z",
      leftAt: null,
      membershipStatus: "active",
      pendingEmail: null,
      displayName: "My Nguyen",
    },
    {
      id: "member-pending",
      projectId: "project-1",
      userId: "pending:member-pending",
      role: "member",
      isActive: true,
      joinedAt: "2026-03-28T00:00:00.000Z",
      leftAt: null,
      membershipStatus: "pending_invite",
      pendingEmail: "my@example.com",
      displayName: "My Nguyen",
    },
  ];
  dataset.entries = [
    {
      id: "entry-1",
      projectId: "project-1",
      entryType: "capital_contribution",
      effectiveAt: "2026-03-21T00:00:00.000Z",
      description: "Capital",
      amount: 300,
      currencyCode: "VND",
      cashInMemberId: "member-pending",
      status: "posted",
      createdBy: "user-1",
      createdAt: "2026-03-21T00:00:00.000Z",
      updatedAt: "2026-03-21T00:00:00.000Z",
    },
  ];
  dataset.allocations = [
    {
      id: "allocation-1",
      ledgerEntryId: "entry-1",
      projectMemberId: "member-pending",
      allocationType: "capital_owner",
      amount: 300,
      weightPercent: null,
      note: null,
    },
  ];

  const normalized = canonicalizeProjectDatasetMembers(dataset);
  assert.equal(
    resolveCanonicalProjectMemberId(normalized, "member-pending"),
    "member-user"
  );
});
