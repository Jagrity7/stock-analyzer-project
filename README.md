# stock-analyzer-project
A lightweight, client-side web application that fetches historical market data and runs a custom 5-factor technical heuristic model to score stock setups from 0 to 10.

## About The Project

Most basic stock trackers simply display raw price charts and candle data, leaving users to decipher the technical setup themselves. 

**Stock Analyzer** bridges that gap by running 30 days of price and volume data through an open, 5-factor heuristic scoring algorithm. Instead of returning a black-box number, the application evaluates directional trend, moving averages, momentum, return volatility, and relative volume to produce a clear 0–10 score alongside a complete breakdown of *why* the stock earned its signal.

Built entirely with vanilla HTML5, CSS3, and modern JavaScript, it operates without backend dependencies while gracefully handling edge cases, invalid symbols, and API rate limits.
