import { Client, Users } from 'node-appwrite';
import Router from './router.js';

// Unified logging function with timestamps
const debug = (logFn, type, ...args) => {
  const timestamp = new Date().toISOString();
  logFn(`[${timestamp}] [${type}]`, ...args);
};

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  const logDebug = (...args) => debug(log, 'INFO', ...args);
  const errorDebug = (...args) => debug(error, 'ERROR', ...args);

  logDebug('Path: ', req.path);
  
  // You can use the Appwrite SDK to interact with other services
  // For this example, we're using the Users service
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? process.env.APPWRITE_FUNCTION_API_KEY);
  const users = new Users(client);

  // Set up my routes
  const router = new Router();

  router.get('/ping', (req, res) => { res.json({message: 'Pong'}); });

  router.get('/users/*id', async (req, res) => {
    try {
      const response = await users.get(req.params.id);
      console.log('user: ', response);
      res.json(response);
    } catch (err) {
      errorDebug(`Could not get user: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  router.all('/*splat', (req, res) => { res.json({ message: 'Not Found', splat: req.params.splat }); });

  // Handle the request
  router.handleRequest(req, res);
};
