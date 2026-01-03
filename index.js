const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

/**
 * ODDIY DATABASE (test uchun)
 * Real holatda DB ishlatiladi
 */
const VALID_LICENSES = new Set([
  "TEST-1234",
  "SERVER-5678"
]);

const TOKENS = new Map(); // token -> server info

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

app.post("/sendValue", (req, res) => {
  const { license, token } = req.body;

  /**
   * 1. TOKEN BILAN TEKSHIRISH
   */
  if (token) {
    if (TOKENS.has(token)) {
      return res.json({
        salt: "ok",
        token: token
      });
    }

    return res.status(401).json({
      error: "Invalid token",
      code: "invalid_token"
    });
  }

  /**
   * 2. LICENSE BILAN TEKSHIRISH
   */
  if (!license) {
    return res.status(400).json({
      error: "Missing license",
      code: "invalid_code"
    });
  }

  if (!VALID_LICENSES.has(license)) {
    return res.status(401).json({
      error: "Invalid license",
      code: "invalid_code"
    });
  }

  /**
   * 3. TOKEN YARATISH
   */
  const newToken = generateToken();
  TOKENS.set(newToken, {
    created: Date.now(),
    license
  });

  return res.json({
    salt: "authorized",
    token: newToken
  });
});

app.listen(8080, () => {
  console.log("Auth server running on port 8080");
});
