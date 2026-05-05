import yfinance as yf
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import requests
from bs4 import BeautifulSoup
import json

def fetch_stock_data(ticker_symbol: str) -> pd.DataFrame:
    stock = yf.Ticker(ticker_symbol)
    stock_data = stock.history(period="max")
    stock_data.reset_index(inplace=True)
    
    if "Date" in stock_data.columns:
        stock_data["Date"] = pd.to_datetime(stock_data["Date"], utc=True).dt.tz_convert(None)
        
    return stock_data

def fetch_revenue_data(url: str) -> pd.DataFrame:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        tables = soup.find_all("table")
        revenue_df = pd.DataFrame(columns=["Date", "Revenue"])

        for row in tables[1].tbody.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) > 1:
                revenue_df.loc[len(revenue_df)] = [cols[0].text.strip(), cols[1].text.strip()]

        revenue_df["Revenue"] = revenue_df["Revenue"].str.replace(r'[,$]', "", regex=True)
        revenue_df["Revenue"] = pd.to_numeric(revenue_df["Revenue"], errors="coerce")
        revenue_df.dropna(subset=["Revenue"], inplace=True)
        
        if "Date" in revenue_df.columns:
            revenue_df["Date"] = pd.to_datetime(revenue_df["Date"], utc=True).dt.tz_convert(None)
            
        revenue_df.sort_values("Date", inplace=True)
        return revenue_df
    except Exception:
        return pd.DataFrame(columns=["Date", "Revenue"])


def create_dashboard_figure(stock_data: pd.DataFrame, revenue_data: pd.DataFrame, title: str):
    
    # 2-Row Layout with Revenue overlaid on Row 1 (secondary_y)
    fig = make_subplots(
        rows=2, cols=1, shared_xaxes=True,
        row_heights=[0.75, 0.25], vertical_spacing=0.03,
        specs=[[{"secondary_y": True}], [{"secondary_y": False}]],
    )

    # Trace 0: Close Price (Row 1, Primary Y)
    fig.add_trace(
        go.Scatter(
            x=stock_data["Date"], y=stock_data["Close"],
            mode="lines", name="Close Price",
            line=dict(color="#3b82f6", width=2),
            fill='tozeroy', fillcolor='rgba(59, 130, 246, 0.1)',
            hovertemplate="<b>Close</b>: $%{y:,.2f}<extra></extra>",
            visible=True,
        ), row=1, col=1, secondary_y=False
    )

    # Trace 1: Candlestick (Row 1, Primary Y)
    fig.add_trace(
        go.Candlestick(
            x=stock_data["Date"],
            open=stock_data["Open"], high=stock_data["High"],
            low=stock_data["Low"], close=stock_data["Close"],
            name="OHLC",
            increasing_line_color="#10b981", decreasing_line_color="#ef4444",
            visible=False,
        ), row=1, col=1, secondary_y=False
    )

    if revenue_data.empty:
        revenue_data = pd.DataFrame({"Date": [stock_data["Date"].iloc[-1]], "Revenue": [None]})

    # Trace 2: Revenue (Row 1, Secondary Y)
    fig.add_trace(
        go.Scatter(
            x=revenue_data["Date"], y=revenue_data["Revenue"],
            mode="lines+markers", name="Revenue (M)",
            line=dict(color="#ec4899", width=2),
            marker=dict(size=8, symbol="diamond"),
            hovertemplate="<b>Revenue</b>: $%{y:,.0f}M<extra></extra>",
        ), row=1, col=1, secondary_y=True
    )

    # Trace 3: Volume (Row 2, Primary Y)
    colors = ["#10b981" if c >= o else "#ef4444" for c, o in zip(stock_data["Close"], stock_data["Open"])]
    fig.add_trace(
        go.Bar(
            x=stock_data["Date"], y=stock_data["Volume"],
            name="Volume", marker_color=colors, opacity=0.8,
            hovertemplate="<b>Volume</b>: %{y:,.0f}<extra></extra>",
            showlegend=False,
        ), row=2, col=1
    )

    fig.update_layout(
        updatemenus=[
            dict(
                type="buttons", direction="left",
                x=0.0, xanchor="left", y=1.12, yanchor="top",
                showactive=True, bgcolor="#1e293b", bordercolor="#334155",
                font=dict(color="#e2e8f0", size=12),
                buttons=[
                    dict(label="📈  Line", method="update", args=[{"visible": [True, False, True, True]}]),
                    dict(label="🕯  Candlestick", method="update", args=[{"visible": [False, True, True, True]}]),
                ],
            )
        ]
    )

    fig.update_layout(
        xaxis=dict(
            type="date",
            # No default `range` set here, so Plotly naturally loads "All" data
            rangeselector=dict(
                buttons=list([
                    dict(count=1, label="1M", step="month", stepmode="backward"),
                    dict(count=6, label="6M", step="month", stepmode="backward"),
                    dict(count=1, label="YTD", step="year", stepmode="todate"),
                    dict(count=1, label="1Y", step="year", stepmode="backward"),
                    dict(step="all", label="All")
                ]),
                bgcolor="#1e293b", activecolor="#3b82f6", font=dict(color="#e2e8f0")
            )
        )
    )

    fig.update_yaxes(title_text="Stock Price", gridcolor="#1e293b", row=1, col=1, secondary_y=False)
    fig.update_yaxes(title_text="Revenue (M)", showgrid=False, row=1, col=1, secondary_y=True)
    fig.update_yaxes(title_text="Volume", gridcolor="#1e293b", row=2, col=1)

    fig.update_layout(
        xaxis_rangeslider_visible=False,
        title=dict(text=f"<b>{title}</b>", font=dict(size=22), x=0.5),
        paper_bgcolor="#060b18", plot_bgcolor="#0a0f1e",
        font=dict(color="#94a3b8"), hovermode="x unified",
        legend=dict(orientation="h", x=0.5, xanchor="center", y=1.05),
        margin=dict(l=60, r=60, t=90, b=40),
        dragmode="pan" # Pan is set as default
    )

    return json.loads(fig.to_json())