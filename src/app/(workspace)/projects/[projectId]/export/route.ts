import { NextResponse, type NextRequest } from "next/server";

import { getSessionState } from "@/lib/auth/session";
import { getProjectDataset } from "@/lib/data/repository";
import { buildProjectSnapshot } from "@/lib/finance/engine";
import { buildProjectAuditWorkbook } from "@/lib/export/project-audit-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildSignInRedirect(request: NextRequest, projectId: string) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", `/projects/${projectId}`);
  return url;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const session = await getSessionState();

  if (!session.isAuthenticated) {
    return NextResponse.redirect(buildSignInRedirect(request, projectId));
  }

  const dataset = await getProjectDataset(projectId);

  if (!dataset) {
    return new Response("Project not found.", { status: 404 });
  }

  const snapshot = buildProjectSnapshot(dataset);
  const { workbook, fileName } = await buildProjectAuditWorkbook({
    dataset,
    snapshot,
  });
  const fileBuffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(fileBuffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      "Cache-Control": "no-store",
    },
  });
}
