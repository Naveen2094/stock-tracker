import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3l9RBe_oJS1KzLVD3jLVrLPZp9jiFwkU",
  authDomain: "stock-tracker-de92c.firebaseapp.com",
  projectId: "stock-tracker-de92c",
  storageBucket: "stock-tracker-de92c.firebasestorage.app",
  messagingSenderId: "286845348314",
  appId: "1:286845348314:web:ded76caea55540734a78e3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

function detectFundType(name) {
  const normalizedName = String(name || "").toLowerCase();

  if (normalizedName.includes("small")) return "Small Cap";
  if (normalizedName.includes("mid")) return "Mid Cap";
  if (normalizedName.includes("nifty") || normalizedName.includes("index")) return "Index Fund";
  if (normalizedName.includes("etf")) return "ETF";
  if (
    normalizedName.includes("hybrid") ||
    normalizedName.includes("balanced") ||
    normalizedName.includes("asset allocation") ||
    normalizedName.includes("multi asset") ||
    normalizedName.includes("arbitrage")
  ) {
    return "Hybrid";
  }
  if (
    normalizedName.includes("debt") ||
    normalizedName.includes("bond") ||
    normalizedName.includes("liquid") ||
    normalizedName.includes("gilt") ||
    normalizedName.includes("income")
  ) {
    return "Debt";
  }

  return "Large Cap";
}

function normalizeFundType(value, fallbackName = "") {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return detectFundType(fallbackName);
  }

  const typeMap = {
    "large cap": "Large Cap",
    largecap: "Large Cap",
    "mid cap": "Mid Cap",
    midcap: "Mid Cap",
    "small cap": "Small Cap",
    smallcap: "Small Cap",
    "index fund": "Index Fund",
    index: "Index Fund",
    etf: "ETF",
    hybrid: "Hybrid",
    debt: "Debt"
  };

  return typeMap[normalizedValue] || detectFundType(value);
}

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
  const raw = toRawTicker(value);
  return tickerMap[raw] || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return parseOptionalNumber(value).toFixed(2);
}

export function createPortfolioApp(config) {
  const currentUser = localStorage.getItem("user") || "";
  const welcomeUser = document.getElementById("welcomeUser");
  const input = document.getElementById("ticker");
  const dropdown = document.getElementById("suggestions");
  const isMutualFund = config.dataSource === "mf";

  let holdings = [];
  const stockCache = {};
  let isRefreshing = false;

  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  localStorage.setItem("lastPortfolio", config.storageSuffix);

  function logout() {
    localStorage.clear();
    window.location.href = "index.html";
  }

  function toggleTheme() {
    document.body.classList.toggle("dark");
    const theme = document.body.classList.contains("dark") ? "dark" : "light";
    localStorage.setItem("theme", theme);
  }

  function loadTheme() {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }

  function updateTime() {
    const lastUpdated = document.getElementById("lastUpdated");

    if (!lastUpdated) {
      return;
    }

    lastUpdated.innerText = `Last Updated: ${new Date().toLocaleTimeString()}`;
  }

  function updateHeader() {
    if (welcomeUser) {
      welcomeUser.innerText = `User: ${currentUser} (${config.headerLabel})`;
    }
  }

  function isToday(dateStr) {
    if (!dateStr || typeof dateStr !== "string") {
      return false;
    }

    const today = new Date().toLocaleDateString("en-GB").split("/").join("-");
    return dateStr === today;
  }

  function getDocId() {
    return `${currentUser}_${config.storageSuffix}`;
  }

  function clearCache() {
    Object.keys(stockCache).forEach((key) => delete stockCache[key]);
  }

  function getHoldingKey(holding) {
    return isMutualFund ? String(holding.code || "") : normalizeTicker(holding.ticker || "");
  }

  function getHoldingLabel(holding) {
    return isMutualFund ? (holding.name || holding.code || "") : holding.ticker;
  }

  function normalizeHoldings(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    if (isMutualFund) {
      return list
        .filter((s) => s.code || s.ticker)
        .map((s) => ({
          code: String(s.code || s.ticker || "").trim(),
          name: String(s.name || s.schemeName || s.ticker || s.code || "").trim(),
          qty: parseOptionalNumber(s.qty ?? s.units),
          buy: parseOptionalNumber(s.buy),
          type: normalizeFundType(s.type, s.name || s.ticker || s.code || "")
        }))
        .filter((s) => s.code);
    }

    return list
      .filter((s) => s.ticker && !s.ticker.includes(" "))
      .map((s) => {
        const normalizedTicker = config.useLocalTickerMap
          ? tickerMap[
            s.ticker
              .replace(".NS", "")
              .replace(".BO", "")
              .replace(/\s+/g, "")
              .toUpperCase()
          ] || normalizeTicker(s.ticker)
          : normalizeTicker(s.ticker);

        const holding = {
          ticker: normalizedTicker,
          qty: parseOptionalNumber(s.qty ?? s.units),
          buy: parseOptionalNumber(s.buy)
        };

        if (config.includeType) {
          holding.type = normalizeFundType(s.type, s.ticker);
        }

        return holding;
      });
  }

  async function resolveTicker(name) {
    try {
      const endpoint = config.searchEndpoint || "/api/search";
      const res = await fetch(`${endpoint}?query=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (!data || !data.length) {
        return null;
      }

      return isMutualFund
        ? {
          code: String(data[0].schemeCode),
          name: data[0].schemeName
        }
        : data[0].symbol;
    } catch (err) {
      console.error("Resolve error:", err);
      return null;
    }
  }

  async function fetchPrice(ticker) {
    const cacheKey = isMutualFund ? String(ticker || "").trim() : normalizeTicker(ticker);

    if (!cacheKey || (!isMutualFund && cacheKey.includes(" "))) {
      return null;
    }

    if (stockCache[cacheKey]) {
      return stockCache[cacheKey];
    }

    try {
      const endpoint = config.quoteEndpoint || "/api/stock";
      const queryParam = isMutualFund ? "code" : "ticker";
      const res = await fetch(`${endpoint}?${queryParam}=${encodeURIComponent(cacheKey)}`);
      const data = await res.json();

      if (data.error) {
        return null;
      }

      stockCache[cacheKey] = data;
      return data;
    } catch (err) {
      console.error("Fetch error:", err);
      return null;
    }
  }

  async function save() {
    try {
      await setDoc(doc(db, "users", getDocId()), {
        stocks: holdings
      }, { merge: true });
    } catch (err) {
      console.error("Save error:", err);
    }
  }

  function updateSummaryFromTable() {
    const rows = Array.from(document.querySelectorAll("#table tbody tr"));
    let totalInvestment = 0;
    let totalValue = 0;

    rows.forEach((row) => {
      totalInvestment += parseOptionalNumber(row.querySelector(".investment")?.innerText);
      totalValue += parseOptionalNumber(row.querySelector(".value")?.innerText);
    });

    const totalPL = totalValue - totalInvestment;
    const summary = document.getElementById("summary");

    if (!summary) {
      return;
    }

    summary.innerHTML =
      `Total Investment: \u20B9${formatMoney(totalInvestment)} |
       Current Value: \u20B9${formatMoney(totalValue)} |
       <span class="${totalPL >= 0 ? "green" : "red"}">
       P/L: \u20B9${formatMoney(totalPL)}
       </span>`;
  }

  function showFailedStocks() {
    const failed = JSON.parse(localStorage.getItem("failedStocks") || "[]");
    const div = document.getElementById("failedList");

    if (!div) {
      return;
    }

    if (failed.length === 0) {
      div.innerHTML = "";
      return;
    }

    div.innerHTML = `
      <h3 style="color:red;">${config.failedHeading}</h3>
      ${failed.map((s) => `<p>${s}</p>`).join("")}
    `;
  }

  function buildRowMarkup(s, data) {
    const quantity = parseOptionalNumber(s.qty ?? s.units);
    const buy = parseOptionalNumber(s.buy);
    const hasQuantity = quantity > 0;
    const hasBuy = buy > 0;

    if (isMutualFund) {
      const navValue = Number(data.price) || 0;
      const investmentValue = hasQuantity && hasBuy ? quantity * buy : 0;
      const valueValue = hasQuantity ? quantity * navValue : 0;
      const plValue = valueValue - investmentValue;
      const plColor = plValue >= 0 ? "lightgreen" : "red";
      const nav = formatMoney(navValue);
      const pl = formatMoney(plValue);
      const navDate = data.date || "-";
      const navDateColor = isToday(data.date) ? "lightgreen" : "orange";

      return `
        <tr id="${s.code}">
          <td>${s.name || s.code}</td>
          <td class="cmp">${nav}</td>
          <td class="nav-date" style="color:${navDateColor}">${navDate}</td>
          <td>${normalizeFundType(s.type, s.name || s.code)}</td>
          <td>${quantity || "-"}</td>
          <td>${buy ? formatMoney(buy) : "-"}</td>
          <td class="investment">${investmentValue ? formatMoney(investmentValue) : "-"}</td>
          <td class="value">${valueValue ? formatMoney(valueValue) : "-"}</td>
          <td class="pl" style="color:${plColor}">${hasQuantity ? `\u20B9${pl}` : "-"}</td>
          <td>
            <button onclick="editStock('${s.code}')">Edit</button>
            <button onclick="removeStock('${s.code}')">X</button>
          </td>
        </tr>
      `;
    }

    const cmp = data.price || 0;
    const open = data.open && data.open !== 0 ? data.open : data.prevClose || 0;
    const close = data.prevClose || 0;
    const high = data.high || 0;
    const low = data.low || 0;
    const high52 = data.high52 || 0;
    const low52 = data.low52 || 0;
    const investment = hasQuantity && hasBuy ? quantity * buy : 0;
    const value = hasQuantity ? quantity * cmp : 0;
    const pl = value - investment;
    const typeCell = config.includeType
      ? `<td>${normalizeFundType(s.type, s.ticker)}</td>`
      : "";

    return `
      <tr id="${s.ticker}">
        <td>${s.ticker}</td>
        <td class="cmp">${formatMoney(cmp)}</td>
        <td>${formatMoney(open)}</td>
        <td class="close">${formatMoney(close)}</td>
        <td>${formatMoney(high)}</td>
        <td>${formatMoney(low)}</td>
        <td>${formatMoney(high52)}</td>
        <td>${formatMoney(low52)}</td>
        ${typeCell}
        <td>${quantity || "-"}</td>
        <td>${buy ? formatMoney(buy) : "-"}</td>
        <td class="investment">${investment ? formatMoney(investment) : "-"}</td>
        <td class="value">${value ? formatMoney(value) : "-"}</td>
        <td class="pl ${pl >= 0 ? "green" : "red"}">${hasQuantity ? formatMoney(pl) : "-"}</td>
        <td>
          <button onclick="editStock('${s.ticker}')">Edit</button>
          <button onclick="removeStock('${s.ticker}')">X</button>
        </td>
      </tr>
    `;
  }

  async function renderSingleHolding(s) {
    const tbody = document.querySelector("#table tbody");

    if (!tbody) {
      return false;
    }

    const data = await fetchPrice(isMutualFund ? s.code : s.ticker);

    if (!data) {
      return false;
    }

    const wrapper = document.createElement("tbody");
    wrapper.innerHTML = buildRowMarkup(s, data).trim();
    const row = wrapper.firstElementChild;
    const existingRow = document.getElementById(getHoldingKey(s));

    if (existingRow) {
      existingRow.replaceWith(row);
    } else {
      tbody.appendChild(row);
    }

    updateSummaryFromTable();
    return true;
  }

  async function updatePricesOnly() {
    clearCache();

    for (const s of holdings) {
      const row = document.getElementById(getHoldingKey(s));

      if (!row) {
        continue;
      }

      const data = await fetchPrice(isMutualFund ? s.code : s.ticker);

      if (!data) {
        continue;
      }

      const cmpValue = Number(data.price) || 0;
      const quantity = parseOptionalNumber(s.qty ?? s.units);
      const buy = parseOptionalNumber(s.buy);
      const hasQuantity = quantity > 0;
      const hasBuy = buy > 0;
      const valueValue = hasQuantity ? quantity * cmpValue : 0;
      const plValue = valueValue - (hasQuantity && hasBuy ? quantity * buy : 0);
      const plColor = plValue >= 0 ? "lightgreen" : "red";
      const cmp = formatMoney(cmpValue);

      row.querySelector(".cmp").innerText = cmp;
      row.querySelector(".value").innerText = hasQuantity ? formatMoney(valueValue) : "-";
      if (isMutualFund) {
        const dateCell = row.querySelector(".nav-date");
        if (dateCell) {
          dateCell.innerText = data.date || "-";
          dateCell.style.color = isToday(data.date) ? "lightgreen" : "orange";
        }
      } else {
        const open = data.open && data.open !== 0 ? data.open : data.prevClose || 0;
        const close = data.prevClose || 0;
        row.querySelector(".close").innerText = formatMoney(close);

        const openCell = row.children[2];

        if (openCell) {
          openCell.innerText = formatMoney(open);
        }
      }

      const plCell = row.querySelector(".pl");
      plCell.innerText = hasQuantity ? `\u20B9${formatMoney(plValue)}` : "-";
      plCell.className = "pl";
      plCell.style.color = plColor;
    }

    updateSummaryFromTable();
    console.log("Prices updated (no full reload)");
  }

  async function refreshPrices() {
    if (isRefreshing) {
      return;
    }

    isRefreshing = true;

    try {
      await updatePricesOnly();
      updateTime();
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      isRefreshing = false;
    }
  }

  async function loadHoldings() {
    const loadingText = document.getElementById("loadingText");

    if (loadingText) {
      loadingText.style.display = "block";
    }

    try {
      const ref = doc(db, "users", getDocId());
      const snap = await getDoc(ref);

      if (snap.exists()) {
        holdings = normalizeHoldings(snap.data().stocks || []);
      } else {
        holdings = [];
      }

      await render();
      updateTime();
    } catch (err) {
      console.error("Load error:", err);
      holdings = [];
      await render();
      updateTime();
    } finally {
      if (loadingText) {
        loadingText.style.display = "none";
      }
    }
  }

  async function addStock() {
    const tickerInput = document.getElementById("ticker").value.trim();
    const typeInput = document.getElementById("type");
    const qty = parseOptionalNumber(document.getElementById("qty").value);
    const buy = parseOptionalNumber(document.getElementById("buy").value);
    const type = config.includeType
      ? normalizeFundType(typeInput?.value, tickerInput)
      : "";

    let ticker = !isMutualFund && tickerInput.includes(".") ? normalizeTicker(tickerInput) : null;
    let fundSelection = null;

    if (!ticker && config.useLocalTickerMap) {
      ticker = resolveLocalTicker(tickerInput);
    }

    if (isMutualFund) {
      const selectedCode = input?.dataset.selectedCode;
      const selectedName = input?.dataset.selectedName;

      if (selectedCode) {
        fundSelection = {
          code: selectedCode,
          name: selectedName || tickerInput
        };
      } else if (/^\d+$/.test(tickerInput)) {
        fundSelection = {
          code: tickerInput,
          name: tickerInput
        };
      } else if (tickerInput) {
        fundSelection = await resolveTicker(tickerInput);
      }
    } else if (!ticker && tickerInput) {
      ticker = await resolveTicker(tickerInput);
    }

    if (
      (isMutualFund && !fundSelection?.code) ||
      (!isMutualFund && (!ticker || ticker.includes(" ")))
    ) {
      alert(config.invalidInputMessage);
      return;
    }

    const item = isMutualFund
      ? {
        code: String(fundSelection.code),
        name: fundSelection.name || tickerInput,
        qty,
        buy,
        type
      }
      : { ticker, qty, buy };

    if (config.includeType && !isMutualFund) {
      item.type = type;
    }

    holdings.push(item);
    holdings.sort((a, b) => getHoldingLabel(a).localeCompare(getHoldingLabel(b)));
    clearCache();
    document.getElementById("ticker").value = "";
    if (input) {
      delete input.dataset.selectedCode;
      delete input.dataset.selectedName;
    }
    if (typeInput) {
      typeInput.selectedIndex = 0;
    }
    dropdown.innerHTML = "";
    await save();
    await render();
  }

  async function removeStock(ticker) {
    holdings = holdings.filter((s) => getHoldingKey(s) !== ticker);
    clearCache();
    await save();
    await render();
  }

  async function editStock(ticker) {
    const stock = holdings.find((s) => getHoldingKey(s) === ticker);

    if (!stock) {
      return;
    }

    const currentQty = parseOptionalNumber(stock.qty ?? stock.units);
    const currentBuy = parseOptionalNumber(stock.buy);
    const qtyLabel = isMutualFund ? "Enter units" : "Enter quantity";
    const newQty = window.prompt(qtyLabel, currentQty ? String(currentQty) : "");

    if (newQty === null) {
      return;
    }

    const buyLabel = "Enter buy price";
    const newBuy = window.prompt(buyLabel, currentBuy ? String(currentBuy) : "");

    if (newBuy === null) {
      return;
    }

    const trimmedQty = String(newQty).trim();
    const trimmedBuy = String(newBuy).trim();

    if (trimmedQty === "") {
      stock.qty = 0;
    } else {
      const qty = Number(trimmedQty);

      if (Number.isNaN(qty)) {
        alert("Invalid values");
        return;
      }

      stock.qty = qty;
    }

    if (trimmedBuy === "") {
      stock.buy = 0;
    } else {
      const buy = Number(trimmedBuy);

      if (Number.isNaN(buy)) {
        alert("Invalid values");
        return;
      }

      stock.buy = buy;
    }

    await save();
    await render();
  }

  async function clearAll() {
    localStorage.removeItem("failedStocks");
    holdings = [];
    clearCache();
    await save();
    await render();
  }

  async function importExcel() {
    const fileInput = document.getElementById("excelFile");
    const file = fileInput.files[0];
    const importStatus = document.getElementById("importStatus");
    const progressText = document.getElementById("progress");
    const progressBarContainer = document.getElementById("progressBarContainer");
    const progressBar = document.getElementById("progressBar");

    if (!file) {
      alert("Please select an Excel file");
      return;
    }

    alert(config.importStartMessage);

    const reader = new FileReader();

    reader.onload = async function (e) {
      isRefreshing = true;

      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        const total = json.length;
        let count = 0;
        const tbody = document.querySelector("#table tbody");

        holdings = [];
        clearCache();

        if (tbody) {
          tbody.innerHTML = "";
        }

        updateSummaryFromTable();

        if (progressBarContainer) {
          progressBarContainer.style.display = "block";
        }

        if (progressBar) {
          progressBar.style.width = "0%";
        }

        for (const row of json) {
          const name = row["Name"];
          const qty = parseOptionalNumber(row["__EMPTY"]);
          const buy = parseOptionalNumber(row["__EMPTY_1"]);
          count++;

          if (progressText) {
            progressText.innerText = `Importing ${count}/${total}`;
          }

          if (importStatus) {
            importStatus.innerText = `Importing ${count}/${total}: ${name || "Unknown"}`;
          }

          if (
            !name ||
            typeof name !== "string" ||
            name.toLowerCase().includes("stock name") ||
            name.toLowerCase().includes("summary")
          ) {
            if (progressBar) {
              progressBar.style.width = `${((count / total) * 100).toFixed(0)}%`;
            }
            continue;
          }

          let ticker = null;
          let mfSelection = null;

          if (config.useLocalTickerMap) {
            ticker = resolveLocalTicker(name);
          }

          if (isMutualFund) {
            mfSelection = await resolveTicker(name);
          } else if (!ticker) {
            ticker = await resolveTicker(name);
          }

          if (
            (isMutualFund && !mfSelection?.code) ||
            (!isMutualFund && (!ticker || ticker.includes(" ")))
          ) {
            if (progressBar) {
              progressBar.style.width = `${((count / total) * 100).toFixed(0)}%`;
            }
            continue;
          }

          const item = isMutualFund
            ? {
              code: String(mfSelection.code),
              name: mfSelection.name || name,
              qty: Number(qty),
              buy: Number(buy),
              type: normalizeFundType(
                row.Type || row.TYPE || row.Category || row.CATEGORY,
                name
              )
            }
            : {
              ticker,
              qty: Number(qty),
              buy: Number(buy)
            };

          if (config.includeType && !isMutualFund) {
            item.type = normalizeFundType(
              row.Type || row.TYPE || row.Category || row.CATEGORY,
              name
            );
          }

          holdings.push(item);

          if (config.useLocalTickerMap) {
            tickerMap[toRawTicker(name)] = ticker;
          }

          const rendered = await renderSingleHolding(item);

          if (!rendered) {
            holdings.pop();
            continue;
          }

          if (progressBar) {
            progressBar.style.width = `${((count / total) * 100).toFixed(0)}%`;
          }

          await sleep(120);
        }

        if (holdings.length === 0) {
          alert(config.noValidMessage);
          return;
        }

        holdings = normalizeHoldings(holdings);
        holdings.sort((a, b) => getHoldingLabel(a).localeCompare(getHoldingLabel(b)));
        await save();
        localStorage.setItem("failedStocks", JSON.stringify([]));
        await render();

        if (importStatus) {
          importStatus.innerText = "Import Completed";
        }

        if (progressText) {
          progressText.innerText = `Importing ${total}/${total}`;
        }

        setTimeout(() => {
          if (progressBarContainer) {
            progressBarContainer.style.display = "none";
          }
        }, 2000);
      } finally {
        isRefreshing = false;
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async function buildExportRows() {
    const rows = await Promise.all(
      holdings.map(async (s) => {
        const holdingKey = isMutualFund ? s.code : s.ticker;
        const data = await fetchPrice(holdingKey);

        if (!data) {
          return null;
        }

        const units = Number(s.units ?? s.qty) || 0;
        const buy = Number(s.buy) || 0;
        const price = Number(data.price ?? s.price) || 0;
        const investment = units * buy;
        const value = units * price;
        const pl = value - investment;
        const row = isMutualFund
          ? {
            [config.exportLabel]: s.name || s.code,
            Code: s.code,
            NAV: formatMoney(price),
            "NAV Date": data.date || "-",
            Units: units,
            Buy: formatMoney(buy),
            Investment: `\u20B9${formatMoney(investment)}`,
            Value: `\u20B9${formatMoney(value)}`,
            "P/L": `\u20B9${formatMoney(pl)}`,
            Type: normalizeFundType(s.type, s.name || s.code)
          }
          : {
            [config.exportLabel]: s.ticker,
            CMP: formatMoney(price),
            Open: formatMoney(data.open && data.open !== 0 ? data.open : data.prevClose || 0),
            Close: formatMoney(data.prevClose || 0),
            High: formatMoney(data.high || 0),
            Low: formatMoney(data.low || 0),
            "52W High": formatMoney(data.high52 || 0),
            "52W Low": formatMoney(data.low52 || 0),
            Qty: units,
            Buy: formatMoney(buy),
            Investment: `\u20B9${formatMoney(investment)}`,
            Value: `\u20B9${formatMoney(value)}`,
            "P/L": `\u20B9${formatMoney(pl)}`
          };

        if (config.includeType && !isMutualFund) {
          row.Type = normalizeFundType(s.type, s.ticker);
        }

        return row;
      })
    );

    return rows.filter((row) => row !== null);
  }

  async function downloadExcel() {
    const rows = await buildExportRows();

    if (rows.length === 0) {
      alert(config.emptyExportMessage);
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    XLSX.writeFile(wb, config.excelFileName);
  }

  async function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const rows = await buildExportRows();

    if (rows.length === 0) {
      alert(config.emptyExportMessage);
      return;
    }

    const columns = isMutualFund
      ? [config.exportLabel, "Code", "Type", "NAV", "NAV Date", "Units", "Buy", "Investment", "Value", "P/L"]
      : config.includeType
      ? [config.exportLabel, "Type", "CMP", "Open", "Close", "Qty", "Buy", "Investment", "Value", "P/L"]
      : [config.exportLabel, "CMP", "Open", "Close", "Qty", "Buy", "Investment", "Value", "P/L"];

    const tableData = rows.map((row) => {
      if (isMutualFund) {
        return [
          row[config.exportLabel],
          row.Code,
          row.Type,
          row.NAV,
          row["NAV Date"],
          row.Units,
          row.Buy,
          row.Investment,
          row.Value,
          row["P/L"]
        ];
      }

      return config.includeType
        ? [
          row[config.exportLabel],
          row.Type,
          row.CMP,
          row.Open,
          row.Close,
          row.Qty,
          row.Buy,
          row.Investment,
          row.Value,
          row["P/L"]
        ]
        : [
          row[config.exportLabel],
          row.CMP,
          row.Open,
          row.Close,
          row.Qty,
          row.Buy,
          row.Investment,
          row.Value,
          row["P/L"]
        ];
    });

    pdf.text(config.pdfTitle, 14, 10);
    pdf.autoTable({
      head: [columns],
      body: tableData,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 8 }
    });

    pdf.save(config.pdfFileName);
  }

  async function render() {
    const tbody = document.querySelector("#table tbody");
    tbody.innerHTML = "";

    holdings.sort((a, b) => getHoldingLabel(a).localeCompare(getHoldingLabel(b)));

    for (const holding of holdings) {
      const item = isMutualFund
        ? {
          ...holding,
          code: String(holding.code || "").trim()
        }
        : {
          ...holding,
          ticker: normalizeTicker(holding.ticker)
        };
      const data = await fetchPrice(isMutualFund ? item.code : item.ticker);

      if (!data) {
        continue;
      }

      tbody.innerHTML += buildRowMarkup(item, data);
    }

    updateSummaryFromTable();
    showFailedStocks();
    updateTime();
  }

  if (input) {
    input.addEventListener("input", async () => {
      const query = input.value.trim();

      if (isMutualFund) {
        delete input.dataset.selectedCode;
        delete input.dataset.selectedName;
      }

      if (query.length < 2) {
        dropdown.innerHTML = "";
        dropdown.style.display = "none";
        return;
      }

      try {
        const endpoint = config.searchEndpoint || "/api/search";
        const res = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        dropdown.innerHTML = data
          .map((item) => isMutualFund
            ? `
              <div onclick="selectStock('${String(item.schemeCode).replace(/'/g, "\\'")}', '${String(item.schemeName).replace(/'/g, "\\'")}')">
                ${item.schemeName} (${item.schemeCode})
              </div>
            `
            : `
              <div onclick="selectStock('${item.symbol}')">
                ${item.name} (${item.symbol})
              </div>
            `)
          .join("");
        dropdown.style.display = data.length ? "block" : "none";
      } catch (err) {
        console.error("Search error:", err);
        dropdown.innerHTML = "";
        dropdown.style.display = "none";
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!input || !dropdown) {
      return;
    }

    const target = event.target;

    if (!input.contains(target) && !dropdown.contains(target)) {
      dropdown.style.display = "none";
    }
  });

  window.addStock = addStock;
  window.clearAll = clearAll;
  window.downloadExcel = downloadExcel;
  window.downloadPDF = downloadPDF;
  window.importExcel = importExcel;
  window.logout = logout;
  window.editStock = editStock;
  window.refreshPrices = refreshPrices;
  window.removeStock = removeStock;
  window.selectStock = function selectAsset(value, label = "") {
    document.getElementById("ticker").value = label || value;
    if (input) {
      if (isMutualFund) {
        input.dataset.selectedCode = value;
        input.dataset.selectedName = label || value;
      } else {
        delete input.dataset.selectedCode;
        delete input.dataset.selectedName;
      }
    }
    dropdown.innerHTML = "";
    dropdown.style.display = "none";
  };
  window.toggleTheme = toggleTheme;

  loadTheme();
  updateHeader();
  loadHoldings();
  if (config.enableAutoRefresh !== false) {
    setInterval(updatePricesOnly, 30000);
  }
}
