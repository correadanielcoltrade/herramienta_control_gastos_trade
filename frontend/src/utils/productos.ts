/** Catalogo de productos validos y el material asignado a cada uno.
 *
 * Es la fuente unica para el front; el backend valida contra la misma lista
 * (`PRODUCTO_MATERIAL_MAP` en `serial_service.py`).
 */
export const productoOptions = ["Mate", "Privacy", "Blue light", "Estandar"] as const;

export type ProductoOption = (typeof productoOptions)[number];

export const productoMaterialMap: Record<ProductoOption, string> = {
  Mate: "7018735",
  Privacy: "7018734",
  "Blue light": "7015640",
  Estandar: "7015490",
};

export function normalizeProductoOption(value: string) {
  return value.trim().toLowerCase();
}

export const productoOptionsByNormalized = new Map<string, ProductoOption>(
  productoOptions.map((option) => [normalizeProductoOption(option), option]),
);

export function getMaterialForProducto(producto: string): string {
  const matched = productoOptionsByNormalized.get(normalizeProductoOption(producto));
  return matched ? productoMaterialMap[matched] : "";
}
