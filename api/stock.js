export default async function handler(req, res) {
  const { ticker } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: "Ticker required" });
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
    );

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return res.status(200).json({ error: "Invalid ticker" });
    }

    const meta = result.meta;

    res.status(200).json({
      price: meta.regularMarketPrice,
      open: meta.regularMarketOpen,
      prevClose: meta.previousClose,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      high52: meta.fiftyTwoWeekHigh,
      low52: meta.fiftyTwoWeekLow,
    });
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
}
