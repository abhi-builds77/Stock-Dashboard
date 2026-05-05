from flask import Flask, render_template, request, jsonify
import pandas as pd
from dashboard import fetch_stock_data, fetch_revenue_data, create_dashboard_figure

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chart", methods=["POST"])
def chart():
    body    = request.get_json(force=True)
    ticker  = body.get("ticker", "NVDA").strip().upper()
    rev_url = body.get("rev_url", "")

    try:
        # Fetch the data
        stock_data   = fetch_stock_data(ticker)
        revenue_data = fetch_revenue_data(rev_url) if rev_url else pd.DataFrame(columns=["Date", "Revenue"])
        
        # Build the chart dictionary (which now safely handles NaN values)
        fig_dict = create_dashboard_figure(stock_data, revenue_data, f"{ticker} Market Overview")
        
        # Send it cleanly to the frontend
        return jsonify(fig_dict)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("\n  Stock Dashboards is running: http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)