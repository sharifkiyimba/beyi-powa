export const generateId = () => Math.random().toString(36).substring(2, 15);

// For the fake phones, we assign them a fixed ID so they can be messaged
const DEMO_SELLER_ID_1 = "demo-seller-1";
const DEMO_SELLER_ID_2 = "demo-seller-2";
const DEMO_SELLER_ID_3 = "demo-seller-3";

export const MOCK_PHONES = [
  {
    id: "1",
    title: "iPhone 13 Pro",
    brand: "Apple",
    condition: "Clean piece",
    price: 2200000,
    wholesalePrice: 2000000,
    location: "Kikuubo",
    seller: "Sharif Phones",
    sellerId: DEMO_SELLER_ID_1,
    verified: true,
    image: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&q=80&w=400",
    description: "Excellent condition, 128GB, battery health 89%."
  },
  {
    id: "2",
    title: "Samsung Galaxy S22",
    brand: "Samsung",
    condition: "New",
    price: 1800000,
    wholesalePrice: 1600000,
    location: "Ntinda",
    seller: "Tech Hub UG",
    sellerId: DEMO_SELLER_ID_2,
    verified: true,
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=400",
    description: "Brand new sealed in box. 256GB."
  },
  {
    id: "3",
    title: "Google Pixel 6",
    brand: "Google",
    condition: "Has issues",
    price: 850000,
    wholesalePrice: 700000,
    location: "Kampala Central",
    seller: "Moses Gadgets",
    sellerId: DEMO_SELLER_ID_3,
    verified: false,
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=400",
    description: "Screen has a small crack, works perfectly fine."
  },
];

// We also pre-register the demo sellers so the messaging system works for the fake phones
const DEMO_SELLERS = [
  { id: DEMO_SELLER_ID_1, name: "Sharif Phones", email: "sharif@demo.com", role: "seller", verified: true, feePaid: true },
  { id: DEMO_SELLER_ID_2, name: "Tech Hub UG", email: "techhub@demo.com", role: "seller", verified: true, feePaid: true },
  { id: DEMO_SELLER_ID_3, name: "Moses Gadgets", email: "moses@demo.com", role: "seller", verified: false, feePaid: false },
];

export const db = {
  getPhones: () => {
    if (typeof window === "undefined") return MOCK_PHONES;
    const saved = localStorage.getItem("beyi_phones");
    if (saved) return [...JSON.parse(saved), ...MOCK_PHONES];
    return MOCK_PHONES;
  },
  
  addPhone: (phone: any) => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("beyi_phones");
    const existing = saved ? JSON.parse(saved) : [];
    localStorage.setItem("beyi_phones", JSON.stringify([phone, ...existing]));
  },

  getUser: () => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("beyi_user");
    return saved ? JSON.parse(saved) : null;
  },

  loginUser: (user: any) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("beyi_user", JSON.stringify(user));
  },

  logoutUser: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("beyi_user");
  },

  getAllSellers: () => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("beyi_all_sellers");
    const registered = saved ? JSON.parse(saved) : [];
    // Always return the demo sellers + real registered ones
    return [...DEMO_SELLERS, ...registered];
  },

  registerSeller: (seller: any) => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("beyi_all_sellers");
    const existing = saved ? JSON.parse(saved) : [];
    
    const sellerWithId = { ...seller, id: seller.id || generateId() };

    if (!existing.find((s: any) => s.email === sellerWithId.email)) {
      localStorage.setItem("beyi_all_sellers", JSON.stringify([...existing, sellerWithId]));
    }
    return sellerWithId;
  },

  getSellerById: (id: string) => {
    if (typeof window === "undefined") return null;
    // Check demo sellers first
    const demo = DEMO_SELLERS.find((s) => s.id === id);
    if (demo) return demo;
    
    const saved = localStorage.getItem("beyi_all_sellers");
    const existing = saved ? JSON.parse(saved) : [];
    return existing.find((s: any) => s.id === id);
  },

  verifySeller: (email: string) => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("beyi_all_sellers");
    if (saved) {
      const existing = JSON.parse(saved);
      const updated = existing.map((s: any) => 
        s.email === email ? { ...s, verified: true, feePaid: true } : s
      );
      localStorage.setItem("beyi_all_sellers", JSON.stringify(updated));
    }
  },

  getReviews: (sellerName: string) => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("beyi_reviews");
    const allReviews = saved ? JSON.parse(saved) : [];
    return allReviews.filter((r: any) => r.sellerName === sellerName);
  },

  addReview: (review: any) => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("beyi_reviews");
    const existing = saved ? JSON.parse(saved) : [];
    localStorage.setItem("beyi_reviews", JSON.stringify([review, ...existing]));
  },

  // MESSAGING SYSTEM
  getMessages: (chatId: string) => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(`beyi_chat_${chatId}`);
    return saved ? JSON.parse(saved) : [];
  },

  sendMessage: (chatId: string, message: any) => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`beyi_chat_${chatId}`);
    const existing = saved ? JSON.parse(saved) : [];
    const updated = [...existing, message];
    localStorage.setItem(`beyi_chat_${chatId}`, JSON.stringify(updated));
  },

  getUserChats: (userId: string) => {
    if (typeof window === "undefined") return [];
    const chats = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("beyi_chat_")) {
        const chatId = key.replace("beyi_chat_", "");
        // We split by '-' to check IDs. UUIDs don't contain hyphens in our generator, so this is safe.
        const parts = chatId.split("-");
        if (parts.includes(userId)) {
          const messages = JSON.parse(localStorage.getItem(key) || "[]");
          if (messages.length > 0) {
            // Find the other participant's ID
            const receiverId = parts.find((p) => p !== userId && p.length > 5);
            chats.push({
              id: chatId,
              receiverId,
              lastMessage: messages[messages.length - 1]
            });
          }
        }
      }
    }
    return chats;
  }
};