/// <reference types="@cloudflare/workers-types" />
/// <reference types="react" />

interface CloudflareEnv {
  DB: D1Database;
  AVATARS: R2Bucket;
}
