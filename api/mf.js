function toNavTimestamp(value) {
  if (typeof value !== "string") {
    return Number.NEGATIVE_INFINITY;
  }

  const [day, month, year] = value.split("-").map((part) => Number(part));

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return Number.NEGATIVE_INFINITY;
  }

  return new Date(year, month - 1, day).getTime();
}

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Scheme code required" });
  }

  try {
    const response = await fetch(
      `https://api.mfapi.in/mf/${encodeURIComponent(code)}`
    );

    const data = await response.json();
    const entries = Array.isArray(data?.data) ? [...data.data] : [];
    entries.sort((a, b) => toNavTimestamp(b.date) - toNavTimestamp(a.date));
    const latest = entries[0];
    const meta = data?.meta;

    if (!latest || !meta) {
      return res.status(200).json({ error: "Invalid scheme code" });
    }

    res.status(200).json({
      code: String(meta.scheme_code),
      name: meta.scheme_name,
      fundHouse: meta.fund_house,
      price: Number.parseFloat(latest.nav),
      date: latest.date || meta.last_nav_date
    });
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
}
