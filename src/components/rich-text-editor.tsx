"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import "react-quill-new/dist/quill.snow.css";
interface RichTextEditorProps {
  onChange: (value: string) => void;
  value: string;
  placeholder?: string;
}

export const RichTextEditor = ({ onChange, value, placeholder }: RichTextEditorProps) => {
  const ReactQuill = useMemo(() => dynamic(() => import("react-quill-new"), { ssr: false, loading: () => <div className="w-full h-[120px] rounded-lg bg-muted animate-pulse" /> }), []);

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"],
      ],
    }),
    []
  );

  return (
    <div className="bg-background rounded-lg border overflow-hidden">
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
        className="min-h-[120px]"
      />
    </div>
  );
};
