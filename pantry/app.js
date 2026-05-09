const storageKey = "smart-pantry-pwa-v1";

const recipes = [
  { name: "Chicken burrito bowls", ingredients: ["Rice", "Black beans", "Chicken breast", "Tomatoes"], tags: ["Dinner", "High protein"] },
  { name: "Pasta pomodoro", ingredients: ["Pasta", "Tomatoes", "Olive oil", "Garlic"], tags: ["Quick", "Vegetarian"] },
  { name: "Breakfast tacos", ingredients: ["Eggs", "Tortillas", "Cheese", "Salsa"], tags: ["Breakfast"] },
  { name: "Fried rice", ingredients: ["Rice", "Eggs", "Frozen vegetables", "Soy sauce"], tags: ["Quick"] },
  { name: "Bean chili", ingredients: ["Black beans", "Tomatoes", "Onion", "Chili powder"], tags: ["One pot", "Vegetarian"] },
  { name: "Chicken noodle soup", ingredients: ["Chicken breast", "Pasta", "Carrots", "Celery"], tags: ["Comfort"] },
];

const demoItems = [
  { name: "Rice", qty: 2, unit: "bags", category: "Grains", lowAt: 1, expires: "" },
  { name: "Black beans", qty: 4, unit: "cans", category: "Canned", lowAt: 2, expires: "" },
  { name: "Chicken breast", qty: 2, unit: "lb", category: "Protein", lowAt: 1, expires: "" },
  { name: "Tomatoes", qty: 4, unit: "each", category: "Produce", lowAt: 2, expires: "" },
  { name: "Pasta", qty: 1, unit: "box", category: "Grains", lowAt: 1, expires: "" },
];

let state = loadState();

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved?.pantry && saved?.grocery) return saved;
  } catch (error) {
    console.warn("Unable to load pantry state", error);
  }
  return { pantry: demoItems.map((item) => ({ id: id(), ...item })), grocery: [] };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function lowItems() {
  return state.pantry.filter((item) => Number(item.qty) <= Number(item.lowAt || 0));
}

function expiringItems() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(today.getDate() + 7);
  return state.pantry.filter((item) => {
    if (!item.expires) return false;
    const date = new Date(`${item.expires}T00:00:00`);
    return date >= today && date <= soon;
  });
}

function recipeMatches() {
  const available = new Set(state.pantry.filter((item) => Number(item.qty) > 0).map((item) => norm(item.name)));
  return recipes.map((recipe) => {
    const have = recipe.ingredients.filter((item) => available.has(norm(item)));
    const missing = recipe.ingredients.filter((item) => !available.has(norm(item)));
    return { ...recipe, have, missing, score: Math.round((have.length / recipe.ingredients.length) * 100) };
  }).sort((a, b) => b.score - a.score || a.missing.length - b.missing.length);
}

function addGrocery(name, source = "Manual") {
  const clean = String(name || "").trim();
  if (!clean) return;
  const exists = state.grocery.some((item) => norm(item.name) === norm(clean) && !item.done);
  if (!exists) state.grocery.push({ id: id(), name: clean, source, done: false });
}

function parseReceipt(text) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\$?\d+(\.\d{2})?\s*$/g, "").replace(/[^a-zA-Z0-9 &'/-]/g, " ").trim())
    .filter((line) => line.length > 2)
    .map((line) => line.replace(/\s+/g, " ").toLowerCase())
    .filter((line, index, arr) => arr.indexOf(line) === index)
    .map((line) => line.replace(/\b\w/g, (char) => char.toUpperCase()));
}

function render() {
  const low = lowItems();
  const expiring = expiringItems();
  document.querySelector("#stat-items").textContent = state.pantry.length;
  document.querySelector("#stat-low").textContent = low.length;
  document.querySelector("#stat-grocery").textContent = state.grocery.filter((item) => !item.done).length;

  document.querySelector("#alerts").innerHTML = expiring.length
    ? `<div class="alert">${expiring.length} item${expiring.length === 1 ? "" : "s"} expiring within 7 days</div>`
    : "";

  document.querySelector("#inventory").innerHTML = state.pantry.map((item) => `
    <div class="item ${Number(item.qty) <= Number(item.lowAt || 0) ? "low" : ""}">
      <div>
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="meta">${escapeHtml(item.category)}${item.expires ? ` · expires ${escapeHtml(item.expires)}` : ""}</div>
      </div>
      <button class="mini secondary" data-action="decrement" data-id="${item.id}">-</button>
      <div class="qty">${escapeHtml(item.qty)} ${escapeHtml(item.unit)}</div>
      <button class="mini secondary" data-action="increment" data-id="${item.id}">+</button>
      <button class="danger" data-action="delete" data-id="${item.id}">Remove</button>
    </div>
  `).join("");

  document.querySelector("#grocery-list").innerHTML = state.grocery.map((item) => `
    <div class="grocery-row ${item.done ? "done" : ""}">
      <input type="checkbox" ${item.done ? "checked" : ""} data-action="toggle-grocery" data-id="${item.id}">
      <span>${escapeHtml(item.name)} <small class="meta">${escapeHtml(item.source)}</small></span>
      <button class="mini danger" data-action="remove-grocery" data-id="${item.id}">x</button>
    </div>
  `).join("") || `<div class="meta">No grocery items yet.</div>`;

  document.querySelector("#recipes").innerHTML = recipeMatches().map((recipe) => `
    <div class="recipe">
      <div class="recipe-head"><span class="recipe-name">${escapeHtml(recipe.name)}</span><span class="score">${recipe.score}%</span></div>
      <div class="tags">${recipe.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="missing">${recipe.missing.length ? `Missing: ${recipe.missing.map(escapeHtml).join(", ")}` : "You have everything for this."}</div>
      <div class="button-row">
        ${recipe.missing.length ? `<button data-action="add-recipe" data-recipe="${escapeHtml(recipe.name)}">Add missing ingredients</button>` : ""}
        <button class="secondary" data-action="cook-recipe" data-recipe="${escapeHtml(recipe.name)}">Cook Recipe</button>
      </div>
    </div>
  `).join("");

  bindDynamicActions();
}

function bindDynamicActions() {
  document.querySelectorAll("[data-action]").forEach((node) => {
    node.onclick = () => {
      const action = node.dataset.action;
      const pantryItem = state.pantry.find((item) => item.id === node.dataset.id);
      if (action === "increment" && pantryItem) pantryItem.qty = Number(pantryItem.qty || 0) + 1;
      if (action === "decrement" && pantryItem) pantryItem.qty = Math.max(0, Number(pantryItem.qty || 0) - 1);
      if (action === "delete") state.pantry = state.pantry.filter((item) => item.id !== node.dataset.id);
      if (action === "toggle-grocery") {
        const item = state.grocery.find((entry) => entry.id === node.dataset.id);
        if (item) item.done = !item.done;
      }
      if (action === "remove-grocery") state.grocery = state.grocery.filter((item) => item.id !== node.dataset.id);
      if (action === "add-recipe") {
        const recipe = recipeMatches().find((item) => item.name === node.dataset.recipe);
        recipe?.missing.forEach((item) => addGrocery(item, recipe.name));
      }
      if (action === "cook-recipe") {
        const recipe = recipes.find((item) => item.name === node.dataset.recipe);
        recipe?.ingredients.forEach((ingredient) => {
          const match = state.pantry.find((item) => norm(item.name) === norm(ingredient));
          if (match) match.qty = Math.max(0, Number(match.qty || 0) - 1);
        });
      }
      saveState();
      render();
    };
  });
}

document.querySelector("#pantry-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.pantry.push({
    id: id(),
    name: String(data.get("name") || "").trim(),
    qty: Number(data.get("qty") || 1),
    unit: String(data.get("unit") || "each"),
    category: String(data.get("category") || "Pantry"),
    lowAt: Number(data.get("lowAt") || 1),
    expires: String(data.get("expires") || ""),
  });
  event.currentTarget.reset();
  saveState();
  render();
});

document.querySelector("#grocery-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  addGrocery(data.get("name"), "Manual");
  event.currentTarget.reset();
  saveState();
  render();
});

document.querySelector("#add-low").addEventListener("click", () => {
  lowItems().forEach((item) => addGrocery(item.name, "Low stock"));
  saveState();
  render();
});

document.querySelector("#clear-done").addEventListener("click", () => {
  state.grocery = state.grocery.filter((item) => !item.done);
  saveState();
  render();
});

document.querySelector("#seed-demo").addEventListener("click", () => {
  state.pantry = demoItems.map((item) => ({ id: id(), ...item }));
  state.grocery = [];
  saveState();
  render();
});

document.querySelector("#parse-receipt").addEventListener("click", () => {
  const items = parseReceipt(document.querySelector("#receipt-text").value);
  document.querySelector("#receipt-review").innerHTML = items.map((name) => `
    <div class="review-row">
      <span>${escapeHtml(name)}</span>
      <button class="secondary" data-import="${escapeHtml(name)}">Add Pantry</button>
      <button data-grocery="${escapeHtml(name)}">Add Grocery</button>
    </div>
  `).join("") || `<div class="meta">No items found.</div>`;
  document.querySelectorAll("[data-import]").forEach((button) => {
    button.onclick = () => {
      state.pantry.push({ id: id(), name: button.dataset.import, qty: 1, unit: "each", category: "Receipt", lowAt: 1, expires: "" });
      saveState();
      render();
    };
  });
  document.querySelectorAll("[data-grocery]").forEach((button) => {
    button.onclick = () => {
      addGrocery(button.dataset.grocery, "Receipt");
      saveState();
      render();
    };
  });
});

render();
