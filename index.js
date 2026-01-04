// Cloudflare Worker — AdventureCore bilan TO‘LIQ VA OXIRGI ISHLAYDIGAN VERSIYA

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

    let tokenToReturn = "authenticated";  // dummy token, plugin faqat borligini tekshiradi
    let saltValue = "success";

    // License yuborilgan bo‘lsa — tekshirib, yangi token yaratamiz
    if (body.license) {
      const licenseKey = body.license.toString().trim();
      const exists = await env.AUTH_KV.get(`license:${licenseKey}`);
      if (!exists) {
        return jsonResponse({ error: "Invalid license", code: "invalid_code" }, 401);
      }
      // Yangi real token yaratamiz
      tokenToReturn = crypto.randomUUID().replaceAll("-", "");
      await env.AUTH_KV.put(`token:${tokenToReturn}`, JSON.stringify({ license: licenseKey }), { expirationTtl: 3600 });
    }

    // Token yuborilgan bo‘lsa — tekshirib, tasdiqlaymiz
    else if (body.token) {
      const session = await env.AUTH_KV.get(`token:${body.token.toString().trim()}`);
      if (!session) {
        return jsonResponse({ error: "Invalid token", code: "invalid_session" }, 401);
      }
      tokenToReturn = body.token;  // eski tokenni qaytaramiz
    } else {
      return jsonResponse({ error: "Bad request", code: "bad_request" }, 400);
    }

    // To‘g‘ri JSON format — plugin bu ni parse qilib, "success:success" oladi
    return jsonResponse({
      token: tokenToReturn,
      salt: saltValue
    });

  } catch (error) {
    console.error("Worker error:", error);
    return jsonResponse({ error: "Server error", code: "server_error" }, 500);
  }
}

// Qo‘shimcha endpointlar
async function authInit(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  if (!body.license) return jsonResponse({ error: "Missing license" }, 400);

  const exists = await env.AUTH_KV.get(`license:${body.license}`);
  if (!exists) return jsonResponse({ authorized: false }, 401);

  const token = crypto.randomUUID().replaceAll("-", "");
  await env.AUTH_KV.put(`token:${token}`, JSON.stringify({ license: body.license }), { expirationTtl: 3600 });

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
