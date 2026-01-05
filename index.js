export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/auth/init") {
      return authInit(req, env);
    }

    if (url.pathname === "/auth/runtime") {
      return authRuntime(req, env);
    }

    if (url.pathname === "/auth/enforce") {
      return authEnforce();
    }

    if (url.pathname.startsWith("/admin")) {
      return admin(req, env);
    }

    return new Response("Not found", { status: 404 });
  }
};

// ================= 1. INIT =================

async function authInit(req, env) {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const body = await req.json().catch(() => null);
  if (!body?.license) {
    return json({ error: "missing_license" }, 400);
  }

  const exists = await env.AUTH_KV.get(`license:${body.license}`);
  if (!exists) {
    return json({ authorized: false }, 401);
  }

  const token = crypto.randomUUID().replaceAll("-", "");

  await env.AUTH_KV.put(
    `token:${token}`,
    JSON.stringify({
      license: body.license,
      created: Date.now()
    }),
    { expirationTtl: 3600 }
  );

  return json({
    authorized: true,
    token,
    expires_in: 3600
  });
}

// ================= 2. RUNTIME =================

async function authRuntime(req, env) {
  if (req.method !== "POST") {
    return json({ allowed: false }, 405);
  }

  const body = await req.json().catch(() => null);
  if (!body?.token || !body?.action) {
    return json({ allowed: false }, 400);
  }

  const session = await env.AUTH_KV.get(`token:${body.token}`);
  if (!session) {
    return json({ allowed: false, reason: "invalid_session" });
  }

  return json({
    allowed: true
  });
}

// ================= 3. ENFORCE =================

function authEnforce() {
  return json({
    action: "rollback",
    target: "spawn"
  });
}

// ================= ADMIN =================

async function admin(req, env) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${env.ADMIN_SECRET}`) {
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (!body?.license) {
      return json({ error: "missing_license" }, 400);
    }

    await env.AUTH_KV.put(`license:${body.license}`, "true");
    return json({ success: true });
  }

  return new Response("Admin OK");
}

// ================= HELPER =================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
