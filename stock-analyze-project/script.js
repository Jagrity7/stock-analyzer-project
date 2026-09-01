const button = document.getElementById("search-button");
const input = document.getElementById('stock-input');
const resultBox = document.getElementById("result");

async function getData(stockName) {
    const response = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${stockName}&interval=1day&outputsize=30&format=JSON&apikey=07efdb0749184b57be58fb0243d60a73&timezone=Asia/Kolkata`
    );
    return await response.json();
}

/**
 * Calculates a 0–10 "buy score" from recent daily candles.
 * This is a simple technical heuristic, NOT financial advice.
 * values[0] is assumed to be the most recent day (Twelve Data returns newest-first).
 */
function calculateBuyScore(values) {
    const closes = values.map(v => parseFloat(v.close));
    const volumes = values.map(v => parseFloat(v.volume));

    let score = 0;
    const breakdown = {};

    // 1) Short-term trend: latest close vs. close 5 days ago (max 3 pts)
    const latest = closes[0];
    const fiveDaysAgo = closes[4];
    const shortTermChangePct = ((latest - fiveDaysAgo) / fiveDaysAgo) * 100;
    let trendPts = 0;
    if (shortTermChangePct > 5) trendPts = 3;
    else if (shortTermChangePct > 2) trendPts = 2;
    else if (shortTermChangePct > 0) trendPts = 1;
    score += trendPts;
    breakdown.trend = { value: shortTermChangePct.toFixed(2) + '%', points: trendPts };

    // 2) Price vs 10-day moving average (max 2 pts)
    const ma10 = closes.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    let maPts = 0;
    if (latest > ma10) maPts = 2;
    else if (latest > ma10 * 0.98) maPts = 1;
    score += maPts;
    breakdown.movingAverage = { value: ma10.toFixed(2), points: maPts };

    // 3) Momentum: how many of the last 4 day-over-day moves were up (max 2 pts)
    let upDays = 0;
    for (let i = 0; i < 4; i++) {
        if (closes[i] > closes[i + 1]) upDays++;
    }
    const momentumPts = Math.min(upDays, 2);
    score += momentumPts;
    breakdown.momentum = { value: `${upDays}/4 up days`, points: momentumPts };

    // 4) Volatility of daily returns over last 10 days: lower = steadier (max 1.5 pts)
    const returns = [];
    for (let i = 0; i < 9; i++) {
        returns.push((closes[i] - closes[i + 1]) / closes[i + 1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatilityPct = Math.sqrt(variance) * 100;
    let volPts = 0;
    if (volatilityPct < 1) volPts = 1.5;
    else if (volatilityPct < 2) volPts = 1;
    else if (volatilityPct < 3) volPts = 0.5;
    score += volPts;
    breakdown.volatility = { value: volatilityPct.toFixed(2) + '%', points: volPts };

    // 5) Volume vs recent average volume (max 1.5 pts)
    const latestVolume = volumes[0];
    const avgVolume = volumes.slice(1, 5).reduce((a, b) => a + b, 0) / 4;
    let volumePts = 0;
    if (latestVolume > avgVolume * 1.2) volumePts = 1.5;
    else if (latestVolume > avgVolume) volumePts = 1;
    score += volumePts;
    breakdown.volume = { value: `${((latestVolume / avgVolume - 1) * 100).toFixed(1)}% vs avg`, points: volumePts };

    return {
        score: Math.min(Math.round(score * 10) / 10, 10),
        breakdown
    };
}

function scoreLabel(score) {
    if (score >= 7.5) return { text: "Strong signal", color: "#2e7d32" };
    if (score >= 5) return { text: "Moderate signal", color: "#f9a825" };
    return { text: "Weak signal", color: "#c62828" };
}

function showError(message) {
    resultBox.innerHTML = `<p class="error-message">${message}</p>`;
}

button.addEventListener('click', async () => {
    const value = input.value.trim();

    if (!value) {
        showError("Please enter a stock symbol.");
        return;
    }

    button.textContent = "Analyzing...";
    button.disabled = true;

    try {
        const result = await getData(value);

        // Twelve Data returns { status: "error", message: "..." } on bad symbols/limits
        if (result.status === "error" || !result.values) {
            showError(result.message || "Couldn't find data for that symbol. Check the spelling and try again.");
            return;
        }

        if (result.values.length < 10) {
            showError("Not enough historical data returned to calculate a score.");
            return;
        }

        const stock = result.values[0];
        const { score, breakdown } = calculateBuyScore(result.values);
        const label = scoreLabel(score);

        resultBox.innerHTML = `
        <div class="stock-card">
            <h2>${value.toUpperCase()}</h2>

            <div class="buy-score" style="border-color:${label.color}">
                <span class="buy-score-number" style="color:${label.color}">${score}/10</span>
                <span class="buy-score-label" style="color:${label.color}">${label.text}</span>
            </div>

            <div class="stock-data">
                <p><span>Date</span> ${stock.datetime}</p>
                <p><span>Open</span> ${stock.open}</p>
                <p><span>High</span> ${stock.high}</p>
                <p><span>Low</span> ${stock.low}</p>
                <p><span>Close</span> ${stock.close}</p>
                <p><span>Volume</span> ${stock.volume}</p>
            </div>

            <h3 class="breakdown-title">Score breakdown</h3>
            <div class="stock-data">
                <p><span>5-day trend</span> ${breakdown.trend.value} (+${breakdown.trend.points})</p>
                <p><span>10-day MA</span> ${breakdown.movingAverage.value} (+${breakdown.movingAverage.points})</p>
                <p><span>Momentum</span> ${breakdown.momentum.value} (+${breakdown.momentum.points})</p>
                <p><span>Volatility</span> ${breakdown.volatility.value} (+${breakdown.volatility.points})</p>
                <p><span>Volume</span> ${breakdown.volume.value} (+${breakdown.volume.points})</p>
            </div>

            <p class="disclaimer">This is a heuristic technical score, not financial advice.</p>
        </div>
        `;
    } catch (err) {
        console.error(err);
        showError("Something went wrong while fetching data. Please try again.");
    } finally {
        button.textContent = "Analyze";
        button.disabled = false;
    }
});
