const MACRO_BASE = "https://www.macrotrends.net/stocks/charts";
let activeRangeBtn = "all";

function setStatus(msg, type) {
  const s = document.getElementById("status");
  s.textContent = msg;
  s.className = type;
}

function loadPreset(ticker, slug) {
  document.getElementById("ticker").value = ticker;
  document.getElementById("rev-url").value = `${MACRO_BASE}/${ticker}/${slug}/revenue`;
  loadChart();
}

function getXBounds(label, allX) {
  const last = new Date(allX[allX.length - 1]);
  const first = new Date(allX[0]);
  let start;

  if (label === "1m") {
    start = new Date(last);
    start.setMonth(start.getMonth() - 1);
  } else if (label === "6m") {
    start = new Date(last);
    start.setMonth(start.getMonth() - 6);
  } else if (label === "ytd") {
    start = new Date(last.getFullYear(), 0, 1);
  } else if (label === "1y") {
    start = new Date(last);
    start.setFullYear(start.getFullYear() - 1);
  } else {
    start = first;
  }

  // Clamp to actual data range
  if (start < first) start = first;

  return { xStart: start.getTime(), xEnd: last.getTime(), xStartStr: start.toISOString(), xEndStr: last.toISOString() };
}

function computeYRanges(chartDiv, xStart, xEnd) {
  const priceTrace = chartDiv.data[0];
  const candleTrace = chartDiv.data[1];
  const revTrace = chartDiv.data[2];
  const volTrace = chartDiv.data[3];

  const lineVisible = priceTrace && priceTrace.visible !== false && priceTrace.visible !== "legendonly";
  const activeTrace = lineVisible ? priceTrace : candleTrace;

  let minPrice = Infinity, maxPrice = -Infinity;
  let minRev = Infinity, maxRev = -Infinity;
  let maxVol = 0;

  if (activeTrace && activeTrace.x) {
    for (let i = 0; i < activeTrace.x.length; i++) {
      const t = new Date(activeTrace.x[i]).getTime();
      if (t < xStart || t > xEnd) continue;

      if (lineVisible) {
        const y = activeTrace.y[i];
        if (y != null) { if (y < minPrice) minPrice = y; if (y > maxPrice) maxPrice = y; }
      } else {
        const hi = activeTrace.high ? activeTrace.high[i] : null;
        const lo = activeTrace.low ? activeTrace.low[i] : null;
        if (hi != null && hi > maxPrice) maxPrice = hi;
        if (lo != null && lo < minPrice) minPrice = lo;
      }

      if (volTrace && volTrace.y[i] != null && volTrace.y[i] > maxVol) maxVol = volTrace.y[i];
    }
  }

  if (revTrace && revTrace.x) {
    for (let i = 0; i < revTrace.x.length; i++) {
      const t = new Date(revTrace.x[i]).getTime();
      if (t < xStart || t > xEnd) continue;
      const v = revTrace.y[i];
      if (v != null) { if (v < minRev) minRev = v; if (v > maxRev) maxRev = v; }
    }
  }

  const result = {};

  if (isFinite(minPrice) && isFinite(maxPrice)) {
    const pad = (maxPrice - minPrice) * 0.08 || maxPrice * 0.05;
    result.priceMin = minPrice - pad;
    result.priceMax = maxPrice + pad;
  }

  if (isFinite(minRev) && isFinite(maxRev)) {
    const pad = (maxRev - minRev) * 0.15 || maxRev * 0.1;
    result.revMin = minRev - pad;
    result.revMax = maxRev + pad;
  }

  if (maxVol > 0) {
    result.volMax = maxVol * 1.2;
  }

  return result;
}

function applyRange(chartDiv, label) {
  const allX = chartDiv.data[0].x;
  const { xStart, xEnd, xStartStr, xEndStr } = getXBounds(label, allX);
  const yr = computeYRanges(chartDiv, xStart, xEnd);

  const update = {
    'xaxis.range[0]': xStartStr,
    'xaxis.range[1]': xEndStr,
    'xaxis.autorange': false,
  };

  if (yr.priceMin !== undefined) {
    update['yaxis.range[0]'] = yr.priceMin;
    update['yaxis.range[1]'] = yr.priceMax;
    update['yaxis.autorange'] = false;
  }

  if (yr.revMin !== undefined) {
    update['yaxis2.range[0]'] = yr.revMin;
    update['yaxis2.range[1]'] = yr.revMax;
    update['yaxis2.autorange'] = false;
  }

  if (yr.volMax !== undefined) {
    update['yaxis3.range[0]'] = 0;
    update['yaxis3.range[1]'] = yr.volMax;
    update['yaxis3.autorange'] = false;
  }

  Plotly.relayout(chartDiv, update);

  document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  const activeEl = document.querySelector(`.range-btn[data-range="${label}"]`);
  if (activeEl) activeEl.classList.add('active');
  activeRangeBtn = label;
}

async function loadChart() {
  const ticker = document.getElementById("ticker").value.trim().toUpperCase();
  const revUrl = document.getElementById("rev-url").value.trim();
  if (!ticker) { setStatus("⚠ Enter a ticker symbol.", "error"); return; }

  document.getElementById("spinner").style.display = "inline-block";
  setStatus("Fetching market data…", "loading");

  try {
    const res = await fetch("/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, rev_url: revUrl }),
    });

    const fig = await res.json();

    if (!res.ok || fig.error) {
      setStatus("✖ " + (fig.error || "Unknown error"), "error");
      return;
    }

    const config = {
      responsive: true,
      displayModeBar: 'hover',
      displaylogo: false,
      scrollZoom: true,
    };

    const chartDiv = document.getElementById("chart");
    Plotly.react(chartDiv, fig.data, fig.layout, config);

    chartDiv.removeAllListeners('plotly_relayout');
    chartDiv.removeAllListeners('plotly_restyle');

    // After pan/zoom by mouse, rescale Y to match whatever X window user dragged to
    let suppressRelayout = false;
    chartDiv.on('plotly_relayout', function (evt) {
      if (suppressRelayout) return;

      let xStart, xEnd;

      if (evt['xaxis.range[0]'] !== undefined) {
        xStart = new Date(evt['xaxis.range[0]']).getTime();
        xEnd   = new Date(evt['xaxis.range[1]']).getTime();
      } else if (Array.isArray(evt['xaxis.range'])) {
        xStart = new Date(evt['xaxis.range'][0]).getTime();
        xEnd   = new Date(evt['xaxis.range'][1]).getTime();
      } else {
        return;
      }

      if (!isFinite(xStart) || !isFinite(xEnd) || xEnd <= xStart) return;

      const yr = computeYRanges(chartDiv, xStart, xEnd);
      const update = {};

      if (yr.priceMin !== undefined) {
        update['yaxis.range[0]'] = yr.priceMin;
        update['yaxis.range[1]'] = yr.priceMax;
        update['yaxis.autorange'] = false;
      }
      if (yr.revMin !== undefined) {
        update['yaxis2.range[0]'] = yr.revMin;
        update['yaxis2.range[1]'] = yr.revMax;
        update['yaxis2.autorange'] = false;
      }
      if (yr.volMax !== undefined) {
        update['yaxis3.range[0]'] = 0;
        update['yaxis3.range[1]'] = yr.volMax;
        update['yaxis3.autorange'] = false;
      }

      if (Object.keys(update).length > 0) {
        suppressRelayout = true;
        Plotly.relayout(chartDiv, update).then(() => { suppressRelayout = false; });
      }
    });

    // After Line/Candlestick toggle, re-apply current range
    chartDiv.on('plotly_restyle', function () {
      setTimeout(() => { applyRange(chartDiv, activeRangeBtn); }, 80);
    });

    // Apply "all" by default on load
    applyRange(chartDiv, "all");

    window.dispatchEvent(new Event('resize'));
    setStatus("", "");
  } catch (err) {
    setStatus("✖ Network error: " + err.message, "error");
  } finally {
    document.getElementById("spinner").style.display = "none";
  }
}

// Wire up custom range buttons
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chartDiv = document.getElementById("chart");
      if (!chartDiv.data) return;
      applyRange(chartDiv, btn.dataset.range);
    });
  });
});

window.addEventListener("load", loadChart);