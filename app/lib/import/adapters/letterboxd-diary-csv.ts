import type { FileImportAdapter } from '~~/shared/import/types'
import {
  LETTERBOXD_DIARY_SOURCE,
  parseLetterboxdDiaryCsv,
} from '~~/shared/import/adapters/letterboxd-diary'

export { LETTERBOXD_DIARY_SOURCE, parseLetterboxdDiaryCsv }

export const letterboxdDiaryCsvAdapter: FileImportAdapter = {
  id: LETTERBOXD_DIARY_SOURCE,
  label: 'Letterboxd diary',
  kind: 'file',
  description:
    'Upload diary.csv from your Letterboxd export zip (Settings → Export your data).',
  widgetsGenerated: ['starRating'],
  fileExtensions: ['.csv'],
  mimeTypes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  parseFile: parseLetterboxdDiaryCsv,
}
