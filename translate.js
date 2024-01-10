import crypto from 'crypto';
import { Redis } from 'ioredis';
import { CronJob } from 'cron';
import _ from 'lodash';
import 'dotenv/config.js';

import * as tencent from './providers/tencent.js';
import * as baidu from './providers/baidu.js';

const providers = [
  {
    name: 'baidu',
    translate: baidu.translate,
    credits: 1000000,
  },
  {
    name: 'tencent',
    translate: tencent.translate,
    credits: 5000000,
  },
];

const redis = new Redis(process.env.REDIS_URL_CACHE, {
  keyPrefix: 'fanyi:',
});

const resetCreditsJob = new CronJob('0 5 0 1 * *', async () => {
  for (const provider of providers) {
    await produce(provider);
  }
});

resetCreditsJob.start();

/**
 * @param {number} chars
 */
async function getProvider(chars) {
  const _providers = _.shuffle(providers);
  const creditsKeys = _providers.map((provider) => `credits:${provider.name}`);
  const creditsList = await redis.mget(...creditsKeys);
  for (const [provider, credits] of _.zip(_providers, creditsList)) {
    if (credits && parseInt(credits) > chars) {
      return provider;
    }
  }
}

async function produce(provider) {
  const credits = Math.floor(provider.credits * 0.95);
  await redis.set(`credits:${provider.name}`, credits.toString());
  console.log(`[info] reset credits of ${provider.name} to ${credits}`);
}

async function consume(provider, credits) {
  const remainCredits = await redis.incrby(
    `credits:${provider.name}`,
    -credits
  );
  if (remainCredits < 0) {
    await redis.incrby(`credits:${provider.name}`, credits);
    throw new Error('余额不足');
  }
  console.log(`[info] credits of ${provider.name} down to ${remainCredits}`);
  return remainCredits;
}

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

  const provider = await getProvider(chars);
  if (!provider) {
    throw new Error('余额不足');
  }
  const remainCredits = await consume(provider, chars);

  const tResult = await provider.translate(text);

  const result = {
    provider: provider.name,
    from: tResult.from,
    text: tResult.text,
  };
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 60 * 60 * 2);

  return {
    ...result,
    credits: remainCredits,
  };
}
