import type { EntryWidget } from "../../../app/types/entry";
import type { EntryImportDraft } from "../types";
import { parseCsv } from "../parseCsv";
import { plainTextToTipTapDoc } from "../tiptapDoc";
import { tagsFromStrings } from "../tags";

/** `importMeta.source` for Letterboxd `diary.csv` rows. */
export const LETTERBOXD_DIARY_SOURCE = "letterboxd-diary";

const REQUIRED_HEADERS = [
  "Date",
  "Name",
  "Year",
  "Letterboxd URI",
  "Rating",
  "Rewatch",
  "Tags",
  "Watched Date",
] as const;

function utcMidnightFromYmd(ymd: string): Date {
  const s = ymd.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    throw new Error(`Expected YYYY-MM-DD, got: ${ymd}`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
}

/** Letterboxd Tags cell: comma-separated tags or a single phrase (e.g. `top b`). */
function parseTagsCell(cell: string): string[] {
  const t = cell.trim();
  if (!t) return [];
  if (t.includes(",")) {
    return t
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [t];
}

/**
 * Letterboxd diary `Rating` cell: numeric 0–5, half-star steps. Empty = unrated.
 */
export function letterboxdRatingToStarWidget(cell: string): EntryWidget | null {
  const s = cell.trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 2) / 2;
  if (rounded < 0 || rounded > 5) return null;
  return { type: "starRating", value: rounded };
}

function headerIndexMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const key = h.trim();
    if (key) map[key] = i;
  });
  return map;
}

function buildDraft(row: Record<string, string>): EntryImportDraft {
  const date = row.Date?.trim() ?? "";
  const name = row.Name?.trim() ?? "";
  const year = row.Year?.trim() ?? "";
  const uri = row["Letterboxd URI"]?.trim() ?? "";
  const rating = row.Rating?.trim() ?? "";
  const rewatch = row.Rewatch?.trim() ?? "";
  const tagsCell = row.Tags ?? "";
  const watchedDate = row["Watched Date"]?.trim() ?? "";

  if (!date || !name || !uri) {
    throw new Error("Missing Date, Name, or Letterboxd URI");
  }

  const datesLine =
    watchedDate && watchedDate !== date
      ? `Watched: ${watchedDate} · Logged: ${date}`
      : `Watched & logged: ${date}`;

  const lines = [
    year ? `${name} (${year})` : name,
    rating ? `Rating: ${rating} / 5` : null,
    rewatch.toLowerCase() === "yes" ? "Rewatch" : null,
    datesLine,
  ].filter((x): x is string => Boolean(x));

  const contentText = lines.join("\n");
  const tagPieces = [...parseTagsCell(tagsCell), "letterboxd", "diary"];

  const ratingWidget = letterboxdRatingToStarWidget(rating);
  const widgets = ratingWidget ? [ratingWidget] : undefined;

  return {
    contentText,
    contentJson: plainTextToTipTapDoc(contentText),
    url: uri,
    linkPreview: null,
    tags: tagsFromStrings(tagPieces),
    createdAt: utcMidnightFromYmd(date),
    ...(widgets ? { widgets } : {}),
    importMeta: {
      source: LETTERBOXD_DIARY_SOURCE,
      externalId: `${uri}|${date}`,
    },
  };
}

export function parseLetterboxdDiaryCsv(text: string): EntryImportDraft[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    return [];
  }
  const headerRow = rows[0]!;
  const col = headerIndexMap(headerRow);

  for (const h of REQUIRED_HEADERS) {
    if (col[h] === undefined) {
      throw new Error(`Missing required column: ${h}`);
    }
  }

  const drafts: EntryImportDraft[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    if (cells.every((c) => !c || !c.trim())) continue;

    const row: Record<string, string> = {};
    for (const h of REQUIRED_HEADERS) {
      const i = col[h]!;
      row[h] = cells[i] ?? "";
    }
    drafts.push(buildDraft(row));
  }
  return drafts;
}
