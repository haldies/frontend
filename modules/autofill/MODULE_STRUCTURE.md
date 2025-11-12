# 📋 Smart Autofill Module Structure

## 🎯 Overview
Module `autofill` bertanggung jawab untuk deteksi dan pengisian form otomatis di website. Modul ini memiliki struktur yang terorganisasi dengan pemisahan yang jelas antara **data/types**, **logika bisnis**, dan **utilities**.

---

## 📁 File Structure & Fungsi

### 🔹 **Type Definitions**
File-file ini mendefinisikan struktur data dan interface TypeScript:

#### `types.ts` (2.4 KB)
**Purpose:** Mendefinisikan semua interface dan type definitions
- `FieldDefinition` - Struktur definisi field (label, keywords, etc.)
- `ProfileFieldState` - State field untuk profile user
- `AutoFillState` - State utama aplikasi
- `DetectedValueField` - Hasil deteksi field di halaman
- `DetectionMap` - Mapping field yang terdeteksi

#### `keys.ts` (357 B)
**Purpose:** Mendefinisikan field keys yang valid
- `FieldKey` - Type untuk field keys
- Helper functions untuk field key validation

---

### 🔹 **Core Logic & Configuration**
File-file ini mengandung logika bisnis utama:

#### `config.ts` (8.8 KB) ⭐ **MAIN CONFIGURATION**
**Purpose:** Konfigurasi utama field definitions dan management
- `ensureFieldConfigsReady()` - Inisialisasi konfigurasi dari API
- `getFieldConfigsSync()` - Ambil konfigurasi secara sync
- `saveFieldConfig()` - Simpan konfigurasi field baru
- `refreshConfigsFromApi()` - Refresh konfigurasi dari API
- `setupIndexedDbChangeListener()` - Listener untuk perubahan (disabled)

#### `controller.ts` (14 KB) ⭐ **MAIN CONTROLLER**
**Purpose:** Controller utama untuk mengatur seluruh autofill process
- `SmartAutofillController` - Class controller utama
- `enableCustomFieldsSupport()` - Enable custom fields
- `runDetection()` - Jalankan proses deteksi
- `fillFields()` - Isi field yang terdeteksi
- `triggerDetection()` - Trigger manual detection

#### `detection.ts` (11.8 KB) ⭐ **DETECTION ENGINE**
**Purpose:** Engine untuk mendeteksi field di halaman web
- `detectFields()` - Fungsi utama deteksi
- `evaluateFieldMatch()` - Scoring dan matching field
- `extractFieldKeywords()` - Extract keywords dari elemen
- `fieldMatchEvaluation()` - Evaluasi kecocokan field

#### `state.ts` (2.4 KB)
**Purpose:** Management state aplikasi
- `getDefaultState()` - Default state aplikasi
- `mergeState()` - Merge state dengan stored state
- `persistState()` - Simpan state ke storage
- `loadPersistedState()` - Load state dari storage

#### `api.ts` (4 KB)
**Purpose:** Integration dengan API untuk profile data
- `fetchProfileTemplate()` - Ambil profile dari API
- `normalizeValueForField()` - Normalisasi value untuk field
- API integration dengan localhost:8000

---

### 🔹 **Storage & Persistence**
File-file ini menangani penyimpanan data:

#### `storage.ts` (7.9 KB)
**Purpose:** Storage management untuk Chrome extension
- `StorageAPI` - Class untuk storage operations
- `set()`, `get()`, `clear()` - Basic storage operations
- Chrome extension storage integration
- Persist user profile dan settings

---

### 🔹 **UI & Presentation**
File-file ini menangani tampilan dan UI:

#### `ui.ts` (7.6 KB)
**Purpose:** UI components dan rendering untuk field yang terdeteksi
- `renderFieldOverlay()` - Render overlay di field
- `removeFieldOverlays()` - Hapus overlay
- `createFieldLabel()` - Buat label untuk field
- `updateFieldPositions()` - Update posisi overlay

#### `panel-style.ts` (6.6 KB)
**Purpose:** Styling untuk panel dan UI components
- CSS styles untuk sidepanel
- Theme colors dan design system
- Animation dan layout styles

---

### 🔹 **Utilities & Helpers**
File-file ini berisi fungsi helper dan utilities:

#### `utils.ts` (1.3 KB)
**Purpose:** Utility functions umum
- `escapeHtml()` - Escape HTML characters
- `applyValueToElement()` - Apply value ke DOM element
- `normaliseText()` - Normalisasi text
- `cloneEmptyDetectionMap()` - Clone detection map

---

### 🔹 **Module Entry Point**
File-file ini untuk export dan module organization:

#### `index.ts` (98 B)
**Purpose:** Entry point untuk module autofill
- Export `SmartAutofillController`
- Export `getGlobalController`, `setGlobalController`

---

## 🔄 **Data Flow & Architecture**

```
1. 🚀 Initialization (controller.ts)
   ↓
2. ⚙️ Load Configuration (config.ts)
   ↓
3. 🔍 Detect Fields (detection.ts)
   ↓
4. 💾 Store State (state.ts + storage.ts)
   ↓
5. 🎨 Render UI (ui.ts + panel-style.ts)
   ↓
6. 📝 Fill Fields (utils.ts)
```

## 🏗️ **File Organization Recommendations**

### ✅ **Sudah Terorganisasi dengan Baik:**
- **Types** terpisah di `types.ts` dan `keys.ts`
- **Configuration** terpusat di `config.ts`
- **Core Logic** terpisah di `controller.ts`, `detection.ts`
- **UI Logic** terpisah di `ui.ts`, `panel-style.ts`
- **Storage** terpisah di `storage.ts`
- **Utilities** terpisah di `utils.ts`

### 📝 **Suggestions untuk Lebih Baik:**
1. **Buat subfolders:**
   ```
   /autofill/
   ├── types/          # types.ts, keys.ts
   ├── core/           # config.ts, controller.ts, detection.ts
   ├── storage/        # storage.ts, state.ts
   ├── ui/             # ui.ts, panel-style.ts
   ├── api/            # api.ts
   ├── utils/          # utils.ts
   └── index.ts        # entry point
   ```

2. **File yang bisa digabung:**
   - `state.ts` bisa digabung ke `storage.ts`
   - `keys.ts` bisa digabung ke `types.ts`

## 🎯 **Cara Penggunaan**

```typescript
// Import main controller
import { SmartAutofillController } from './autofill';

// Initialize controller
const controller = new SmartAutofillController();

// Enable custom fields
await controller.enableCustomFieldsSupport();

// Run detection
controller.runDetection();

// Fill fields
await controller.fillFields(profileData);
```

## 📊 **File Size Summary**
- **Types:** 2.8 KB total
- **Core Logic:** 34.6 KB total
- **Storage:** 10.3 KB total
- **UI:** 14.2 KB total
- **API & Utils:** 5.3 KB total
- **Total:** ~67.2 KB

---

**💡 Tip:** Fokus utama ada di `config.ts` untuk mengubah field definitions, `controller.ts` untuk logic utama, dan `detection.ts` untuk algorithm deteksi.