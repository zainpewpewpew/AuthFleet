/** Minimal class-join helper so the components do not pull a dep. */
export default function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p)).join(' ');
}
