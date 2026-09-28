const BORDER_NEEDED_COLORS = new Set(['#FFFFFF', '#FFFF00', '#000000']);
const DARK_TEXT_COLORS = new Set(['#FFFFFF', '#FFFF00', '#F1C40F', '#FFEB3B']);

export function needsGroupBorder(groupColor: string): boolean {
  return BORDER_NEEDED_COLORS.has(groupColor.toUpperCase());
}

export function needsDarkGroupText(groupColor: string): boolean {
  return DARK_TEXT_COLORS.has(groupColor.toUpperCase());
}
