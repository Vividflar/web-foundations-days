// ---------- Select elements ----------
const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusEl = document.querySelector("#status");
const usersList = document.querySelector("#users-list");
 
const API_URL = "https://jsonplaceholder.typicode.com/users";
 
// All loaded users are stored here so filtering never needs a new request
let users = [];
 
// ---------- Status messages ----------
function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}
 
// ---------- Rendering ----------
// Build one <p> line with createElement + textContent
function createLine(text, className) {
  const line = document.createElement("p");
  if (className) {
    line.classList.add(className);
  }
  line.textContent = text;
  return line;
}
 
// Draws any array of users
function renderUsers(list) {
  usersList.replaceChildren();
 
  if (list.length === 0) {
    const message = document.createElement("li");
    message.textContent = "No users match your filter.";
    usersList.appendChild(message);
    return;
  }
 
  for (const user of list) {
    const li = document.createElement("li");
    li.append(
      createLine(user.name, "user-name"),
      createLine(`Email: ${user.email}`),
      createLine(`City: ${user.address.city}`),
      createLine(`Company: ${user.company.name}`)
    );
    usersList.appendChild(li);
  }
}
 
// ---------- Filtering (no new request) ----------
function filterUsers() {
  if (users.length === 0) {
    return; // nothing loaded yet
  }
  const term = filterInput.value.trim().toLowerCase();
  const matches = users.filter((user) => user.name.toLowerCase().includes(term));
  renderUsers(matches);
}
 
// ---------- Loading ----------
async function loadUsers() {
  loadBtn.disabled = true;
  setStatus("Loading users...");
 
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    users = await response.json();
    filterUsers(); // draws all users, or only those matching what is already typed
    setStatus(`Loaded ${users.length} users.`);
  } catch (error) {
    users = [];
    usersList.replaceChildren();
    setStatus(`Could not load users: ${error.message}`, true);
  } finally {
    loadBtn.disabled = false;
  }
}
 
// ---------- Events ----------
loadBtn.addEventListener("click", loadUsers);
filterInput.addEventListener("input", filterUsers);
 