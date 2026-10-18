// Stable across date changes, sorting and visibility filters.
export function eventColor(id: string) {
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 8;
}
