// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ReviewClient } from "./review-client";
import type { ReviewItem } from "@/lib/analytics";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const makeItem = (overrides: Partial<ReviewItem> = {}): ReviewItem => ({
  attemptId:   1,
  questionId:  1,
  questionNum: 1,
  paperId:     1,
  year:        2024,
  paperNumber: "1",
  topic:       "Thermodynamics",
  score:       3,
  maxMark:     10,
  confidence:  2,
  mistakeType: "conceptual",
  notes:       "Missed entropy term",
  status:      "review_needed",
  attemptedAt: "2024-01-15T10:00:00",
  ...overrides,
});

const defaultItems: ReviewItem[] = [
  makeItem({ attemptId: 1, questionId: 1, questionNum: 1, topic: "Thermodynamics", score: 3, maxMark: 10, mistakeType: "conceptual", attemptedAt: "2024-01-15T10:00:00" }),
  makeItem({ attemptId: 2, questionId: 2, questionNum: 2, topic: "Kinetics", score: 5, maxMark: 15, mistakeType: "calculation", attemptedAt: "2024-01-10T10:00:00" }),
  makeItem({ attemptId: 3, questionId: 3, questionNum: 1, paperId: 2, year: 2023, paperNumber: "3", topic: "Organic", score: 2, maxMark: 20, mistakeType: "forgot_formula", attemptedAt: "2024-01-20T10:00:00" }),
];

const defaultFilterOptions = {
  topics:       ["Thermodynamics", "Kinetics", "Organic"],
  years:        [2024, 2023],
  paperNumbers: ["1", "3"],
  mistakeTypes: ["conceptual", "calculation", "forgot_formula"],
};

// Render without StrictMode to avoid double-rendering
function renderComponent(ui: React.ReactElement) {
  return render(ui, { wrapper: ({ children }) => <>{children}</> });
}

function getQuestionLinks() {
  return screen.getAllByRole("link").filter((el) =>
    /^\d{4} Paper .+ Q\d+$/.test(el.textContent ?? "")
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true });
});

describe("ReviewClient", () => {
  it("renders correct number of review items", () => {
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);
    expect(screen.getAllByText("Dismiss")).toHaveLength(3);
    expect(screen.getAllByText("Go to paper")).toHaveLength(3);
  });

  it("shows empty state when no items", () => {
    renderComponent(<ReviewClient items={[]} filterOptions={{ topics: [], years: [], paperNumbers: [], mistakeTypes: [] }} />);
    expect(screen.getByText("All caught up!")).toBeInTheDocument();
  });

  it("shows item count", () => {
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("filters by topic", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);

    await user.selectOptions(screen.getByLabelText("Topic"), "Kinetics");

    expect(screen.getAllByText("Dismiss")).toHaveLength(1);
  });

  it("filters by year", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);

    await user.selectOptions(screen.getByLabelText("Year"), "2023");

    expect(screen.getAllByText("Dismiss")).toHaveLength(1);
  });

  it("shows no-match state when filters empty the list", async () => {
    const user = userEvent.setup();
    const items = [makeItem({ topic: "Thermodynamics" })];
    renderComponent(<ReviewClient items={items} filterOptions={{ ...defaultFilterOptions, topics: ["Thermodynamics", "Kinetics"] }} />);

    await user.selectOptions(screen.getByLabelText("Topic"), "Kinetics");

    expect(screen.getByText("No items match your filters.")).toBeInTheDocument();
  });

  it("sorts by accuracy (worst first)", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);

    await user.click(screen.getByRole("button", { name: "Worst" }));

    const links = getQuestionLinks();
    expect(links.length).toBe(3);
    expect(links[0]).toHaveTextContent("2023 Paper 3 Q1");
    expect(links[1]).toHaveTextContent("2024 Paper 1 Q1");
    expect(links[2]).toHaveTextContent("2024 Paper 1 Q2");
  });

  it("sorts by topic alphabetically", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);

    await user.click(screen.getByRole("button", { name: "Topic" }));

    const links = getQuestionLinks();
    expect(links[0]).toHaveTextContent("2024 Paper 1 Q2");
    expect(links[1]).toHaveTextContent("2023 Paper 3 Q1");
    expect(links[2]).toHaveTextContent("2024 Paper 1 Q1");
  });

  it("dismiss calls PATCH with correct body", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewClient items={[defaultItems[0]]} filterOptions={defaultFilterOptions} />);

    await user.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/attempts/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ markedForReview: false, status: "attempted" }),
        })
      );
    });
  });

  it("dismiss shows error and restores item on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const user = userEvent.setup();
    renderComponent(<ReviewClient items={[defaultItems[0]]} filterOptions={defaultFilterOptions} />);

    await user.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.getByText(/Failed to dismiss/)).toBeInTheDocument();
    });
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("go-to-paper links have correct hrefs", () => {
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);
    const goLinks = screen.getAllByText("Go to paper");
    expect(goLinks[0].closest("a")).toHaveAttribute("href", "/papers/2024/1");
  });

  it("renders items with null topic without crashing", () => {
    const items = [makeItem({ topic: null })];
    renderComponent(<ReviewClient items={items} filterOptions={{ topics: [], years: [2024], paperNumbers: ["1"], mistakeTypes: ["conceptual"] }} />);
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("renders items with null score without crashing", () => {
    const items = [makeItem({ score: null, maxMark: null })];
    renderComponent(<ReviewClient items={items} filterOptions={defaultFilterOptions} />);
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("renders Edit button for each item", () => {
    renderComponent(<ReviewClient items={defaultItems} filterOptions={defaultFilterOptions} />);
    expect(screen.getAllByText("Edit")).toHaveLength(3);
  });

  it("Edit button opens modal with pre-filled data", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewClient items={[defaultItems[0]]} filterOptions={defaultFilterOptions} />);

    await user.click(screen.getByText("Edit"));

    expect(screen.getByText(/Edit attempt/)).toBeInTheDocument();
  });
});
