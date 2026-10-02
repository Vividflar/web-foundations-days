let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const VALID_CATEGORIES = ["personal", "work", "study"    
];

// Helper: lower-case, trim and collapse repeated spaces so
// "  Buy   MILK " and "buy milk" count as the same text.
function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------- 1. searchNotes ----------
// Returns an array of notes whose text contains word (ignoring case).
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(search));
}

