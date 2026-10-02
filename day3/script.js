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

// ---------- 2. longestNote ----------
// Returns the note object with the most characters, or null if there are none.
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// ---------- 3. countByCategory ----------
// Returns an object counting notes per category.
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category] === undefined) {
      counts[note.category] = 0;
    }
    counts[note.category]++;
  }
  return counts;
}
 
// ---------- 4. getSummary ----------
// Returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const total = notes.length;
  const word = total === 1 ? "note" : "notes";
  if (total === 0) {
    return `0 ${word}.`;
  }
  const counts = countByCategory();
  const parts = [];
  for (const category of VALID_CATEGORIES) {
    if (counts[category] > 0) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${total} ${word}: ${parts.join(", ")}.`;
}
 
// ---------- 5. isDuplicate ----------
// Returns true if a note with the same text exists (ignoring case and extra spaces).
function isDuplicate(text) {
  const wanted = normalizeText(text);
  return notes.some((note) => normalizeText(note.text) === wanted);
}

// ---------- 6. addNote ----------
// Adds a note only if it is valid. Returns true when added, false otherwise.
function addNote(text, category) {
  if (typeof text !== "string") {
    console.log("Not added: the text must be a string.");
    return false;
  }
  const cleaned = text.trim();
  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log(`Not added: text must be 1-200 characters (got ${cleaned.length}).`);
    return false;
  }
  if (!VALID_CATEGORIES.includes(category)) {
    console.log(`Not added: "${category}" is not a valid category (use personal, work or study).`);
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log(`Not added: "${cleaned}" already exists.`);
    return false;
  }
  const nextId = notes.length === 0 ? 1 : Math.max(...notes.map((n) => n.id)) + 1;
  notes.push({ id: nextId, text: cleaned, category: category });
  return true;
}
 
// Tests (expected output is in the comment next to each call)
 
// --- searchNotes ---
console.log("--- searchNotes ---");
console.log(searchNotes("the").map((n) => n.text));
// ["Finish the Day 3 assignment", "Email the project report to Grace"]
console.log(searchNotes("MILK").map((n) => n.text));
// ["Buy milk and bread"]  (upper case search still matches)
console.log(searchNotes("zebra"));
// []  (edge case: no results)
 
// --- longestNote ---
console.log("--- longestNote ---");
console.log(longestNote());
// { id: 3, text: "Email the project report to Grace", category: "work" }
{
  const saved = notes;
  notes = []; // edge case: no notes
  console.log(longestNote()); // null
  notes = saved;
}
 
// --- countByCategory ---
console.log("--- countByCategory ---");
console.log(countByCategory());
// { personal: 2, study: 2, work: 1 }  (key order follows first appearance)
{
  const saved = notes;
  notes = []; // edge case: no notes
  console.log(countByCategory()); // {}
  notes = saved;
}
 
// --- getSummary ---
console.log("--- getSummary ---");
console.log(getSummary());
// "5 notes: 2 personal, 1 work, 2 study."
{
  const saved = notes;
  notes = [saved[4]]; // edge case: exactly one note
  console.log(getSummary()); // "1 note: 1 personal."
  notes = [];         // edge case: no notes
  console.log(getSummary()); // "0 notes."
  notes = saved;
}
 
// --- isDuplicate ---
console.log("--- isDuplicate ---");
console.log(isDuplicate("buy milk and bread"));    // true  (different case)
console.log(isDuplicate("  CALL    mum  "));       // true  (extra spaces and case)
console.log(isDuplicate("Walk the dog"));          // false (not in the list)
console.log(isDuplicate("Buy milk"));              // false (only part of an existing note)
 
// --- addNote ---
console.log("--- addNote ---");
console.log(addNote("Walk the dog", "personal"));
// true  (valid note added as id 6)
console.log(addNote("  walk   THE dog ", "personal"));
// logs: Not added: "walk   THE dog" already exists.   then: false
console.log(addNote("   ", "work"));
// logs: Not added: text must be 1-200 characters (got 0).   then: false
console.log(addNote("a".repeat(201), "work"));
// logs: Not added: text must be 1-200 characters (got 201).   then: false
console.log(addNote("Plan the week", "hobby"));
// logs: Not added: "hobby" is not a valid category (use personal, work or study).   then: false
console.log(addNote("Read chapter 4", "study"));
// true  (valid note added as id 7)
 
// --- final check: summary after the two successful additions ---
console.log("--- after adding ---");
console.log(getSummary());
// "7 notes: 3 personal, 1 work, 3 study."
console.log(notes.length);
// 7
 