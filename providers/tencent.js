import { tmt } from 'tencentcloud-sdk-nodejs';

const client = new tmt.v20180321.Client({
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  region: 'ap-beijing',
  profile: {
    httpProfile: {
      endpoint: 'tmt.tencentcloudapi.com',
    },
  },
});

/**
 * @param {string} text
 */
export async function translate(text) {
  const res = await client.TextTranslate({
    SourceText: text,
    Source: 'auto',
    Target: 'zh',
    ProjectId: 0,
  });
  return {
    text: res.TargetText,
    from: getLangCode(res.Source),
  };
}

/**
 * @param {string} source
 */
function getLangCode(source) {
  if (source === 'zh-TW') {
    return 'zh-Hant';
  }
  return source;
}
