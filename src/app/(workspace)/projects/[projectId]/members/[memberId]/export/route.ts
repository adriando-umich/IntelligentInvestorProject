import { NextResponse, type NextRequest } from "next/server";

import { getSessionState } from "@/lib/auth/session";
import {
  getMemberStatement,
  getProjectSnapshot,
} from "@/lib/data/repository";
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

  const [{ locale }, statement, snapshot] = await Promise.all([
    getServerI18n(),
    getMemberStatement(projectId, memberId),
    getProjectSnapshot(projectId),
  ]);

  if (!statement || !snapshot) {
    return new Response("Project not found.", { status: 404 });
  }
  const { fileBuffer, fileName } = await buildMemberStatementPdf({
    statement,
    dataset: snapshot.dataset,
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
