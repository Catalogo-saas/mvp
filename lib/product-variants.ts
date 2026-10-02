import { z } from "zod";

export const variantCombinationSchema = z.object({
  key: z.string().min(2).max(500),
  stockQuantity: z.number().int().min(0).max(999999).nullable(),
  basePrice: z.number().int().min(0).max(999999999).nullable(),
  promoPrice: z.number().int().min(0).max(999999999).nullable(),
  isVisible: z.boolean().default(true),
  imageUrl: z.string().url().nullable().default(null),
  imageIndex: z.number().int().min(0).max(5).optional()
});

export type VariantCombination = z.infer<typeof variantCombinationSchema>;

export function normalizeVariants(value: unknown): VariantCombination[] {
  return z.array(variantCombinationSchema).max(100).catch([]).parse(value);
}

export function variantKeyFromNames(selected: Array<{ groupName: string; optionName: string }>) {
  return JSON.stringify(selected.map(({ groupName, optionName }) => [groupName.trim(), optionName.trim()]).sort(([a], [b]) => a.localeCompare(b)));
}

export function selectedVariantKey(groups: Array<{ name: string; selectionType?: string; options: Array<{ id: string; name: string }> }>, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return variantKeyFromNames(groups.flatMap((group) => group.options.filter((option) => selected.has(option.id)).map((option) => ({ groupName: group.name, optionName: option.name }))));
}

export function variantCombinations(groups: Array<{ name: string; selectionType: string; isRequired?: boolean; options: Array<{ name: string }> }>) {
  const validGroups = groups.filter((group) => group.name.trim() && group.selectionType === "SINGLE" && group.options.some((option) => option.name.trim()));
  if (!validGroups.length) return [];
  let combinations: Array<Array<{ groupName: string; optionName: string }>> = [[]];
  for (const group of validGroups) {
    combinations = combinations.flatMap((current) => [
      ...group.options.filter((option) => option.name.trim()).map((option) => [...current, { groupName: group.name, optionName: option.name }])
    ]);
    if (combinations.length > 100) return [];
  }
  return combinations.map((options) => ({ key: variantKeyFromNames(options), label: options.map((item) => item.optionName).join(" / ") || "Sin variante" }));
}
