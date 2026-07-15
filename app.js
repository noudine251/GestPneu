const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} = React;
const {
  LayoutDashboard,
  Package,
  Boxes,
  Truck,
  ShoppingCart,
  Landmark,
  Users,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Menu,
  LogOut,
  FileText,
  KeyRound,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  MapPin,
  Phone,
  Building2,
  Lock,
  Receipt,
  Send,
  CheckCheck,
  XCircle,
  ArrowRightCircle
} = LucideReact;

/* ---------------------------------------------------------------------- */
/*  Kils Import/Export — Gestion boutique pneus d'occasion                */
/* ---------------------------------------------------------------------- */

const COMPANY = {
  name: "Kils Import/Export",
  phone: "+237 670 05 28 57",
  location: "Bonabo, Douala — Cameroun"
};
const FMT = new Intl.NumberFormat("fr-FR");
const cfa = n => `${FMT.format(Math.round(Number(n) || 0))} FCFA`;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const today = () => new Date().toISOString().slice(0, 10);
const ROLE_LABEL = {
  admin: "Administrateur",
  vendeur: "Vendeur"
};
const QUOTE_STATUS_LABEL = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  invoiced: "Facturé"
};
const QUOTE_STATUS_TONE = {
  draft: "neutral",
  sent: "info",
  accepted: "ok",
  refused: "danger",
  invoiced: "ok"
};
const INVOICE_STATUS_LABEL = {
  unpaid: "Non payée",
  paid: "Payée",
  overdue: "En retard"
};
const INVOICE_STATUS_TONE = {
  unpaid: "warn",
  paid: "ok",
  overdue: "danger"
};
const KEYS = {
  products: "kils:products",
  suppliers: "kils:suppliers",
  orders: "kils:purchaseOrders",
  moves: "kils:stockMovements",
  sales: "kils:sales",
  shipments: "kils:shipments",
  accounts: "kils:bankAccounts",
  txns: "kils:bankTransactions",
  customers: "kils:customers",
  users: "kils:users",
  quotes: "kils:quotes",
  invoices: "kils:invoices"
};

// saveC/subscribeC (Firestore temps réel) sont définies dans firebase-init.js,
// chargé avant ce fichier dans index.html.

/* ---------------------------- PDF (jsPDF via CDN) ------------------------ */

function loadScriptOnce(src, isReady) {
  const ready = isReady || (() => !!window.jspdf);
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) {
      const check = () => ready() ? resolve() : setTimeout(check, 50);
      return check();
    }
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Impossible de charger " + src));
    document.head.appendChild(s);
  });
}
async function ensureJsPDF() {
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => !!window.jspdf);
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js", () => !!(window.jspdf && window.jspdf.jsPDF.API.autoTable));
  return window.jspdf.jsPDF;
}
// La police par défaut de jsPDF ne gère pas l'espace fine insécable utilisée par Intl "fr-FR" — on la remplace par un espace normal pour l'impression.
const pdfNum = n => FMT.format(Math.round(Number(n) || 0)).replace(/ /g, " ");
async function generateDocPDF(kind, record, customer) {
  const JsPDF = await ensureJsPDF();
  const doc = new JsPDF();
  const title = kind === "devis" ? "DEVIS" : "FACTURE";
  const DARK = [23, 23, 23];
  const ORANGE = [232, 89, 12];
  const GRAY = [140, 140, 140];

  // Bandeau d'en-tête
  doc.setFillColor(...DARK);
  doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text(COMPANY.name, 14, 17);
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(COMPANY.location, 14, 25);
  doc.text(COMPANY.phone, 14, 30);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(title, 196, 17, { align: "right" });
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(`N° ${record.number}`, 196, 25, { align: "right" });
  doc.text(`Date : ${record.date}`, 196, 30, { align: "right" });
  doc.setFillColor(...ORANGE);
  doc.rect(0, 38, 210, 2, "F");

  // Bloc client / échéance
  let y = 52;
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  doc.text("FACTURÉ À", 14, y);
  doc.text(kind === "devis" ? "VALABLE JUSQU'AU" : "ÉCHÉANCE", 196, y, { align: "right" });
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(customer?.name || record.customerName || "Client comptoir", 14, y);
  doc.setFontSize(10);
  doc.text(kind === "devis" ? record.validUntil || "-" : record.dueDate || record.date, 196, y, { align: "right" });
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  if (customer?.phone || record.phone) {
    y += 6;
    doc.text(`Tél : ${customer?.phone || record.phone}`, 14, y);
  }
  if (customer?.address || record.address) {
    y += 6;
    doc.text(String(customer?.address || record.address), 14, y);
  }

  // Tableau des lignes
  const rows = record.items.map(it => [String(it.label || "Article"), String(it.qty), `${pdfNum(it.unitPrice)} FCFA`, `${pdfNum(it.qty * it.unitPrice)} FCFA`]);
  doc.autoTable({
    startY: 75,
    head: [["Désignation", "Qté", "P.U.", "Total"]],
    body: rows,
    theme: "striped",
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    headStyles: {
      fillColor: DARK,
      textColor: 255,
      fontStyle: "bold"
    },
    columnStyles: {
      1: {
        halign: "right",
        cellWidth: 20
      },
      2: {
        halign: "right",
        cellWidth: 35
      },
      3: {
        halign: "right",
        cellWidth: 35
      }
    },
    margin: {
      left: 14,
      right: 14
    }
  });
  let finalY = doc.lastAutoTable.finalY + 10;

  // Total mis en évidence
  doc.setFillColor(...ORANGE);
  doc.rect(120, finalY - 8, 76, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL : ${pdfNum(record.total)} FCFA`, 192, finalY, { align: "right" });
  finalY += 16;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  const statusLabel = kind === "devis" ? QUOTE_STATUS_LABEL[record.status] : INVOICE_STATUS_LABEL[record.status];
  if (statusLabel) {
    doc.text(`Statut : ${statusLabel}`, 14, finalY);
    finalY += 7;
  }
  if (record.notes) {
    doc.text(`Notes : ${record.notes}`, 14, finalY);
  }

  // Pied de page
  doc.setDrawColor(225, 225, 225);
  doc.setLineWidth(0.3);
  doc.line(14, 280, 196, 280);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Merci pour votre confiance — Kils Import/Export, pneus d'occasion.", 105, 286, { align: "center" });
  doc.save(`${record.number}.pdf`);
}

/* ---------------------------- UI atoms --------------------------------- */

function Shell({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Inter, sans-serif"
    },
    className: "min-h-screen bg-stone-100 text-neutral-900"
  }, children);
}
function TreadRule({
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `h-2 w-full ${className}`,
    style: {
      backgroundImage: "repeating-linear-gradient(115deg, #E8590C 0px, #E8590C 8px, transparent 8px, transparent 16px)",
      opacity: 0.9
    }
  });
}
function Card({
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `bg-white rounded-lg border border-stone-200 shadow-sm ${className}`
  }, children);
}
function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  className = "",
  disabled
}) {
  const styles = {
    primary: "bg-orange-600 text-white hover:bg-orange-700",
    dark: "bg-neutral-900 text-white hover:bg-neutral-800",
    ghost: "bg-transparent text-neutral-900 border border-stone-300 hover:bg-stone-200",
    danger: "bg-transparent text-red-700 border border-red-200 hover:bg-red-50"
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    className: `inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`
  }, children);
}
function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "block mb-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1"
  }, label), children);
}
const inputCls = "w-full px-3 py-2 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600";
function Input(props) {
  return /*#__PURE__*/React.createElement("input", {
    ...props,
    className: `${inputCls} ${props.className || ""}`
  });
}
function Select(props) {
  return /*#__PURE__*/React.createElement("select", {
    ...props,
    className: `${inputCls} ${props.className || ""}`
  });
}
function Modal({
  title,
  onClose,
  children,
  wide
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: `bg-white rounded-lg w-full ${wide ? "max-w-2xl" : "max-w-md"} my-8 shadow-xl`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-5 py-4 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold text-lg",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-stone-500 hover:text-neutral-900"
  }, /*#__PURE__*/React.createElement(X, {
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-5"
  }, children)));
}
function Badge({
  children,
  tone = "neutral"
}) {
  const tones = {
    neutral: "bg-stone-200 text-stone-500",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-red-50 text-red-700",
    ok: "bg-emerald-50 text-emerald-700",
    info: "bg-blue-50 text-blue-700"
  };
  return /*#__PURE__*/React.createElement("span", {
    className: `px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${tones[tone]}`
  }, children);
}
function Empty({
  text,
  icon: Icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center justify-center py-14 text-stone-400"
  }, /*#__PURE__*/React.createElement(Icon, {
    size: 32,
    className: "mb-2 opacity-50"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-sm"
  }, text));
}
const NAV = [{
  id: "dashboard",
  label: "Tableau de bord",
  icon: LayoutDashboard,
  roles: ["admin", "vendeur"]
}, {
  id: "products",
  label: "Produits",
  icon: Package,
  roles: ["admin", "vendeur"]
}, {
  id: "stock",
  label: "Stock",
  icon: Boxes,
  roles: ["admin", "vendeur"]
}, {
  id: "customers",
  label: "Clients",
  icon: Users,
  roles: ["admin", "vendeur"]
}, {
  id: "suppliers",
  label: "Fournisseurs",
  icon: Building2,
  roles: ["admin", "vendeur"]
}, {
  id: "orders",
  label: "Commandes fournisseur",
  icon: ShoppingCart,
  roles: ["admin", "vendeur"]
}, {
  id: "sales",
  label: "Ventes & livraisons",
  icon: Truck,
  roles: ["admin", "vendeur"]
}, {
  id: "billing",
  label: "Devis & Factures",
  icon: Receipt,
  roles: ["admin", "vendeur"]
}, {
  id: "bank",
  label: "Banque",
  icon: Landmark,
  roles: ["admin", "vendeur"]
}, {
  id: "users",
  label: "Utilisateurs",
  icon: UserCog,
  roles: ["admin"]
}];

/* ------------------------------ App ------------------------------------ */

function App() {
  const [tab, setTab] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [moves, setMoves] = useState([]);
  const [sales, setSales] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [txns, setTxns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  useEffect(() => {
    const pending = new Set(Object.keys(KEYS));
    const markLoaded = k => {
      pending.delete(k);
      if (pending.size === 0) setLoaded(true);
    };
    const unsubs = [subscribeC(KEYS.products, d => {
      setProducts(d);
      markLoaded("products");
    }), subscribeC(KEYS.suppliers, d => {
      setSuppliers(d);
      markLoaded("suppliers");
    }), subscribeC(KEYS.orders, d => {
      setOrders(d);
      markLoaded("orders");
    }), subscribeC(KEYS.moves, d => {
      setMoves(d);
      markLoaded("moves");
    }), subscribeC(KEYS.sales, d => {
      setSales(d);
      markLoaded("sales");
    }), subscribeC(KEYS.shipments, d => {
      setShipments(d);
      markLoaded("shipments");
    }), subscribeC(KEYS.accounts, d => {
      setAccounts(d.length ? d : [{
        id: uid(),
        name: "Caisse principale",
        initial: 0
      }]);
      markLoaded("accounts");
    }), subscribeC(KEYS.txns, d => {
      setTxns(d);
      markLoaded("txns");
    }), subscribeC(KEYS.customers, d => {
      setCustomers(d);
      markLoaded("customers");
    }), subscribeC(KEYS.users, d => {
      setUsers(d);
      markLoaded("users");
    }), subscribeC(KEYS.quotes, d => {
      setQuotes(d);
      markLoaded("quotes");
    }), subscribeC(KEYS.invoices, d => {
      setInvoices(d);
      markLoaded("invoices");
    })];
    return () => unsubs.forEach(u => u());
  }, []);
  useEffect(() => {
    if (loaded) saveC(KEYS.products, products);
  }, [products, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.suppliers, suppliers);
  }, [suppliers, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.orders, orders);
  }, [orders, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.moves, moves);
  }, [moves, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.sales, sales);
  }, [sales, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.shipments, shipments);
  }, [shipments, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.accounts, accounts);
  }, [accounts, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.txns, txns);
  }, [txns, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.customers, customers);
  }, [customers, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.users, users);
  }, [users, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.quotes, quotes);
  }, [quotes, loaded]);
  useEffect(() => {
    if (loaded) saveC(KEYS.invoices, invoices);
  }, [invoices, loaded]);
  const lowStock = useMemo(() => products.filter(p => Number(p.qty) <= Number(p.alertThreshold ?? 3)), [products]);
  const bankBalance = useCallback(accId => {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return 0;
    const sum = txns.filter(t => t.accountId === accId).reduce((s, t) => s + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)), 0);
    return Number(acc.initial || 0) + sum;
  }, [accounts, txns]);
  const totalBalance = accounts.reduce((s, a) => s + bankBalance(a.id), 0);
  const adjustStock = (productId, delta, reason, ref) => {
    setProducts(prev => prev.map(p => p.id === productId ? {
      ...p,
      qty: Math.max(0, Number(p.qty) + delta)
    } : p));
    setMoves(prev => [{
      id: uid(),
      productId,
      type: delta >= 0 ? "in" : "out",
      qty: Math.abs(delta),
      reason,
      ref: ref || "",
      date: today(),
      by: currentUser?.name || "—"
    }, ...prev]);
  };
  const addTxn = (accountId, type, amount, label, ref) => {
    if (!accountId || !amount) return;
    setTxns(prev => [{
      id: uid(),
      accountId,
      type,
      amount: Number(amount),
      label,
      ref: ref || "",
      date: today(),
      by: currentUser?.name || "—"
    }, ...prev]);
  };
  if (!loaded) {
    return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
      className: "p-10 text-stone-500"
    }, "Chargement…"));
  }
  if (!currentUser) {
    return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement(Login, {
      users: users,
      setUsers: setUsers,
      onLogin: setCurrentUser
    }));
  }
  const visibleNav = NAV.filter(n => n.roles.includes(currentUser.role));
  const activeTab = visibleNav.some(n => n.id === tab) ? tab : "dashboard";
  return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
    className: "flex min-h-screen"
  }, navOpen && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-30 bg-black/40 md:hidden",
    onClick: () => setNavOpen(false)
  }), /*#__PURE__*/React.createElement("aside", {
    className: `fixed inset-y-0 left-0 z-40 w-64 bg-neutral-900 text-white flex flex-col transform transition-transform duration-200 md:static md:z-auto md:w-60 md:shrink-0 md:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-5 pt-6 pb-4 flex items-start justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    },
    className: "text-3xl font-bold tracking-tight leading-none"
  }, "Kils Import/Export"), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-stone-400 mt-1"
  }, "Gestion boutique — pneus d'occasion")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setNavOpen(false),
    className: "text-stone-400 hover:text-white md:hidden"
  }, /*#__PURE__*/React.createElement(X, {
    size: 20
  }))), /*#__PURE__*/React.createElement(TreadRule, null), /*#__PURE__*/React.createElement("nav", {
    className: "flex-1 py-3 overflow-y-auto"
  }, visibleNav.map(n => {
    const Icon = n.icon;
    const active = activeTab === n.id;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => {
        setTab(n.id);
        setNavOpen(false);
      },
      className: `w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left transition-colors border-l-4 ${active ? "bg-neutral-800 border-orange-600 text-white" : "border-transparent text-stone-400 hover:bg-neutral-800 hover:text-white"}`
    }, /*#__PURE__*/React.createElement(Icon, {
      size: 17
    }), n.label, n.id === "stock" && lowStock.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-[10px] bg-orange-600 text-white rounded-full px-1.5 py-0.5"
    }, lowStock.length));
  })), /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-4 text-[11px] text-stone-400 border-t border-neutral-800 space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement(MapPin, {
    size: 12
  }), " ", COMPANY.location), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement(Phone, {
    size: 12
  }), " ", COMPANY.phone), /*#__PURE__*/React.createElement("div", {
    className: "pt-2 border-t border-neutral-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-white text-sm font-medium"
  }, currentUser.name), /*#__PURE__*/React.createElement("div", {
    className: "text-stone-500"
  }, ROLE_LABEL[currentUser.role]), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCurrentUser(null),
    className: "mt-2 flex items-center gap-1.5 text-stone-400 hover:text-white"
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 14
  }), "Déconnexion")))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("header", {
    className: "bg-white border-b border-stone-200 px-4 md:px-8 py-4 flex items-center justify-between gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 min-w-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setNavOpen(true),
    className: "text-neutral-700 md:hidden shrink-0"
  }, /*#__PURE__*/React.createElement(Menu, {
    size: 22
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    },
    className: "text-xl md:text-2xl font-bold truncate"
  }, visibleNav.find(n => n.id === activeTab)?.label)), /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-stone-500 hidden sm:block shrink-0"
  }, new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 md:p-8"
  }, activeTab === "dashboard" && /*#__PURE__*/React.createElement(Dashboard, {
    products: products,
    lowStock: lowStock,
    orders: orders,
    sales: sales,
    shipments: shipments,
    totalBalance: totalBalance,
    moves: moves,
    customers: customers,
    isAdmin: currentUser.role === "admin"
  }), activeTab === "products" && /*#__PURE__*/React.createElement(Products, {
    products: products,
    setProducts: setProducts,
    suppliers: suppliers,
    isAdmin: currentUser.role === "admin"
  }), activeTab === "stock" && /*#__PURE__*/React.createElement(Stock, {
    products: products,
    moves: moves,
    setMoves: setMoves,
    lowStock: lowStock,
    adjustStock: adjustStock
  }), activeTab === "customers" && /*#__PURE__*/React.createElement(Customers, {
    customers: customers,
    setCustomers: setCustomers,
    sales: sales
  }), activeTab === "suppliers" && /*#__PURE__*/React.createElement(Suppliers, {
    suppliers: suppliers,
    setSuppliers: setSuppliers,
    orders: orders
  }), activeTab === "orders" && /*#__PURE__*/React.createElement(Orders, {
    orders: orders,
    setOrders: setOrders,
    suppliers: suppliers,
    products: products,
    accounts: accounts,
    adjustStock: adjustStock,
    addTxn: addTxn,
    currentUser: currentUser
  }), activeTab === "sales" && /*#__PURE__*/React.createElement(SalesShipping, {
    sales: sales,
    setSales: setSales,
    shipments: shipments,
    setShipments: setShipments,
    products: products,
    accounts: accounts,
    customers: customers,
    setCustomers: setCustomers,
    invoices: invoices,
    setInvoices: setInvoices,
    adjustStock: adjustStock,
    addTxn: addTxn,
    currentUser: currentUser
  }), activeTab === "billing" && /*#__PURE__*/React.createElement(Billing, {
    quotes: quotes,
    setQuotes: setQuotes,
    invoices: invoices,
    setInvoices: setInvoices,
    customers: customers,
    setCustomers: setCustomers,
    products: products,
    accounts: accounts,
    addTxn: addTxn,
    currentUser: currentUser
  }), activeTab === "bank" && /*#__PURE__*/React.createElement(Bank, {
    accounts: accounts,
    setAccounts: setAccounts,
    txns: txns,
    setTxns: setTxns,
    bankBalance: bankBalance,
    currentUser: currentUser
  }), activeTab === "users" && /*#__PURE__*/React.createElement(UsersAdmin, {
    users: users,
    setUsers: setUsers,
    currentUser: currentUser
  })))));
}

/* ---------------------------- Login / Users ------------------------------ */

function Login({
  users,
  setUsers,
  onLogin
}) {
  const [mode, setMode] = useState(users.length ? "select" : "create");
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const active = users.filter(u => u.active !== false);
  const tryLogin = e => {
    e.preventDefault();
    if (!selected) return;
    if (String(selected.pin) !== String(pin)) {
      setError("Code PIN incorrect.");
      return;
    }
    setError("");
    onLogin(selected);
  };
  const createFirst = data => {
    const u = {
      ...data,
      id: uid(),
      role: users.length ? data.role : "admin",
      active: true,
      createdAt: today()
    };
    setUsers(prev => [...prev, u]);
    onLogin(u);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center mb-6"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    },
    className: "text-4xl font-bold text-neutral-900"
  }, "Kils Import/Export"), /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-stone-500 mt-1"
  }, "Gestion boutique — pneus d'occasion"), /*#__PURE__*/React.createElement(TreadRule, {
    className: "mt-4 rounded-full"
  })), /*#__PURE__*/React.createElement(Card, {
    className: "p-6"
  }, mode === "select" && !selected && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold mb-3",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Qui êtes-vous ?"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mb-4"
  }, active.map(u => /*#__PURE__*/React.createElement("button", {
    key: u.id,
    onClick: () => {
      setSelected(u);
      setError("");
    },
    className: "w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-stone-200 hover:border-orange-600 hover:bg-stone-50 text-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, u.name), /*#__PURE__*/React.createElement(Badge, {
    tone: u.role === "admin" ? "info" : "neutral"
  }, ROLE_LABEL[u.role])))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMode("create"),
    className: "text-sm text-orange-600 font-medium"
  }, "+ Ajouter un nouvel utilisateur")), mode === "select" && selected && /*#__PURE__*/React.createElement("form", {
    onSubmit: tryLogin
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-4"
  }, /*#__PURE__*/React.createElement(Lock, {
    size: 16,
    className: "text-stone-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, selected.name)), /*#__PURE__*/React.createElement(Field, {
    label: "Code PIN"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "password",
    inputMode: "numeric",
    autoFocus: true,
    value: pin,
    onChange: e => setPin(e.target.value),
    placeholder: "••••"
  })), error && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-red-700 mb-2"
  }, error), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setSelected(null);
      setPin("");
    },
    className: "text-sm text-stone-500"
  }, "Retour"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Entrer"))), mode === "create" && /*#__PURE__*/React.createElement(CreateUserForm, {
    isFirst: users.length === 0,
    onSave: createFirst,
    onCancel: users.length ? () => setMode("select") : null
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-stone-400 text-center mt-4"
  }, "Identification simplifiée par code PIN — pratique pour une petite équipe en boutique.")));
}
function CreateUserForm({
  isFirst,
  onSave,
  onCancel
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("vendeur");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const submit = e => {
    e.preventDefault();
    if (pin.length < 4) return setErr("Le code PIN doit contenir au moins 4 chiffres.");
    if (pin !== pin2) return setErr("Les deux codes PIN ne correspondent pas.");
    setErr("");
    onSave({
      name,
      role: isFirst ? "admin" : role,
      pin
    });
  };
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: submit
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold mb-3",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, isFirst ? "Créer le compte administrateur" : "Nouvel utilisateur"), /*#__PURE__*/React.createElement(Field, {
    label: "Nom"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: name,
    onChange: e => setName(e.target.value)
  })), !isFirst && /*#__PURE__*/React.createElement(Field, {
    label: "Rôle"
  }, /*#__PURE__*/React.createElement(Select, {
    value: role,
    onChange: e => setRole(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "vendeur"
  }, "Vendeur"), /*#__PURE__*/React.createElement("option", {
    value: "admin"
  }, "Administrateur"))), /*#__PURE__*/React.createElement(Field, {
    label: "Code PIN (4 chiffres min.)"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "password",
    inputMode: "numeric",
    required: true,
    value: pin,
    onChange: e => setPin(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Confirmer le code PIN"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "password",
    inputMode: "numeric",
    required: true,
    value: pin2,
    onChange: e => setPin2(e.target.value)
  })), err && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-red-700 mb-2"
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, onCancel && /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, isFirst ? "Créer et entrer" : "Créer l'utilisateur")));
}
function UsersAdmin({
  users,
  setUsers,
  currentUser
}) {
  const [modal, setModal] = useState(false);
  const create = data => {
    setUsers(prev => [...prev, {
      ...data,
      id: uid(),
      active: true,
      createdAt: today()
    }]);
    setModal(false);
  };
  const toggleActive = id => setUsers(prev => prev.map(u => u.id === id ? {
    ...u,
    active: !u.active
  } : u));
  const changeRole = (id, role) => setUsers(prev => prev.map(u => u.id === id ? {
    ...u,
    role
  } : u));
  const resetPin = id => {
    const pin = prompt("Nouveau code PIN (4 chiffres min.) :");
    if (pin && pin.length >= 4) setUsers(prev => prev.map(u => u.id === id ? {
      ...u,
      pin
    } : u));
  };
  const renameUser = (id, currentName) => {
    const name = prompt("Nouveau nom :", currentName);
    if (name && name.trim()) setUsers(prev => prev.map(u => u.id === id ? {
      ...u,
      name: name.trim()
    } : u));
  };
  const removeUser = (id, name) => {
    if (confirm(`Supprimer définitivement l'utilisateur "${name}" ?`)) setUsers(prev => prev.filter(u => u.id !== id));
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mb-4"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setModal(true)
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouvel utilisateur")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Nom"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Rôle"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Statut"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, users.map(u => /*#__PURE__*/React.createElement("tr", {
    key: u.id,
    className: "border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 font-medium"
  }, u.name, " ", u.id === currentUser.id && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-stone-400"
  }, "(vous)")), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement(Select, {
    value: u.role,
    onChange: e => changeRole(u.id, e.target.value),
    className: "w-40",
    disabled: u.id === currentUser.id
  }, /*#__PURE__*/React.createElement("option", {
    value: "vendeur"
  }, "Vendeur"), /*#__PURE__*/React.createElement("option", {
    value: "admin"
  }, "Administrateur"))), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, u.active !== false ? /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, "Actif") : /*#__PURE__*/React.createElement(Badge, {
    tone: "danger"
  }, "Désactivé")), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => renameUser(u.id, u.name)
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 14
  }), " Renommer"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => resetPin(u.id)
  }, /*#__PURE__*/React.createElement(KeyRound, {
    size: 14
  }), " PIN"), u.id !== currentUser.id && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Btn, {
    variant: u.active !== false ? "danger" : "ghost",
    onClick: () => toggleActive(u.id)
  }, u.active !== false ? "Désactiver" : "Réactiver"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeUser(u.id, u.name),
    className: "text-stone-500 hover:text-red-700 px-1 text-xs font-medium"
  }, "Supprimer")))))))))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-stone-400 mt-3"
  }, "Identification simplifiée pour une équipe en boutique (pas un système de sécurité de niveau bancaire)."), modal && /*#__PURE__*/React.createElement(Modal, {
    title: "Nouvel utilisateur",
    onClose: () => setModal(false)
  }, /*#__PURE__*/React.createElement(CreateUserForm, {
    isFirst: false,
    onSave: create,
    onCancel: () => setModal(false)
  })));
}

/* ---------------------------- Dashboard --------------------------------- */

function Stat({
  label,
  value,
  tone = "dark"
}) {
  const tones = {
    dark: "text-neutral-900",
    orange: "text-orange-600",
    green: "text-emerald-700",
    red: "text-red-700"
  };
  return /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs uppercase tracking-wide text-stone-400 font-semibold mb-1"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: `text-3xl font-bold ${tones[tone]}`,
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, value));
}
function Dashboard({
  products,
  lowStock,
  orders,
  sales,
  shipments,
  totalBalance,
  moves,
  customers,
  isAdmin
}) {
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const activeShipments = shipments.filter(s => s.status !== "delivered").length;
  const stockValue = products.reduce((s, p) => s + Number(p.qty) * Number(p.purchasePrice || 0), 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-4"
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Références produits",
    value: products.length
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Alertes stock bas",
    value: lowStock.length,
    tone: lowStock.length ? "red" : "dark"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Commandes en attente",
    value: pendingOrders,
    tone: "orange"
  }), isAdmin ? /*#__PURE__*/React.createElement(Stat, {
    label: "Solde banque/caisse",
    value: cfa(totalBalance),
    tone: "green"
  }) : /*#__PURE__*/React.createElement(Stat, {
    label: "Clients enregistrés",
    value: customers.length
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-6"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold mb-3",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Valeur du stock (au prix d'achat)"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold text-neutral-900"
  }, cfa(stockValue)), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-stone-500 mt-2"
  }, "Livraisons en cours : ", activeShipments)), /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold mb-3",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Alertes stock bas"), lowStock.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-stone-500"
  }, "Aucune alerte pour le moment.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1.5"
  }, lowStock.slice(0, 6).map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    className: "flex justify-between text-sm"
  }, /*#__PURE__*/React.createElement("span", null, p.name), /*#__PURE__*/React.createElement(Badge, {
    tone: "danger"
  }, p.qty, " restant(s)")))))), /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold mb-3",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Derniers mouvements de stock"), moves.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucun mouvement enregistré",
    icon: Boxes
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("tbody", null, moves.slice(0, 6).map(m => {
    const p = products.find(pp => pp.id === m.productId);
    return /*#__PURE__*/React.createElement("tr", {
      key: m.id,
      className: "border-t border-stone-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-2"
    }, m.date), /*#__PURE__*/React.createElement("td", {
      className: "py-2"
    }, p?.name || "Produit supprimé"), /*#__PURE__*/React.createElement("td", {
      className: "py-2"
    }, m.reason), /*#__PURE__*/React.createElement("td", {
      className: "py-2 text-right"
    }, m.type === "in" ? /*#__PURE__*/React.createElement("span", {
      className: "text-emerald-700 font-semibold"
    }, "+", m.qty) : /*#__PURE__*/React.createElement("span", {
      className: "text-red-700 font-semibold"
    }, "-", m.qty)));
  }))))));
}

/* ---------------------------- Products ----------------------------------- */

const emptyProduct = () => ({
  id: null,
  name: "",
  brand: "",
  size: "",
  condition: "Bon état",
  purchasePrice: "",
  minSalePrice: "",
  maxSalePrice: "",
  qty: 0,
  alertThreshold: 3,
  supplierId: ""
});
function Products({
  products,
  setProducts,
  suppliers,
  isAdmin
}) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = products.filter(p => `${p.name} ${p.brand} ${p.size}`.toLowerCase().includes(search.toLowerCase()));
  const save = data => {
    if (data.id) setProducts(prev => prev.map(p => p.id === data.id ? data : p));else setProducts(prev => [...prev, {
      ...data,
      id: uid(),
      qty: Number(data.qty) || 0
    }]);
    setModal(null);
  };
  const remove = id => {
    if (confirm("Supprimer ce produit ?")) setProducts(prev => prev.filter(p => p.id !== id));
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative w-full sm:w-72"
  }, /*#__PURE__*/React.createElement(Search, {
    size: 16,
    className: "absolute left-3 top-2.5 text-stone-400"
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Rechercher un produit…",
    value: search,
    onChange: e => setSearch(e.target.value),
    className: "pl-9"
  })), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setModal(emptyProduct())
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouveau produit")), /*#__PURE__*/React.createElement(Card, null, filtered.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucun produit. Ajoutez votre premier pneu.",
    icon: Package
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Produit"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Dimension"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "État"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Achat"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Vente min"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Vente max"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Stock"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    className: "border-b border-stone-100 hover:bg-stone-50"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 font-medium"
  }, p.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-stone-400 font-normal"
  }, p.brand)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, p.size), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, p.condition), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, cfa(p.purchasePrice)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, cfa(p.minSalePrice)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, cfa(p.maxSalePrice)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, Number(p.qty) <= Number(p.alertThreshold ?? 3) ? /*#__PURE__*/React.createElement(Badge, {
    tone: "danger"
  }, p.qty) : /*#__PURE__*/React.createElement("span", null, p.qty)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setModal(p),
    className: "text-stone-500 hover:text-neutral-900"
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 15
  })), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(p.id),
    className: "text-stone-500 hover:text-red-700 text-xs font-medium"
  }, "Supprimer"))))))))), modal && /*#__PURE__*/React.createElement(Modal, {
    title: modal.id ? "Modifier le produit" : "Nouveau produit",
    onClose: () => setModal(null)
  }, /*#__PURE__*/React.createElement(ProductForm, {
    data: modal,
    suppliers: suppliers,
    onSave: save,
    onCancel: () => setModal(null)
  })));
}
function ProductForm({
  data,
  suppliers,
  onSave,
  onCancel
}) {
  const [f, setF] = useState(data);
  const set = k => e => setF({
    ...f,
    [k]: e.target.value
  });
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSave({
        ...f,
        purchasePrice: Number(f.purchasePrice),
        minSalePrice: Number(f.minSalePrice),
        maxSalePrice: Number(f.maxSalePrice),
        qty: Number(f.qty),
        alertThreshold: Number(f.alertThreshold)
      });
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-x-4"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Désignation"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: f.name,
    onChange: set("name"),
    placeholder: "Pneu occasion"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Marque"
  }, /*#__PURE__*/React.createElement(Input, {
    value: f.brand,
    onChange: set("brand"),
    placeholder: "Michelin, Continental…"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Dimension"
  }, /*#__PURE__*/React.createElement(Input, {
    value: f.size,
    onChange: set("size"),
    placeholder: "195/65 R15"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "État"
  }, /*#__PURE__*/React.createElement(Select, {
    value: f.condition,
    onChange: set("condition")
  }, /*#__PURE__*/React.createElement("option", null, "Excellent état"), /*#__PURE__*/React.createElement("option", null, "Bon état"), /*#__PURE__*/React.createElement("option", null, "État moyen"))), /*#__PURE__*/React.createElement(Field, {
    label: "Prix d'achat (FCFA)"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    required: true,
    min: "0",
    value: f.purchasePrice,
    onChange: set("purchasePrice")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Fournisseur"
  }, /*#__PURE__*/React.createElement(Select, {
    value: f.supplierId,
    onChange: set("supplierId")
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), suppliers.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name)))), /*#__PURE__*/React.createElement(Field, {
    label: "Prix de vente min"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    required: true,
    min: "0",
    value: f.minSalePrice,
    onChange: set("minSalePrice")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Prix de vente max"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    required: true,
    min: "0",
    value: f.maxSalePrice,
    onChange: set("maxSalePrice")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Quantité initiale"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "0",
    value: f.qty,
    onChange: set("qty"),
    disabled: !!data.id
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Seuil d'alerte"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "0",
    value: f.alertThreshold,
    onChange: set("alertThreshold")
  }))), data.id && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-stone-400 -mt-2 mb-3"
  }, "La quantité en stock se modifie depuis l'onglet Stock."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Enregistrer")));
}

/* ---------------------------- Stock -------------------------------------- */

function Stock({
  products,
  moves,
  setMoves,
  lowStock,
  adjustStock
}) {
  const [adjustFor, setAdjustFor] = useState(null);
  const deleteMove = id => {
    if (confirm("Supprimer ce mouvement de l'historique ?")) setMoves(prev => prev.filter(m => m.id !== id));
  };
  const clearMoves = () => {
    if (confirm("Vider tout l'historique des mouvements de stock ? Cette action est irréversible.")) setMoves([]);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, lowStock.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-3 rounded-md text-sm"
  }, /*#__PURE__*/React.createElement(AlertTriangle, {
    size: 16
  }), " ", lowStock.length, " produit(s) au seuil d'alerte ou en rupture."), /*#__PURE__*/React.createElement(Card, null, products.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucun produit en stock",
    icon: Boxes
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Produit"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Quantité"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Seuil alerte"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Statut"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, products.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    className: "border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 font-medium"
  }, p.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-stone-400 font-normal"
  }, p.size)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, p.qty), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, p.alertThreshold ?? 3), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, Number(p.qty) === 0 ? /*#__PURE__*/React.createElement(Badge, {
    tone: "danger"
  }, "Rupture") : Number(p.qty) <= Number(p.alertThreshold ?? 3) ? /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, "Stock bas") : /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, "OK")), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setAdjustFor(p)
  }, "Ajuster")))))))), /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Historique des mouvements"), moves.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: clearMoves,
    className: "text-xs font-medium text-red-700 hover:text-red-900"
  }, "Vider l'historique")), moves.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-stone-500"
  }, "Aucun mouvement.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "py-2"
  }, "Date"), /*#__PURE__*/React.createElement("th", null, "Produit"), /*#__PURE__*/React.createElement("th", null, "Motif"), /*#__PURE__*/React.createElement("th", null, "Par"), /*#__PURE__*/React.createElement("th", {
    className: "text-right"
  }, "Quantité"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, moves.map(m => {
    const p = products.find(pp => pp.id === m.productId);
    return /*#__PURE__*/React.createElement("tr", {
      key: m.id,
      className: "border-b border-stone-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-2"
    }, m.date), /*#__PURE__*/React.createElement("td", null, p?.name || "—"), /*#__PURE__*/React.createElement("td", null, m.reason), /*#__PURE__*/React.createElement("td", {
      className: "text-stone-400"
    }, m.by || "—"), /*#__PURE__*/React.createElement("td", {
      className: "text-right"
    }, m.type === "in" ? /*#__PURE__*/React.createElement("span", {
      className: "text-emerald-700 font-semibold flex items-center gap-1 justify-end"
    }, /*#__PURE__*/React.createElement(ArrowUpCircle, {
      size: 14
    }), "+", m.qty) : /*#__PURE__*/React.createElement("span", {
      className: "text-red-700 font-semibold flex items-center gap-1 justify-end"
    }, /*#__PURE__*/React.createElement(ArrowDownCircle, {
      size: 14
    }), "-", m.qty)), /*#__PURE__*/React.createElement("td", {
      className: "text-right"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => deleteMove(m.id),
      className: "text-xs font-medium text-stone-400 hover:text-red-700"
    }, "Supprimer")));
  }))))), adjustFor && /*#__PURE__*/React.createElement(Modal, {
    title: `Ajuster le stock — ${adjustFor.name}`,
    onClose: () => setAdjustFor(null)
  }, /*#__PURE__*/React.createElement(AdjustForm, {
    product: adjustFor,
    onSave: (delta, reason) => {
      adjustStock(adjustFor.id, delta, reason);
      setAdjustFor(null);
    },
    onCancel: () => setAdjustFor(null)
  })));
}
function AdjustForm({
  product,
  onSave,
  onCancel
}) {
  const [type, setType] = useState("in");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSave(type === "in" ? Number(qty) : -Number(qty), reason || (type === "in" ? "Entrée manuelle" : "Sortie manuelle"));
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-stone-500 mb-3"
  }, "Stock actuel : ", /*#__PURE__*/React.createElement("strong", null, product.qty)), /*#__PURE__*/React.createElement(Field, {
    label: "Type de mouvement"
  }, /*#__PURE__*/React.createElement(Select, {
    value: type,
    onChange: e => setType(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "in"
  }, "Entrée (ajout)"), /*#__PURE__*/React.createElement("option", {
    value: "out"
  }, "Sortie (diminution)"))), /*#__PURE__*/React.createElement(Field, {
    label: "Quantité"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "1",
    required: true,
    value: qty,
    onChange: e => setQty(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Motif"
  }, /*#__PURE__*/React.createElement(Input, {
    value: reason,
    onChange: e => setReason(e.target.value),
    placeholder: "Ex : inventaire, casse, retour client…"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Valider")));
}

/* ---------------------------- Customers ----------------------------------- */

function Customers({
  customers,
  setCustomers,
  sales
}) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const filtered = customers.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  const save = data => {
    if (data.id) setCustomers(prev => prev.map(c => c.id === data.id ? data : c));else setCustomers(prev => [...prev, {
      ...data,
      id: uid(),
      createdAt: today()
    }]);
    setModal(null);
  };
  const remove = id => {
    if (confirm("Supprimer ce client ?")) setCustomers(prev => prev.filter(c => c.id !== id));
  };
  const spentBy = id => sales.filter(s => s.customerId === id).reduce((s, sale) => s + Number(sale.total), 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative w-full sm:w-72"
  }, /*#__PURE__*/React.createElement(Search, {
    size: 16,
    className: "absolute left-3 top-2.5 text-stone-400"
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Rechercher un client…",
    value: search,
    onChange: e => setSearch(e.target.value),
    className: "pl-9"
  })), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setModal({
      id: null,
      name: "",
      phone: "",
      address: "",
      notes: ""
    })
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouveau client")), /*#__PURE__*/React.createElement(Card, null, filtered.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucun client enregistré",
    icon: Users
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Nom"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Téléphone"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Adresse"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Achats"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Total dépensé"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id,
    className: "border-b border-stone-100 hover:bg-stone-50"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 font-medium cursor-pointer",
    onClick: () => setDetail(c)
  }, c.name), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, c.phone), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, c.address), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, sales.filter(s => s.customerId === c.id).length), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, cfa(spentBy(c.id))), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setModal(c),
    className: "text-stone-500 hover:text-neutral-900"
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(c.id),
    className: "text-stone-500 hover:text-red-700 text-xs font-medium"
  }, "Supprimer"))))))))), modal && /*#__PURE__*/React.createElement(Modal, {
    title: modal.id ? "Modifier le client" : "Nouveau client",
    onClose: () => setModal(null)
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      save(modal);
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nom"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: modal.name,
    onChange: e => setModal({
      ...modal,
      name: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Téléphone"
  }, /*#__PURE__*/React.createElement(Input, {
    value: modal.phone,
    onChange: e => setModal({
      ...modal,
      phone: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Adresse"
  }, /*#__PURE__*/React.createElement(Input, {
    value: modal.address,
    onChange: e => setModal({
      ...modal,
      address: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Notes"
  }, /*#__PURE__*/React.createElement(Input, {
    value: modal.notes,
    onChange: e => setModal({
      ...modal,
      notes: e.target.value
    }),
    placeholder: "Préférences, remarques…"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setModal(null)
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Enregistrer")))), detail && /*#__PURE__*/React.createElement(Modal, {
    title: `Historique — ${detail.name}`,
    onClose: () => setDetail(null),
    wide: true
  }, sales.filter(s => s.customerId === detail.id).length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-stone-500"
  }, "Aucun achat pour ce client.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "py-2"
  }, "Date"), /*#__PURE__*/React.createElement("th", null, "Articles"), /*#__PURE__*/React.createElement("th", {
    className: "text-right"
  }, "Total"), /*#__PURE__*/React.createElement("th", null, "Paiement"))), /*#__PURE__*/React.createElement("tbody", null, sales.filter(s => s.customerId === detail.id).map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id,
    className: "border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-2"
  }, s.date), /*#__PURE__*/React.createElement("td", null, s.items.length, " réf."), /*#__PURE__*/React.createElement("td", {
    className: "text-right"
  }, cfa(s.total)), /*#__PURE__*/React.createElement("td", null, s.paid ? /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, "Payé") : /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, "Non payé")))))))));
}

/* ---------------------------- Suppliers ---------------------------------- */

function Suppliers({
  suppliers,
  setSuppliers,
  orders
}) {
  const [modal, setModal] = useState(null);
  const save = data => {
    if (data.id) setSuppliers(prev => prev.map(s => s.id === data.id ? data : s));else setSuppliers(prev => [...prev, {
      ...data,
      id: uid()
    }]);
    setModal(null);
  };
  const remove = id => {
    if (confirm("Supprimer ce fournisseur ?")) setSuppliers(prev => prev.filter(s => s.id !== id));
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mb-4"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setModal({
      id: null,
      name: "",
      phone: "",
      address: ""
    })
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouveau fournisseur")), /*#__PURE__*/React.createElement(Card, null, suppliers.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucun fournisseur enregistré",
    icon: Building2
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Nom"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Téléphone"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Adresse"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Commandes"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, suppliers.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id,
    className: "border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 font-medium"
  }, s.name), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, s.phone), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, s.address), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, orders.filter(o => o.supplierId === s.id).length), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setModal(s),
    className: "text-stone-500 hover:text-neutral-900"
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(s.id),
    className: "text-stone-500 hover:text-red-700 text-xs font-medium"
  }, "Supprimer"))))))))), modal && /*#__PURE__*/React.createElement(Modal, {
    title: modal.id ? "Modifier le fournisseur" : "Nouveau fournisseur",
    onClose: () => setModal(null)
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      save(modal);
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nom"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: modal.name,
    onChange: e => setModal({
      ...modal,
      name: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Téléphone"
  }, /*#__PURE__*/React.createElement(Input, {
    value: modal.phone,
    onChange: e => setModal({
      ...modal,
      phone: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Adresse"
  }, /*#__PURE__*/React.createElement(Input, {
    value: modal.address,
    onChange: e => setModal({
      ...modal,
      address: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setModal(null)
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Enregistrer")))));
}

/* ---------------------------- Purchase Orders ----------------------------- */

const STATUS_LABEL = {
  pending: "En attente",
  received: "Reçue",
  cancelled: "Annulée"
};
const STATUS_TONE = {
  pending: "warn",
  received: "ok",
  cancelled: "danger"
};
function Orders({
  orders,
  setOrders,
  suppliers,
  products,
  accounts,
  adjustStock,
  addTxn,
  currentUser
}) {
  const [modal, setModal] = useState(null);
  const [receiveOrder, setReceiveOrder] = useState(null);
  const createOrder = data => {
    setOrders(prev => [{
      ...data,
      id: uid(),
      status: "pending",
      date: today(),
      by: currentUser?.name
    }, ...prev]);
    setModal(null);
  };
  const cancelOrder = id => setOrders(prev => prev.map(o => o.id === id ? {
    ...o,
    status: "cancelled"
  } : o));
  const receive = (order, accountId, markPaid) => {
    order.items.forEach(it => {
      adjustStock(it.productId, Number(it.qty), "Réception commande fournisseur", order.id);
    });
    const total = order.items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
    if (markPaid && accountId) {
      addTxn(accountId, "debit", total, `Achat fournisseur — commande #${order.id.slice(-5).toUpperCase()}`, order.id);
    }
    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      status: "received",
      receivedAt: today()
    } : o));
    setReceiveOrder(null);
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mb-4"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setModal(true)
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouvelle commande")), /*#__PURE__*/React.createElement(Card, null, orders.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucune commande fournisseur",
    icon: ShoppingCart
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Fournisseur"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Articles"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Statut"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, orders.map(o => {
    const sup = suppliers.find(s => s.id === o.supplierId);
    const total = o.items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
    return /*#__PURE__*/React.createElement("tr", {
      key: o.id,
      className: "border-b border-stone-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, o.date), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, sup?.name || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, o.items.length, " réf."), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-right"
    }, cfa(total)), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: STATUS_TONE[o.status]
    }, STATUS_LABEL[o.status])), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-right"
    }, o.status === "pending" && /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 justify-end"
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: () => cancelOrder(o.id)
    }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
      onClick: () => setReceiveOrder(o)
    }, /*#__PURE__*/React.createElement(CheckCircle2, {
      size: 15
    }), " Réceptionner"))));
  }))))), modal && /*#__PURE__*/React.createElement(Modal, {
    title: "Nouvelle commande fournisseur",
    onClose: () => setModal(null),
    wide: true
  }, /*#__PURE__*/React.createElement(OrderForm, {
    suppliers: suppliers,
    products: products,
    onSave: createOrder,
    onCancel: () => setModal(null)
  })), receiveOrder && /*#__PURE__*/React.createElement(Modal, {
    title: "Réception de commande",
    onClose: () => setReceiveOrder(null)
  }, /*#__PURE__*/React.createElement(ReceiveForm, {
    order: receiveOrder,
    accounts: accounts,
    onConfirm: receive,
    onCancel: () => setReceiveOrder(null)
  })));
}
function OrderForm({
  suppliers,
  products,
  onSave,
  onCancel
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [items, setItems] = useState([{
    productId: products[0]?.id || "",
    qty: 1,
    unitPrice: products[0]?.purchasePrice || 0
  }]);
  const updateItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? {
    ...it,
    ...patch
  } : it));
  const addLine = () => setItems(prev => [...prev, {
    productId: products[0]?.id || "",
    qty: 1,
    unitPrice: products[0]?.purchasePrice || 0
  }]);
  const removeLine = idx => setItems(prev => prev.filter((_, i) => i !== idx));
  const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSave({
        supplierId,
        items
      });
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Fournisseur"
  }, /*#__PURE__*/React.createElement(Select, {
    required: true,
    value: supplierId,
    onChange: e => setSupplierId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Sélectionner…"), suppliers.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name)))), /*#__PURE__*/React.createElement("div", {
    className: "mt-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2"
  }, "Articles commandés"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, items.map((it, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "flex gap-2 items-center"
  }, /*#__PURE__*/React.createElement(Select, {
    className: "flex-1",
    value: it.productId,
    onChange: e => {
      const prod = products.find(p => p.id === e.target.value);
      updateItem(idx, {
        productId: e.target.value,
        unitPrice: prod?.purchasePrice || 0
      });
    }
  }, products.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, p.name, " (", p.size, ")"))), /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "1",
    className: "w-20",
    value: it.qty,
    onChange: e => updateItem(idx, {
      qty: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "0",
    className: "w-32",
    value: it.unitPrice,
    onChange: e => updateItem(idx, {
      unitPrice: e.target.value
    })
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => removeLine(idx),
    className: "text-stone-400 hover:text-red-700"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 16
  }))))), products.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-red-700 mt-2"
  }, "Créez d'abord un produit dans l'onglet Produits."), products.length > 0 && /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    className: "mt-2",
    onClick: addLine
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " Ajouter une ligne")), /*#__PURE__*/React.createElement("div", {
    className: "text-right mt-3 font-bold",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Total : ", cfa(total)), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-4"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit",
    disabled: !supplierId || products.length === 0
  }, "Créer la commande")));
}
function ReceiveForm({
  order,
  accounts,
  onConfirm,
  onCancel
}) {
  const [paid, setPaid] = useState(true);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const total = order.items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onConfirm(order, accountId, paid);
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-stone-500 mb-3"
  }, "Confirmer la réception ajoutera automatiquement ", /*#__PURE__*/React.createElement("strong", null, order.items.reduce((s, it) => s + Number(it.qty), 0), " unité(s)"), " au stock."), /*#__PURE__*/React.createElement(Field, {
    label: "Total de la commande"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-bold"
  }, cfa(total))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-sm mb-3"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: paid,
    onChange: e => setPaid(e.target.checked)
  }), "Enregistrer le paiement en banque/caisse"), paid && /*#__PURE__*/React.createElement(Field, {
    label: "Compte à débiter"
  }, /*#__PURE__*/React.createElement(Select, {
    value: accountId,
    onChange: e => setAccountId(e.target.value)
  }, accounts.map(a => /*#__PURE__*/React.createElement("option", {
    key: a.id,
    value: a.id
  }, a.name)))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Confirmer la réception")));
}

/* ---------------------------- Sales & Shipping ---------------------------- */

const SHIP_LABEL = {
  prep: "Préparation",
  shipped: "Expédiée",
  delivered: "Livrée"
};
const SHIP_TONE = {
  prep: "neutral",
  shipped: "info",
  delivered: "ok"
};
function SalesShipping({
  sales,
  setSales,
  shipments,
  setShipments,
  products,
  accounts,
  customers,
  setCustomers,
  invoices,
  setInvoices,
  adjustStock,
  addTxn,
  currentUser
}) {
  const [modal, setModal] = useState(false);
  const [editSale, setEditSale] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(null);
  const updateSale = data => {
    const total = data.items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
    setSales(prev => prev.map(s => s.id === editSale.id ? {
      ...s,
      customerId: data.customerId,
      customer: data.customerName,
      phone: data.phone,
      items: data.items,
      total
    } : s));
    setShipments(prev => prev.map(sh => sh.saleId === editSale.id ? {
      ...sh,
      address: data.address,
      carrier: data.carrier
    } : sh));
    setEditSale(null);
  };
  const deleteSale = id => {
    if (confirm("Supprimer cette vente ? Cette action est irréversible.")) {
      setSales(prev => prev.filter(s => s.id !== id));
    }
  };
  const createSale = ({
    customerId,
    customerName,
    phone,
    address,
    carrier,
    items,
    accountId,
    paid
  }) => {
    const saleId = uid();
    items.forEach(it => adjustStock(it.productId, -Number(it.qty), "Vente client", saleId));
    const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
    setSales(prev => [{
      id: saleId,
      customerId,
      customer: customerName,
      phone,
      items,
      total,
      date: today(),
      paid,
      by: currentUser?.name
    }, ...prev]);
    setShipments(prev => [{
      id: uid(),
      saleId,
      address,
      carrier,
      status: "prep",
      date: today()
    }, ...prev]);
    if (paid && accountId) addTxn(accountId, "credit", total, `Vente client — ${customerName}`, saleId);
    const invoiceId = uid();
    const invoiceItems = items.map(it => {
      const p = products.find(pp => pp.id === it.productId);
      return {
        label: p ? `${p.name}${p.size ? " " + p.size : ""}` : "Produit",
        qty: Number(it.qty),
        unitPrice: Number(it.unitPrice)
      };
    });
    setInvoices(prev => [{
      id: invoiceId,
      number: `FAC-${String(invoices.length + 1).padStart(4, "0")}`,
      customerId,
      customerName,
      phone,
      date: today(),
      dueDate: today(),
      items: invoiceItems,
      total,
      status: paid ? "paid" : "unpaid",
      source: "sale",
      linkedSaleId: saleId,
      createdBy: currentUser?.name
    }, ...prev]);
    setModal(false);
  };
  const advanceShipment = id => setShipments(prev => prev.map(s => {
    if (s.id !== id) return s;
    const next = s.status === "prep" ? "shipped" : s.status === "shipped" ? "delivered" : "delivered";
    return {
      ...s,
      status: next
    };
  }));
  const downloadInvoice = async sale => {
    setPdfBusy(sale.id);
    try {
      const customer = customers.find(c => c.id === sale.customerId);
      const invoice = invoices.find(inv => inv.linkedSaleId === sale.id);
      if (invoice) {
        await generateDocPDF("facture", invoice, customer);
      } else {
        const invoiceItems = sale.items.map(it => {
          const p = products.find(pp => pp.id === it.productId);
          return {
            label: p ? `${p.name}${p.size ? " " + p.size : ""}` : "Produit",
            qty: Number(it.qty),
            unitPrice: Number(it.unitPrice)
          };
        });
        await generateDocPDF("facture", {
          number: `FAC-${sale.id.slice(-6).toUpperCase()}`,
          date: sale.date,
          dueDate: sale.date,
          items: invoiceItems,
          total: sale.total,
          status: sale.paid ? "paid" : "unpaid",
          customerName: sale.customer,
          phone: sale.phone
        }, customer);
      }
    } catch (e) {
      alert("Impossible de générer la facture PDF (connexion internet requise pour charger le générateur).");
    } finally {
      setPdfBusy(null);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setModal(true)
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouvelle vente")), /*#__PURE__*/React.createElement(Card, null, sales.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucune vente enregistrée",
    icon: ShoppingCart
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Client"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Articles"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Paiement"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Livraison"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, sales.map(s => {
    const ship = shipments.find(sh => sh.saleId === s.id);
    return /*#__PURE__*/React.createElement("tr", {
      key: s.id,
      className: "border-b border-stone-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, s.date), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, s.customer, /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-stone-400"
    }, s.phone)), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, s.items.length, " réf."), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-right"
    }, cfa(s.total)), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, s.paid ? /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Payé") : /*#__PURE__*/React.createElement(Badge, {
      tone: "warn"
    }, "Non payé")), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, ship && /*#__PURE__*/React.createElement(Badge, {
      tone: SHIP_TONE[ship.status]
    }, SHIP_LABEL[ship.status])), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 justify-end"
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      disabled: pdfBusy === s.id,
      onClick: () => downloadInvoice(s)
    }, /*#__PURE__*/React.createElement(FileText, {
      size: 14
    }), " ", pdfBusy === s.id ? "Génération…" : "Facture PDF"), ship && ship.status !== "delivered" && /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: () => advanceShipment(ship.id)
    }, /*#__PURE__*/React.createElement(Truck, {
      size: 14
    }), " ", ship.status === "prep" ? "Expédier" : "Livrée"), /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: () => setEditSale(s)
    }, /*#__PURE__*/React.createElement(Pencil, {
      size: 14
    }), " Modifier"), currentUser?.role === "admin" && /*#__PURE__*/React.createElement(Btn, {
      variant: "danger",
      onClick: () => deleteSale(s.id)
    }, "Supprimer"))));
  }))))), modal && /*#__PURE__*/React.createElement(Modal, {
    title: "Nouvelle vente",
    onClose: () => setModal(false),
    wide: true
  }, /*#__PURE__*/React.createElement(SaleForm, {
    products: products,
    accounts: accounts,
    customers: customers,
    setCustomers: setCustomers,
    onSave: createSale,
    onCancel: () => setModal(false)
  })), editSale && /*#__PURE__*/React.createElement(Modal, {
    title: "Modifier la vente",
    onClose: () => setEditSale(null),
    wide: true
  }, /*#__PURE__*/React.createElement(SaleForm, {
    products: products,
    accounts: accounts,
    customers: customers,
    setCustomers: setCustomers,
    sale: editSale,
    onSave: updateSale,
    onCancel: () => setEditSale(null)
  })));
}
function SaleForm({
  products,
  accounts,
  customers,
  setCustomers,
  sale,
  onSave,
  onCancel
}) {
  const [customerId, setCustomerId] = useState(sale?.customerId || "");
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerName, setCustomerName] = useState(sale?.customerId ? "" : sale?.customer || "");
  const [phone, setPhone] = useState(sale?.phone || "");
  const [address, setAddress] = useState(sale?.address || "");
  const [carrier, setCarrier] = useState(sale?.carrier || "");
  const [paid, setPaid] = useState(sale?.paid ?? true);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [items, setItems] = useState(sale?.items || (products.length ? [{
    productId: products[0].id,
    qty: 1,
    unitPrice: products[0].minSalePrice
  }] : []));
  const selectCustomer = id => {
    setCustomerId(id);
    const c = customers.find(cc => cc.id === id);
    if (c) {
      setCustomerName(c.name);
      setPhone(c.phone || "");
      setAddress(c.address || "");
    }
  };
  const updateItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? {
    ...it,
    ...patch
  } : it));
  const addLine = () => setItems(prev => [...prev, {
    productId: products[0]?.id,
    qty: 1,
    unitPrice: products[0]?.minSalePrice || 0
  }]);
  const removeLine = idx => setItems(prev => prev.filter((_, i) => i !== idx));
  const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
  const priceWarning = it => {
    const p = products.find(pp => pp.id === it.productId);
    if (!p) return null;
    if (Number(it.unitPrice) < Number(p.minSalePrice)) return `Sous le prix minimum (${cfa(p.minSalePrice)})`;
    if (Number(it.unitPrice) > Number(p.maxSalePrice)) return `Au-dessus du prix maximum (${cfa(p.maxSalePrice)})`;
    return null;
  };
  const stockOk = items.every(it => {
    const p = products.find(pp => pp.id === it.productId);
    return p && Number(it.qty) <= Number(p.qty);
  });
  const submit = e => {
    e.preventDefault();
    let finalCustomerId = customerId;
    let finalName = customerName;
    if (newCustomer && customerName) {
      const c = {
        id: uid(),
        name: customerName,
        phone,
        address,
        notes: "",
        createdAt: today()
      };
      setCustomers(prev => [...prev, c]);
      finalCustomerId = c.id;
    }
    if (!finalName) finalName = "Client comptoir";
    onSave({
      customerId: finalCustomerId || null,
      customerName: finalName,
      phone,
      address,
      carrier,
      items,
      accountId,
      paid
    });
  };
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: submit
  }, /*#__PURE__*/React.createElement("div", {
    className: "mb-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1"
  }, "Client"), !newCustomer ? /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Select, {
    className: "flex-1",
    value: customerId,
    onChange: e => selectCustomer(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Client comptoir (sans fiche)"), customers.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name, " — ", c.phone))), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      setNewCustomer(true);
      setCustomerId("");
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " Nouveau")) : /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-x-4 border border-stone-200 rounded-md p-3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nom du client"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: customerName,
    onChange: e => setCustomerName(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Téléphone"
  }, /*#__PURE__*/React.createElement(Input, {
    value: phone,
    onChange: e => setPhone(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2 -mt-2 mb-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setNewCustomer(false),
    className: "text-xs text-stone-500 underline"
  }, "Choisir un client existant à la place")))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-x-4"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Adresse de livraison"
  }, /*#__PURE__*/React.createElement(Input, {
    value: address,
    onChange: e => setAddress(e.target.value),
    placeholder: "Quartier, ville"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Transporteur"
  }, /*#__PURE__*/React.createElement(Input, {
    value: carrier,
    onChange: e => setCarrier(e.target.value),
    placeholder: "Ex : moto-taxi, agence de transport"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 mt-1"
  }, "Articles vendus"), products.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-red-700"
  }, "Aucun produit en stock.") : /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, items.map((it, idx) => {
    const warning = priceWarning(it);
    const p = products.find(pp => pp.id === it.productId);
    return /*#__PURE__*/React.createElement("div", {
      key: idx
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 items-center"
    }, /*#__PURE__*/React.createElement(Select, {
      className: "flex-1",
      value: it.productId,
      onChange: e => {
        const prod = products.find(pp => pp.id === e.target.value);
        updateItem(idx, {
          productId: e.target.value,
          unitPrice: prod?.minSalePrice || 0
        });
      }
    }, products.map(p => /*#__PURE__*/React.createElement("option", {
      key: p.id,
      value: p.id
    }, p.name, " (", p.size, ") — stock ", p.qty))), /*#__PURE__*/React.createElement(Input, {
      type: "number",
      min: "1",
      max: p?.qty,
      className: "w-20",
      value: it.qty,
      onChange: e => updateItem(idx, {
        qty: e.target.value
      })
    }), /*#__PURE__*/React.createElement(Input, {
      type: "number",
      min: "0",
      className: "w-32",
      value: it.unitPrice,
      onChange: e => updateItem(idx, {
        unitPrice: e.target.value
      })
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => removeLine(idx),
      className: "text-stone-400 hover:text-red-700"
    }, /*#__PURE__*/React.createElement(Trash2, {
      size: 16
    }))), warning && /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-red-700 mt-1"
    }, warning));
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    className: "mt-1",
    onClick: addLine
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " Ajouter une ligne")), !stockOk && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-red-700 mt-2"
  }, "Quantité demandée supérieure au stock disponible."), !sale && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mt-4"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-sm"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: paid,
    onChange: e => setPaid(e.target.checked)
  }), " Vente encaissée"), paid && /*#__PURE__*/React.createElement(Select, {
    className: "w-48",
    value: accountId,
    onChange: e => setAccountId(e.target.value)
  }, accounts.map(a => /*#__PURE__*/React.createElement("option", {
    key: a.id,
    value: a.id
  }, a.name)))), /*#__PURE__*/React.createElement("div", {
    className: "text-right mt-3 font-bold",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Total : ", cfa(total)), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-4"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit",
    disabled: products.length === 0 || !stockOk
  }, sale ? "Enregistrer les modifications" : "Enregistrer la vente")));
}

/* ---------------------------- Bank ---------------------------------------- */

function Bank({
  accounts,
  setAccounts,
  txns,
  setTxns,
  bankBalance,
  currentUser
}) {
  const [accModal, setAccModal] = useState(false);
  const [editAccountModal, setEditAccountModal] = useState(null);
  const [txnModal, setTxnModal] = useState(false);
  const totalBalance = accounts.reduce((s, a) => s + bankBalance(a.id), 0);
  const addAccount = (name, initial) => {
    setAccounts(prev => [...prev, {
      id: uid(),
      name,
      initial: Number(initial) || 0
    }]);
    setAccModal(false);
  };
  const updateAccount = (name, initial) => {
    setAccounts(prev => prev.map(a => a.id === editAccountModal.id ? {
      ...a,
      name,
      initial: Number(initial) || 0
    } : a));
    setEditAccountModal(null);
  };
  const resetAccount = id => {
    if (confirm("Réinitialiser ce compte ? Toutes ses écritures seront supprimées, son solde reviendra à son solde initial.")) setTxns(prev => prev.filter(t => t.accountId !== id));
  };
  const deleteAccount = id => {
    if (confirm("Supprimer ce compte et toutes ses écritures ? Cette action est irréversible.")) {
      setAccounts(prev => prev.filter(a => a.id !== id));
      setTxns(prev => prev.filter(t => t.accountId !== id));
    }
  };
  const addManualTxn = data => {
    setTxns(prev => [{
      ...data,
      id: uid(),
      amount: Number(data.amount),
      date: today(),
      by: currentUser?.name
    }, ...prev]);
    setTxnModal(false);
  };
  const deleteTxn = id => {
    if (confirm("Supprimer cette écriture bancaire ?")) setTxns(prev => prev.filter(t => t.id !== id));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-5 md:col-span-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-start mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Comptes"), currentUser?.role === "admin" && /*#__PURE__*/React.createElement("button", {
    onClick: () => setAccModal(true),
    className: "text-orange-600"
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 18
  }))), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, accounts.map(a => {
    const nameRow = /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between"
    }, /*#__PURE__*/React.createElement("span", null, a.name), /*#__PURE__*/React.createElement("span", {
      className: "font-semibold"
    }, cfa(bankBalance(a.id))));
    const actionsRow = currentUser?.role === "admin" && /*#__PURE__*/React.createElement("div", {
      className: "flex gap-3 mt-1 text-xs"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => resetAccount(a.id),
      className: "text-stone-500 hover:text-neutral-900"
    }, "Réinitialiser"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setEditAccountModal(a),
      className: "text-stone-500 hover:text-neutral-900"
    }, "Modifier"), /*#__PURE__*/React.createElement("button", {
      onClick: () => deleteAccount(a.id),
      className: "text-red-700 hover:text-red-900"
    }, "Supprimer"));
    return /*#__PURE__*/React.createElement("li", {
      key: a.id,
      className: "text-sm border-b border-stone-100 pb-2 last:border-0 last:pb-0"
    }, nameRow, actionsRow);
  })), /*#__PURE__*/React.createElement("div", {
    className: "border-t border-stone-100 mt-3 pt-3 flex justify-between font-bold"
  }, /*#__PURE__*/React.createElement("span", null, "Total"), /*#__PURE__*/React.createElement("span", null, cfa(totalBalance)))), /*#__PURE__*/React.createElement(Card, {
    className: "p-5 md:col-span-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Écritures bancaires"), currentUser?.role === "admin" && /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setTxnModal(true)
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouvelle écriture")), txns.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucune écriture bancaire",
    icon: Landmark
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "py-2"
  }, "Date"), /*#__PURE__*/React.createElement("th", null, "Libellé"), /*#__PURE__*/React.createElement("th", null, "Compte"), /*#__PURE__*/React.createElement("th", {
    className: "text-right"
  }, "Montant"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, txns.map(t => {
    const acc = accounts.find(a => a.id === t.accountId);
    return /*#__PURE__*/React.createElement("tr", {
      key: t.id,
      className: "border-b border-stone-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-2"
    }, t.date), /*#__PURE__*/React.createElement("td", null, t.label), /*#__PURE__*/React.createElement("td", null, acc?.name), /*#__PURE__*/React.createElement("td", {
      className: `text-right font-semibold ${t.type === "credit" ? "text-emerald-700" : "text-red-700"}`
    }, t.type === "credit" ? "+" : "-", cfa(t.amount)), /*#__PURE__*/React.createElement("td", {
      className: "text-right"
    }, currentUser?.role === "admin" && /*#__PURE__*/React.createElement("button", {
      onClick: () => deleteTxn(t.id),
      className: "text-stone-400 hover:text-red-700 text-xs font-medium"
    }, "Supprimer")));
  })))))), accModal && /*#__PURE__*/React.createElement(Modal, {
    title: "Nouveau compte",
    onClose: () => setAccModal(false)
  }, /*#__PURE__*/React.createElement(AccountForm, {
    onSave: addAccount,
    onCancel: () => setAccModal(false)
  })), editAccountModal && /*#__PURE__*/React.createElement(Modal, {
    title: "Modifier le compte",
    onClose: () => setEditAccountModal(null)
  }, /*#__PURE__*/React.createElement(AccountForm, {
    account: editAccountModal,
    onSave: updateAccount,
    onCancel: () => setEditAccountModal(null)
  })), txnModal && /*#__PURE__*/React.createElement(Modal, {
    title: "Nouvelle écriture bancaire",
    onClose: () => setTxnModal(false)
  }, /*#__PURE__*/React.createElement(TxnForm, {
    accounts: accounts,
    onSave: addManualTxn,
    onCancel: () => setTxnModal(false)
  })));
}
function AccountForm({
  account,
  onSave,
  onCancel
}) {
  const [name, setName] = useState(account?.name || "");
  const [initial, setInitial] = useState(account?.initial ?? 0);
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSave(name, initial);
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nom du compte"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "Ex : Compte MTN MoMo, Afriland…"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Solde initial"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    value: initial,
    onChange: e => setInitial(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, account ? "Enregistrer" : "Créer")));
}
function TxnForm({
  accounts,
  onSave,
  onCancel
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [type, setType] = useState("credit");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSave({
        accountId,
        type,
        amount,
        label
      });
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Compte"
  }, /*#__PURE__*/React.createElement(Select, {
    value: accountId,
    onChange: e => setAccountId(e.target.value)
  }, accounts.map(a => /*#__PURE__*/React.createElement("option", {
    key: a.id,
    value: a.id
  }, a.name)))), /*#__PURE__*/React.createElement(Field, {
    label: "Type"
  }, /*#__PURE__*/React.createElement(Select, {
    value: type,
    onChange: e => setType(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "credit"
  }, "Crédit (entrée d'argent)"), /*#__PURE__*/React.createElement("option", {
    value: "debit"
  }, "Débit (sortie d'argent)"))), /*#__PURE__*/React.createElement(Field, {
    label: "Montant (FCFA)"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "number",
    required: true,
    min: "0",
    value: amount,
    onChange: e => setAmount(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Libellé"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: label,
    onChange: e => setLabel(e.target.value),
    placeholder: "Ex : loyer boutique, frais transport…"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Enregistrer")));
}

/* ---------------------------- Devis & Factures ---------------------------- */

function LineItemsEditor({
  items,
  setItems,
  products
}) {
  const updateItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? {
    ...it,
    ...patch
  } : it));
  const addLine = () => setItems(prev => [...prev, {
    label: "",
    qty: 1,
    unitPrice: 0
  }]);
  const removeLine = idx => setItems(prev => prev.filter((_, i) => i !== idx));
  const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2"
  }, "Lignes (produits du catalogue ou prestations de service)"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, items.map((it, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "flex gap-2 items-start border border-stone-200 rounded-md p-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Désignation — ex : Pose et équilibrage 4 pneus",
    value: it.label,
    onChange: e => updateItem(idx, {
      label: e.target.value
    })
  }), products.length > 0 && /*#__PURE__*/React.createElement(Select, {
    className: "mt-1.5 text-xs",
    value: "",
    onChange: e => {
      const p = products.find(pp => pp.id === e.target.value);
      if (p) updateItem(idx, {
        label: `${p.name}${p.size ? " " + p.size : ""}`,
        unitPrice: p.minSalePrice
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— Remplir depuis le catalogue produits —"), products.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, p.name, " (", p.size, ")")))), /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "1",
    className: "w-20",
    value: it.qty,
    onChange: e => updateItem(idx, {
      qty: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "0",
    className: "w-32",
    value: it.unitPrice,
    onChange: e => updateItem(idx, {
      unitPrice: e.target.value
    })
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => removeLine(idx),
    className: "text-stone-400 hover:text-red-700 mt-2"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 16
  }))))), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    className: "mt-2",
    onClick: addLine
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " Ajouter une ligne"), /*#__PURE__*/React.createElement("div", {
    className: "text-right mt-3 font-bold",
    style: {
      fontFamily: "'Barlow Condensed', sans-serif"
    }
  }, "Total : ", cfa(total)));
}
function CustomerPicker({
  customerId,
  setCustomerId,
  newCustomer,
  setNewCustomer,
  customerName,
  setCustomerName,
  phone,
  setPhone,
  address,
  setAddress,
  customers
}) {
  const select = id => {
    setCustomerId(id);
    const c = customers.find(cc => cc.id === id);
    if (c) {
      setCustomerName(c.name);
      setPhone(c.phone || "");
      setAddress(c.address || "");
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "mb-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1"
  }, "Client"), !newCustomer ? /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Select, {
    className: "flex-1",
    value: customerId,
    onChange: e => select(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Client comptoir (sans fiche)"), customers.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name, " — ", c.phone))), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      setNewCustomer(true);
      setCustomerId("");
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " Nouveau")) : /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-x-4 border border-stone-200 rounded-md p-3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nom du client"
  }, /*#__PURE__*/React.createElement(Input, {
    required: true,
    value: customerName,
    onChange: e => setCustomerName(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Téléphone"
  }, /*#__PURE__*/React.createElement(Input, {
    value: phone,
    onChange: e => setPhone(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2 -mt-2 mb-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setNewCustomer(false),
    className: "text-xs text-stone-500 underline"
  }, "Choisir un client existant à la place"))));
}
function QuoteForm({
  customers,
  setCustomers,
  products,
  onSave,
  onCancel
}) {
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{
    label: "",
    qty: 1,
    unitPrice: 0
  }]);
  const submit = e => {
    e.preventDefault();
    let finalCustomerId = customerId,
      finalName = customerName || "Client comptoir";
    if (newCustomer && customerName) {
      const c = {
        id: uid(),
        name: customerName,
        phone,
        address,
        notes: "",
        createdAt: today()
      };
      setCustomers(prev => [...prev, c]);
      finalCustomerId = c.id;
    }
    const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
    onSave({
      customerId: finalCustomerId || null,
      customerName: finalName,
      phone,
      address,
      validUntil,
      notes,
      items,
      total
    });
  };
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(CustomerPicker, {
    customerId,
    setCustomerId,
    newCustomer,
    setNewCustomer,
    customerName,
    setCustomerName,
    phone,
    setPhone,
    address,
    setAddress,
    customers
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Valable jusqu'au"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "date",
    value: validUntil,
    onChange: e => setValidUntil(e.target.value)
  })), /*#__PURE__*/React.createElement(LineItemsEditor, {
    items: items,
    setItems: setItems,
    products: products
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Notes (optionnel)"
  }, /*#__PURE__*/React.createElement(Input, {
    value: notes,
    onChange: e => setNotes(e.target.value),
    placeholder: "Conditions, délais, remarques…"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-4"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit",
    disabled: !items.some(it => it.label && Number(it.qty) > 0)
  }, "Créer le devis")));
}
function InvoiceForm({
  customers,
  setCustomers,
  products,
  accounts,
  invoice,
  onSave,
  onCancel
}) {
  const [customerId, setCustomerId] = useState(invoice?.customerId || "");
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerName, setCustomerName] = useState(invoice?.customerId ? "" : invoice?.customerName || "");
  const [phone, setPhone] = useState(invoice?.phone || "");
  const [address, setAddress] = useState(invoice?.address || "");
  const [dueDate, setDueDate] = useState(invoice?.dueDate || today());
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [paid, setPaid] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [items, setItems] = useState(invoice?.items || [{
    label: "",
    qty: 1,
    unitPrice: 0
  }]);
  const submit = e => {
    e.preventDefault();
    let finalCustomerId = customerId,
      finalName = customerName || "Client comptoir";
    if (newCustomer && customerName) {
      const c = {
        id: uid(),
        name: customerName,
        phone,
        address,
        notes: "",
        createdAt: today()
      };
      setCustomers(prev => [...prev, c]);
      finalCustomerId = c.id;
    }
    const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
    onSave({
      customerId: finalCustomerId || null,
      customerName: finalName,
      phone,
      address,
      dueDate,
      notes,
      items,
      total,
      paid,
      accountId
    });
  };
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(CustomerPicker, {
    customerId,
    setCustomerId,
    newCustomer,
    setNewCustomer,
    customerName,
    setCustomerName,
    phone,
    setPhone,
    address,
    setAddress,
    customers
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Échéance de paiement"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "date",
    value: dueDate,
    onChange: e => setDueDate(e.target.value)
  })), /*#__PURE__*/React.createElement(LineItemsEditor, {
    items: items,
    setItems: setItems,
    products: products
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Notes (optionnel)"
  }, /*#__PURE__*/React.createElement(Input, {
    value: notes,
    onChange: e => setNotes(e.target.value),
    placeholder: "Ex : facture pour prestation de service"
  })), !invoice && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mt-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-sm"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: paid,
    onChange: e => setPaid(e.target.checked)
  }), " Déjà encaissée"), paid && /*#__PURE__*/React.createElement(Select, {
    className: "w-48",
    value: accountId,
    onChange: e => setAccountId(e.target.value)
  }, accounts.map(a => /*#__PURE__*/React.createElement("option", {
    key: a.id,
    value: a.id
  }, a.name)))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-4"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit",
    disabled: !items.some(it => it.label && Number(it.qty) > 0)
  }, invoice ? "Enregistrer les modifications" : "Créer la facture")));
}
function MarkPaidForm({
  invoice,
  accounts,
  onConfirm,
  onCancel
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onConfirm(accountId);
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-stone-500 mb-3"
  }, "Encaisser ", /*#__PURE__*/React.createElement("strong", null, cfa(invoice.total)), " pour la facture ", invoice.number, "."), /*#__PURE__*/React.createElement(Field, {
    label: "Compte à créditer"
  }, /*#__PURE__*/React.createElement(Select, {
    value: accountId,
    onChange: e => setAccountId(e.target.value)
  }, accounts.map(a => /*#__PURE__*/React.createElement("option", {
    key: a.id,
    value: a.id
  }, a.name)))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Annuler"), /*#__PURE__*/React.createElement(Btn, {
    type: "submit"
  }, "Confirmer l'encaissement")));
}
function Billing({
  quotes,
  setQuotes,
  invoices,
  setInvoices,
  customers,
  setCustomers,
  products,
  accounts,
  addTxn,
  currentUser
}) {
  const [subTab, setSubTab] = useState("quotes");
  const [quoteModal, setQuoteModal] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(null);
  const createQuote = data => {
    const id = uid();
    setQuotes(prev => [{
      ...data,
      id,
      number: `DEV-${String(quotes.length + 1).padStart(4, "0")}`,
      date: today(),
      status: "draft",
      createdBy: currentUser?.name
    }, ...prev]);
    setQuoteModal(false);
  };
  const setQuoteStatus = (id, status) => setQuotes(prev => prev.map(q => q.id === id ? {
    ...q,
    status
  } : q));
  const deleteQuote = id => {
    if (confirm("Supprimer ce devis ?")) setQuotes(prev => prev.filter(q => q.id !== id));
  };
  const deleteInvoice = id => {
    if (confirm("Supprimer cette facture ? Cette action est irréversible.")) setInvoices(prev => prev.filter(i => i.id !== id));
  };
  const convertToInvoice = quote => {
    const id = uid();
    const invoice = {
      id,
      number: `FAC-${String(invoices.length + 1).padStart(4, "0")}`,
      customerId: quote.customerId,
      customerName: quote.customerName,
      phone: quote.phone,
      address: quote.address,
      date: today(),
      dueDate: today(),
      items: quote.items,
      total: quote.total,
      status: "unpaid",
      source: "quote",
      linkedQuoteId: quote.id,
      createdBy: currentUser?.name
    };
    setInvoices(prev => [invoice, ...prev]);
    setQuotes(prev => prev.map(q => q.id === quote.id ? {
      ...q,
      status: "invoiced",
      linkedInvoiceId: id
    } : q));
    setSubTab("invoices");
  };
  const createInvoice = data => {
    const id = uid();
    setInvoices(prev => [{
      id,
      number: `FAC-${String(invoices.length + 1).padStart(4, "0")}`,
      customerId: data.customerId,
      customerName: data.customerName,
      phone: data.phone,
      address: data.address,
      date: today(),
      dueDate: data.dueDate,
      items: data.items,
      total: data.total,
      status: data.paid ? "paid" : "unpaid",
      source: "manual",
      notes: data.notes,
      createdBy: currentUser?.name
    }, ...prev]);
    if (data.paid && data.accountId) addTxn(data.accountId, "credit", data.total, `Facture — ${data.customerName}`, id);
    setInvoiceModal(false);
  };
  const updateInvoice = data => {
    setInvoices(prev => prev.map(i => i.id === editInvoice.id ? {
      ...i,
      customerId: data.customerId,
      customerName: data.customerName,
      phone: data.phone,
      address: data.address,
      dueDate: data.dueDate,
      items: data.items,
      total: data.total,
      notes: data.notes
    } : i));
    setEditInvoice(null);
  };
  const markPaid = accountId => {
    setInvoices(prev => prev.map(i => i.id === payModal.id ? {
      ...i,
      status: "paid",
      paidDate: today()
    } : i));
    if (accountId) addTxn(accountId, "credit", payModal.total, `Facture ${payModal.number} — ${payModal.customerName}`, payModal.id);
    setPayModal(null);
  };
  const displayInvoiceStatus = inv => inv.status === "paid" ? "paid" : inv.dueDate && inv.dueDate < today() ? "overdue" : "unpaid";
  const downloadPdf = async (kind, record) => {
    setPdfBusy(record.id);
    try {
      const customer = customers.find(c => c.id === record.customerId);
      await generateDocPDF(kind, record, customer);
    } catch (e) {
      alert("Impossible de générer le PDF (connexion internet requise pour charger le générateur).");
    } finally {
      setPdfBusy(null);
    }
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inline-flex rounded-md border border-stone-300 overflow-hidden"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSubTab("quotes"),
    className: `px-4 py-2 text-sm font-medium ${subTab === "quotes" ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"}`
  }, "Devis / Propositions"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSubTab("invoices"),
    className: `px-4 py-2 text-sm font-medium ${subTab === "invoices" ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"}`
  }, "Factures")), subTab === "quotes" ? /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setQuoteModal(true)
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouveau devis") : /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setInvoiceModal(true)
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Nouvelle facture")), subTab === "quotes" && /*#__PURE__*/React.createElement(Card, null, quotes.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucun devis / proposition de service",
    icon: Receipt
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "N°"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Client"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Statut"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, quotes.map(q => /*#__PURE__*/React.createElement("tr", {
    key: q.id,
    className: "border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 font-mono text-xs"
  }, q.number), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, q.date), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, q.customerName), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right"
  }, cfa(q.total)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: QUOTE_STATUS_TONE[q.status]
  }, QUOTE_STATUS_LABEL[q.status])), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1.5 justify-end flex-wrap"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    disabled: pdfBusy === q.id,
    onClick: () => downloadPdf("devis", q)
  }, /*#__PURE__*/React.createElement(FileText, {
    size: 14
  }), " PDF"), q.status === "draft" && /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setQuoteStatus(q.id, "sent")
  }, /*#__PURE__*/React.createElement(Send, {
    size: 14
  }), " Envoyer"), q.status === "sent" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setQuoteStatus(q.id, "accepted")
  }, /*#__PURE__*/React.createElement(CheckCheck, {
    size: 14
  }), " Accepté"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => setQuoteStatus(q.id, "refused")
  }, /*#__PURE__*/React.createElement(XCircle, {
    size: 14
  }), " Refusé")), q.status === "accepted" && /*#__PURE__*/React.createElement(Btn, {
    onClick: () => convertToInvoice(q)
  }, /*#__PURE__*/React.createElement(ArrowRightCircle, {
    size: 14
  }), " Convertir en facture"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => deleteQuote(q.id)
  }, "Supprimer"))))))))), subTab === "invoices" && /*#__PURE__*/React.createElement(Card, null, invoices.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Aucune facture",
    icon: FileText
  }) : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-left text-xs uppercase text-stone-400 border-b border-stone-100"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "N°"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Client"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Origine"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Statut"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }))), /*#__PURE__*/React.createElement("tbody", null, invoices.map(inv => {
    const st = displayInvoiceStatus(inv);
    return /*#__PURE__*/React.createElement("tr", {
      key: inv.id,
      className: "border-b border-stone-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 font-mono text-xs"
    }, inv.number), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, inv.date), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, inv.customerName), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-stone-400 text-xs"
    }, inv.source === "sale" ? "Vente" : inv.source === "quote" ? "Devis" : "Manuelle"), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-right"
    }, cfa(inv.total)), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: INVOICE_STATUS_TONE[st]
    }, INVOICE_STATUS_LABEL[st])), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex gap-1.5 justify-end"
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: () => setEditInvoice(inv)
    }, /*#__PURE__*/React.createElement(Pencil, {
      size: 14
    }), " Modifier"), /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      disabled: pdfBusy === inv.id,
      onClick: () => downloadPdf("facture", inv)
    }, /*#__PURE__*/React.createElement(FileText, {
      size: 14
    }), " PDF"), inv.status !== "paid" && /*#__PURE__*/React.createElement(Btn, {
      onClick: () => setPayModal(inv)
    }, /*#__PURE__*/React.createElement(CheckCircle2, {
      size: 14
    }), " Marquer payée"), currentUser.role === "admin" && /*#__PURE__*/React.createElement(Btn, {
      variant: "danger",
      onClick: () => deleteInvoice(inv.id)
    }, "Supprimer"))));
  }))))), quoteModal && /*#__PURE__*/React.createElement(Modal, {
    title: "Nouveau devis / proposition de service",
    onClose: () => setQuoteModal(false),
    wide: true
  }, /*#__PURE__*/React.createElement(QuoteForm, {
    customers: customers,
    setCustomers: setCustomers,
    products: products,
    onSave: createQuote,
    onCancel: () => setQuoteModal(false)
  })), invoiceModal && /*#__PURE__*/React.createElement(Modal, {
    title: "Nouvelle facture",
    onClose: () => setInvoiceModal(false),
    wide: true
  }, /*#__PURE__*/React.createElement(InvoiceForm, {
    customers: customers,
    setCustomers: setCustomers,
    products: products,
    accounts: accounts,
    onSave: createInvoice,
    onCancel: () => setInvoiceModal(false)
  })), editInvoice && /*#__PURE__*/React.createElement(Modal, {
    title: "Modifier la facture",
    onClose: () => setEditInvoice(null),
    wide: true
  }, /*#__PURE__*/React.createElement(InvoiceForm, {
    customers: customers,
    setCustomers: setCustomers,
    products: products,
    accounts: accounts,
    invoice: editInvoice,
    onSave: updateInvoice,
    onCancel: () => setEditInvoice(null)
  })), payModal && /*#__PURE__*/React.createElement(Modal, {
    title: "Encaisser la facture",
    onClose: () => setPayModal(null)
  }, /*#__PURE__*/React.createElement(MarkPaidForm, {
    invoice: payModal,
    accounts: accounts,
    onConfirm: markPaid,
    onCancel: () => setPayModal(null)
  })));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));