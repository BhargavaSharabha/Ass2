'use client';

import { useState, useEffect, useRef } from 'react';

interface PriceData {
  ticker: string;
  price: string;
  timestamp: number;
}

export default function Home() {
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [subscribedTickers, setSubscribedTickers] = useState<Set<string>>(new Set());
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    console.log('Initializing connection to backend...');
    connectToBackend();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const connectToBackend = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('Creating EventSource connection...');
    const eventSource = new EventSource('http://localhost:8080/events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('Connected to backend');
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setConnected(false);
      setTimeout(() => connectToBackend(), 5000);
    };
  };

  const subscribeTicker = async (ticker: string) => {
    const upperTicker = ticker.toUpperCase();

    if (subscribedTickers.has(upperTicker)) {
      console.log(`Already subscribed to ${upperTicker}`);
      setError(`Already subscribed to ${upperTicker}`);
      return;
    }

    console.log(`Subscribing to ${upperTicker}...`);
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8080/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticker: upperTicker }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to subscribe to ${upperTicker}`);
      }

      setSubscribedTickers(prev => new Set([...prev, upperTicker]));
      console.log(`Successfully subscribed to ${upperTicker}`);
      setSelectedTicker('');
    } catch (error: any) {
      console.error(`Failed to subscribe to ${upperTicker}:`, error);
      setError(error.message || `Failed to subscribe to ${upperTicker}`);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeTicker = async (ticker: string) => {
    console.log(`Unsubscribing from ${ticker}...`);

    try {
      const response = await fetch('http://localhost:8080/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticker }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
    } catch (error) {
      console.error(`Failed to unsubscribe from ${ticker}:`, error);
    }
  };

  const handleAddTicker = () => {
    const trimmedTicker = selectedTicker.trim();
    if (!trimmedTicker) {
      setError('Please enter a ticker symbol');
      return;
    }
    subscribeTicker(trimmedTicker);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleAddTicker();
    }
  };

  const sortedTickers = Array.from(subscribedTickers).sort();

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

        <input
          type="text"
          value={selectedTicker}
          onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
          onKeyPress={handleKeyPress}
          placeholder="Enter ticker (e.g., BTCUSD)"
          disabled={loading || !connected}
          style={{
            padding: '5px',
            marginRight: '10px',
            width: '200px',
            textTransform: 'uppercase'
          }}
        />
        <button
          onClick={handleAddTicker}
          disabled={!selectedTicker || !connected || loading}
          style={{ padding: '5px 10px' }}
        >
          {loading ? 'Adding...' : 'Add Ticker'}
        </button>
        {error && (
          <span style={{
            marginLeft: '10px',
            color: '#f44336',
            fontSize: '14px'
          }}>
            {error}
          </span>
        )}
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