/**
 * Unit tests for inferPaperNumber — covers every distinct filename convention
 * observed in the real paper library (2016–2025).
 *
 * Run with: npm test
 */

import { describe, it, expect } from "vitest";
import { inferPaperNumber, inferFileYear } from "./scanner";

// ─── Naming Convention Fixtures ───────────────────────────────────────────────

describe("inferPaperNumber — naming conventions", () => {
  // Convention 1: II_YEAR_PaperNA[B].pdf  (2016, 2018–2020)
  describe("II_YEAR_PaperN[AB] style (2016–2020)", () => {
    it("II_2016_Paper2.pdf → '2'", () => {
      expect(inferPaperNumber("II_2016_Paper2.pdf")).toBe("2");
    });
    it("II_2016_Paper2A.pdf → '2A'", () => {
      expect(inferPaperNumber("II_2016_Paper2A.pdf")).toBe("2A");
    });
    it("II_2018_Paper2B.pdf → '2B'", () => {
      expect(inferPaperNumber("II_2018_2B.pdf")).toBe("2B");
    });
    // 1A/1B are normalised to "1"
    it("II_2016_Paper1A.pdf → '1' (1A normalised)", () => {
      expect(inferPaperNumber("II_2016_Paper1A.pdf")).toBe("1");
    });
    it("II_2016_Paper1B.pdf → '1' (1B normalised)", () => {
      expect(inferPaperNumber("II_2016_Paper1B.pdf")).toBe("1");
    });
    // 4A/4B are normalised to "4"
    it("II_2016_Paper4A.pdf → '4' (4A normalised)", () => {
      expect(inferPaperNumber("II_2016_Paper4A.pdf")).toBe("4");
    });
  });

  // Convention 2: II_YEAR_N[A].pdf  (2017 — no "Paper" word, just number after year)
  describe("II_YEAR_N[A] style (2017)", () => {
    it("II_2017_1A.pdf → '1' (1A normalised)", () => {
      expect(inferPaperNumber("II_2017_1A.pdf")).toBe("1");
    });
    it("II_2017_2.pdf → '2'", () => {
      expect(inferPaperNumber("II_2017_2.pdf")).toBe("2");
    });
    it("II_2017_3.pdf → '3'", () => {
      expect(inferPaperNumber("II_2017_3.pdf")).toBe("3");
    });
    it("II_2017_4A.pdf → '4' (4A normalised)", () => {
      expect(inferPaperNumber("II_2017_4A.pdf")).toBe("4");
    });
  });

  // Convention 3: PartII_YEAR_PaperN[A].pdf  (2021 — no underscore between Part and II)
  describe("PartII_YEAR_PaperN style (2021)", () => {
    it("PartII_2021_Paper1.pdf → '1'", () => {
      expect(inferPaperNumber("PartII_2021_Paper1.pdf")).toBe("1");
    });
    it("PartII_2021_Paper2A.pdf → '2A'", () => {
      expect(inferPaperNumber("PartII_2021_Paper2A.pdf")).toBe("2A");
    });
    it("PartII_2021_Paper3.pdf → '3'", () => {
      expect(inferPaperNumber("PartII_2021_Paper3.pdf")).toBe("3");
    });
    it("PartII_2021_Paper4.pdf → '4'", () => {
      expect(inferPaperNumber("PartII_2021_Paper4.pdf")).toBe("4");
    });
  });

  // Convention 4: II_YEAR_Paper_N[A].pdf  (2022 — underscore before number)
  describe("II_YEAR_Paper_N[A] style (2022)", () => {
    it("II_2022_Paper_1.pdf → '1'", () => {
      expect(inferPaperNumber("II_2022_Paper_1.pdf")).toBe("1");
    });
    it("II_2022_Paper_2A.pdf → '2A'", () => {
      expect(inferPaperNumber("II_2022_Paper_2A.pdf")).toBe("2A");
    });
    it("II_2022_Paper_2B.pdf → '2B'", () => {
      expect(inferPaperNumber("II_2022_Paper_2B.pdf")).toBe("2B");
    });
    it("II_2022_Paper_4.pdf → '4'", () => {
      expect(inferPaperNumber("II_2022_Paper_4.pdf")).toBe("4");
    });
  });

  // Convention 5: "Paper N[A] final.pdf"  (2023 — plain "Paper" with space)
  describe("Paper N[A] final style (2023)", () => {
    it("Paper 1 final.pdf → '1'", () => {
      expect(inferPaperNumber("Paper 1 final.pdf")).toBe("1");
    });
    it("Paper 2A final.pdf → '2A'", () => {
      expect(inferPaperNumber("Paper 2A final.pdf")).toBe("2A");
    });
    it("Paper 2B final.pdf → '2B'", () => {
      expect(inferPaperNumber("Paper 2B final.pdf")).toBe("2B");
    });
    it("Paper 3 final.pdf → '3'", () => {
      expect(inferPaperNumber("Paper 3 final.pdf")).toBe("3");
    });
    it("Paper 4 final.pdf → '4'", () => {
      expect(inferPaperNumber("Paper 4 final.pdf")).toBe("4");
    });
  });

  // Convention 6: "Part ll YEAR - Paper N[A] QP.pdf"  (2024 — lowercase ll, dash, QP suffix)
  describe("Part ll YEAR - Paper N QP style (2024)", () => {
    it("Part ll 2024 - Paper 1 QP.pdf → '1'", () => {
      expect(inferPaperNumber("Part ll 2024 - Paper 1 QP.pdf")).toBe("1");
    });
    it("Part ll 2024 - Paper 2A QP.pdf → '2A'", () => {
      expect(inferPaperNumber("Part ll 2024 - Paper 2A QP.pdf")).toBe("2A");
    });
    it("Part ll 2024 - Paper 2B QP.pdf → '2B'", () => {
      expect(inferPaperNumber("Part ll 2024 - Paper 2B QP.pdf")).toBe("2B");
    });
    it("Part ll 2024 - Paper 3 QP.pdf → '3'", () => {
      expect(inferPaperNumber("Part ll 2024 - Paper 3 QP.pdf")).toBe("3");
    });
    it("Part ll 2024 - Paper 4 QP.pdf → '4'", () => {
      expect(inferPaperNumber("Part ll 2024 - Paper 4 QP.pdf")).toBe("4");
    });
  });

  // Convention 7: "Part ll Paper N[A].pdf"  (2025 — no year in filename)
  describe("Part ll Paper N[A] style (2025)", () => {
    it("Part ll Paper 1.pdf → '1'", () => {
      expect(inferPaperNumber("Part ll Paper 1.pdf")).toBe("1");
    });
    it("Part ll Paper 2A.pdf → '2A'", () => {
      expect(inferPaperNumber("Part ll Paper 2A.pdf")).toBe("2A");
    });
    it("Part ll Paper 2B.pdf → '2B'", () => {
      expect(inferPaperNumber("Part ll Paper 2B.pdf")).toBe("2B");
    });
    it("Part ll Paper 4.pdf → '4'", () => {
      expect(inferPaperNumber("Part ll Paper 4.pdf")).toBe("4");
    });
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("inferPaperNumber — edge cases", () => {
  it("returns null for an unrecognised filename", () => {
    expect(inferPaperNumber("Lecture notes.pdf")).toBeNull();
    expect(inferPaperNumber("random_file.pdf")).toBeNull();
    expect(inferPaperNumber("2024.pdf")).toBeNull();
  });

  it("is case-insensitive for II", () => {
    expect(inferPaperNumber("ii_2018_2A.pdf")).toBe("2A");
  });

  it("normalises 3A → '3' and 3B → '3'", () => {
    // Fictional filenames to test normalisation branch
    expect(inferPaperNumber("II_2019_3A.pdf")).toBe("3");
    expect(inferPaperNumber("II_2019_3B.pdf")).toBe("3");
  });

  // Convention 8: "II YEAR PaperN[AB].pdf" (2015-style — spaces and no gap
  // between "Paper" and digit). Previously returned null, causing 2015 MS
  // lookups to fall through to the cross-year "New folder" stash.
  it("II 2015 Paper1A.pdf → '1' (1A normalised)", () => {
    expect(inferPaperNumber("II 2015 Paper1A.pdf")).toBe("1");
  });
  it("II 2015 Paper2.pdf → '2'", () => {
    expect(inferPaperNumber("II 2015 Paper2.pdf")).toBe("2");
  });
  it("II 2015 Paper4B.pdf → '4' (4B normalised)", () => {
    expect(inferPaperNumber("II 2015 Paper4B.pdf")).toBe("4");
  });
});

// ─── inferFileYear ────────────────────────────────────────────────────────────

describe("inferFileYear", () => {
  it("extracts a single year", () => {
    expect(inferFileYear("II 2015 Paper1A.pdf")).toBe(2015);
    expect(inferFileYear("Part II Paper 1 2022 Combined adjusted V2.pdf")).toBe(2022);
  });

  it("ignores DD.MM.YYYY date stamps", () => {
    // "15.05.2024" is the update date, NOT the exam year. Without this fix
    // the file would be falsely tagged as a 2024 paper.
    expect(inferFileYear("Paper 4 with answers 15.05.2024 update.pdf")).toBeNull();
  });

  it("returns the end calendar year for academic-year ranges", () => {
    // "2017-18 paper" was sat in 2018, so its exam year is 2018.
    expect(inferFileYear("Part II 2017-18 paper 1.pdf")).toBe(2018);
    expect(inferFileYear("Part II 2017-2018 paper 1.pdf")).toBe(2018);
  });

  it("returns null when no year is present", () => {
    expect(inferFileYear("Paper 1 final.pdf")).toBeNull();
    expect(inferFileYear("Part ll Paper 1.pdf")).toBeNull();
  });
});
