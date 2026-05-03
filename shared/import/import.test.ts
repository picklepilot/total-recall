import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseLetterboxdDiaryCsv,
  LETTERBOXD_DIARY_SOURCE,
} from "./adapters/letterboxd-diary";
import { parseCsv } from "./parseCsv";
import { plainTextToTipTapDoc } from "./tiptapDoc";
import { tagsFromStrings } from "./tags";

const _dir = dirname(fileURLToPath(import.meta.url));

describe("plainTextToTipTapDoc", () => {
  it("produces valid doc JSON with paragraphs", () => {
    const json = plainTextToTipTapDoc("a\n\nb");
    const doc = JSON.parse(json) as { type: string; content: unknown[] };
    expect(doc.type).toBe("doc");
    expect(Array.isArray(doc.content)).toBe(true);
    expect(doc.content.length).toBe(3);
  });

  it("handles empty input", () => {
    const json = plainTextToTipTapDoc("");
    const doc = JSON.parse(json) as {
      type: string;
      content: { type: string }[];
    };
    expect(doc.content[0]?.type).toBe("paragraph");
  });
});

describe("parseCsv", () => {
  it("parses quoted commas", () => {
    const rows = parseCsv('"hello, world",x\n');
    expect(rows).toEqual([["hello, world", "x"]]);
  });
});

describe("tagsFromStrings", () => {
  it("dedupes and lowercases", () => {
    expect(tagsFromStrings("A", ["b", "B"], "a")).toEqual(["a", "b"]);
  });
});

describe("parseLetterboxdDiaryCsv", () => {
  it("parses fixture and maps rows", () => {
    const raw = readFileSync(
      join(_dir, "fixtures/letterboxd-diary-sample.csv"),
      "utf8",
    );
    const drafts = parseLetterboxdDiaryCsv(raw);
    expect(drafts).toHaveLength(3);

    const first = drafts[0]!;
    expect(first.url).toBe("https://boxd.it/1yQw4R");
    expect(first.importMeta?.source).toBe(LETTERBOXD_DIARY_SOURCE);
    expect(first.importMeta?.externalId).toBe(
      "https://boxd.it/1yQw4R|2021-01-04",
    );
    expect(first.contentText).toContain("Eraserhead");
    expect(first.contentText).toContain("Watched: 2020-09-03");
    expect(first.contentText).toContain("Logged: 2021-01-04");
    expect(first.tags).toContain("letterboxd");
    expect(first.tags).toContain("diary");
    expect(first.createdAt.toISOString().startsWith("2021-01-04")).toBe(true);

    const tagged = drafts[1]!;
    expect(tagged.tags).toContain("top b");

    const doc = JSON.parse(first.contentJson) as { type: string };
    expect(doc.type).toBe("doc");
  });

  it("throws on missing column", () => {
    expect(() => parseLetterboxdDiaryCsv("a,b\n1,2")).toThrow(
      /Missing required column/,
    );
  });
});
