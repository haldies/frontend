export const FIELD_KEYS = [
  'fullName',
  'email',
  'phone',
  'whatsapp',
  'company',
  'jobTitle',
  'placeOfBirth',
  'dateOfBirth',
  'university',
  'educationLevel',
  'major',
  'gpa',
  'experience',
  'expectedSalary',
  'linkedin',
  'referralSource',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];
