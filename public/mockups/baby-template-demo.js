(() => {
  const products = [
    {
      id: "body-nube",
      name: "Body Cruzado Nube",
      category: "Ropa",
      description: "Body cruzado de algodón suave, pensado para cambios simples.",
      price: 18900,
      stock: 14,
      images: [
        "https://images.pexels.com/photos/16681603/pexels-photo-16681603.jpeg?auto=compress&cs=tinysrgb&w=1000",
        "https://images.pexels.com/photos/3932934/pexels-photo-3932934.jpeg?auto=compress&cs=tinysrgb&w=1000"
      ],
      options: [
        { name: "Talle", values: ["RN", "0–3 M", "3–6 M"] },
        { name: "Color", values: ["Avena", "Nube"] }
      ]
    },
    {
      id: "enterito-jardin",
      name: "Enterito Jardín",
      category: "Ropa",
      description: "Enterito liviano con broches y estampa de pequeños jardines.",
      price: 26400,
      stock: 5,
      images: [
        "https://images.pexels.com/photos/5982382/pexels-photo-5982382.jpeg?auto=compress&cs=tinysrgb&w=1000",
        "https://images.pexels.com/photos/5982373/pexels-photo-5982373.jpeg?auto=compress&cs=tinysrgb&w=1000"
      ],
      options: [{ name: "Talle", values: ["0–3 M", "3–6 M", "6–12 M"] }]
    },
    {
      id: "cardigan-avena",
      name: "Cardigan Avena",
      category: "Ropa",
      description: "Tejido liviano para sumar una capa cómoda todos los días.",
      price: 32800,
      stock: 0,
      images: [
        "https://images.pexels.com/photos/3932934/pexels-photo-3932934.jpeg?auto=compress&cs=tinysrgb&w=1000",
        "https://images.pexels.com/photos/16681603/pexels-photo-16681603.jpeg?auto=compress&cs=tinysrgb&w=1000"
      ],
      options: [{ name: "Talle", values: ["3–6 M", "6–12 M", "12–18 M"] }]
    },
    {
      id: "primeros-pasos",
      name: "Primeros Pasos Arena",
      category: "Calzado",
      description: "Calzado flexible de horma amplia y ajuste simple.",
      price: 35900,
      stock: 3,
      images: [
        "https://images.pexels.com/photos/3932934/pexels-photo-3932934.jpeg?auto=compress&cs=tinysrgb&w=1000&crop=entropy",
        "https://images.pexels.com/photos/3661264/pexels-photo-3661264.jpeg?auto=compress&cs=tinysrgb&w=1000"
      ],
      options: [
        { name: "Talle", values: ["17", "18", "19", "20"] },
        { name: "Color", values: ["Arena", "Canela"] }
      ]
    },
    {
      id: "manta-muselina",
      name: "Manta Muselina",
      category: "Accesorios",
      description: "Manta respirable y liviana para paseos, siestas y arrullo.",
      price: 22100,
      stock: 18,
      images: [
        "https://images.pexels.com/photos/32452339/pexels-photo-32452339.jpeg?auto=compress&cs=tinysrgb&w=1000",
        "https://images.pexels.com/photos/16681603/pexels-photo-16681603.jpeg?auto=compress&cs=tinysrgb&w=1000"
      ],
      options: [{ name: "Color", values: ["Salvia", "Terracota", "Natural"] }]
    },
    {
      id: "gorro-bosque",
      name: "Gorro Bosque",
      category: "Accesorios",
      description: "Gorro suave con ajuste cómodo para acompañar cada salida.",
      price: 14600,
      stock: 9,
      images: [
        "https://images.pexels.com/photos/5982373/pexels-photo-5982373.jpeg?auto=compress&cs=tinysrgb&w=1000&crop=entropy",
        "https://images.pexels.com/photos/32452339/pexels-photo-32452339.jpeg?auto=compress&cs=tinysrgb&w=1000"
      ],
      options: [{ name: "Talle", values: ["0–6 M", "6–12 M", "12–18 M"] }]
    }
  ];

  const money = (value) => new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);

  const elements = {
    productGrid: document.getElementById("productGrid"),
    emptyState: document.getElementById("emptyState"),
    resultCount: document.getElementById("resultCount"),
    searchInput: document.getElementById("productSearch"),
    shade: document.getElementById("shade"),
    productPanel: document.getElementById("productPanel"),
    cartPanel: document.getElementById("cartPanel"),
    cartButton: document.getElementById("cartButton"),
    cartCount: document.getElementById("cartCount"),
    cartLines: document.getElementById("cartLines"),
    cartTotal: document.getElementById("cartTotal"),
    checkoutForm: document.getElementById("checkoutForm"),
    checkoutError: document.getElementById("checkoutError"),
    toast: document.getElementById("toast"),
    deliveryAddress: document.getElementById("deliveryAddress"),
    deliveryAddressInput: document.getElementById("deliveryAddressInput")
  };

  let currentFilter = "all";
  let activeProduct = null;
  let activeSelections = {};
  let cart = [];

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 1900);
  }

  function productCard(product) {
    const unavailable = product.stock === 0;
    const stockLabel = unavailable ? "Sin stock" : product.stock <= 4 ? `Quedan ${product.stock}` : "Disponible";
    return `<article class="product-card" data-category="${product.category}">
      <button class="product-open" type="button" data-product="${product.id}" ${unavailable ? "disabled" : ""}>
        <span class="product-media"><img src="${product.images[0]}" alt="${product.name}">${unavailable ? '<span class="product-action">Sin stock</span>' : `<span class="product-photos">${product.images.length} fotos</span>`}</span>
        <span class="product-copy"><span><small>${product.category}</small><strong>${product.name}</strong><em>${product.description}</em></span><b>${money(product.price)}</b><span class="stock ${product.stock > 0 && product.stock <= 4 ? "low" : ""}">${stockLabel}</span></span>
      </button>
    </article>`;
  }

  function renderProducts() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const visible = products.filter((product) => {
      const matchesFilter = currentFilter === "all" || product.category === currentFilter;
      const matchesQuery = `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
    elements.productGrid.innerHTML = visible.map(productCard).join("");
    elements.resultCount.textContent = `${visible.length} ${visible.length === 1 ? "producto" : "productos"}`;
    elements.emptyState.hidden = visible.length > 0;
    elements.productGrid.querySelectorAll("[data-product]").forEach((button) => {
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

  function closePanels() {
    elements.productPanel.classList.remove("open");
    elements.cartPanel.classList.remove("open");
    elements.shade.classList.remove("open");
    document.body.classList.remove("lock");
  }

  function openPanel(panel) {
    closePanels();
    panel.classList.add("open");
    elements.shade.classList.add("open");
    document.body.classList.add("lock");
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
    document.getElementById("addToCart").textContent = `Agregar · ${money(activeProduct.price)}`;
    document.querySelectorAll("[data-detail-image]").forEach((button) => button.addEventListener("click", () => {
      document.getElementById("detailImage").src = button.dataset.detailImage;
      document.querySelectorAll("[data-detail-image]").forEach((item) => item.classList.toggle("active", item === button));
    }));
    document.querySelectorAll("[data-option]").forEach((button) => button.addEventListener("click", () => {
      activeSelections[button.dataset.option] = button.dataset.value;
      document.querySelectorAll(`[data-option="${button.dataset.option}"]`).forEach((item) => item.classList.toggle("selected", item === button));
      document.getElementById("detailError").hidden = true;
    }));
    openPanel(elements.productPanel);
  }

  function addActiveProduct() {
    if (activeProduct.options.some((option) => !activeSelections[option.name])) {
      document.getElementById("detailError").hidden = false;
      return;
    }
    const selectionLabel = activeProduct.options.map((option) => `${option.name}: ${activeSelections[option.name]}`).join(" · ");
    const key = `${activeProduct.id}-${selectionLabel}`;
    const existing = cart.find((item) => item.key === key);
    const productQuantity = cart.filter((item) => item.product.id === activeProduct.id).reduce((sum, item) => sum + item.quantity, 0);
    if (productQuantity >= activeProduct.stock) {
      document.getElementById("detailError").textContent = "No hay más stock disponible.";
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
    elements.cartCount.textContent = count;
    elements.cartTotal.textContent = money(total);
    elements.cartLines.innerHTML = cart.length ? cart.map((item) => `<article class="cart-line">
      <img src="${item.product.images[0]}" alt="">
      <div><strong>${item.product.name}</strong><small>${item.selectionLabel}</small><div class="quantity"><button type="button" data-quantity="-1" data-key="${item.key}" aria-label="Quitar una unidad">−</button><b>${item.quantity}</b><button type="button" data-quantity="1" data-key="${item.key}" aria-label="Agregar una unidad">+</button></div><button class="remove-line" type="button" data-remove="${item.key}">Eliminar</button></div>
      <b>${money(item.product.price * item.quantity)}</b>
    </article>`).join("") : '<p class="empty-cart">Tu carrito está vacío.</p>';
    elements.cartLines.querySelectorAll("[data-quantity]").forEach((button) => button.addEventListener("click", () => {
      const item = cart.find((candidate) => candidate.key === button.dataset.key);
      const delta = Number(button.dataset.quantity);
      const totalForProduct = cart.filter((candidate) => candidate.product.id === item.product.id).reduce((sum, candidate) => sum + candidate.quantity, 0);
      if (delta > 0 && totalForProduct >= item.product.stock) return showToast("No hay más stock disponible");
      item.quantity += delta;
      if (item.quantity <= 0) cart = cart.filter((candidate) => candidate.key !== item.key);
      renderCart();
    }));
    elements.cartLines.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
      cart = cart.filter((item) => item.key !== button.dataset.remove);
      renderCart();
    }));
    elements.checkoutForm.querySelector("button[type=submit]").disabled = cart.length === 0;
  }

  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter, button.dataset.scroll === "true")));
  elements.searchInput.addEventListener("input", renderProducts);
  elements.cartButton.addEventListener("click", () => openPanel(elements.cartPanel));
  elements.shade.addEventListener("click", closePanels);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closePanels));
  document.getElementById("addToCart").addEventListener("click", addActiveProduct);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePanels(); });
  document.querySelectorAll('input[name="delivery"]').forEach((input) => input.addEventListener("change", () => {
    const isDelivery = input.value === "delivery" && input.checked;
    elements.deliveryAddress.hidden = !isDelivery;
    elements.deliveryAddressInput.required = isDelivery;
  }));
  elements.checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cart.length) return;
    if (!elements.checkoutForm.checkValidity()) {
      elements.checkoutError.hidden = false;
      elements.checkoutForm.reportValidity();
      return;
    }
    elements.checkoutError.hidden = true;
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
