// ---------- Select elements ----------
const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const MAX_CHARS = 200;
const WARNING_AT = 180;
const DRAFT_KEY = "quicknotes-draft";
const THEME_KEY = "quicknotes-theme";

// ---------- Counters ----------
function updateCounts() {
  const text = noteText.value;
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
 
  charCount.textContent = `${chars} / ${MAX_CHARS} characters`;
  wordCount.textContent = `${words} words`;
 
  // over (red) wins over warning (orange)
  charCount.classList.toggle("over", chars > MAX_CHARS);
  charCount.classList.toggle("warning", chars > WARNING_AT && chars <= MAX_CHARS);
}

// ---------- Draft ----------
function saveDraft() {
  if (noteText.value === "") {
    localStorage.removeItem(DRAFT_KEY);
  } else {
    localStorage.setItem(DRAFT_KEY, noteText.value);
  }
}
 
function loadDraft() {
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft !== null) {
    noteText.value = draft;
  }
}
 
function clearNote() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  noteText.focus();
}

// ---------- Theme ----------
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  // The button label names the mode you will switch TO
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}
 
function loadTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) === "dark");
}
 
// ---------- Events ----------
noteText.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});
 
noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});
 
clearBtn.addEventListener("click", clearNote);
 
themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});
 
// ---------- On page load ----------
loadDraft();
loadTheme();
updateCounts();