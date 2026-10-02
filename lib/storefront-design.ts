/** WCAG relative luminance: choose the higher-contrast text color for a custom brand. */
export function contrastingTextColor(hex: string) {
  if (!/^#[\da-f]{6}$/i.test(hex)) return "#ffffff";
  const rgb = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  return luminance > .179 ? "#000000" : "#ffffff";
}
