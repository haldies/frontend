import React, { useState, FormEvent } from "react";

export interface PostFormData {
  title: string;
  description: string;
  keywords: string[];
}

type Props = {
  initial?: Partial<PostFormData>;
  onSubmit?: (data: PostFormData) => void;
  submitLabel?: string;
};

const normalizeKeyword = (s: string) => s.trim().toLowerCase();

export default function PostForm({ initial = {}, onSubmit, submitLabel = "Simpan" }: Props) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState(
    (initial.keywords ?? []).map(normalizeKeyword).filter(Boolean)
  );
  const [errors, setErrors] = useState<{ title?: string }>({});

  const addKeyword = () => {
    const k = normalizeKeyword(keywordInput);
    if (!k) return;
    if (!keywords.includes(k)) {
      setKeywords(prev => [...prev, k]);
    }
    setKeywordInput("");
  };

  const removeKeyword = (index: number) => {
    setKeywords(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = "Title wajib diisi.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const payload: PostFormData = {
      title: title.trim(),
      description: description.trim(),
      keywords,
    };

    onSubmit?.(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 bg-white rounded-md shadow">
      {/* Title */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 ${
            errors.title ? "border-red-400" : "border-gray-300 focus:ring-indigo-400"
          }`}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Deskripsi</label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400"
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* Keywords */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Keywords</label>

        <div className="flex items-center gap-2">
          <input
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400"
            placeholder="Masukkan keyword..."
          />
          <button
            type="button"
            onClick={addKeyword}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Add
          </button>
        </div>

        {/* Keyword tags */}
        <div className="flex gap-2 flex-wrap mt-3">
          {keywords.map((k, i) => (
            <span
              key={k + i}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-sm"
            >
              {k}
              <button
                type="button"
                onClick={() => removeKeyword(i)}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between mt-4">
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {submitLabel}
        </button>

        <button
          type="button"
          onClick={() => {
            setTitle("");
            setDescription("");
            setKeywordInput("");
            setKeywords([]);
            setErrors({});
          }}
          className="px-3 py-2 border rounded-md hover:bg-gray-50"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
