import type { FieldDefinition } from '../types/types';
import { getApiBaseUrl } from './api';

export interface FieldConfigResponse {
  fields: FieldDefinition[];
}

export interface CreateFieldRequest {
  label: string;
  default_value?: string;
  default_enabled?: boolean;
  keywords?: string[];
  input_kind?: string;
  require_keyword?: boolean;
}

export interface UpdateFieldRequest {
  label?: string;
  default_value?: string;
  default_enabled?: boolean;
  keywords?: string[];
  input_kind?: string;
  require_keyword?: boolean;
}

class FieldConfigApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${getApiBaseUrl()}/api/fields`;
  }

  async getAllFields(): Promise<FieldDefinition[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch fields: ${response.status}`);
    }
    const data: FieldConfigResponse = await response.json();
    return data.fields.map(this.transformApiFieldToFieldDefinition);
  }

  async getFieldById(id: number): Promise<FieldDefinition | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch field: ${response.status}`);
    }
    const data = await response.json();
    return this.transformApiFieldToFieldDefinition(data);
  }

  // Keep backward compatibility
  async getFieldByKey(key: string): Promise<FieldDefinition | null> {
    return this.getFieldById(parseInt(key));
  }

  async createField(request: CreateFieldRequest): Promise<FieldDefinition> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to create field: ${response.status}`);
    }
    const data = await response.json();
    return this.transformApiFieldToFieldDefinition(data);
  }

  async updateField(id: number, request: UpdateFieldRequest): Promise<FieldDefinition> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to update field: ${response.status}`);
    }
    const data = await response.json();
    return this.transformApiFieldToFieldDefinition(data);
  }

  async deleteField(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete field: ${response.status}`);
    }
  }

  async resetToDefaults(): Promise<FieldDefinition[]> {
    const response = await fetch(`${this.baseUrl}/reset`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to reset fields: ${response.status}`);
    }
    const data: FieldConfigResponse = await response.json();
    return data.fields.map(this.transformApiFieldToFieldDefinition);
  }

  private transformApiFieldToFieldDefinition(apiField: any): FieldDefinition {
    return {
      id: apiField.id,
      label: apiField.label,
      description: apiField.description || '',
      defaultValue: apiField.default_value || '',
      defaultEnabled: apiField.default_enabled ?? true,
      keywords: apiField.keywords || [],
      inputKind: apiField.input_kind || 'text',
      requireKeyword: apiField.require_keyword ?? false,
    };
  }

  private transformFieldDefinitionToApiField(field: FieldDefinition): any {
    return {
      id: field.id,
      label: field.label,
      default_value: field.defaultValue,
      default_enabled: field.defaultEnabled,
      keywords: field.keywords,
      input_kind: field.inputKind,
      require_keyword: field.requireKeyword,
    };
  }
}

export const fieldConfigApi = new FieldConfigApi();