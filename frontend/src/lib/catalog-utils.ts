/**
 * Utilidades para transformar productos del backend
 * al formato que necesita el catálogo del frontend
 */

// Tipo de producto que viene del backend
export interface Product {
  code: string;
  name: string;
  category: string;
  price: string | number;
  stock: number;
}

export interface CatalogService {
  svc: string;
  note?: string;
  plans: string[];
  category: string;
  stockByPlan?: Record<string, number>;
}

export interface PriceMap {
  [key: string]: number;
}

export interface ProductCodeMap {
  [key: string]: string; // key: "serviceName|planName" -> value: product_code
}

export interface CategoryMap {
  [key: string]: string; // key: "serviceName|planName" -> value: category
}

/**
 * Extrae el nombre base del servicio desde el nombre del producto
 */
function extractServiceName(productName: string): string {
  if (productName.includes('Créditos')) return 'Recarga de Créditos (Billetera)';
  if (productName.includes('FlujoTV')) return 'FlujoTV';
  if (productName.includes('MagisTV')) {
    return productName.includes('(3 Dispositivos)') ? 'MagisTV PRO 3 Disp' : 'MagisTV PRO 1 Disp';
  }
  if (productName.includes('Tele Latino')) {
    return productName.includes('(3 Dispositivos)') ? 'Tele Latino PRO 3 Disp' : 'Tele Latino PRO 1 Disp';
  }
  return productName.split(' ')[0];
}

/**
 * Extrae el plan desde el nombre del producto
 */
function extractPlanName(productName: string, serviceName: string): string {
  if (!productName || !serviceName) {
    return productName || '';
  }
  
  if (serviceName === 'Recarga de Créditos (Billetera)') {
    return productName.replace('Créditos', '').trim();
  }
  
  return productName
    .replace(serviceName.replace(' PRO 3 Disp', '').replace(' PRO 1 Disp', ''), '')
    .replace('PRO', '')
    .trim();
}

/**
 * Agrupa productos por servicio
 */
export function groupProductsByService(products: Product[]): CatalogService[] {
  const servicesMap = new Map<string, CatalogService>();

  products.forEach(product => {
    const serviceName = extractServiceName(product.name);
    const planName = extractPlanName(product.name, serviceName);

    if (!servicesMap.has(serviceName)) {
      servicesMap.set(serviceName, {
        svc: serviceName,
        plans: [],
        category: product.category,
        stockByPlan: {},
      });
    }

    const service = servicesMap.get(serviceName)!;
    service.plans.push(planName);
    
    if (!service.stockByPlan) {
      service.stockByPlan = {};
    }
    service.stockByPlan[planName] = product.stock || 0;

    // Notas especiales
    if (serviceName.includes('FlujoTV') || serviceName.includes('MagisTV') || serviceName.includes('Tele Latino')) {
      if (serviceName.includes('3 Disp')) {
        service.note = 'Hasta 3 dispositivos';
      } else if (serviceName.includes('1 Disp')) {
        service.note = '1 dispositivo';
      }
    } else if (serviceName === 'Recarga de Créditos (Billetera)') {
      service.note = 'Compra paquetes y recibe bono automático';
    }
  });

  return Array.from(servicesMap.values());
}

/**
 * Crea un mapa de precios
 */
export function createPriceMap(products: Product[]): PriceMap {
  const priceMap: PriceMap = {};

  products.forEach(product => {
    const serviceName = extractServiceName(product.name);
    const planName = extractPlanName(product.name, serviceName);
    const key = `${serviceName}|${planName}`;
    priceMap[key] = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  });

  return priceMap;
}

/**
 * Crea un mapa de códigos de producto
 */
export function createProductCodeMap(products: Product[]): ProductCodeMap {
  const codeMap: ProductCodeMap = {};

  products.forEach(product => {
    const serviceName = extractServiceName(product.name);
    const planName = extractPlanName(product.name, serviceName);
    const key = `${serviceName}|${planName}`;
    codeMap[key] = product.code;
  });

  return codeMap;
}

/**
 * Crea un mapa de categorías de producto
 */
export function createCategoryMap(products: Product[]): CategoryMap {
  const categoryMap: CategoryMap = {};

  products.forEach(product => {
    const serviceName = extractServiceName(product.name);
    const planName = extractPlanName(product.name, serviceName);
    const key = `${serviceName}|${planName}`;
    categoryMap[key] = product.category;
  });

  return categoryMap;
}

/**
 * Colores oficiales de las marcas
 */
export function getBrandColors(): Record<string, string> {
  return {
    "Disney": "#113CCF",
    "VIX": "#FF6600",
    "Crunchyroll": "#F47521",
    "MAX": "#0A0F9E",
    "Netflix": "#E50914",
    "Paramount": "#0064FF",
    "Spotify": "#1DB954",
    "FlujoTV": "#00ADEF",
    "MagisTV PRO 3 Disp": "#FF6B00",
    "MagisTV PRO 1 Disp": "#FF6B00",
    "Tele Latino PRO 3 Disp": "#DC2626",
    "Tele Latino PRO 1 Disp": "#DC2626",
    "Recarga de Créditos (Billetera)": "#10B981",
  };
}
