// Cloudflare Worker — AdventureCore uchun 3 QATLAMLI MOSLASHTIRILGAN VERSIYA (doim success, 3 ta server roli)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/sendValue" && request.method === "POST") {
      return handleSendValue(request);  // Server A va B uchun (initial va refresh)
    }

    if (path === "/auth/init" && request.method === "POST") {
      return authInit(request);  // Server A uchun (initial auth)
    }

    if (path === "/auth/runtime" && request.method === "POST") {
      return authRuntime(request);  // Server C uchun (runtime validation)
    }

    if (path === "/auth/enforce") {
      return authEnforce();
    }

    if (path.startsWith("/admin")) {
      return new Response("Admin OK");
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleSendValue(request) {
  try {
    const body = await request.json().catch(() => ({}));  // Body bo'sh bo'lsa ham ishlaydi
    console.log("Received /sendValue: " + JSON.stringify(body));

    let returnToken = "fixed-token-for-test";  // Doim shu token (test uchun)
    const saltValue = "success";  // Doim success

    // Litsenziya yoki token bo'lsa, log qilamiz, lekin check yo'q
    if (body.license) {
      console.log("Initial auth for license: " + body.license);
    } else if (body.token) {
      returnToken = body.token;  // Refresh: eski tokenni qaytaramiz
      console.log("Token refresh: " + body.token);
    }

    const responseData = {
      token: returnToken,
      salt: saltValue
    };
    console.log("Returning: " + JSON.stringify(responseData));
    return jsonResponse(responseData);
  } catch (error) {
    console.error("Error in /sendValue: " + error.message);
    return jsonResponse({ error: "Server error", code: "server_error" }, 500);
  }
}

async function authInit(request) {
  const body = await request.json().catch(() => ({}));
  console.log("Received /auth/init: " + JSON.stringify(body));

  const token = "fixed-token-for-test";  // Doim shu
  return jsonResponse({ authorized: true, token, expires_in: null });
}

async function authRuntime(request) {
  const body = await request.json().catch(() => ({}));
  console.log("Received /auth/runtime: " + JSON.stringify(body));

  return jsonResponse({ allowed: true });  // Doim true (validation muvaffaqiyatli)
}

function authEnforce() {
  return jsonResponse({ action: "rollback", target: "spawn" });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
