import React, { useState } from "react";
import PostForm from "./PostForm";

export default function PostFormWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-xl mx-auto mt-6">

      {/* Jika form belum dibuka → tampil tombol Add */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Add
        </button>
      )}

      {/* Jika tombol Add ditekan → tampilkan form */}
      {open && (
        <div className="mt-4 p-4 border rounded-md shadow bg-white">
          <PostForm
            submitLabel="Simpan"
            onSubmit={(data) => {
              console.log("Data disubmit:", data);
              setOpen(false); // setelah submit, tutup form (opsional)
            }}
          />

          {/* Tombol cancel untuk menutup form */}
          <button
            onClick={() => setOpen(false)}
            className="mt-3 px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
