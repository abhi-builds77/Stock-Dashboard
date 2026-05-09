# Stock Dashboards

An interactive financial dashboard built with Flask, Plotly, and yFinance. Visualize stock price history, trading volume, and quarterly revenue in a single view.

## Features

- Line and Candlestick chart modes
- Volume subplot with color-coded bars
- Quarterly revenue overlay from Macrotrends
- Custom range selector: 1M, 6M, YTD, 1Y, All
- Auto-scaling X and Y axes on every range change
- Pan and scroll zoom with live Y-axis rescaling
- Quick-load presets: TSLA, GME, AAPL, AMZN, NVDA
- Any ticker supported via Yahoo Finance

## Project Structure

```
Stock-Dashboard/
│
├── app.py           # Flask server and API routes
├── dashboard.py     # Data fetching and Plotly figure builder
│
├── templates/
│   └── index.html   # Main UI
│
└── static/
    ├── style.css    # Styles
    └── script.js    # Chart logic and range controls
```

## Installation

**1. Clone or download the project**

```bash
git clone https://github.com/yourname/stock-dashboard.git
cd stock-dashboard
```

**2. Create a virtual environment**

```bash
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows
```

**3. Install dependencies**

```bash
pip install flask yfinance pandas plotly requests beautifulsoup4
```

## Running the App

```bash
python app.py
```

Then open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## Usage

1. Enter a ticker symbol (e.g. `AAPL`) in the Ticker field
2. Optionally paste a Macrotrends revenue URL for the revenue overlay
3. Click **Load** or use a Quick Load preset
4. Use the **1M / 6M / YTD / 1Y / All** buttons to change the time range
5. Toggle between **Line** and **Candlestick** using the chart buttons
6. Pan by dragging, zoom with scroll wheel

### Revenue URL Format

```
https://www.macrotrends.net/stocks/charts/TICKER/company-name/revenue
```

Examples:
- `https://www.macrotrends.net/stocks/charts/AAPL/apple/revenue`
- `https://www.macrotrends.net/stocks/charts/TSLA/tesla/revenue`

## Dependencies

| Package | Purpose |
|---|---|
| Flask | Web server |
| yfinance | Stock price data |
| pandas | Data processing |
| plotly | Interactive charts |
| requests | HTTP requests |
| beautifulsoup4 | Revenue data scraping |

## Notes

- Stock data is fetched live from Yahoo Finance on every load; no caching
- Revenue data is scraped from Macrotrends and may break if their page structure changes
- The revenue URL field is optional; the chart loads without it