import { withAuth } from "@/lib/api";
import { listConversations } from "@/server/inbox/queries";
import { getMemberLineAccess } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session, req: Request) => {
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;

  let allowedLineIds: string[] | undefined;
  if (session.role === "agent") {
    allowedLineIds = await getMemberLineAccess(
      session.organizationId,
      session.memberId
    );
  }

  const conversations = await listConversations(
    session.organizationId,
    since && !Number.isNaN(since.getTime()) ? since : undefined,
    allowedLineIds !== undefined ? { allowedLineIds } : undefined
  );
  return Response.json({ conversations });
});
