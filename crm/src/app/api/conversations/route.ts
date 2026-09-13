import { withAuth } from "@/lib/api";
import { listConversations } from "@/server/inbox/queries";
import { getMemberLineAccess } from "@/server/auth/permissions";
import { listCredentialsByOrg } from "@/server/whatsapp/credentials";
import type { ConversationLineDto } from "@/lib/types";

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

  const [conversations, allCreds] = await Promise.all([
    listConversations(
      session.organizationId,
      since && !Number.isNaN(since.getTime()) ? since : undefined,
      allowedLineIds !== undefined ? { allowedLineIds } : undefined
    ),
    listCredentialsByOrg(session.organizationId),
  ]);

  const accessibleCreds =
    session.role === "agent" && allowedLineIds !== undefined
      ? allCreds.filter((c) => allowedLineIds!.includes(c.phoneNumberId))
      : allCreds;

  const lines: ConversationLineDto[] = accessibleCreds.map((c) => ({
    phoneNumberId: c.phoneNumberId,
    name: c.label || c.verifiedName || c.displayPhoneNumber || "WhatsApp",
    displayPhone: c.displayPhoneNumber,
    isDefault: c.isDefault,
  }));

  return Response.json({ conversations, lines });
});
