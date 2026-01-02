export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === "/sendValue" && request.method === "POST") {
      let code = "unknown";
      try {
        const body = await request.json();
        code = body.license || body.token || "no_code";
      } catch (e) {
        // agar json bo‘lmasa ham ishlasin
      }

      console.log(`Received code: ${code}`);

      const responseText = "true:valid:MyLicense2025:forever:2026";
      
      return new Response(responseText, {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
