import { describe, it, expect } from "vitest";
import { extractTopic, shouldInclude, EXTENSIONS } from "@/lib/resources";

describe("extractTopic", () => {
  it("matches a module code at the start of the filename", () => {
    expect(extractTopic("A1_Active_Recall_Exercises.docx")).toBe("A1");
    expect(extractTopic("C5_Combined_Textbook.pdf")).toBe("C5");
  });

  it("matches a module code mid-filename (Handouts style)", () => {
    expect(extractTopic("PT II A1 Ln An 2025 student.pdf")).toBe("A1");
    expect(extractTopic("Direct_Methods_Notes_C6.docx")).toBe("C6");
  });

  it("matches when surrounded by spaces or punctuation", () => {
    expect(extractTopic("A6 Symmetry and Bonding 2025 - Truscott Final.pdf")).toBe("A6");
    expect(extractTopic("B4_ATA Mich 2025 PV.pdf")).toBe("B4");
  });

  it("is case-insensitive but returns uppercase", () => {
    expect(extractTopic("a1_notes.md")).toBe("A1");
    expect(extractTopic("c5-handout.pdf")).toBe("C5");
  });

  it("returns the FIRST match when multiple module codes appear", () => {
    expect(extractTopic("A1_vs_B4_comparison.md")).toBe("A1");
  });

  it("returns null when no module code is present", () => {
    expect(extractTopic("REVISION_PLAN.md")).toBeNull();
    expect(extractTopic("Chemistry_in_the_Atmosphere_2016-2025.pdf")).toBeNull();
    expect(extractTopic("OsO4_and_Ozonolysis_Mechanisms.docx")).toBeNull();
  });

  it("does not match codes outside the A0-C9 range", () => {
    expect(extractTopic("D1_something.pdf")).toBeNull();
    expect(extractTopic("Z9_other.pdf")).toBeNull();
  });

  it("requires word boundaries (no partial matches inside identifiers)", () => {
    // "ABC123" must NOT match "C1" — the word boundary requirement protects us.
    expect(extractTopic("ABC123.pdf")).toBeNull();
    // Likewise embedded in a longer alphanumeric token
    expect(extractTopic("dataB42log.pdf")).toBeNull();
  });

  it("matches in filenames with parentheses, hyphens, dots", () => {
    expect(extractTopic("A1 2025 heavier TM - student PV (1).pdf")).toBe("A1");
    expect(extractTopic("C2_Mock_Question_LaTeX.pdf")).toBe("C2");
  });
});

describe("shouldInclude", () => {
  it("includes whitelisted extensions when a module code is present", () => {
    expect(shouldInclude("A1_notes.pdf")).toBe(true);
    expect(shouldInclude("B4_Flashcards.docx")).toBe(true);
    expect(shouldInclude("B5_Problem_Set.html")).toBe(true);
    expect(shouldInclude("C6_notes.md")).toBe(true);
    expect(shouldInclude("B4_Flashcards.tsv")).toBe(true);
  });

  it("excludes non-whitelisted extensions even with a module code", () => {
    expect(shouldInclude("A6_cheatsheet.tex")).toBe(false);
    expect(shouldInclude("A6_cheatsheet.aux")).toBe(false);
    expect(shouldInclude("A6_cheatsheet.log")).toBe(false);
    expect(shouldInclude("A6_cheatsheet.out")).toBe(false);
    expect(shouldInclude("C2_generate.py")).toBe(false);
    expect(shouldInclude("A1_mistakes.sql")).toBe(false);
  });

  it("excludes Word/Excel lockfiles", () => {
    expect(shouldInclude("~$A1_Active_Recall.docx")).toBe(false);
    expect(shouldInclude("~$B4_Flashcards.docx")).toBe(false);
  });

  it("excludes hidden dotfiles", () => {
    expect(shouldInclude(".DS_Store")).toBe(false);
    expect(shouldInclude(".a1_active_recall.md")).toBe(false);
  });

  it("excludes whitelisted-extension files with no module code", () => {
    expect(shouldInclude("REVISION_PLAN.md")).toBe(false);
    expect(shouldInclude("Chemistry_in_the_Atmosphere_2016-2025.pdf")).toBe(false);
    expect(shouldInclude("OsO4_and_Ozonolysis_Mechanisms.docx")).toBe(false);
  });

  it("is case-insensitive on extension", () => {
    expect(shouldInclude("A1_notes.PDF")).toBe(true);
    expect(shouldInclude("B4_quiz.HTML")).toBe(true);
  });
});

describe("EXTENSIONS constant", () => {
  it("contains exactly the five whitelisted types", () => {
    expect([...EXTENSIONS].sort()).toEqual([".docx", ".html", ".md", ".pdf", ".tsv"]);
  });
});
