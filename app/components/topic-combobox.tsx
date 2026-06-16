"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}

export function TopicCombobox({ value, onChange, suggestions, placeholder = "Add topic..." }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInput(value);
  }, [value]);

  function getFiltered(query: string) {
    return suggestions.filter(
      (s) => s.toLowerCase().includes(query.toLowerCase()) && s.toLowerCase() !== query.toLowerCase()
    );
  }

  const filtered = getFiltered(input);

  function handleInput(val: string) {
    setInput(val);
    const matches = getFiltered(val);
    setOpen(val.length > 0 && matches.length > 0);
    onChange(val);
  }

  function handleSelect(topic: string) {
    setInput(topic);
    setOpen(false);
    onChange(topic);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Recompute filtered on input change for dropdown visibility
  const showDropdown = open && input.length > 0 && filtered.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={input}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => input.length > 0 && filtered.length > 0 && setOpen(true)}
        className="w-full rounded border-0 bg-transparent text-sm text-zinc-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 px-1 py-0.5 -ml-1"
        placeholder={placeholder}
      />
      {showDropdown && (
        <ul className="absolute z-20 top-full left-0 mt-0.5 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filtered.slice(0, 8).map((topic) => (
            <li key={topic}>
              <button
                type="button"
                onClick={() => handleSelect(topic)}
                className="w-full text-left px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {topic}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
