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

if (!TOKEN || !REPO_OWNER || !REPO_NAME || !BRANCH) {
  console.error('Environment variables for GitHub configuration are missing.');
}

// Helper function to fetch Google Trends
async function fetchGoogleTrends(logDebug, errorDebug) {
  logDebug('Fetching Google Trends...');
  try {
    const response = await googleTrends.dailyTrends({ geo: 'US' });
    logDebug('Google Trends response received.');

    const data = JSON.parse(response);
    const trends = data.default.trendingSearchesDays[0].trendingSearches.map(
      (search) => search.title.query
    );

    logDebug('Extracted trends:', trends);
    return trends;
  } catch (error) {
    errorDebug('Error fetching Google Trends:', error.message);
    throw new Error(`Error fetching Google Trends: ${error.message}`);
  }
}

// Helper function to create and push a new post
async function createAndPushPost(trends, logDebug, errorDebug) {
  if (!octokit) {
    logDebug('GitHub configuration missing. Skipping push operation.');
    return { message: 'Please provide ENV variables.' };
  }

  logDebug('Generating post content...');
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

  logDebug('Generated post content:', content);

  // Write the file locally for GitHub push
  const filePath = path.join('/tmp', fileName);
  try {
    logDebug(`Writing post content to ${filePath}...`);
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    errorDebug(`Error writing file to ${filePath}:`, error.message);
    throw error;
  }

  const encodedContent = Buffer.from(content).toString('base64');
  let sha = null;

  // Check if the file already exists in the repo
  try {
    logDebug('Checking if the file already exists in the repository...');
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `_posts/${fileName}`,
      ref: BRANCH,
    });
    sha = data.sha;
    logDebug(`File already exists. SHA: ${sha}`);
  } catch (err) {
    logDebug('File does not exist. Proceeding to create a new file...');
  }

  // Push to GitHub
  try {
    logDebug('Pushing the file to GitHub...');
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `_posts/${fileName}`,
      message: `Add new Google Trends post: ${fileName}`,
      content: encodedContent,
      branch: BRANCH,
      sha,
    });
    logDebug(`File '${fileName}' pushed to GitHub successfully.`);
  } catch (error) {
    errorDebug('Error pushing file to GitHub:', error.message);
    throw error;
  }

  // Return both the generated content and the success message
  return {
    message: `File '${fileName}' successfully pushed to GitHub.`,
    content,
  };
}

// Main handler function
export default async ({ req, res, log, error }) => {
  const logDebug = (...args) => debug(log, 'INFO', ...args);
  const errorDebug = (...args) => debug(error, 'ERROR', ...args);

  logDebug('Path:', req.path);

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
    logDebug('Ping endpoint hit.');
    return res.json({ message: 'Pong' });
  });

  // Fetch trending terms
  router.get('/trends', async (req, res) => {
    logDebug('Fetching trending terms...');
    try {
      const trends = await fetchGoogleTrends(logDebug, errorDebug);
      logDebug('Successfully fetched trends.');
      return res.json({ trends });
    } catch (err) {
      errorDebug(`Could not fetch trends: ${err.message}`);
      return res.empty();
    }
  });

  // Generate and push a new post
  router.get('/generate-post', async (req, res) => {
    logDebug('Generating and pushing new post...');
    try {
      const trends = await fetchGoogleTrends(logDebug, errorDebug);
      const result = await createAndPushPost(trends, logDebug, errorDebug);
      logDebug('Post generation and push successful.');
      return res.json(result);
    } catch (err) {
      errorDebug(`Could not generate post: ${err.message}`);
      return res.empty();
    }
  });

  // Fetch user details
  router.get('/users/*id', async (req, res) => {
    logDebug('Fetching user details...');
    try {
      const response = await users.get(req.params.id);
      logDebug('User fetched successfully:', response);
      return res.json(response);
    } catch (err) {
      errorDebug(`Could not get user: ${err.message}`);
      return res.empty();
    }
  });

  // Default route
  router.all('/*splat', (req, res) => {
    logDebug('Default route hit.');
    return res.empty();
  });

  // Handle the request
  logDebug('Handling request...');
  return router.handleRequest(req, res);
};