import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, q } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const COOKIE = "ipa_studio";
const SESSION_DAYS = 30;

export type StudioUser = { id: string; email: string; name: string; role: "admin" | "producer" };

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// Compared against when the email is unknown, so both paths take the same time.
const DUMMY = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [, saltB64, hashB64] = (stored || DUMMY).split("$");
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected) && Boolean(stored);
}

export async function startSession(userId: string) {
  const token = newToken();
  await q(
    `insert into studio.sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + ($3 || ' days')::interval)`,
    [sha256(token), userId, String(SESSION_DAYS)],
  );
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await q(`delete from studio.sessions where token_hash = $1`, [sha256(token)]);
  cookies().delete(COOKIE);
}

export const getUser = cache(async (): Promise<StudioUser | null> => {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return one<StudioUser>(
    `select u.id, u.email, u.name, u.role
       from studio.sessions s join studio.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.active`,
    [sha256(token)],
  );
});

export async function requireUser(): Promise<StudioUser> {
  const user = await getUser();
  if (!user) redirect("/studio/login");
  return user;
}

export async function requireAdmin(): Promise<StudioUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/studio");
  return user;
}

/** A one-time link where someone picks their own password. Good for 72 hours. */
export async function createSetupToken(userId: string): Promise<string> {
  const token = newToken();
  await q(
    `insert into studio.setup_tokens (token_hash, user_id, expires_at)
     values ($1, $2, now() + interval '72 hours')`,
    [sha256(token), userId],
  );
  return token;
}

// ── BytePlus keys are encrypted at rest; STUDIO_SECRET never touches the database. ──

function secretKey(): Buffer {
  const secret = process.env.STUDIO_SECRET;
  if (!secret || secret.length < 32) throw new Error("STUDIO_SECRET is not set");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, body] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
