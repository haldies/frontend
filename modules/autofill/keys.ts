export const DEFAULT_FIELD_KEYS = [
  'fullName',
  'email',
] as const;

export type DefaultFieldKey = (typeof DEFAULT_FIELD_KEYS)[number];
export type FieldKey = DefaultFieldKey | (string & Record<never, never>);

export function isDefaultFieldKey(key: string): key is DefaultFieldKey {
  return (DEFAULT_FIELD_KEYS as readonly string[]).includes(key);
}
