// Returns the list of Econt / Speedy offices: { manual: boolean, offices: [{id,n,c,z,a,p}] }.
// Econt uses its public API. Speedy needs the shop's Speedy API account: secrets SPEEDY_USER and SPEEDY_PASS
// (without them Speedy answers manual:true and the site shows a text field for the office).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
type Office = { id: string; n: string; c: string; z: string; a: string; p: number };
const cache: Record<string, { t: number; list: Office[] }> = {};

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.json();
}

async function econt(): Promise<Office[]> {
  const j = await post("https://ee.econt.com/services/Nomenclatures/NomenclaturesService.getOffices.json", { countryCode: "BGR" });
  const out: Office[] = [];
  for (const o of j.offices || []) {
    if (!o.id) continue;
    const st: string[] = Array.isArray(o.shipmentTypes) ? o.shipmentTypes : ["post"];
    if (!st.includes("post") && !st.includes("courier")) continue;
    const c = o.address?.city || {};
    out.push({ id: String(o.id), n: String(o.name || "").trim(), c: String(c.name || "").trim(), z: String(c.postCode || ""),
      a: String(o.address?.fullAddress || "").trim(), p: o.isAPS ? 1 : 0 });
  }
  return out;
}

async function speedy(): Promise<Office[] | null> {
  const u = Deno.env.get("SPEEDY_USER"), p = Deno.env.get("SPEEDY_PASS");
  if (!u || !p) return null;
  const j = await post("https://api.speedy.bg/v1/location/office", { userName: u, password: p, language: "BG", countryId: 100 });
  const out: Office[] = [];
  for (const o of j.offices || []) {
    if (o.id === undefined) continue;
    const ad = o.address || {};
    out.push({ id: String(o.id), n: String(o.name || "").trim(), c: String(ad.siteName || o.siteName || "").trim(), z: String(ad.postCode || ""),
      a: String(ad.fullAddressString || ad.localAddressString || "").trim(), p: o.type === "APT" ? 1 : 0 });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let courier = "";
  try { courier = String((await req.json()).courier || ""); } catch { /* ignore */ }
  if (courier !== "econt" && courier !== "speedy") {
    return new Response(JSON.stringify({ error: "courier" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const hit = cache[courier];
  let list: Office[] | null = hit && Date.now() - hit.t < 6 * 3600 * 1000 ? hit.list : null;
  try {
    if (!list) {
      list = courier === "econt" ? await econt() : await speedy();
      if (list && list.length) {
        list.sort((a, b) => (a.c + a.n).localeCompare(b.c + b.n, "bg"));
        cache[courier] = { t: Date.now(), list };
      }
    }
  } catch (e) {
    console.error("offices", courier, e);
    list = hit ? hit.list : null;
  }
  const body = list && list.length ? { manual: false, offices: list } : { manual: true, offices: [] };
  return new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });
});
