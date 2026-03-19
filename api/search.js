export default async function handler(req, res) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json([]);
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${query}`
    );

    const data = await response.json();

    const results = (data.quotes || [])
      .filter(q => q.symbol && (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO")))
      .slice(0, 5)
      .map(q => ({
        symbol: q.symbol,
        name: q.shortname || q.longname
      }));

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json([]);
  }
}
