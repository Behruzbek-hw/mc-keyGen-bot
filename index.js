// Cloudflare Worker — AdventureCore plugin bilan 100% ISHLAYDIGAN OXIRGI VERSIYA

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/sendValue" && request.method === "POST") {
      return handleSendValue(request, env);
    }

    if (path === "/auth/init" && request.method === "POST") {
      return authInit(request, env);
    }
    if (path === "/auth/runtime" && request.method === "POST") {
      return authRuntime(request, env);
    }
    if (path === "/auth/enforce") {
      return authEnforce();
    }
    if (path.startsWith("/admin")) {
      return admin(request, env);
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleSendValue(request, env) {
  try {
    const body = await request.json();

    let returnToken = null;
    const saltValue = "success";  // Har doim "success:success" bo'ladi

    // License yuborilgan bo'lsa
    if (body.license && typeof body.license === "string" && body.license.trim() !== "") {
      const licenseKey = body.license.trim();
      const exists = await env.AUTH_KV.get(`license:${licenseKey}`);
      if (!exists) {
        return jsonResponse({ error: "Invalid license", code: "invalid_code" }, 401);
      }
      // Yangi token yaratamiz
      returnToken = crypto.randomUUID().replaceAll("-", "");
      await env.AUTH_KV.put(`token:${returnToken}`, JSON.stringify({ license: licenseKey, created: Date.now() }), { expirationTtl: 3600 });
    }
    // Token yuborilgan bo'lsa
    else if (body.token && typeof body.token === "string" && body.token.trim() !== "") {
      const tokenKey = body.token.trim();
      const session = await env.AUTH_KV.get(`token:${tokenKey}`);
      if (!session) {
        return jsonResponse({ error: "Invalid token", code: "invalid_session" }, 401);
      }
      returnToken = tokenKey;  // Eski tokenni qaytaramiz
    }
    // Hech qaysi yo'q
    else {
      return jsonResponse({ error: "Missing license or token", code: "bad_request" }, 400);
    }

    // Har doim to'g'ri format: {"token": "...", "salt": "success"}
    return jsonResponse({
      token: returnToken,
      salt: saltValue
    });

  } catch (error) {
    console.error("Worker xatosi (/sendValue):", error);
    return jsonResponse({ error: "Server error", code: "server_error" }, 500);
  }
}

// Qo'shimcha endpointlar (eski usullar uchun)
async function authInit(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  if (!body.license) return jsonResponse({ error: "Missing license" }, 400);

  const exists = await env.AUTH_KV.get(`license:${body.license}`);
  if (!exists) return jsonResponse({ authorized: false }, 401);

  const token = crypto.randomUUID().replaceAll("-", "");
  await env.AUTH_KV.put(`token:${token}`, JSON.stringify({ license: body.license, created: Date.now() }), { expirationTtl: 3600 });

  return jsonResponse({ authorized: true, token, expires_in: 3600 });
}

async function authRuntime(request, env) {
  if (request.method !== "POST") return jsonResponse({ allowed: false }, 405);
  const body = await request.json().catch(() => ({}));
  if (!body.token || !body.action) return jsonResponse({ allowed: false }, 400);

  const session = await env.AUTH_KV.get(`token:${body.token}`);
  if (!session) return jsonResponse({ allowed: false, reason: "invalid_session" });

  return jsonResponse({ allowed: true });
}

function authEnforce() {
  return jsonResponse({ action: "rollback", target: "spawn" });
}

async function admin(request, env) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${env.ADMIN_SECRET}`) return new Response("Forbidden", { status: 403 });

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.license) return jsonResponse({ error: "Missing license" }, 400);
    await env.AUTH_KV.put(`license:${body.license}`, "true");
    return jsonResponse({ success: true });
  }
  return new Response("Admin OK");
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
