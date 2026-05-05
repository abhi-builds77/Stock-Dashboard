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

    const fig = await res.json(); 
    
    if (!res.ok || fig.error) {
      setStatus("✖ " + (fig.error || "Unknown error"), "error");
      return;
    }

    const config = { 
        responsive: true, 
        displayModeBar: 'hover',
        displaylogo: false
    };

    const chartDiv = document.getElementById("chart");
    Plotly.react(chartDiv, fig.data, fig.layout, config);
    
    // Remove old listeners to prevent duplicates when loading new tickers
    chartDiv.removeAllListeners('plotly_relayout');
    
    // --- THE FIX: DYNAMIC Y-AXIS SCALING ---
    chartDiv.on('plotly_relayout', function(eventdata) {
        // Skip if this event was triggered by our own Y-axis update to prevent an infinite loop
        if (eventdata['yaxis.range[0]'] || eventdata['yaxis.autorange']) return;

        let xStart, xEnd;
        
        // Extract the new X-axis bounds that the user just clicked
        if (eventdata['xaxis.range[0]']) {
            xStart = new Date(eventdata['xaxis.range[0]']).getTime();
            xEnd = new Date(eventdata['xaxis.range[1]']).getTime();
        } else if (eventdata['xaxis.range']) {
            xStart = new Date(eventdata['xaxis.range'][0]).getTime();
            xEnd = new Date(eventdata['xaxis.range'][1]).getTime();
        } else if (eventdata['xaxis.autorange']) {
            // User clicked "All", so reset the Y axes normally
            Plotly.relayout(chartDiv, { 'yaxis.autorange': true, 'yaxis3.autorange': true });
            return;
        } else {
            return; // Nothing changed on X
        }

        // Grab the main Price data (Trace 0)
        let priceData = chartDiv.data[0];
        if (!priceData || !priceData.x) return;

        let visibleY = [];
        let visibleVol = [];

        // Loop through all data and find what is currently visible in the new X window
        for (let i = 0; i < priceData.x.length; i++) {
            let time = new Date(priceData.x[i]).getTime();
            if (time >= xStart && time <= xEnd) {
                if (priceData.y[i] != null) visibleY.push(priceData.y[i]);
                // Trace 3 is the Volume chart. We want to auto-scale that too.
                if (chartDiv.data[3] && chartDiv.data[3].y[i] != null) visibleVol.push(chartDiv.data[3].y[i]);
            }
        }

        // Calculate new Y bounds based ONLY on the data that is currently visible
        if (visibleY.length > 0) {
            let minY = Math.min(...visibleY);
            let maxY = Math.max(...visibleY);
            
            // Add a 10% visual padding so the line doesn't crash into the top/bottom edges
            let padY = (maxY - minY) * 0.1; 

            let layoutUpdate = {
                'yaxis.range': [minY - padY, maxY + padY]
            };

            // Scale the volume chart
            if (visibleVol.length > 0) {
                let maxVol = Math.max(...visibleVol);
                layoutUpdate['yaxis3.range'] = [0, maxVol * 1.1]; 
            }

            // Apply the new limits instantly
            Plotly.relayout(chartDiv, layoutUpdate);
        }
    });

    // Fix Plotly rendering dimensions on initial load
    window.dispatchEvent(new Event('resize'));
    
    setStatus("", "");
  } catch (err) {
    setStatus("✖ Network error: " + err.message, "error");
  } finally {
    document.getElementById("spinner").style.display = "none";
  }
}

// Load Default on page open
window.addEventListener("load", loadChart);