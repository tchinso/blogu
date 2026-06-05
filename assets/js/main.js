(function () {
  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
      return;
    }
    fn();
  };

  ready(() => {
    if (window.lucide) {
      try {
        window.lucide.createIcons();
      } catch (error) {
        console.error("Failed to initialize Lucide icons:", error);
      }
    }

    const body = document.body;
    const sidebar = document.querySelector(".lec-mobile-sidebar");
    const toggle = document.querySelector("[data-lec-mobile-toggle]");
    const backdrop = document.querySelector("[data-lec-mobile-close]");

    const setMenu = (open) => {
      if (!sidebar || !toggle || !backdrop) return;
      sidebar.classList.toggle("is-visible", open);
      toggle.classList.toggle("is-active", open);
      body.classList.toggle("is-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      sidebar.setAttribute("aria-hidden", String(!open));
      backdrop.hidden = !open;
    };

    if (toggle) {
      toggle.addEventListener("click", () => {
        setMenu(!sidebar.classList.contains("is-visible"));
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", () => setMenu(false));
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenu(false);
    });

    document.querySelectorAll("[data-lec-top]").forEach((button) => {
      button.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    const ddayRoot = document.querySelector("[data-dday-since]");
    const ddayOutput = document.querySelector("[data-dday-output]");
    if (ddayRoot && ddayOutput) {
      const since = new Date(`${ddayRoot.dataset.ddaySince}T00:00:00`);
      if (!Number.isNaN(since.getTime())) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start = new Date(since.getFullYear(), since.getMonth(), since.getDate());
        const diff = Math.floor((today - start) / 86400000) + 1;
        ddayOutput.textContent = diff >= 0 ? `D+${String(diff).padStart(3, "0")}` : `D${diff}`;
      }
    }

    const searchInput = document.querySelector("[data-lec-search-input]");
    const searchClear = document.querySelector("[data-lec-search-clear]");
    const emptyState = document.querySelector("[data-lec-empty-state]");
    const searchable = Array.from(document.querySelectorAll("[data-search-item]"));

    const runSearch = () => {
      if (!searchInput) return;
      const query = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;

      searchable.forEach((item) => {
        const text = (item.dataset.searchText || item.textContent || "").toLowerCase();
        const visible = !query || text.includes(query);
        item.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      if (emptyState) {
        emptyState.hidden = !query || visibleCount > 0;
      }
    };

    if (searchInput) {
      searchInput.addEventListener("input", runSearch);
    }

    if (searchClear && searchInput) {
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        runSearch();
        searchInput.focus();
      });
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    const cursor = document.querySelector(".lec-heart-cursor");
    const particles = [];
    let lastParticleAt = 0;

    const removeParticle = (particle) => {
      const index = particles.indexOf(particle);
      if (index >= 0) particles.splice(index, 1);
      particle.remove();
    };

    const addParticle = (x, y) => {
      const now = performance.now();
      if (now - lastParticleAt < 70) return;
      lastParticleAt = now;

      while (particles.length >= 50) {
        removeParticle(particles[0]);
      }

      const particle = document.createElement("span");
      const colors = ["#ff7da4", "#f86e83", "#ffd3de", "#fff4f7"];
      const size = Math.round(12 + Math.random() * 10);
      particle.className = "lec-heart-particle";
      particle.textContent = "\u2661";
      particle.style.left = `${x + Math.random() * 14 - 7}px`;
      particle.style.top = `${y + Math.random() * 14 - 7}px`;
      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = `${size}px`;
      particle.style.setProperty("--lec-heart-x", `${Math.random() * 34 - 17}px`);
      document.body.appendChild(particle);
      particles.push(particle);
      particle.addEventListener("animationend", () => removeParticle(particle), { once: true });
    };

    if (cursor && finePointer.matches) {
      document.addEventListener("mousemove", (event) => {
        cursor.style.transform = `translate3d(${event.clientX - 10}px, ${event.clientY - 10}px, 0)`;
        addParticle(event.clientX, event.clientY);
      });
    }
  });
})();
