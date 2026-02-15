export const browser =
  window.msBrowser || window.browser || window.chrome;

export function applyI18n() {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((element) => {
    const message = element.getAttribute("data-i18n");
    element.textContent = browser.i18n.getMessage(message);
  });
}

export function formatCurrency(value) {
  const num = typeof value === "number" && isFinite(value) ? value : 0;
  return num.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}
