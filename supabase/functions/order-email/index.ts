// Sends the "we received your order" e-mail from info@dushichki.com (via SMTP) and a copy to the owner.
// Secrets (Supabase → Edge Functions → Secrets): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OWNER_EMAIL (optional).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let id = "";
  try { id = String((await req.json()).order_id || ""); } catch { /* ignore */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad id" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Claim the order: only a fresh order (< 15 min) whose e-mail was not sent yet -> prevents repeats and abuse.
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: rows, error } = await sb.from("orders")
    .update({ "Писмо_изпратено": true })
    .eq("id", id).eq("Писмо_изпратено", false).gt("Дата", since)
    .select("*");
  if (error) return json({ error: "db" }, 500);
  if (!rows || !rows.length) return json({ ok: true, skipped: true });
  const o = rows[0];

  const full = `${o["Име"]} ${o["Фамилия"] || ""}`.trim();
  const num = String(o.id).slice(0, 8).toUpperCase();
  const items = (o.items || []).map((it: Record<string, unknown>) => `
    <li style="margin-bottom:10px"><b>${esc(it["Дреха"])}</b> – ${esc(it["Модел"])}<br>
    Цвят: ${esc(it["Цвят"])} · Размер: ${esc(it["Размер"])} · €${esc(it["Цена_евро"])}
    ${it["Текст"] ? `<br>Текст: ${esc(it["Текст"])}` : ""}
    ${it["Ореол"] ? `<br>Ореол/криле: ${esc(it["Ореол"])} за ${esc(it["За_кого"])}` : ""}
    ${it["История"] ? `<br>История: ${esc(it["История"])}` : ""}
    ${it["Бележки"] ? `<br>Бележки: ${esc(it["Бележки"])}` : ""}</li>`).join("");
  const total = (Number(o["Сума_евроцента"]) / 100).toFixed(2);

  const body = (intro: string) => `<div style="font-family:Arial,sans-serif;color:#2b2323;max-width:560px">
    <h2 style="color:#DC0A1E">${intro}</h2>
    <p>Поръчка <b>${num}</b></p>
    <ul style="padding-left:18px">${items}</ul>
    <p><b>Доставка:</b> ${esc(o["Куриер"])} (${esc(o["Доставка"])}): ${esc(o["Адрес"])}</p>
    <p><b>Получател:</b> ${esc(full)}, ${esc(o["Телефон"])}</p>
    <p><b>Общо за артикулите: €${total}</b></p>
    ${o["Снимка"] ? `<p>Снимка: <a href="${esc(o["Снимка"])}">отвори</a></p>` : ""}</div>`;

  const user = Deno.env.get("SMTP_USER")!;
  const smtp = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com",
      port: Number(Deno.env.get("SMTP_PORT") || 465),
      tls: true,
      auth: { username: user, password: Deno.env.get("SMTP_PASS")! },
    },
  });
  try {
    await smtp.send({
      from: `Душички <${user}>`, to: o["Имейл"],
      subject: `Получихме поръчката ти (${num})`,
      html: body("Благодарим ти! Получихме поръчката ти ❤️") +
        `<p>Ще се свържем с теб за плащането и потвърждение. Изработката отнема до 7 календарни дни, след което пратката тръгва с куриер.</p>
         <p>Въпроси: пиши ни на ${esc(user)}</p>`,
    });
    await smtp.send({
      from: `Душички <${user}>`, to: Deno.env.get("OWNER_EMAIL") || user,
      subject: `Нова поръчка ${num} – ${full}`,
      html: body("Нова поръчка") + `<p>Клиент: ${esc(o["Имейл"])}</p>`,
    });
    await smtp.close();
  } catch (e) {
    try { await smtp.close(); } catch { /* ignore */ }
    await sb.from("orders").update({ "Писмо_изпратено": false }).eq("id", id); // allow a retry
    console.error("smtp", e);
    return json({ error: "smtp" }, 500);
  }
  return json({ ok: true });
});
