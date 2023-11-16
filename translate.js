import crypto from 'crypto';
import { Redis } from 'ioredis';
import { CronJob } from 'cron';
import _ from 'lodash';
import 'dotenv/config.js';

import * as tencent from './providers/tencent.js';
import * as baidu from './providers/baidu.js';

const redis = new Redis(process.env.REDIS_URL_CACHE, {
  keyPrefix: 'fanyi:',
});

const resetCreditsJob = new CronJob('0 5 0 1 * *', async () => {
  await redis.set('credits:baidu', 1000000);
  await redis.set('credits:tencent', 4500000);
});

resetCreditsJob.start();

/**
 * @param {number} chars
 */
async function getProvider(chars) {
  const providers = ['baidu', 'tencent'];
  const creditsKeys = providers.map((provider) => `credits:${provider}`);
  const creditsList = await redis.mget(...creditsKeys);
  for (const [provider, credits] of _.zip(providers, creditsList)) {
    if (credits && parseInt(credits) > chars) {
      return provider;
    }
  }
}

/**
 * @param {string} provider
 * @param {number} credits
 */
async function consume(provider, credits) {
  const remainCredits = await redis.incrby(`credits:${provider}`, -credits);
  if (remainCredits < 0) {
    await redis.incrby(`credits:${provider}`, credits);
    throw new Error('余额不足');
  }
  return remainCredits;
}

/**
 * @param {string} text
 */
export async function translate(text) {
  text = text.trim();
  const chars = text.length;
  if (!chars) {
    return text;
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

  const provider = await getProvider(chars);
  if (!provider) {
    throw new Error('余额不足');
  }
  const remainCredits = await consume(provider, chars);

  let tResult;
  switch (provider) {
    case 'baidu':
      tResult = await baidu.translate(text);
    case 'tencent':
      tResult = await tencent.translate(text);
  }

  const result = {
    text: tResult,
    provider,
  };
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 60 * 60 * 48);

  return {
    ...result,
    credits: remainCredits,
  };
}
