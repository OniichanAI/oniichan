document.querySelectorAll(".accordion-head").forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".accordion-item");
    item.classList.toggle("open");
  });
});

const focusToggle = document.getElementById("focusToggle");
if (focusToggle) {
  focusToggle.addEventListener("click", () => {
    document.querySelectorAll(".card, .hero").forEach((el) => {
      el.classList.toggle("focus");
    });
  });
}

const filterInput = document.getElementById("taskFilter");
if (filterInput) {
  const rows = Array.from(document.querySelectorAll("[data-task]"));
  filterInput.addEventListener("input", () => {
    const q = filterInput.value.trim().toLowerCase();
    rows.forEach((row) => {
      const match = row.dataset.task.includes(q);
      row.style.display = match ? "" : "none";
    });
  });
}
