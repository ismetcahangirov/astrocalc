import { Redis } from '@upstash/redis';

export type RedisClient = Redis;

/** Create an Upstash Redis client over its serverless REST API. */
export function createRedis(url: string, token: string): Redis {
  return new Redis({ url, token });
}
