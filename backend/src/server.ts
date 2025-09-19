import { createServer } from 'http';
import { PriceScraper } from './price-scraper.js';

const priceScraper = new PriceScraper();

interface Client {
  id: string;
  tickers: Set<string>;
  callbacks: Map<string, (price: string) => void>;
}

const clients = new Map<string, Client>();
let clientIdCounter = 0;

async function handleStreamPrices(req: any, res: any) {
  const clientId = `client-${++clientIdCounter}`;
  console.log(`New client connected: ${clientId}`);

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Transfer-Encoding': 'chunked',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  const client: Client = {
    id: clientId,
    tickers: new Set(),
    callbacks: new Map()
  };

  clients.set(clientId, client);

  const sendUpdate = (ticker: string, price: string) => {
    const update = JSON.stringify({
      ticker,
      price,
      timestamp: Date.now()
    });
    res.write(update + '\n');
  };

  req.on('data', async (chunk: Buffer) => {
    try {
      const data = JSON.parse(chunk.toString());
      if (data.ticker) {
        const ticker = data.ticker.toUpperCase();
        console.log(`Client ${clientId} subscribing to ${ticker}`);

        if (!client.tickers.has(ticker)) {
          client.tickers.add(ticker);

          const callback = (price: string) => sendUpdate(ticker, price);
          client.callbacks.set(ticker, callback);

          await priceScraper.addTicker(ticker, callback);
        }
      }
    } catch (error) {
      console.error(`Error processing client data:`, error);
    }
  });

  req.on('close', async () => {
    console.log(`Client ${clientId} disconnected`);

    for (const [ticker, callback] of client.callbacks) {
      await priceScraper.removeTicker(ticker, callback);
    }

    clients.delete(clientId);
  });

  req.on('error', (error: Error) => {
    console.error(`Stream error for client ${clientId}:`, error);
  });
}

async function main() {
  await priceScraper.initialize();

  const server = createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms'
      });
      res.end();
      return;
    }

    if (req.url?.includes('/StreamPrices') && req.method === 'POST') {
      await handleStreamPrices(req, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Ready to stream cryptocurrency prices...');
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await priceScraper.cleanup();
    server.close();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Server failed to start:', error);
  process.exit(1);
});