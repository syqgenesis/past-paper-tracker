import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Disable React StrictMode wrapper in tests to avoid double-rendering
configure({ reactStrictMode: false });
