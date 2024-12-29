import { Client, Users } from 'node-appwrite';
import Router from './router.js';
import dotenv from 'dotenv';
import googleTrends from 'google-trends-api';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Unified logging function with timestamps
const debug = (logFn, type, ...args) => {
  const timestamp = new Date().toISOString();
  logFn(`[${timestamp}] [${type}]`, ...args);
};

// GitHub Configuration
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const BRANCH = process.env.BRANCH || '';
const TOKEN = process.env.GITHUB_TOKEN || '';

const octokit = (TOKEN !== '') ? new Octokit({ auth: TOKEN }) : null;

// Helper function to fetch Google Trends
async function fetchGoogleTrends() {
  try {
    const response = await googleTrends.dailyTrends({
      geo: 'US',
    });

    const data = JSON.parse(response);
    const trends = data.default.trendingSearchesDays[0].trendingSearches.map(
      (search) => search.title.query
    );

    return trends;
  } catch (error) {
    throw new Error(`Error fetching Google Trends: ${error.message}`);
  }
}

// Helper function to create and push a new post
async function createAndPushPost(trends) {
  if (!octokit) {
    return {message: 'Please provide ENV variables.'}
  }

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const fileName = `google-trends-${dateStr}.md`;

  const content = `---
title: Google Trends for ${dateStr}
date: ${today.toISOString()}
categories: [Google Trends, Daily Trends]
tags: [trending, google trends, blog]
---

## Top Trending Topics

${trends.map((trend) => `- ${trend}`).join('\n')}

*This is a placeholder post generated automatically based on the latest Google Trends.*
`;

  const filePath = path.join('/tmp', fileName);

  // Write file to temporary directory
  fs.writeFileSync(filePath, content, 'utf8');

  const encodedContent = Buffer.from(content).toString('base64');

  // Check if the file already exists in the repo
  let sha = null;
  try {
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `_posts/${fileName}`,
      ref: BRANCH,
    });
    sha = data.sha;
  } catch (err) {
    // File does not exist, continue without sha
  }

  // Push to GitHub
  await octokit.repos.createOrUpdateFileContents({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: `_posts/${fileName}`,
    message: `Add new Google Trends post: ${fileName}`,
    content: encodedContent,
    branch: BRANCH,
    sha,
  });

  return { message: `File '${fileName}' pushed to GitHub successfully.` };
}

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  const logDebug = (...args) => debug(log, 'INFO', ...args);
  const errorDebug = (...args) => debug(error, 'ERROR', ...args);

  logDebug('Path: ', req.path);

  // Appwrite Client Setup
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? process.env.APPWRITE_FUNCTION_API_KEY);
  const users = new Users(client);

  // Set up routes
  const router = new Router();

  // Test route
  router.get('/ping', (req, res) => {
    res.json({ message: 'Pong' });
  });

  // Fetch trending terms
  router.get('/trends', async (req, res) => {
    try {
      const trends = await fetchGoogleTrends();
      res.json({ trends });
    } catch (err) {
      errorDebug(`Could not fetch trends: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Generate and push a new post
  router.post('/generate-post', async (req, res) => {
    try {
      const trends = await fetchGoogleTrends();
      const result = await createAndPushPost(trends);
      res.json(result);
    } catch (err) {
      errorDebug(`Could not generate post: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Fetch user details
  router.get('/users/*id', async (req, res) => {
    try {
      const response = await users.get(req.params.id);
      logDebug('User:', response);
      res.json(response);
    } catch (err) {
      errorDebug(`Could not get user: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Default route
  router.all('/*splat', (req, res) => {
    res.json({ message: 'Not Found', splat: req.params.splat });
  });

  // Handle the request
  router.handleRequest(req, res);
};