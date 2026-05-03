import type { FileImportAdapter } from '~~/shared/import/types'
import { letterboxdDiaryCsvAdapter } from './adapters/letterboxd-diary-csv'

export const fileImportAdapters: FileImportAdapter[] = [letterboxdDiaryCsvAdapter]

export function getFileImportAdapter(id: string): FileImportAdapter | undefined {
  return fileImportAdapters.find((a) => a.id === id)
}
