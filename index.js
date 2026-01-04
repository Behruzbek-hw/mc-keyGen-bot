// Cloudflare Worker — AdventureCore plugin bilan 100% ISHLAYDIGAN YANGILANGAN VERSIYA (KV o'chirilgan, xatolar hal qilingan)

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
    console.log("Worker received body: " + JSON.stringify(body));  // Logs uchun

    let returnToken = crypto.randomUUID().replaceAll("-", "");  // Yangi token
    const saltValue = "success";  // Doim success

    // Har qanday input uchun valid – check yo'q
    if (body.license && typeof body.license === "string") {
      console.log("New token for license: " + body.license.trim());
    } else if (body.token && typeof body.token === "string") {
      returnToken = body.token.trim();  // Eski tokenni qaytar
      console.log("Using token: " + returnToken);
    }

    const responseData = {
      token: returnToken,
      salt: saltValue
    };
    console.log("Returning: " + JSON.stringify(responseData));

    return jsonResponse(responseData);

  } catch (error) {
    console.error("Error: " + error.message);
    return jsonResponse({ error: "Server error", code: "server_error" }, 500);
  }
}

// Boshqa endpointlar (KV siz moslashtirilgan)
async function authInit(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  if (!body.license) return jsonResponse({ error: "Missing license" }, 400);

  const token = crypto.randomUUID().replaceAll("-", "");
  return jsonResponse({ authorized: true, token, expires_in: null });
}

async function authRuntime(request, env) {
  if (request.method !== "POST") return jsonResponse({ allowed: false }, 405);
  const body = await request.json().catch(() => ({}));
  if (!body.token || !body.action) return jsonResponse({ allowed: false }, 400);

  return jsonResponse({ allowed: true });
}

function authEnforce() {
  return jsonResponse({ action: "rollback", target: "spawn" });
}

async function admin(request, env) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${env.ADMIN_SECRET}`) return new Response("Forbidden", { status: 403 });

  if (request.method === "POST") {
    return jsonResponse({ success: true });  // KV yo'q
  }
  return new Response("Admin OK");
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
