import { createPortfolioApp } from "./app-common.js";

function goToMF() {
  localStorage.setItem("lastPortfolio", "mf");
  window.location.href = "mf.html";
}

window.goToMF = goToMF;

createPortfolioApp({
  storageSuffix: "stocks",
  headerLabel: "STOCKS",
  exportLabel: "Stock",
  includeType: false,
  useLocalTickerMap: true,
  invalidInputMessage: "Enter a valid ticker",
  importStartMessage: "Importing stocks... please wait",
  noValidMessage: "No valid stocks found",
  emptyExportMessage: "No stock data available to export",
  failedHeading: "Fix These Stocks:",
  sheetName: "Stocks",
  excelFileName: "StockPortfolio.xlsx",
  pdfTitle: "Stock Portfolio",
  pdfFileName: "StockPortfolio.pdf"
});
