import catalog from '../design-contract/assets/roku/roku/data/avatar-catalog.json';

/* The pinned design catalog (ADM-004) is the only source of worlds, names and
 * counts. Generated worlds have `per_category` choices in avatars/avatar-catalog;
 * character worlds list their own items in avatars/avatar-characters. Choices are
 * stable 1-based positions within a world. */
export type AvatarWorld = {style: string; name: string; count: number};
type Category = (typeof catalog.categories)[number];
const items = (category: Category) => 'items' in category ? category.items : undefined;
const characterPrefix = 'pkg:/images/';

export const AVATAR_WORLDS: AvatarWorld[] = catalog.categories.map(category => ({style: category.style, name: category.name, count: items(category)?.length ?? catalog.per_category}));
export const AVATAR_COUNT = AVATAR_WORLDS.reduce((total, world) => total + world.count, 0);
export const avatarWorld = (style?: string) => AVATAR_WORLDS.find(world => world.style === style);

/** Packaged artwork for a catalog selection, or undefined when it does not resolve. */
export function catalogAvatarUrl(style?: string, choice?: number | null) {
  const category = catalog.categories.find(entry => entry.style === style);
  if (!category || !Number.isInteger(choice) || choice! < 1) return undefined;
  const list = items(category);
  if (!list) return choice! <= catalog.per_category ? `${import.meta.env.BASE_URL}avatars/avatar-catalog/${style}-${choice}.png` : undefined;
  const local = list[choice! - 1]?.local;
  return local?.startsWith(characterPrefix) ? `${import.meta.env.BASE_URL}avatars/${local.slice(characterPrefix.length)}` : undefined;
}
