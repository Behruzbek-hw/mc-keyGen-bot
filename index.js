export default {
  async fetch(request) {
    const url = new URL(request.url);

    // AdventureCore aynan shu endpointni chaqiradi
    if (url.pathname !== "/sendValue") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    // License yoki token kelganini tekshirish (farqi yo‘q)
    if (!body.license && !body.token) {
      return json({
        error: "missing_data",
        code: "invalid_code"
      }, 400);
    }

    // === ENG MUHIM QISM ===
    // AdventureCore uchun AUTH OK signali
    return json({
      salt: "authorized",
      token: "local-dev-token"
    });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
