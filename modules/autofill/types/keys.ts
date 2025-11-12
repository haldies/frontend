export const DEFAULT_FIELD_IDS = [
  'nama_lengkap',
  'email',
] as const;

export type DefaultFieldId = (typeof DEFAULT_FIELD_IDS)[number];
export type FieldId = DefaultFieldId | (string & Record<never, never>);

export function isDefaultFieldId(id: string): id is DefaultFieldId {
  return (DEFAULT_FIELD_IDS as readonly string[]).includes(id);
}

// Keep backward compatibility for now
export type FieldKey = FieldId;
export const DEFAULT_FIELD_KEYS = DEFAULT_FIELD_IDS;
export type DefaultFieldKey = DefaultFieldId;
export function isDefaultFieldKey(key: string): key is DefaultFieldKey {
  return isDefaultFieldId(key);
}
