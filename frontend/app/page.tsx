'use client';

import { useState, useEffect, useRef } from 'react';

interface PriceData {
  ticker: string;
  price: string;
  timestamp: number;
}

const AVAILABLE_TICKERS = [
  'BTCUSD', 'ETHUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD',
  'DOGEUSD', 'SOLUSD', 'DOTUSD', 'MATICUSD', 'LTCUSD',
  'SHIBUSD', 'TRXUSD', 'AVAXUSD', 'DAIUSD', 'WBTCUSD',
  'LINKUSD', 'UNIUSD', 'ATOMUSD', 'ETCUSD', 'TONUSD'
];

export default function Home() {
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [subscribedTickers, setSubscribedTickers] = useState<Set<string>>(new Set());
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const streamControllerRef = useRef<AbortController | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);

  useEffect(() => {
    console.log('Initializing connection to backend...');
    connectToBackend();

    return () => {
      if (streamControllerRef.current) {
        streamControllerRef.current.abort();
      }
    };
  }, []);

  const connectToBackend = async () => {
    try {
      if (streamControllerRef.current) {
        streamControllerRef.current.abort();
      }

      streamControllerRef.current = new AbortController();

      console.log('Creating stream connection...');

      const response = await fetch('http://localhost:8080/StreamPrices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: streamControllerRef.current.signal,
        duplex: 'half' as any,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setConnected(true);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.ticker && data.price) {
                console.log(`Price update received: ${data.ticker} = ${data.price}`);
                setPrices(prev => {
                  const newPrices = new Map(prev);
                  newPrices.set(data.ticker, {
                    ticker: data.ticker,
                    price: data.price,
                    timestamp: data.timestamp || Date.now()
                  });
                  return newPrices;
                });
              }
            } catch (e) {
              console.error('Failed to parse update:', e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to connect to backend:', error);
        setConnected(false);
        setTimeout(connectToBackend, 5000);
      }
    }
  };

  const subscribeTicker = async (ticker: string) => {
    if (subscribedTickers.has(ticker)) {
      console.log(`Already subscribed to ${ticker}`);
      return;
    }

    console.log(`Subscribing to ${ticker}...`);
    setSubscribedTickers(prev => new Set([...prev, ticker]));

    try {
      await fetch('http://localhost:8080/StreamPrices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticker }),
      });

      console.log(`Successfully subscribed to ${ticker}`);
    } catch (error) {
      console.error(`Failed to subscribe to ${ticker}:`, error);
      setSubscribedTickers(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticker);
        return newSet;
      });
    }
  };

  const unsubscribeTicker = async (ticker: string) => {
    console.log(`Unsubscribing from ${ticker}...`);

    setSubscribedTickers(prev => {
      const newSet = new Set(prev);
      newSet.delete(ticker);
      return newSet;
    });

    setPrices(prev => {
      const newPrices = new Map(prev);
      newPrices.delete(ticker);
      return newPrices;
    });

    console.log(`Unsubscribed from ${ticker}`);
  };

  const handleAddTicker = () => {
    if (selectedTicker && !subscribedTickers.has(selectedTicker)) {
      subscribeTicker(selectedTicker);
      setSelectedTicker('');
    }
  };

  const sortedTickers = Array.from(subscribedTickers).sort();
  const availableTickers = AVAILABLE_TICKERS.filter(t => !subscribedTickers.has(t)).sort();

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Cryptocurrency Price Tracker</h1>

      <div style={{ marginBottom: '20px' }}>
        <span style={{
          padding: '5px 10px',
          marginRight: '20px',
          backgroundColor: connected ? '#4CAF50' : '#f44336',
          color: 'white',
          borderRadius: '4px'
        }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>

        <select
          value={selectedTicker}
          onChange={(e) => setSelectedTicker(e.target.value)}
          style={{ padding: '5px', marginRight: '10px' }}
        >
          <option value="">Select a ticker...</option>
          {availableTickers.map(ticker => (
            <option key={ticker} value={ticker}>{ticker}</option>
          ))}
        </select>
        <button
          onClick={handleAddTicker}
          disabled={!selectedTicker || !connected}
          style={{ padding: '5px 10px' }}
        >
          Add Ticker
        </button>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        {sortedTickers.map(ticker => {
          const priceData = prices.get(ticker);
          return (
            <div
              key={ticker}
              style={{
                border: '1px solid #ccc',
                padding: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f9f9f9'
              }}
            >
              <div>
                <strong>{ticker}</strong>
                {priceData && (
                  <>
                    <span style={{ marginLeft: '20px', fontSize: '18px', color: '#2196F3' }}>
                      ${priceData.price}
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
                      {new Date(priceData.timestamp).toLocaleTimeString()}
                    </span>
                  </>
                )}
                {!priceData && (
                  <span style={{ marginLeft: '20px', color: '#999' }}>
                    Loading...
                  </span>
                )}
              </div>
              <button
                onClick={() => unsubscribeTicker(ticker)}
                style={{ padding: '5px 10px', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {sortedTickers.length === 0 && (
        <p style={{ color: '#666' }}>No tickers added yet. Select a ticker from the dropdown to get started.</p>
      )}
    </div>
  );
}