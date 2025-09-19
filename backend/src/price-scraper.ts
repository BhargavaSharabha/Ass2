import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface PriceListener {
  ticker: string;
  callback: (price: string) => void;
}

export class PriceScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private listeners: Map<string, Set<(price: string) => void>> = new Map();
  private prices: Map<string, string> = new Map();
  private intervalIds: Map<string, NodeJS.Timeout> = new Map();

  async initialize() {
    console.log('Initializing browser...');
    this.browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    console.log('Browser initialized successfully');
  }

  async addTicker(ticker: string, callback: (price: string) => void) {
    const upperTicker = ticker.toUpperCase();
    console.log(`Adding ticker: ${upperTicker}`);

    if (!this.listeners.has(upperTicker)) {
      this.listeners.set(upperTicker, new Set());
      await this.startScrapingTicker(upperTicker);
    }

    const callbacks = this.listeners.get(upperTicker)!;
    callbacks.add(callback);

    const currentPrice = this.prices.get(upperTicker);
    if (currentPrice) {
      callback(currentPrice);
    }
  }

  async removeTicker(ticker: string, callback: (price: string) => void) {
    const upperTicker = ticker.toUpperCase();
    console.log(`Removing ticker: ${upperTicker}`);

    const callbacks = this.listeners.get(upperTicker);
    if (callbacks) {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.listeners.delete(upperTicker);
        await this.stopScrapingTicker(upperTicker);
      }
    }
  }

  private async startScrapingTicker(ticker: string) {
    if (!this.context) {
      throw new Error('Browser not initialized');
    }

    console.log(`Starting to scrape ${ticker}`);
    const page = await this.context.newPage();
    this.pages.set(ticker, page);

    const url = `https://www.tradingview.com/symbols/${ticker}/?exchange=BINANCE`;
    console.log(`Navigating to ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(`Page loaded for ${ticker}`);

      await page.waitForTimeout(2000);

      const intervalId = setInterval(async () => {
        try {
          const price = await this.extractPrice(page, ticker);
          if (price && price !== this.prices.get(ticker)) {
            console.log(`Price update for ${ticker}: ${price}`);
            this.prices.set(ticker, price);
            this.notifyListeners(ticker, price);
          }
        } catch (error) {
          console.error(`Error extracting price for ${ticker}:`, error);
        }
      }, 500);

      this.intervalIds.set(ticker, intervalId);

    } catch (error) {
      console.error(`Error loading page for ${ticker}:`, error);
      throw error;
    }
  }

  private async extractPrice(page: Page, ticker: string): Promise<string | null> {
    try {
      const priceSelectors = [
        'div[data-symbol-short] span.js-symbol-last',
        'span[data-symbol-last]',
        'div.tv-symbol-price-quote__value',
        '[class*="lastPrice"]',
        'span.tv-symbol-price-quote__value',
        'div[class*="priceValue"]'
      ];

      for (const selector of priceSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const price = await element.textContent();
            if (price && price.trim()) {
              return price.trim();
            }
          }
        } catch (e) {
        }
      }

      const price = await page.evaluate(() => {
        const elements = document.querySelectorAll('span, div');
        for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (/^\d{1,10}([.,]\d{1,10})?$/.test(text) && text.length > 1) {
            const parent = el.parentElement;
            if (parent && (
              parent.className.includes('price') ||
              parent.className.includes('value') ||
              parent.className.includes('quote')
            )) {
              return text;
            }
          }
        }
        return null;
      });

      return price;
    } catch (error) {
      console.error(`Error extracting price for ${ticker}:`, error);
      return null;
    }
  }

  private async stopScrapingTicker(ticker: string) {
    console.log(`Stopping scraping for ${ticker}`);

    const intervalId = this.intervalIds.get(ticker);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(ticker);
    }

    const page = this.pages.get(ticker);
    if (page) {
      await page.close();
      this.pages.delete(ticker);
    }

    this.prices.delete(ticker);
  }

  private notifyListeners(ticker: string, price: string) {
    const callbacks = this.listeners.get(ticker);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(price);
        } catch (error) {
          console.error(`Error in price callback for ${ticker}:`, error);
        }
      });
    }
  }

  async cleanup() {
    console.log('Cleaning up browser resources...');

    for (const intervalId of this.intervalIds.values()) {
      clearInterval(intervalId);
    }
    this.intervalIds.clear();

    for (const page of this.pages.values()) {
      await page.close();
    }
    this.pages.clear();

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }

    console.log('Cleanup complete');
  }
}