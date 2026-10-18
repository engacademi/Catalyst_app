// Stable across date changes, sorting and visibility filters.
export function eventColor(id: string) {
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 8;
}

const TEAM_COLORS = [
  "#1d705a",
  "#8a5595",
  "#28679a",
  "#aa591e",
  "#a84160",
  "#5e6e2a",
  "#427b80",
  "#7259a5",
];
export function teamColor(id: string) {
  return TEAM_COLORS[eventColor(id)];
}
