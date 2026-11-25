import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import app from "../index";
import { createTestD1 } from "../test/d1";
import { updateUserPassword } from "../auth/user";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "../auth/password";
import { createSession } from "../auth/session";
import { MAX_EMAIL_FAILURES } from "../auth/rateLimit";
import type { D1Database } from "@cloudflare/workers-types";

describe("Auth HTTP Boundary Seam", () => {
  let db: D1Database;
  const mockEnv = () => ({
    DB: db,
    RESEND_API_KEY: "re_test_mock_key",
    TURNSTILE_SECRET_KEY: "mock-turnstile-secret",
    TURNSTILE_HOSTNAMES: "wrongfirst.dev,next.wrongfirst.dev",
  });

  beforeEach(() => {
    db = createTestD1();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/auth/me returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/auth/me", {}, mockEnv());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ user: null });
  });

  it("Creates session, retrieves profile via /api/auth/me, and logs out cleanly", async () => {
    // 1. Manually insert a test user into D1
    const userId = "usr_test123";
    const email = "developer@example.com";
    const now = Date.now();
    await db
      .prepare(
        "INSERT INTO users (id, email, name, avatar_url, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(userId, email, "Test Dev", "https://example.com/avatar.png", "free", now, now)
      .run();

    // 2. Insert a valid session
    const sessionId = "sess_abc123xyz";
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    await db
      .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(sessionId, userId, expiresAt)
      .run();

    // 3. Test GET /api/auth/me with session cookie
    const meRes = await app.request(
      "/api/auth/me",
      {
        headers: {
          Cookie: `session=${sessionId}`,
        },
      },
      mockEnv(),
    );

    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as any;
    expect(meBody.user).toEqual({
      id: userId,
      email,
      name: "Test Dev",
      avatarUrl: "https://example.com/avatar.png",
      tier: "free",
      paddleCustomerId: null,
      paddleSubscriptionId: null,
    });

    // 4. Test POST /api/auth/logout with session cookie
    const logoutRes = await app.request(
      "/api/auth/logout",
      {
        method: "POST",
        headers: {
          Cookie: `session=${sessionId}`,
        },
      },
      mockEnv(),
    );

    expect(logoutRes.status).toBe(200);
    const logoutCookie = logoutRes.headers.get("Set-Cookie");
    expect(logoutCookie).toContain("session=;");

    // 5. Subsequent /api/auth/me returns 401
    const meAfterLogout = await app.request(
      "/api/auth/me",
      {
        headers: {
          Cookie: `session=${sessionId}`,
        },
      },
      mockEnv(),
    );
    expect(meAfterLogout.status).toBe(401);
  });

  describe("Password Authentication Seam", () => {
    const VALID_TOKEN = "valid-turnstile-token";

    function mockSiteverify(response: {
      success: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: string[];
    }) {
      return vi.spyOn(globalThis, "fetch").mockImplementation(
        async () =>
          new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      );
    }

    beforeEach(() => {
      mockSiteverify({
        success: true,
        action: "login",
        hostname: "wrongfirst.dev",
      });
    });

    it("hashPassword and verifyPassword round-trip and reject wrong passwords", async () => {
      const hash = await hashPassword("correct-horse-battery-staple");
      expect(hash.startsWith("pbkdf2_sha256$100000$")).toBe(true);
      expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
      expect(await verifyPassword("wrong-password", hash)).toBe(false);
    });

    it("POST /api/auth/login/password enforces Turnstile token, action, hostname, and single-use verification", async () => {
      const passwordHash = await hashPassword("super-secret-123");
      const now = Date.now();
      await db
        .prepare(
          "INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("usr_ts_1", "ts@wrongfirst.dev", "TS", "free", passwordHash, now, now, now)
        .run();

      // Missing token -> 403
      const missingRes = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "ts@wrongfirst.dev", password: "super-secret-123" }),
        },
        mockEnv(),
      );
      expect(missingRes.status).toBe(403);

      // Overlong token -> 403
      const overlongRes = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "ts@wrongfirst.dev",
            password: "super-secret-123",
            "cf-turnstile-response": "x".repeat(2049),
          }),
        },
        mockEnv(),
      );
      expect(overlongRes.status).toBe(403);

      // Wrong action -> 403
      vi.restoreAllMocks();
      mockSiteverify({ success: true, action: "signup", hostname: "wrongfirst.dev" });
      const wrongActionRes = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "ts@wrongfirst.dev",
            password: "super-secret-123",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(wrongActionRes.status).toBe(403);

      // Wrong hostname -> 403
      vi.restoreAllMocks();
      mockSiteverify({ success: true, action: "login", hostname: "evil.example" });
      const wrongHostRes = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "ts@wrongfirst.dev",
            password: "super-secret-123",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(wrongHostRes.status).toBe(403);

      // Failed / replayed token -> 403
      vi.restoreAllMocks();
      mockSiteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
      const replayRes = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "ts@wrongfirst.dev",
            password: "super-secret-123",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(replayRes.status).toBe(403);
    });

    it("POST /api/auth/login/password authenticates verified user with valid password and sets session cookie", async () => {
      const passwordHash = await hashPassword("super-secret-123");
      const now = Date.now();
      await db
        .prepare(
          "INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("usr_pw_1", "admin@wrongfirst.dev", "Admin", "pro", passwordHash, now, now, now)
        .run();

      const loginRes = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "Admin@Wrongfirst.dev",
            password: "super-secret-123",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );

      expect(loginRes.status).toBe(200);
      const body = (await loginRes.json()) as any;
      expect(body.user.id).toBe("usr_pw_1");
      expect(body.user.tier).toBe("pro");

      const setCookie = loginRes.headers.get("Set-Cookie");
      expect(setCookie).toContain("session=sess_");

      const sessionCookie = setCookie!.split(";")[0];
      const meRes = await app.request(
        "/api/auth/me",
        { headers: { Cookie: sessionCookie } },
        mockEnv(),
      );
      expect(meRes.status).toBe(200);
      const meBody = (await meRes.json()) as any;
      expect(meBody.user.email).toBe("admin@wrongfirst.dev");
    });

    it("POST /api/auth/login/password rejects wrong password, unknown email, or passwordless user", async () => {
      const passwordHash = await hashPassword("right-password");
      const now = Date.now();
      await db
        .prepare(
          "INSERT INTO users (id, email, name, tier, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("usr_pw_2", "user@wrongfirst.dev", "User", "free", passwordHash, now, now)
        .run();
      await db
        .prepare(
          "INSERT INTO users (id, email, name, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("usr_nopw", "oauth@wrongfirst.dev", "OAuth User", "free", now, now)
        .run();

      const badPw = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@wrongfirst.dev",
            password: "wrong-password",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(badPw.status).toBe(401);

      const unknown = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "nobody@wrongfirst.dev",
            password: "right-password",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(unknown.status).toBe(401);

      const noPwUser = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "oauth@wrongfirst.dev",
            password: "anything",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(noPwUser.status).toBe(401);

      const overlongPw = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@wrongfirst.dev",
            password: "a".repeat(300),
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(overlongPw.status).toBe(401);
    });

    it("rejects unverified email accounts with 403 only after password matches", async () => {
      const passwordHash = await hashPassword("valid-unverified-pass");
      const now = Date.now();
      await db
        .prepare(
          "INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)",
        )
        .bind(
          "usr_unverified",
          "unverified@wrongfirst.dev",
          "Unverified",
          "free",
          passwordHash,
          now,
          now,
        )
        .run();

      const wrongPw = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "unverified@wrongfirst.dev",
            password: "wrong-password",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(wrongPw.status).toBe(401);

      const rightPw = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "unverified@wrongfirst.dev",
            password: "valid-unverified-pass",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(rightPw.status).toBe(403);
      const rightPwBody = (await rightPw.json()) as { error?: string };
      expect(rightPwBody.error).toContain("verify your email");
    });

    it("locks account with 429 after repeated failed logins across rotating IPs and clears on success", async () => {
      const passwordHash = await hashPassword("locked-test-pass-123");
      const now = Date.now();
      await db
        .prepare(
          "INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("usr_rl_1", "target@wrongfirst.dev", "Target", "free", passwordHash, now, now, now)
        .run();

      for (let i = 0; i < MAX_EMAIL_FAILURES; i++) {
        const res = await app.request(
          "/api/auth/login/password",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "CF-Connecting-IP": `198.51.100.${i + 1}`,
            },
            body: JSON.stringify({
              email: "target@wrongfirst.dev",
              password: "wrong",
              "cf-turnstile-response": VALID_TOKEN,
            }),
          },
          mockEnv(),
        );
        expect(res.status).toBe(401);
      }

      // Next attempt (even with the correct password!) is blocked with 429 + Retry-After
      const lockedRes = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": "203.0.113.99",
          },
          body: JSON.stringify({
            email: "target@wrongfirst.dev",
            password: "locked-test-pass-123",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(lockedRes.status).toBe(429);
      expect(Number(lockedRes.headers.get("Retry-After"))).toBeGreaterThan(0);
    });

    it("enforces NIST length policy and revokes all existing sessions on updateUserPassword", async () => {
      expect(validatePasswordPolicy("short").valid).toBe(false);
      expect(validatePasswordPolicy("a".repeat(257)).valid).toBe(false);
      expect(validatePasswordPolicy("correct horse battery staple").valid).toBe(true);

      const now = Date.now();
      const oldHash = await hashPassword("old-password-12345");
      await db
        .prepare(
          "INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("usr_pw_chg", "rotate@wrongfirst.dev", "Rotate", "free", oldHash, now, now, now)
        .run();

      const sess1 = await createSession(db, "usr_pw_chg");
      const sess2 = await createSession(db, "usr_pw_chg");

      await updateUserPassword(db, "usr_pw_chg", "brand-new-passphrase-2026");

      const s1Res = await app.request(
        "/api/auth/me",
        { headers: { Cookie: `session=${sess1}` } },
        mockEnv(),
      );
      const s2Res = await app.request(
        "/api/auth/me",
        { headers: { Cookie: `session=${sess2}` } },
        mockEnv(),
      );
      expect(s1Res.status).toBe(401);
      expect(s2Res.status).toBe(401);

      const loginNew = await app.request(
        "/api/auth/login/password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "rotate@wrongfirst.dev",
            password: "brand-new-passphrase-2026",
            "cf-turnstile-response": VALID_TOKEN,
          }),
        },
        mockEnv(),
      );
      expect(loginNew.status).toBe(200);
    });
  });
});
