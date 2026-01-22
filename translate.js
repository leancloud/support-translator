import crypto from 'crypto';
import { Redis } from 'ioredis';
import 'dotenv/config.js';

import * as tencent from './providers/tencent.js';

const ttl = 60 * 60 * 10; // 10 hours

const providers = [
  {
    name: 'tencent',
    translate: tencent.translate,
  },
];

const redis = new Redis(process.env.REDIS_URL_CACHE, {
  keyPrefix: 'fanyi:',
});


/**
 * @param {string} text
 */
export async function translate(text) {
  text = text.trim();
  const chars = text.length;
  if (!chars) {
    return { text };
  }

  const textHash = crypto.createHash('md5').update(text).digest('hex');
  const cacheKey = `cache:${textHash}`;
  const cacheValue = await redis.get(cacheKey);
  if (cacheValue !== null) {
    return {
      ...JSON.parse(cacheValue),
      cache: true,
    };
  }

  const provider = providers[0];
  if (!provider) {
    throw new Error('没有可用的翻译服务');
  }

  const tResult = await provider.translate(text);

  const result = {
    provider: provider.name,
    from: tResult.from,
    text: tResult.text,
  };
  await redis.set(cacheKey, JSON.stringify(result), 'EX', ttl);

  return {
    ...result,
  };
}
