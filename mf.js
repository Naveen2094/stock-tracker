import { createPortfolioApp } from "./app-common.js";

function goToStocks() {
  localStorage.setItem("lastPortfolio", "stocks");
  window.location.href = "stocks.html";
}

window.goToStocks = goToStocks;

createPortfolioApp({
  storageSuffix: "mf",
  headerLabel: "MF",
  exportLabel: "Fund",
  includeType: true,
  useLocalTickerMap: false,
  dataSource: "mf",
  searchEndpoint: "/api/mf-search",
  quoteEndpoint: "/api/mf",
  enableAutoRefresh: false,
  invalidInputMessage: "Enter a valid fund or ETF",
  importStartMessage: "Importing funds... please wait",
  noValidMessage: "No valid funds found",
  emptyExportMessage: "No fund data available to export",
  failedHeading: "Fix These Funds:",
  sheetName: "MutualFunds",
  excelFileName: "MutualFundPortfolio.xlsx",
  pdfTitle: "Mutual Fund Portfolio",
  pdfFileName: "MutualFundPortfolio.pdf"
});
