import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs';
import { resolve } from 'node:path';
import { HTML_PORT, SERVICE_PORT, MONGO_URI } from './constants.js';
import { validateEventObject } from './event.js';
import { MongoClient, Db } from 'mongodb';

// HTML server
const startHTMLServer = (): void => {
  createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && /\/[123]\.html/.test(req.url ?? '')) {
      readFile(resolve('public/common.html'), (err, content) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('Not Found', 'utf-8');
          } else {
            // Some server error
            res.writeHead(500);
            res.end(`Server Error: ${err.code}`);
          }
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('Not Found', 'utf-8');
    }
  }).listen(HTML_PORT, () => {
    console.log(`HTML server listening on port ${HTML_PORT}/`);
  });
};

/**
 * Event logging request handler
 * @param req
 * @param res
 * @param db
 */
const handleTrackRequest = (
  req: IncomingMessage,
  res: ServerResponse,
  db: Db,
): void => {
  res.setHeader('Access-Control-Allow-Origin', `http://localhost:${HTML_PORT}`);
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    let events: Object[];
    try {
      if (body[0] === '-') {
        events = JSON.parse(body.slice(1));
      } else {
        events = JSON.parse(body);
      }

      // Validation
      if (Array.isArray(events) && events.every(validateEventObject)) {
        // Filter out empty tags
        events = events.map((event) => ({
          ...event,
          tags: event.tags.filter((tag) => !!tag),
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', data: 'Events received' }));

        try {
          await db.collection('tracks').insertMany(events);
          console.log('Events inserted into MongoDB');
        } catch (dbError) {
          console.error('Failed to insert events into MongoDB:', dbError);
        }
      } else {
        throw new Error('Invalid events format');
      }
    } catch (err: any) {
      console.error(err.message);
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// JS and API server
const startJSnAPIServer = (db: Db): void => {
  createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/tracker') {
      readFile(resolve('dist/tracker.js'), (err, content) => {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': `http://localhost:${HTML_PORT}`,
          Vary: 'Origin',
        });
        res.end(content, 'utf-8');
      });
    } else if (req.method === 'POST' && req.url === '/track') {
      handleTrackRequest(req, res, db);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  }).listen(SERVICE_PORT, () => {
    console.log(`SERVICE server listening on port ${SERVICE_PORT}`);
  });
};

// Connecting to the DB and starting servers
(async (): Promise<void> => {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB:', db.databaseName);
    startHTMLServer();
    startJSnAPIServer(db);
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
})();
