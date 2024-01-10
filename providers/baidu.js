import crypto from 'node:crypto';
import { URLSearchParams } from 'node:url';
import axios from 'axios';

const APP_ID = process.env.BAIDU_APP_ID;
const APP_SECRET = process.env.BAIDU_APP_SECRET;

const LANG_CODE_MAP = {
  jp: 'ja', // 日语
  kor: 'ko', // 韩语
  fra: 'fr', // 法语
  spa: 'es', // 西班牙语
  vie: 'vi', // 越南语
  ara: 'ar', // 阿拉伯语
};

/**
 * @param {string} text
 */
export async function translate(text) {
  const salt = crypto.randomBytes(4).toString('hex');
  const sign = crypto
    .createHash('md5')
    .update(APP_ID + text + salt + APP_SECRET)
    .digest('hex');

  const params = new URLSearchParams({
    q: text,
    from: 'auto',
    to: 'zh',
    appid: APP_ID,
    salt,
    sign,
  });

  const { data } = await axios.post(
    'https://fanyi-api.baidu.com/api/trans/vip/translate',
    params.toString()
  );

  if (data.error_code) {
    throw new Error(`${data.error_code}:${data.error_msg}`);
  }

  for (const { src, dst } of data.trans_result) {
    text = text.replace(src, dst);
  }

  return {
    text,
    from: getLangCode(data.from),
  };
}

/**
 * @param {string} from
 */
function getLangCode(from) {
  return LANG_CODE_MAP[from] || from;
}
