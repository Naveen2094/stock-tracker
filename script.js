const defaultStocks = [
  { ticker: "ITC.NS", qty: 10, buy: 450 },
  { ticker: "RELIANCE.NS", qty: 5, buy: 2500 },
  { ticker: "TCS.NS", qty: 3, buy: 3200 },
  { ticker: "INFY.NS", qty: 8, buy: 1400 },
  { ticker: "HDFCBANK.NS", qty: 4, buy: 1500 },
  { ticker: "WHEELS.NS", qty: 1, buy: 716 }
];
const tickerMap = {
  BANKOFINDIA: "BANKINDIA.NS",
  WHEELSINDIA: "WHEELS.BO",
  TVSELECTRONICS: "TVSELECT.NS",
  RELIANCEINDUSTRIES: "RELIANCE.NS",
  INFOSYS: "INFY.NS",
  HDFCBANK: "HDFCBANK.NS",
  ICICIBANK: "ICICIBANK.NS",
  ASHOKLEYLAND: "ASHOKLEY.NS",
  DRREDDYSLABORATORIES: "DRREDDY.NS",
  TATAMOTORS: "TATAMOTORS.NS",
  SUZLONENERGY: "SUZLON.NS",
  INDIANRAILTOURCORP: "IRCTC.NS"
};
const portfolioInitialized = localStorage.getItem("portfolioInitialized");
const input = document.getElementById("ticker");
const dropdown = document.getElementById("suggestions");

let stocks = JSON.parse(localStorage.getItem("stocks"));

if (!portfolioInitialized) {
  stocks = [...defaultStocks];
  localStorage.setItem("portfolioInitialized", "true");
  localStorage.setItem("stocks", JSON.stringify(stocks));
}

stocks = Array.isArray(stocks) ? stocks : [];
stocks = stocks
  .filter(s => s.ticker && !s.ticker.includes(" "))
  .map(s => {
    const raw = s.ticker
      .replace(".NS", "")
      .replace(".BO", "")
      .replace(/\s+/g, "")
      .toUpperCase();
    const fixed = tickerMap[raw] || normalizeTicker(s.ticker);

    return { ...s, ticker: fixed };
  });
localStorage.setItem("stocks", JSON.stringify(stocks));

function toRawTicker(value) {
  return value
    .replace(/LIMITED|LTD|INDIA|CORPORATION|CORP|CO\.?|PVT|SERVICES|TECHNOLOGIES|INDUSTRIES/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .toUpperCase();
}

function normalizeTicker(ticker) {
  const normalized = ticker.trim().toUpperCase();

  if (!normalized) {
    return "";
  }

  return normalized.includes(".") ? normalized : `${normalized}.NS`;
}

function resolveLocalTicker(value) {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes(".")) {
    return normalizeTicker(normalized);
  }

  const rawName = toRawTicker(normalized);

  return tickerMap[rawName] || `${rawName}.NS`;
}

async function resolveTicker(name) {
  try {
    const res = await fetch(`/api/search?query=${encodeURIComponent(name)}`);
    const data = await res.json();

    if (!data || !data.length) return null;

    return data[0].symbol;
  } catch (err) {
    console.error("Resolve error:", err);
    return null;
  }
}

async function fetchStock(ticker) {
  try {
    const res = await fetch(`/api/stock?ticker=${ticker}`);
    const data = await res.json();

    if (data.error) return null;

    return data;
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

function save() {
  localStorage.setItem("stocks", JSON.stringify(stocks));
}

function addStock() {
  const ticker = resolveLocalTicker(document.getElementById("ticker").value);
  const qty = Number(document.getElementById("qty").value);
  const buy = Number(document.getElementById("buy").value);

  if (!ticker || !qty || !buy) return alert("Fill all fields");

  stocks.push({ ticker, qty, buy });
  document.getElementById("ticker").value = "";
  dropdown.innerHTML = "";
  save();
  render();
}

function selectStock(symbol) {
  document.getElementById("ticker").value = symbol;
  document.getElementById("suggestions").innerHTML = "";
}

input.addEventListener("input", async () => {
  const query = input.value.trim();

  if (query.length < 2) {
    dropdown.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    dropdown.innerHTML = data
      .map(item => `
        <div onclick="selectStock('${item.symbol}')">
          ${item.name} (${item.symbol})
        </div>
      `)
      .join("");
  } catch (err) {
    console.error("Search error:", err);
    dropdown.innerHTML = "";
  }
});

function removeStock(ticker) {
  stocks = stocks.filter(s => s.ticker !== ticker);
  save();
  render();
}

function clearAll() {
  localStorage.removeItem("stocks");
  localStorage.removeItem("failedStocks");
  stocks = [];
  location.reload();
}

function resetPortfolio() {
  stocks = [...defaultStocks];
  localStorage.setItem("stocks", JSON.stringify(stocks));
  localStorage.removeItem("failedStocks");
  location.reload();
}

function showFailedStocks() {
  const failed = JSON.parse(localStorage.getItem("failedStocks")) || [];
  const div = document.getElementById("failedList");

  if (!div) {
    return;
  }

  if (failed.length === 0) {
    div.innerHTML = "";
    return;
  }

  div.innerHTML = `
    <h3 style="color:red;">Fix These Stocks:</h3>
    ${failed.map(s => `<p>${s}</p>`).join("")}
  `;
}

async function importExcel() {
  const fileInput = document.getElementById("excelFile");
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select an Excel file");
    return;
  }

  localStorage.removeItem("stocks");
  alert("Importing stocks... please wait");

  const reader = new FileReader();

  reader.onload = async function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    console.log("Raw Excel:", json);

    let importedStocks = [];

    for (const row of json) {
      const name = row["Name"];
      const qty = row["__EMPTY"];
      const buy = row["__EMPTY_1"];

      if (
        !name ||
        typeof name !== "string" ||
        name.toLowerCase().includes("stock name") ||
        name.toLowerCase().includes("summary") ||
        name.toLowerCase().includes("value")
      ) {
        continue;
      }

      if (!qty || !buy) continue;

      const ticker = await resolveTicker(name);

      if (!ticker) {
        continue;
      }

      importedStocks.push({
        ticker,
        qty: Number(qty),
        buy: Number(buy)
      });
    }

    if (importedStocks.length === 0) {
      alert("No valid stocks found");
      return;
    }

    console.log("Final Stocks:", importedStocks);

    stocks = importedStocks;
    localStorage.setItem("stocks", JSON.stringify(stocks));
    localStorage.setItem("failedStocks", JSON.stringify([]));
    localStorage.setItem("portfolioInitialized", "true");

    alert("Stocks imported successfully!");
    location.reload();
  };

  reader.readAsArrayBuffer(file);
}

async function render() {
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = "";

  let totalInvestment = 0;
  let totalValue = 0;

  for (let s of stocks) {
    s.ticker = resolveLocalTicker(s.ticker);
    const data = await fetchStock(s.ticker);

    if (!data) {
      continue;
    }

    const cmp = data.price || 0;
    const open = data.open && data.open !== 0
      ? data.open
      : data.prevClose || 0;
    const high = data.high || 0;
    const low = data.low || 0;
    const high52 = data.high52 || 0;
    const low52 = data.low52 || 0;

    const investment = s.qty * s.buy;
    const value = s.qty * cmp;
    const pl = value - investment;

    totalInvestment += investment;
    totalValue += value;

    const row = `
      <tr>
        <td>${s.ticker}</td>
        <td>${cmp}</td>
        <td>${open}</td>
        <td>${high}</td>
        <td>${low}</td>
        <td>${high52}</td>
        <td>${low52}</td>
        <td>${s.qty}</td>
        <td>${s.buy}</td>
        <td>${investment.toFixed(2)}</td>
        <td>${value.toFixed(2)}</td>
        <td class="${pl >= 0 ? 'green' : 'red'}">${pl.toFixed(2)}</td>
        <td><button onclick="removeStock('${s.ticker}')">X</button></td>
      </tr>
    `;

    tbody.innerHTML += row;
  }

  const totalPL = totalValue - totalInvestment;

  document.getElementById("summary").innerHTML =
    `Total Investment: ₹${totalInvestment.toFixed(2)} | 
     Current Value: ₹${totalValue.toFixed(2)} | 
     <span class="${totalPL >= 0 ? 'green' : 'red'}">
     P/L: ₹${totalPL.toFixed(2)}
     </span>`;
  showFailedStocks();
}

render();
// setInterval(render, 30000);
