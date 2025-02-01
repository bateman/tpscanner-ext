var browser = window.msBrowser || window.browser || window.chrome;
console.log('i18n.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const message = element.getAttribute('data-i18n');
      element.textContent = browser.i18n.getMessage(message);
  });
});