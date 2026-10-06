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

