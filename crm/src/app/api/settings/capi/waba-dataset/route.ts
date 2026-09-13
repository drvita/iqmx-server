import { withAuth } from "@/lib/api";
import {
  atribucionDisabledResponse,
  isAtribucionEnabled,
} from "@/server/attribution/flag";
import { listCredentialsByOrg } from "@/server/whatsapp/credentials";
import { getCapiSettings } from "@/server/attribution/settings";
import { getOrLinkWabaDataset } from "@/lib/meta/capi";

export const dynamic = "force-dynamic";

/**
 * Consulta en Meta Graph API el ID del conjunto de datos (Dataset) vinculado
 * a cada WhatsApp Business Account (WABA) de esta organización.
 */
export const GET = withAuth(async (session) => {
  if (!(await isAtribucionEnabled(session.organizationId))) {
    return atribucionDisabledResponse();
  }

  const allCreds = await listCredentialsByOrg(session.organizationId);
  if (!allCreds || allCreds.length === 0) {
    return Response.json(
      {
        ok: false,
        error: "No hay una línea de WhatsApp conectada para consultar la WABA",
      },
      { status: 404 }
    );
  }

  const settings = await getCapiSettings(session.organizationId);

  const seenWabas = new Set<string>();
  const accounts: Array<{
    wabaId: string;
    phoneNumber: string | null;
    label: string | null;
    datasetId: string | null;
    error: string | null;
  }> = [];

  for (const cred of allCreds) {
    if (seenWabas.has(cred.wabaId)) continue;
    seenWabas.add(cred.wabaId);

    const result = await getOrLinkWabaDataset({
      wabaId: cred.wabaId,
      token: cred.token,
      fallbackToken: settings?.token,
    });

    accounts.push({
      wabaId: cred.wabaId,
      phoneNumber: cred.displayPhoneNumber ?? cred.phoneNumberId,
      label: cred.label ?? cred.verifiedName ?? null,
      datasetId: result?.id ?? null,
      error: result?.id
        ? null
        : `Meta no devolvió un Dataset vinculado a la WABA ${cred.wabaId}.`,
    });
  }

  const primaryDatasetId =
    accounts.find((a) => a.datasetId)?.datasetId ?? null;

  if (!primaryDatasetId && accounts.every((a) => !a.datasetId)) {
    return Response.json(
      {
        ok: false,
        accounts,
        error:
          "Meta no devolvió un Dataset vinculado a las WABAs configuradas. Puedes crearlo con POST a /{wabaId}/dataset o en Business Manager.",
      },
      { status: 404 }
    );
  }

  return Response.json({
    ok: true,
    datasetId: primaryDatasetId,
    accounts,
  });
});
