function startApp() {
  const name = document.getElementById("username").value.trim();
  const type = document.getElementById("portfolioType").value;

  if (!name) {
    alert("Enter name");
    return;
  }

  localStorage.setItem("user", name);
  localStorage.setItem("lastPortfolio", type);

  if (type === "stocks") {
    window.location.href = "stocks.html";
  } else {
    window.location.href = "mf.html";
  }
}

const savedUser = localStorage.getItem("user");

if (savedUser) {
  const lastPortfolio = localStorage.getItem("lastPortfolio") || "stocks";
  window.location.href = lastPortfolio === "mf" ? "mf.html" : "stocks.html";
}

window.startApp = startApp;
