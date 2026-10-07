#!/usr/bin/env node
/**
 * Upload animation files to the Cloudflare R2 bucket.
 *
 *   npm run media:upload -- <file...> [--prefix reel/] [--force]
 *
 *   npm run media:upload -- ~/Renders/degen-future-trailer.mp4 --prefix reel/
 *   → reel/degen-future-trailer.mp4  (put that key in content/site.ts as `src`)
 *
 * Objects are stored with a one-year immutable cache header, so a key is never
 * overwritten by accident: if it already exists the file is skipped. Pass
 * --force to replace it deliberately (then rename the key, or purge the cache
 * in Cloudflare — browsers and the CDN will keep serving the old bytes).
 *
 * Credentials come from .env.local (see .env.example). Large files go up as
 * multipart so a multi-GB master doesn't have to fit in memory.
 */

import { createReadStream, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const TYPES = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".json": "application/json", // Lottie
  ".lottie": "application/zip",
  ".riv": "application/octet-stream", // Rive
};

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return v;
};

const args = process.argv.slice(2);
let prefix = "";
let force = false;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--prefix") prefix = args[++i] ?? "";
  else if (args[i] === "--force") force = true;
  else files.push(args[i]);
}
if (files.length === 0) {
  console.error("Usage: npm run media:upload -- <file...> [--prefix reel/] [--force]");
  process.exit(1);
}
if (prefix && !prefix.endsWith("/")) prefix += "/";

const accountId = need("R2_ACCOUNT_ID");
const bucket = need("R2_BUCKET");
const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: need("R2_ACCESS_KEY_ID"),
    secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
  },
});
const publicBase = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const exists = async (Key) => {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key }));
    return true;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") return false;
    throw e;
  }
};

let failed = 0;
for (const file of files) {
  const ext = extname(file).toLowerCase();
  const key = prefix + slug(basename(file));
  const type = TYPES[ext];
  if (!type) {
    console.error(`✗ ${file}: unsupported type "${ext}"`);
    failed++;
    continue;
  }
  try {
    if (!force && (await exists(key))) {
      console.log(`– ${key} already exists, skipped (use --force to replace)`);
      continue;
    }
    const size = statSync(file).size;
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: createReadStream(file),
        ContentType: type,
        CacheControl: "public, max-age=31536000, immutable",
      },
      queueSize: 4,
      partSize: 16 * 1024 * 1024,
    });
    upload.on("httpUploadProgress", ({ loaded }) => {
      if (size > 0) process.stdout.write(`\r  ${key}  ${Math.round(((loaded ?? 0) / size) * 100)}%`);
    });
    await upload.done();
    process.stdout.write("\r\x1b[K");
    console.log(`✓ ${key}${publicBase ? `  →  ${publicBase}/${key}` : ""}`);
  } catch (e) {
    process.stdout.write("\n");
    console.error(`✗ ${file}: ${e?.message ?? e}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
