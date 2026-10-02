export type CategoryNode = { id: string; name: string; parentId: string | null; sortOrder: number };
/** Includes the selected node and all descendants, with cycle protection for old data. */
export function categoryDescendantIds(id: string, nodes: Array<{ id: string; parentId?: string | null }>) {
  const ids = new Set([id]);
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop();
    for (const node of nodes) if (node.parentId === parent && !ids.has(node.id)) { ids.add(node.id); pending.push(node.id); }
  }
  return ids;
}
export function categoryTreeVersion(nodes: Array<{ id: string; updatedAt: string | Date }>) { return nodes.map(node => `${node.id}:${new Date(node.updatedAt).toISOString()}`).sort().join("|"); }

export function categoryPath(id: string, nodes: Array<Pick<CategoryNode, "id" | "name" | "parentId">>): string {
  const map = new Map(nodes.map(node => [node.id, node]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let node = map.get(id);
  while (node && !seen.has(node.id)) { seen.add(node.id); parts.unshift(node.name); node = node.parentId ? map.get(node.parentId) : undefined; }
  return parts.join(" / ");
}

export function validateCategoryTree(nodes: CategoryNode[]) {
  const map = new Map(nodes.map(node => [node.id, node]));
  if (map.size !== nodes.length) throw new Error("Hay categorías repetidas.");
  const siblings = new Set<string>();
  for (const node of nodes) {
    const sibling = `${node.parentId ?? "root"}:${node.name.trim().toLocaleLowerCase("es")}`;
    if (siblings.has(sibling)) throw new Error("Ya existe una categoría con ese nombre en la misma rama.");
    siblings.add(sibling);
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error("Una categoría no puede estar dentro de sí misma.");
      visited.add(parentId);
      const parent = map.get(parentId);
      if (!parent) throw new Error("La categoría principal no existe.");
      if (visited.size > 3) throw new Error("Solo se permiten tres niveles de categorías.");
      parentId = parent.parentId;
    }
  }
}
