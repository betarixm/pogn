import { uuidv7 } from "uuidv7";

export type PostVisibility = "public" | "members";

export type UserId = string & { readonly __brand: "UserId" };
export type LayerId = string & { readonly __brand: "LayerId" };
export type PostId = string & { readonly __brand: "PostId" };
export type AttachmentId = string & { readonly __brand: "AttachmentId" };

export const createUserId = (value: string): UserId => value as UserId;
export const createLayerId = (value: string): LayerId => value as LayerId;
export const createPostId = (value: string): PostId => value as PostId;
export const createAttachmentId = (value: string): AttachmentId =>
  value as AttachmentId;

const SNOWFLAKE_EPOCH_MS = 1_288_834_974_657n;
const SNOWFLAKE_SEQUENCE_BITS = 12n;
const SNOWFLAKE_WORKER_ID_BITS = 10n;
const SNOWFLAKE_MAX_SEQUENCE = (1n << SNOWFLAKE_SEQUENCE_BITS) - 1n;
const SNOWFLAKE_TIMESTAMP_SHIFT = SNOWFLAKE_SEQUENCE_BITS + SNOWFLAKE_WORKER_ID_BITS;
const SNOWFLAKE_WORKER_ID_SHIFT = SNOWFLAKE_SEQUENCE_BITS;
const SNOWFLAKE_WORKER_ID = 0n;

let lastSnowflakeTimestampMs = 0n;
let snowflakeSequence = 0n;

const nowMsBigInt = (): bigint => BigInt(Date.now());

const waitNextMillisecond = (currentTimestampMs: bigint): bigint => {
  let timestampMs = currentTimestampMs;
  while (timestampMs <= lastSnowflakeTimestampMs) {
    timestampMs = nowMsBigInt();
  }
  return timestampMs;
};

const generateSnowflakeId = (): string => {
  let timestampMs = nowMsBigInt();

  // Prevent duplicates when the system clock moves backward.
  if (timestampMs < lastSnowflakeTimestampMs) {
    timestampMs = lastSnowflakeTimestampMs;
  }

  if (timestampMs === lastSnowflakeTimestampMs) {
    snowflakeSequence = (snowflakeSequence + 1n) & SNOWFLAKE_MAX_SEQUENCE;
    if (snowflakeSequence === 0n) {
      timestampMs = waitNextMillisecond(timestampMs);
    }
  } else {
    snowflakeSequence = 0n;
  }

  lastSnowflakeTimestampMs = timestampMs;

  const snowflake =
    ((timestampMs - SNOWFLAKE_EPOCH_MS) << SNOWFLAKE_TIMESTAMP_SHIFT) |
    (SNOWFLAKE_WORKER_ID << SNOWFLAKE_WORKER_ID_SHIFT) |
    snowflakeSequence;

  return snowflake.toString();
};

export const generateUserId = (): UserId => generateSnowflakeId() as UserId;
export const generateLayerId = (): LayerId => generateSnowflakeId() as LayerId;
export const generatePostId = (): PostId => generateSnowflakeId() as PostId;
export const generateAttachmentId = (): AttachmentId => uuidv7() as AttachmentId;
