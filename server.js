import express from 'express';
import bodyParser from 'body-parser';

import { translate } from './translate.js';

const token = process.env.FANYI_TOKEN;
const app = express();

app.use(bodyParser.json());

app.post('/', async (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.status(400).json({ message: 'text is not a string' });
  }
  try {
    const result = await translate(text);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.listen(process.env.LEANCLOUD_APP_PORT || 3000, () => {
  console.log('App Launched');
});
