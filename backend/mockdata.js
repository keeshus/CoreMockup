const MAX_COUNT = 20;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'James', 'Amelia', 'Benjamin', 'Harper', 'Elijah', 'Evelyn', 'Henry', 'Charlotte', 'Alexander', 'Grace', 'Daniel', 'Lily', 'Leo', 'Zoe'];
const LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark'];
const ROLES = ['CEO', 'CTO', 'CFO', 'Designer', 'Engineer', 'Marketing Lead', 'Product Manager', 'Support Agent', 'Analyst', 'Growth Lead', 'Researcher', 'Community Manager'];
const DOMAINS = ['gmail.com', 'outlook.com', 'acme.com', 'example.com', 'proton.me', 'mail.io'];
const PRODUCTS = ['Desk Lamp', 'Coffee Mug', 'Wireless Mouse', 'Mechanical Keyboard', 'Notebook', 'Water Bottle', 'Headphones', 'Monitor Stand', 'Desk Mat', 'USB-C Hub', 'Webcam', 'Speaker', 'Backpack', 'Tablet Stand', 'Plant Pot', 'Phone Charger', 'Laptop Sleeve', 'Whiteboard', 'Fountain Pen', 'Desk Organizer'];
const CATEGORIES = ['Office', 'Electronics', 'Accessories', 'Furniture', 'Stationery'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LOREM = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate', 'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'];
const COLORS = ['#6c5ce7', '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#e91e63', '#1abc9c', '#9b59b6', '#f1c40f', '#ff6b6b', '#4ecdc4', '#45b7d1'];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function int(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function money(rng, min, max) {
  return (rng() * (max - min) + min).toFixed(2);
}
function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function loremSentence(rng, words) {
  const len = int(rng, 8, 16);
  const parts = [];
  for (let i = 0; i < len; i++) parts.push(pick(rng, words));
  return parts.join(' ').replace(parts[0][0], parts[0][0].toUpperCase()) + '.';
}

function generateUsers(rng, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const first = pick(rng, FIRST);
    const last = pick(rng, LAST);
    const name = `${first} ${last}`;
    out.push({
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${pick(rng, DOMAINS)}`,
      role: pick(rng, ROLES),
      initials: initials(name),
      active: rng() > 0.25,
    });
  }
  return out;
}

function generateProducts(rng, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      name: pick(rng, PRODUCTS),
      category: pick(rng, CATEGORIES),
      price: `$${money(rng, 9.99, 199.99)}`,
      rating: +(rng() * 2 + 3).toFixed(1),
      reviews: int(rng, 1, 5000),
      inStock: rng() > 0.2,
    });
  }
  return out;
}

function generateChartSeries(rng, count) {
  const labels = MONTHS.slice(0, count);
  const series = [
    { name: 'Series A', data: labels.map(() => int(rng, 5, 95)) },
    { name: 'Series B', data: labels.map(() => int(rng, 5, 95)) },
  ];
  return { labels, series };
}

function generateParagraphs(rng, count) {
  const paragraphs = [];
  for (let i = 0; i < count; i++) {
    const sentences = int(rng, 3, 6);
    const parts = [];
    for (let j = 0; j < sentences; j++) parts.push(loremSentence(rng, LOREM));
    paragraphs.push(parts.join(' '));
  }
  return paragraphs;
}

function avatarSvg(name, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/><text x="32" y="40" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">${initials(name)}</text></svg>`;
}

function avatarDataUri(name, color) {
  return `data:image/svg+xml;base64,${Buffer.from(avatarSvg(name, color)).toString('base64')}`;
}

async function generateAvatars(rng, count, sessionId, imageCache) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const first = pick(rng, FIRST);
    const last = pick(rng, LAST);
    const name = `${first} ${last}`;
    const color = pick(rng, COLORS);
    let src;
    if (imageCache) {
      const id = await imageCache.storeImage(Buffer.from(avatarSvg(name, color)), 'image/svg+xml', sessionId);
      src = imageCache.imageUrl(id);
    } else {
      src = avatarDataUri(name, color);
    }
    out.push({ name, initials: initials(name), color, src });
  }
  return out;
}

export async function generateMockData(dataset, count = 5, sessionId = null, imageCache = null) {
  const n = Math.max(1, Math.min(MAX_COUNT, Math.floor(count) || 5));
  const rng = mulberry32(Date.now() & 0xffffffff);

  let data;
  switch (dataset) {
    case 'products': data = generateProducts(rng, n); break;
    case 'chart_series': data = generateChartSeries(rng, n); break;
    case 'paragraphs': data = generateParagraphs(rng, n); break;
    case 'avatars': data = await generateAvatars(rng, n, sessionId, imageCache); break;
    case 'users':
    default: data = generateUsers(rng, n); break;
  }

  return `Mock data (${dataset}, ${n} items):\n${JSON.stringify(data, null, 2)}`;
}
