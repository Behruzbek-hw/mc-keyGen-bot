// Cloudflare Worker — AdventureCore plugin bilan to'liq mos (oxirgi versiya)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Asosiy endpoint: AdventureCore plugin chaqiradigan /sendValue
    if (path === "/sendValue" && request.method === "POST") {
      return handleSendValue(request, env);
    }

    // Qo'shimcha endpointlar (agar boshqa joyda ishlatayotgan bo'lsangiz)
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
    if (path === "/test") {
      if (!env.AUTH_KV) {
        return new Response("ERROR: AUTH_KV binding yo'q!", { status: 500 });
      }
      if (!env.ADMIN_SECRET) {
        return new Response("ERROR: ADMIN_SECRET yo'q!", { status: 500 });
      }
      return new Response("Hammasi joyida! AUTH_KV va ADMIN_SECRET bor.");
    }

    return new Response("Not Found", { status: 404 });
  }
};

// AdventureCore plugin uchun moslashtirilgan endpoint
async function handleSendValue(request, env) {
  try {
    const body = await request.json();

    // 1. License yuborilgan bo'lsa → yangi token yaratamiz
    if (body.license) {
      const licenseKey = body.license.trim();

      // License KV da mavjudligini tekshirish
      const exists = await env.AUTH_KV.get(`license:${licenseKey}`);
      if (!exists) {
        return jsonResponse({
          error: "Invalid or expired license",
          code: "invalid_code"
        }, 401);
      }

      // Yangi token yaratish
      const token = crypto.randomUUID().replaceAll("-", "");

      await env.AUTH_KV.put(
        `token:${token}`,
        JSON.stringify({
          license: licenseKey,
          created: Date.now()
        }),
        { expirationTtl: 3600 } // 1 soat yashaydi
      );

      // Plugin kutayotgan format: {"token": "...", "salt": "biror_narsa"}
      // Keyin plugin ichida "salt:salt" qilib qaytaradi → "success:success"
      return jsonResponse({
        token: token,
        salt: "success"
      });
    }

    // 2. Token yuborilgan bo'lsa → faqat tasdiqlaymiz
    if (body.token) {
      const session = await env.AUTH_KV.get(`token:${body.token}`);
      if (!session) {
        return jsonResponse({
          error: "Invalid or expired token",
          code: "invalid_session"
        }, 401);
      }

      // Token hali ishlayapti → tasdiqlaymiz
      return jsonResponse({
        token: body.token,
        salt: "valid"
      });
    }

    // Hech narsa topilmagan bo'lsa
    return jsonResponse({
      error: "Missing license or token",
      code: "bad_request"
    }, 400);

  } catch (error) {
    // Worker ichidagi xatoliklar uchun log
    console.error("Worker error in /sendValue:", error);
    return jsonResponse({
      error: "Internal server error",
      code: "server_error"
    }, 500);
  }
}

// Eski /auth/init (saqlab qoldik)
async function authInit(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const body = await request.json().catch(() => ({}));
  if (!body.license) return jsonResponse({ error: "Missing license" }, 400);

  const exists = await env.AUTH_KV.get(`license:${body.license}`);
  if (!exists) return jsonResponse({ authorized: false }, 401);

  const token = crypto.randomUUID().replaceAll("-", "");
  await env.AUTH_KV.put(`token:${token}`, JSON.stringify({ license: body.license, created: Date.now() }), {
    expirationTtl: 3600
  });

  return jsonResponse({
    authorized: true,
    token,
    expires_in: 3600
  });
}

// Eski /auth/runtime (saqlab qoldik)
async function authRuntime(request, env) {
  if (request.method !== "POST") return jsonResponse({ allowed: false }, 405);

  const body = await request.json().catch(() => ({}));
  if (!body.token || !body.action) return jsonResponse({ allowed: false, reason: "Missing parameters" }, 400);

  const session = await env.AUTH_KV.get(`token:${body.token}`);
  if (!session) return jsonResponse({ allowed: false, reason: "invalid_session" });

  return jsonResponse({ allowed: true });
}

function authEnforce() {
  return jsonResponse({
    action: "rollback",
    target: "spawn"
  });
}

// Admin panel
async function admin(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.license) return jsonResponse({ error: "Missing license" }, 400);

    await env.AUTH_KV.put(`license:${body.license}`, "true");
    return jsonResponse({ success: true });
  }

  return new Response("Admin panel active", { status: 200 });
}

// Yordamchi funksiya — chiroyli JSON javob
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"  // agar kerak bo'lsa
    }
  });
}
