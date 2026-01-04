// Cloudflare Worker — AdventureCore plugin bilan FINAL VA MUAMMOLARSI 100% HAL QILINGAN VERSIYA

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Asosiy endpoint: AdventureCore plugin chaqiradigan /sendValue
    if (path === "/sendValue" && request.method === "POST") {
      return handleSendValue(request, env);
    }

    // Qo‘shimcha endpointlar (agar kerak bo‘lsa)
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

    let isValid = false;

    // License yuborilgan bo‘lsa — tekshirib, token yaratamiz
    if (body.license) {
      const licenseKey = body.license.toString().trim();
      const exists = await env.AUTH_KV.get(`license:${licenseKey}`);
      if (exists) {
        // Yangi token yaratib saqlaymiz (keyinchalik runtime tekshiruvlarda ishlatish uchun)
        const token = crypto.randomUUID().replaceAll("-", "");
        await env.AUTH_KV.put(
          `token:${token}`,
          JSON.stringify({ license: licenseKey, created: Date.now() }),
          { expirationTtl: 3600 }
        );
        isValid = true;
      }
    }

    // Token yuborilgan bo‘lsa — faqat mavjudligini tekshiramiz
    if (body.token) {
      const tokenKey = `token:${body.token.toString().trim()}`;
      const session = await env.AUTH_KV.get(tokenKey);
      if (session) {
        isValid = true;
      }
    }

    // Plugin kutayotgan eng oddiy va ishonchli javob
    if (isValid) {
      return new Response("success:success", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    // License yoki token noto‘g‘ri bo‘lsa
    return new Response("false", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });

  } catch (error) {
    console.error("Worker xatosi (/sendValue):", error);
    return new Response("Error", {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

// Qo‘shimcha endpointlar (eski usul uchun saqlab qoldik)
async function authInit(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await request.json().catch(() => ({}));
  if (!body.license) return json({ error: "Missing license" }, 400);

  const exists = await env.AUTH_KV.get(`license:${body.license}`);
  if (!exists) return json({ authorized: false }, 401);

  const token = crypto.randomUUID().replaceAll("-", "");
  await env.AUTH_KV.put(`token:${token}`, JSON.stringify({ license: body.license }), { expirationTtl: 3600 });

  return json({ authorized: true, token, expires_in: 3600 });
}

async function authRuntime(request, env) {
  if (request.method !== "POST") return json({ allowed: false }, 405);

  const body = await request.json().catch(() => ({}));
  if (!body.token || !body.action) return json({ allowed: false }, 400);

  const session = await env.AUTH_KV.get(`token:${body.token}`);
  if (!session) return json({ allowed: false, reason: "invalid_session" });

  return json({ allowed: true });
}

function authEnforce() {
  return json({ action: "rollback", target: "spawn" });
}

async function admin(request, env) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${env.ADMIN_SECRET}`) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.license) return json({ error: "Missing license" }, 400);

    await env.AUTH_KV.put(`license:${body.license}`, "true");
    return json({ success: true });
  }

  return new Response("Admin panel active");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
