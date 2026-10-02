import { categoryDescendantIds } from "./category-tree";

export function visibleCategories<T extends { id: string; parentId?: string | null; isVisible: boolean }>(categories: T[]): T[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categories.filter((category) => {
    let node: T | undefined = category;
    const visited = new Set<string>();
    while (node) {
      if (!node.isVisible || visited.has(node.id)) return false;
      visited.add(node.id);
      node = node.parentId ? byId.get(node.parentId) : undefined;
    }
    return true;
  });
}

type CategoryProducts = { id: string; parentId?: string | null; products: Array<{ id: string }>; assignedProducts: Array<{ id: string }> };

/** Call with visible products only. A product assigned to multiple descendants counts once. */
export function publicCategoryCounts(categories: CategoryProducts[]) {
  const byId = new Map(categories.map(category => [category.id, category]));
  return new Map(categories.map(category => {
    const productIds = new Set<string>();
    for (const id of categoryDescendantIds(category.id, categories)) {
      const child = byId.get(id);
      for (const product of [...(child?.products ?? []), ...(child?.assignedProducts ?? [])]) productIds.add(product.id);
    }
    return [category.id, productIds.size];
  }));
}
