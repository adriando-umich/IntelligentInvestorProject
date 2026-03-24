import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { DEMO_VIEWER_USER_ID } from "@/lib/app-config";
import { demoProjectDatasets } from "@/lib/data/demo-projects";
import {
  getLiveProjectDataset,
  getLiveViewerProfile,
  listLiveProjectIds,
  shouldUseDemoData,
} from "@/lib/data/supabase-datasets";
import {
  buildMemberStatement,
  buildProjectSnapshot,
} from "@/lib/finance/engine";
import { type ProjectDataset, type ProjectSnapshot } from "@/lib/finance/types";

export async function listProjectSnapshots() {
  noStore();

  if (!(await shouldUseDemoData())) {
    const liveProjectIds = await listLiveProjectIds();

    if (liveProjectIds) {
      const liveSnapshots = (
        await Promise.all(liveProjectIds.map((projectId) => getProjectSnapshot(projectId)))
      ).filter((snapshot): snapshot is ProjectSnapshot => snapshot != null);

      return liveSnapshots.sort((left, right) =>
        right.dataset.project.updatedAt.localeCompare(left.dataset.project.updatedAt)
      );
    }
  }

  return demoProjectDatasets
    .map((dataset) => buildProjectSnapshot(dataset))
    .sort((left, right) =>
      right.dataset.project.updatedAt.localeCompare(left.dataset.project.updatedAt)
    );
}

export async function getProjectSnapshot(projectId: string) {
  noStore();

  if (!(await shouldUseDemoData())) {
    const liveDataset = await getLiveProjectDataset(projectId);
    if (liveDataset) {
      return buildProjectSnapshot(liveDataset);
    }
  }

  const dataset = demoProjectDatasets.find((item) => item.project.id === projectId);
  return dataset ? buildProjectSnapshot(dataset) : null;
}

export async function getProjectDataset(
  projectId: string
): Promise<ProjectDataset | null> {
  noStore();

  if (!(await shouldUseDemoData())) {
    return getLiveProjectDataset(projectId);
  }

  return demoProjectDatasets.find((item) => item.project.id === projectId) ?? null;
}

export async function getMemberStatement(
  projectId: string,
  projectMemberId: string
) {
  noStore();

  if (!(await shouldUseDemoData())) {
    const liveDataset = await getLiveProjectDataset(projectId);
    return liveDataset ? buildMemberStatement(liveDataset, projectMemberId) : null;
  }

  const dataset = demoProjectDatasets.find((item) => item.project.id === projectId);
  return dataset ? buildMemberStatement(dataset, projectMemberId) : null;
}

export async function getViewerProfile() {
  noStore();

  if (!(await shouldUseDemoData())) {
    const liveProfile = await getLiveViewerProfile();
    if (liveProfile) {
      return liveProfile;
    }
  }

  const allProfiles = demoProjectDatasets.flatMap((dataset) => dataset.profiles);
  return (
    allProfiles.find((profile) => profile.userId === DEMO_VIEWER_USER_ID) ??
    allProfiles[0]
  );
}

export async function getProjectCards() {
  noStore();

  const projects = await listProjectSnapshots();
  return projects.map((snapshot) => toProjectCard(snapshot));
}

function toProjectCard(snapshot: ProjectSnapshot) {
  return {
    id: snapshot.dataset.project.id,
    name: snapshot.dataset.project.name,
    slug: snapshot.dataset.project.slug,
    description: snapshot.dataset.project.description ?? "",
    status: snapshot.dataset.project.status,
    currencyCode: snapshot.dataset.project.currencyCode,
    totalProjectCash: snapshot.totalProjectCash,
    undistributedProfit: snapshot.undistributedProfit,
    memberCount: snapshot.dataset.members.length,
    openSettlementCount: snapshot.settlementSuggestions.length,
    hasReconciliationVariance:
      (snapshot.openReconciliation?.varianceCount ?? 0) > 0,
  };
}
