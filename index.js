export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === "/sendValue" && request.method === "POST") {
      let code = "unknown";
      try {
        const body = await request.json();
        code = body.license || body.token || "no_code";
      } catch (e) {
        // JSON bo‘lmasa ham davom etamiz
      }
      console.log(`Received code: ${code}`);

      // Plugin kutayotgan JSON formatdagi javob
      const fakeResponse = {
        salt: "valid",
        token: "forever2026"
      };

      return new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json"
        }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
