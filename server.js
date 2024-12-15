import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config(); // load .env file

const app = express();
const port = process.env.PORT || 3003;

app.use(bodyParser.json());

import mainFunction from './src/main.js';

app.all('*', async (req, res) => {
  const log = console.log;
  const error = console.error;

  try {
    const result = await mainFunction({ req, res, log, error });

  } catch (err) {
    error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});