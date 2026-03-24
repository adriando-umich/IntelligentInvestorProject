import { NextResponse, type NextRequest } from "next/server";

import { getSessionState } from "@/lib/auth/session";
import { getProjectDataset } from "@/lib/data/repository";
import { buildMemberStatement, buildProjectSnapshot } from "@/lib/finance/engine";
import { buildMemberStatementPdf } from "@/lib/export/member-statement-pdf";
import { getServerI18n } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildSignInRedirect(
  request: NextRequest,
  projectId: string,
  memberId: string
) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", `/projects/${projectId}/members/${memberId}`);
  return url;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  const params = await context.params;
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const memberId = typeof params.memberId === "string" ? params.memberId : "";
  const session = await getSessionState();

  if (!session.isAuthenticated) {
    return NextResponse.redirect(buildSignInRedirect(request, projectId, memberId));
  }

  const [{ locale }, dataset] = await Promise.all([
    getServerI18n(),
    getProjectDataset(projectId),
  ]);

  if (!dataset) {
    return new Response("Project not found.", { status: 404 });
  }

  const statement = buildMemberStatement(dataset, memberId);

  if (!statement) {
    return new Response("Member not found.", { status: 404 });
  }

  const snapshot = buildProjectSnapshot(dataset);
  const { fileBuffer, fileName } = await buildMemberStatementPdf({
    statement,
    dataset,
    snapshot,
    locale,
  });

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
