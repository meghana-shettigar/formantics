(function () {
  var STORAGE_KEY = "retainformat_theme";

  function applyTheme(theme) {
    var isLight = theme === "light";
    var body = document.body;
    if (!body) return;
    if (isLight) {
      body.classList.remove("theme-dark");
      body.classList.add("theme-light");
    } else {
      body.classList.remove("theme-light");
      body.classList.add("theme-dark");
    }
    var lightThemeBtn = document.getElementById("lightThemeBtn");
    var darkThemeBtn = document.getElementById("darkThemeBtn");
    if (lightThemeBtn && darkThemeBtn) {
      if (isLight) {
        lightThemeBtn.classList.add("is-active");
        darkThemeBtn.classList.remove("is-active");
        lightThemeBtn.disabled = true;
        darkThemeBtn.disabled = false;
        lightThemeBtn.setAttribute("aria-checked", "true");
        darkThemeBtn.setAttribute("aria-checked", "false");
      } else {
        darkThemeBtn.classList.add("is-active");
        lightThemeBtn.classList.remove("is-active");
        darkThemeBtn.disabled = true;
        lightThemeBtn.disabled = false;
        darkThemeBtn.setAttribute("aria-checked", "true");
        lightThemeBtn.setAttribute("aria-checked", "false");
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    var saved = "light";
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "dark" || v === "light") saved = v;
    } catch (e) {}
    applyTheme(saved);

    var lightThemeBtn = document.getElementById("lightThemeBtn");
    var darkThemeBtn = document.getElementById("darkThemeBtn");
    if (lightThemeBtn) {
      lightThemeBtn.addEventListener("click", function () {
        applyTheme("light");
      });
    }
    if (darkThemeBtn) {
      darkThemeBtn.addEventListener("click", function () {
        applyTheme("dark");
      });
    }
  });
})();
