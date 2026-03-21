export default async function handler(req, res) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json([]);
  }

  try {
    const response = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    const results = (Array.isArray(data) ? data : [])
      .slice(0, 10)
      .map((item) => ({
        schemeCode: String(item.schemeCode),
        schemeName: item.schemeName
      }));

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json([]);
  }
}
