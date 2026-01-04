// Cloudflare Worker — AdventureCore plugin bilan 100% ISHLAYDIGAN MOSLASHTIRILGAN VERSIYA (Java ga mos, xatolar hal qilingan)

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
    console.log("Worker received body: " + JSON.stringify(body));  // Dashboard Logs da ko'rinadi

    let returnToken = crypto.randomUUID().replaceAll("-", "");  // Har doim yangi token generate qilamiz
    const saltValue = "success";  // Har doim success

    let valid = true;  // Doim true, litsenziya/token check ni o'chirdik – har qanday input uchun ishlaydi

    // License yuborilgan bo'lsa, token generate qilamiz
    if (body.license && typeof body.license === "string") {
      const licenseKey = body.license.trim();
      if (licenseKey !== "") {
        console.log("New token created for license: " + licenseKey);
      }
    }
    // Token yuborilgan bo'lsa, uni qaytaramiz (validate qilmaymiz)
    else if (body.token && typeof body.token === "string") {
      const tokenKey = body.token.trim();
      if (tokenKey !== "") {
        returnToken = tokenKey;
        console.log("Token used: " + tokenKey);
      }
    }

    // Har doim KV ga saqlaymiz, muddat yo'q (expirationTtl: null)
    await env.AUTH_KV.put(`token:${returnToken}`, JSON.stringify({ created: Date.now() }), { expirationTtl: null });

    const responseData = {
      token: returnToken,
      salt: saltValue
    };
    console.log("Worker returning: " + JSON.stringify(responseData));

    return jsonResponse(responseData);

  } catch (error) {
    console.error("Worker critical error: " + error.message);
    return jsonResponse({ error: "Server error", code: "server_error" }, 500);
  }
}

// Qo'shimcha endpointlar (eski usullar uchun saqlab qoldik, moslashtirilgan)
async function authInit(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  if (!body.license) return jsonResponse({ error: "Missing license" }, 400);

  // Check ni o'chirdik, doim true
  const token = crypto.randomUUID().replaceAll("-", "");
  await env.AUTH_KV.put(`token:${token}`, JSON.stringify({ created: Date.now() }), { expirationTtl: null });

  return jsonResponse({ authorized: true, token, expires_in: null });  // Muddat yo'q
}

async function authRuntime(request, env) {
  if (request.method !== "POST") return jsonResponse({ allowed: false }, 405);
  const body = await request.json().catch(() => ({}));
  if (!body.token || !body.action) return jsonResponse({ allowed: false }, 400);

  // Session check ni o'chirdik, doim true
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
    await env.AUTH_KV.put(`license:${body.license}`, "true", { expirationTtl: null });  // Muddat yo'q
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
