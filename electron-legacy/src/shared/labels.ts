// Central bilingual label dictionary (implementation plan §13).
// Every UI label is shown as "English (বাংলা)" simultaneously — not a toggle.
// A wording fix is a one-line change here rather than a hunt through components.
//
// Confident Bangla is provided for the common body-measurement words
// (length, chest, waist, hip, shoulder, sleeve, etc.). Trade-specific jargon
// (FD/CB, DS/Straight, Mohuri, Lob round, ...) is intentionally left English-only
// until shop staff confirm the exact wording they use.

interface Label {
  en: string
  bn?: string
}

const D: Record<string, Label> = {
  // --- General / navigation ---
  app_name: { en: 'Top Ten Plus' },
  tagline: { en: 'Tailors • Fabrics • Fashion' },
  dashboard: { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  orders: { en: 'Orders', bn: 'অর্ডার' },
  new_order: { en: 'New Order', bn: 'নতুন অর্ডার' },
  customers: { en: 'Customers', bn: 'গ্রাহক' },
  stock: { en: 'Stock', bn: 'স্টক' },
  fabrics: { en: 'Fabrics', bn: 'কাপড়' },
  sales_history: { en: 'Sales History', bn: 'বিক্রয় ইতিহাস' },
  analytics: { en: 'Analytics', bn: 'বিশ্লেষণ' },
  notify: { en: 'Notify Customer', bn: 'গ্রাহককে জানান' },
  staff: { en: 'Staff', bn: 'কর্মী' },
  logout: { en: 'Logout', bn: 'লগ আউট' },
  save: { en: 'Save', bn: 'সংরক্ষণ' },
  cancel: { en: 'Cancel', bn: 'বাতিল' },
  add: { en: 'Add', bn: 'যোগ করুন' },
  edit: { en: 'Edit', bn: 'সম্পাদনা' },
  delete: { en: 'Delete', bn: 'মুছুন' },
  search: { en: 'Search', bn: 'খুঁজুন' },
  print: { en: 'Print', bn: 'প্রিন্ট' },
  confirm: { en: 'Confirm', bn: 'নিশ্চিত করুন' },

  // --- Customer ---
  name: { en: 'Name', bn: 'নাম' },
  phone: { en: 'Phone', bn: 'ফোন' },
  address: { en: 'Address', bn: 'ঠিকানা' },
  notes: { en: 'Notes', bn: 'মন্তব্য' },

  // --- Order meta ---
  order_date: { en: 'Order Date', bn: 'অর্ডার তারিখ' },
  delivery_date: { en: 'Delivery Date', bn: 'ডেলিভারি তারিখ' },
  due_date: { en: 'Due Date', bn: 'বকেয়ার তারিখ' },
  payment_method: { en: 'Payment Method', bn: 'পেমেন্ট মাধ্যম' },
  total_price: { en: 'Total Price', bn: 'মোট মূল্য' },
  amount_paid: { en: 'Amount Paid', bn: 'পরিশোধিত' },
  due_amount: { en: 'Due', bn: 'বকেয়া' },
  status: { en: 'Status', bn: 'অবস্থা' },
  price: { en: 'Price', bn: 'মূল্য' },

  // --- Garment types ---
  coat: { en: 'Suit / Coat', bn: 'কোট' },
  pant: { en: 'Pant', bn: 'প্যান্ট' },
  shirt: { en: 'Shirt', bn: 'শার্ট' },
  panjabi: { en: 'Panjabi', bn: 'পাঞ্জাবি' },

  // --- Measurements (confident common words) ---
  long: { en: 'Long', bn: 'লম্বা' },
  chest: { en: 'Chest', bn: 'বুক' },
  belly: { en: 'Belly', bn: 'পেট' },
  hip: { en: 'Hip', bn: 'হিপ' },
  shoulder: { en: 'Shoulder', bn: 'কাঁধ' },
  waist: { en: 'Waist', bn: 'কোমর' },
  thigh: { en: 'Thigh', bn: 'রান' },
  body: { en: 'Body', bn: 'শরীর' },
  sleeve_length: { en: 'Sleeve Length', bn: 'হাতার দৈর্ঘ্য' },

  // --- Measurements (trade jargon — English until staff confirm) ---
  sleeve_mohuri: { en: 'Sleeve Mohuri / Loose' },
  fd_cb: { en: 'FD / CB' },
  shoulder_ds: { en: 'Shoulder DS / Straight' },
  thigh_mohuri: { en: 'Thigh Mohuri / Loose' },
  high_rise: { en: 'High (Rise)' },
  sleeve_calf: { en: 'Sleeve Calf' },
  sleeve_mid_width: { en: 'Sleeve Mid Width' },
  sleeve_mid_bottom: { en: 'Sleeve Mid Bottom' },

  // --- Fabric / stock ---
  product_id: { en: 'Product ID / Barcode', bn: 'প্রোডাক্ট আইডি' },
  color: { en: 'Color', bn: 'রং' },
  quantity: { en: 'Quantity', bn: 'পরিমাণ' },
  unit: { en: 'Unit', bn: 'একক' },
  cost_price: { en: 'Cost Price / Unit', bn: 'ক্রয়মূল্য' },
  low_stock_threshold: { en: 'Low-stock Threshold', bn: 'কম-স্টক সীমা' },
  in_stock: { en: 'In Stock', bn: 'স্টকে আছে' },
  fabric_used: { en: 'Fabric Used', bn: 'ব্যবহৃত কাপড়' }
}

/** Returns "English (বাংলা)" if a Bangla term exists, otherwise "English". */
export function t(key: string): string {
  const label = D[key]
  if (!label) return key
  return label.bn ? `${label.en} (${label.bn})` : label.en
}

/** Returns just the English part (for compact contexts, exports, etc.). */
export function en(key: string): string {
  return D[key]?.en ?? key
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash (নগদ)',
  bkash: 'bKash',
  nagad: 'Nagad',
  rocket: 'Rocket',
  card: 'Card (কার্ড)',
  others: 'Others (অন্যান্য)'
}

export const STATUS_LABELS: Record<string, string> = {
  received: 'Received (গৃহীত)',
  in_stitching: 'In Stitching (সেলাই চলছে)',
  ready_for_pickup: 'Ready for Pickup (প্রস্তুত)',
  delivered: 'Delivered (ডেলিভারি সম্পন্ন)',
  cancelled: 'Cancelled (বাতিল)'
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin (অ্যাডমিন)',
  sales_manager: 'Sales Manager (সেলস ম্যানেজার)'
}
