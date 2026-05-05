const MACRO_BASE = "https://www.macrotrends.net/stocks/charts";

function setStatus(msg, type) {
  const s = document.getElementById("status");
  s.textContent  = msg;
  s.className    = type;
}

function loadPreset(ticker, slug) {
  document.getElementById("ticker").value  = ticker;
  document.getElementById("rev-url").value = `${MACRO_BASE}/${ticker}/${slug}/revenue`;
  loadChart();
}

async function loadChart() {
  const ticker = document.getElementById("ticker").value.trim().toUpperCase();
  const revUrl = document.getElementById("rev-url").value.trim();
  if (!ticker) { setStatus("⚠ Enter a ticker symbol.", "error"); return; }

  document.getElementById("spinner").style.display = "inline-block";
  setStatus("Fetching market data…", "loading");

  try {
    const res = await fetch("/chart", {
      method:  "POST",
      headers: {"Content-Type": "application/json"},
      body:    JSON.stringify({ ticker, rev_url: revUrl }),
    });

    // We now receive a ready-to-use JSON object directly from Flask
    const fig = await res.json(); 
    
    if (!res.ok || fig.error) {
      setStatus("✖ " + (fig.error || "Unknown error"), "error");
      return;
    }

    // Configure the chart to look cleaner and respond to resizing
    const config = { 
        responsive: true, 
        displayModeBar: 'hover',
        displaylogo: false
    };

    Plotly.react("chart", fig.data, fig.layout, config);
    
    // Fix Plotly rendering dimensions
    window.dispatchEvent(new Event('resize'));
    
    setStatus("", "");
  } catch (err) {
    setStatus("✖ Network error: " + err.message, "error");
  } finally {
    document.getElementById("spinner").style.display = "none";
  }
}

// Load TSLA on page open
window.addEventListener("load", loadChart);