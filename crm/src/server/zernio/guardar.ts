import { apiError } from "@/lib/api";
import { MetaApiError } from "@/lib/meta/client";
import {
  fetchZernioAccounts,
  pickZernioAccount,
  type ZernioAccount,
  type ZernioChannel,
} from "@/server/zernio/cuentas";

/**
 * 023 — Resolución y validación de cuentas de Zernio al conectar o guardar.
 */
export async function resolveZernioAccount(
  token: string,
  accountRef: string | null | undefined,
  channel: ZernioChannel
): Promise<{ ok: true; account: ZernioAccount } | { ok: false; response: Response }> {
  let accounts: ZernioAccount[];
  try {
    accounts = await fetchZernioAccounts(token);
  } catch (err) {
    if (!(err instanceof MetaApiError)) throw err;
    if (err.status === 0 || err.status >= 500 || err.status === 429) {
      return {
        ok: false,
        response: apiError(
          503,
          "platform_unavailable",
          "No se pudo contactar a Zernio; intenta de nuevo"
        ),
      };
    }
    return {
      ok: false,
      response: apiError(422, "invalid_token", "La API key de Zernio no es válida"),
    };
  }

  const pick = pickZernioAccount(accounts, accountRef, channel);
  if (pick.ok) return { ok: true, account: pick.account };
  return {
    ok: false,
    response: Response.json(
      {
        error: {
          code: pick.code,
          message: pick.message,
          details: { accounts: pick.candidates },
        },
      },
      { status: 422 }
    ),
  };
}
