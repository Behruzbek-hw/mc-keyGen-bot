// Cloudflare Worker — AdventureCore plugin bilan to'liq mos

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Yangi: AdventureCore plugin uchun mos endpoint
    if (path === "/sendValue" && request.method === "POST") {
      return handleSendValue(request, env);
    }

    // Eski endpointlar saqlab qolindi (agar boshqa joyda ishlatayotgan bo'lsangiz)
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

// Plugin uchun asosiy adapter endpoint
async function handleSendValue(request, env) {
  try {
    const body = await request.json();

    // Agar license yuborgan bo'lsa — yangi session boshlash
    if (body.license) {
      const licenseKey = body.license.trim();

      // License KV da borligini tekshirish
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
        { expirationTtl: 3600 } // 1 soat
      );

      // Plugin kutayotgan format: {"token": "...", "salt": "..."}
      return jsonResponse({
        token: token,
        salt: "success"  // plugin "salt:salt" ni ko'radi, shuning uchun shunday qaytaramiz
      });
    }

    // Agar token yuborgan bo'lsa — faqat tasdiqlash yetarli
    if (body.token) {
      const session = await env.AUTH_KV.get(`token:${body.token}`);
      if (!session) {
        return jsonResponse({
          error: "Invalid or expired session",
          code: "invalid_session"
        }, 401);
      }

      // Token hali yashayapti — tasdiqlaymiz
      return jsonResponse({
        token: body.token,
        salt: "valid"
      });
    }

    // Hech qaysi kalit yo'q
    return jsonResponse({
      error: "Missing license or token",
      code: "bad_request"
    }, 400);

  } catch (err) {
    return jsonResponse({
      error: "Internal server error",
      code: "server_error"
    }, 500);
  }
}

// Eski /auth/init — saqlab qoldik
async function authInit(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await request.json().catch(() => ({}));
  if (!body.license) return jsonResponse({ error: "missing_license" }, 400);

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

// Eski /auth/runtime — saqlab qoldik
async function authRuntime(request, env) {
  if (request.method !== "POST") return jsonResponse({ allowed: false }, 405);

  const body = await request.json().catch(() => ({}));
  if (!body.token || !body.action) return jsonResponse({ allowed: false }, 400);

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

async function admin(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.license) return jsonResponse({ error: "missing_license" }, 400);

    await env.AUTH_KV.put(`license:${body.license}`, "true");
    return jsonResponse({ success: true });
  }

  return new Response("Admin panel active");
}

// Yordamchi funksiya — chiroyli JSON javob
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
