(() => {
  const products = [
    {
      id: "lip-tint",
      name: "Tinta Labial Aura",
      category: "Maquillaje",
      description: "Color modulable, acabado luminoso y textura ultraliviana.",
      price: 24900,
      stock: 12,
      images: [
        "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=1000&q=86",
        "https://images.unsplash.com/photo-1631214540242-3cd8c9e9e7bb?auto=format&fit=crop&w=1000&q=86"
      ],
      options: [
        { name: "Tono", values: ["Rosa té", "Cereza", "Terracota"] }
      ]
    },
    {
      id: "blush-cloud",
      name: "Rubor Cloud",
      category: "Maquillaje",
      description: "Pigmento sedoso que se funde con la piel y se difumina fácil.",
      price: 28700,
      stock: 7,
      images: [
        "https://images.unsplash.com/photo-1599733589046-10c005739ef9?auto=format&fit=crop&w=1000&q=86",
        "https://images.unsplash.com/photo-1619451334792-150fd785ee74?auto=format&fit=crop&w=1000&q=86"
      ],
      options: [
        { name: "Tono", values: ["Petal", "Peach", "Berry"] }
      ]
    },
    {
      id: "dress-noa",
      name: "Vestido Noa",
      category: "Indumentaria",
      description: "Silueta fluida con espalda abierta y caída suave.",
      price: 86900,
      stock: 9,
      images: [
        "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=86",
        "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1000&q=86"
      ],
      options: [
        { name: "Talle", values: ["XS", "S", "M", "L"] },
        { name: "Color", values: ["Negro", "Borgoña"] }
      ]
    },
    {
      id: "blazer-alba",
      name: "Blazer Alba",
      category: "Indumentaria",
      description: "Sastrería relajada, hombro definido y forrería al tono.",
      price: 112000,
      stock: 0,
      images: [
        "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=1000&q=86",
        "https://images.unsplash.com/photo-1548624313-0396c75e4b1a?auto=format&fit=crop&w=1000&q=86"
      ],
      options: [
        { name: "Talle", values: ["S", "M", "L"] }
      ]
    },
    {
      id: "pump-cleo",
      name: "Cleo Slingback",
      category: "Calzado",
      description: "Punta fina, taco medio y tira posterior regulable.",
      price: 94500,
      stock: 4,
      images: [
        "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1000&q=86",
        "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=1000&q=86"
      ],
      options: [
        { name: "Talle", values: ["35", "36", "37", "38", "39"] },
        { name: "Color", values: ["Negro", "Rojo"] }
      ]
    },
    {
      id: "sneaker-luna",
      name: "Zapatilla Luna",
      category: "Calzado",
      description: "Cuero suave, base liviana y detalle metalizado.",
      price: 79800,
      stock: 16,
      images: [
        "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1000&q=86",
        "https://images.unsplash.com/photo-1465453869711-7e174808ace9?auto=format&fit=crop&w=1000&q=86"
      ],
      options: [
        { name: "Talle", values: ["35", "36", "37", "38", "39", "40"] }
      ]
    }
  ];

  const money = (value) => new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);

  const productGrid = document.getElementById("productGrid");
  const emptyState = document.getElementById("emptyState");
  const resultCount = document.getElementById("resultCount");
  const searchInput = document.getElementById("productSearch");
  const shade = document.getElementById("shade");
  const productPanel = document.getElementById("productPanel");
  const cartPanel = document.getElementById("cartPanel");
  const cartButton = document.getElementById("cartButton");
  const cartCount = document.getElementById("cartCount");
  const cartLines = document.getElementById("cartLines");
  const cartTotal = document.getElementById("cartTotal");
  const checkoutForm = document.getElementById("checkoutForm");
  const checkoutError = document.getElementById("checkoutError");
  const toast = document.getElementById("toast");
  const deliveryAddress = document.getElementById("deliveryAddress");
  const deliveryAddressInput = document.getElementById("deliveryAddressInput");
  let currentFilter = "all";
  let activeProduct = null;
  let activeSelections = {};
  let cart = [];

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1900);
  }

  function productCard(product) {
    const unavailable = product.stock === 0;
    return `<article class="product-card" data-category="${product.category}">
      <button class="product-open" type="button" data-product="${product.id}" ${unavailable ? "disabled" : ""}>
        <span class="product-media"><img src="${product.images[0]}" alt="${product.name}">${unavailable ? '<span class="product-action">No disponible</span>' : `<span class="product-photos">${product.images.length} fotos</span>`}</span>
        <span class="product-copy"><span><small>${product.category}</small><strong>${product.name}</strong><em>${product.description}</em></span><b>${money(product.price)}</b><span class="stock ${product.stock > 0 && product.stock <= 4 ? "low" : ""}">${unavailable ? "Sin stock" : product.stock <= 4 ? `Últimas ${product.stock} unidades` : "Stock disponible"}</span></span>
      </button>
    </article>`;
  }

  function renderProducts() {
    const query = searchInput.value.trim().toLowerCase();
    const visible = products.filter((product) => {
      const matchesFilter = currentFilter === "all" || product.category === currentFilter;
      const matchesQuery = `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
    productGrid.innerHTML = visible.map(productCard).join("");
    resultCount.textContent = `${visible.length} ${visible.length === 1 ? "producto" : "productos"}`;
    emptyState.hidden = visible.length > 0;
    productGrid.querySelectorAll("[data-product]").forEach((button) => {
      button.addEventListener("click", () => openProduct(button.dataset.product));
    });
  }

  function setFilter(filter, scroll = false) {
    currentFilter = filter;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === filter);
      button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
    });
    renderProducts();
    if (scroll) document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
  }

  function openPanel(panel) {
    closePanels();
    panel.classList.add("open");
    shade.classList.add("open");
    document.body.classList.add("lock");
  }

  function closePanels() {
    productPanel.classList.remove("open");
    cartPanel.classList.remove("open");
    shade.classList.remove("open");
    document.body.classList.remove("lock");
  }

  function openProduct(id) {
    activeProduct = products.find((product) => product.id === id);
    if (!activeProduct || activeProduct.stock === 0) return;
    activeSelections = {};
    document.getElementById("detailCategory").textContent = activeProduct.category;
    document.getElementById("detailName").textContent = activeProduct.name;
    document.getElementById("detailDescription").textContent = activeProduct.description;
    document.getElementById("detailPrice").textContent = money(activeProduct.price);
    document.getElementById("detailStock").textContent = activeProduct.stock <= 4 ? `Quedan ${activeProduct.stock} unidades` : "Stock disponible";
    document.getElementById("detailImage").src = activeProduct.images[0];
    document.getElementById("detailImage").alt = activeProduct.name;
    document.getElementById("detailThumbs").innerHTML = activeProduct.images.map((image, index) => `<button class="detail-thumb ${index === 0 ? "active" : ""}" type="button" data-detail-image="${image}" aria-label="Ver imagen ${index + 1}"><img src="${image}" alt=""></button>`).join("");
    document.getElementById("detailOptions").innerHTML = activeProduct.options.map((option) => `<fieldset class="option-group"><legend>${option.name} <span>*</span></legend><div class="option-values">${option.values.map((value) => `<button type="button" data-option="${option.name}" data-value="${value}">${value}</button>`).join("")}</div></fieldset>`).join("");
    document.getElementById("detailError").hidden = true;
    document.getElementById("addToCart").textContent = `Agregar al carrito · ${money(activeProduct.price)}`;
    document.querySelectorAll("[data-detail-image]").forEach((button) => button.addEventListener("click", () => {
      document.getElementById("detailImage").src = button.dataset.detailImage;
      document.querySelectorAll("[data-detail-image]").forEach((item) => item.classList.toggle("active", item === button));
    }));
    document.querySelectorAll("[data-option]").forEach((button) => button.addEventListener("click", () => {
      activeSelections[button.dataset.option] = button.dataset.value;
      document.querySelectorAll(`[data-option="${button.dataset.option}"]`).forEach((item) => item.classList.toggle("selected", item === button));
      document.getElementById("detailError").hidden = true;
    }));
    openPanel(productPanel);
  }

  function addActiveProduct() {
    const missing = activeProduct.options.some((option) => !activeSelections[option.name]);
    if (missing) {
      document.getElementById("detailError").hidden = false;
      return;
    }
    const selectionLabel = activeProduct.options.map((option) => `${option.name}: ${activeSelections[option.name]}`).join(" · ");
    const key = `${activeProduct.id}-${selectionLabel}`;
    const existing = cart.find((item) => item.key === key);
    const productQuantity = cart.filter((item) => item.product.id === activeProduct.id).reduce((sum, item) => sum + item.quantity, 0);
    if (productQuantity >= activeProduct.stock) {
      document.getElementById("detailError").textContent = "No hay más stock disponible para esta variante.";
      document.getElementById("detailError").hidden = false;
      return;
    }
    if (existing) existing.quantity += 1;
    else cart.push({ key, product: activeProduct, selectionLabel, quantity: 1 });
    renderCart();
    closePanels();
    showToast("Producto agregado al carrito");
  }

  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    cartCount.textContent = count;
    cartTotal.textContent = money(total);
    cartLines.innerHTML = cart.length ? cart.map((item) => `<article class="cart-line">
      <img src="${item.product.images[0]}" alt="">
      <div><strong>${item.product.name}</strong><small>${item.selectionLabel}</small><div class="quantity"><button type="button" data-quantity="-1" data-key="${item.key}" aria-label="Quitar una unidad">−</button><b>${item.quantity}</b><button type="button" data-quantity="1" data-key="${item.key}" aria-label="Agregar una unidad">+</button></div><button class="remove-line" type="button" data-remove="${item.key}">Eliminar</button></div>
      <b>${money(item.product.price * item.quantity)}</b>
    </article>`).join("") : '<p class="empty-cart">Tu carrito está vacío.</p>';
    cartLines.querySelectorAll("[data-quantity]").forEach((button) => button.addEventListener("click", () => {
      const item = cart.find((candidate) => candidate.key === button.dataset.key);
      const next = item.quantity + Number(button.dataset.quantity);
      const totalForProduct = cart.filter((candidate) => candidate.product.id === item.product.id).reduce((sum, candidate) => sum + candidate.quantity, 0);
      if (Number(button.dataset.quantity) > 0 && totalForProduct >= item.product.stock) return showToast("No hay más stock disponible");
      item.quantity = next;
      if (item.quantity <= 0) cart = cart.filter((candidate) => candidate.key !== item.key);
      renderCart();
    }));
    cartLines.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
      cart = cart.filter((item) => item.key !== button.dataset.remove);
      renderCart();
    }));
    checkoutForm.querySelector("button[type=submit]").disabled = cart.length === 0;
  }

  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter, button.dataset.scroll === "true")));
  searchInput.addEventListener("input", renderProducts);
  cartButton.addEventListener("click", () => openPanel(cartPanel));
  shade.addEventListener("click", closePanels);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closePanels));
  document.getElementById("addToCart").addEventListener("click", addActiveProduct);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePanels(); });
  document.querySelectorAll('input[name="delivery"]').forEach((input) => input.addEventListener("change", () => {
    const isDelivery = input.value === "delivery" && input.checked;
    deliveryAddress.hidden = !isDelivery;
    deliveryAddressInput.required = isDelivery;
  }));
  checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cart.length) return;
    if (!checkoutForm.checkValidity()) {
      checkoutError.hidden = false;
      checkoutForm.reportValidity();
      return;
    }
    checkoutError.hidden = true;
    closePanels();
    showToast("En la tienda real se abrirá WhatsApp con el pedido");
  });

  const slides = [...document.querySelectorAll(".hero-slide")];
  const dots = [...document.querySelectorAll("[data-slide]")];
  let slideIndex = 0;
  function showSlide(index) {
    slideIndex = index;
    slides.forEach((slide, position) => slide.classList.toggle("active", position === slideIndex));
    dots.forEach((dot, position) => dot.classList.toggle("active", position === slideIndex));
  }
  dots.forEach((dot, index) => dot.addEventListener("click", () => showSlide(index)));
  if (slides.length > 1) window.setInterval(() => showSlide((slideIndex + 1) % slides.length), 5000);

  const siteHeader = document.querySelector(".site-header");
  const updateHeader = () => siteHeader.classList.toggle("scrolled", window.scrollY > 16);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  renderProducts();
  renderCart();
})();
