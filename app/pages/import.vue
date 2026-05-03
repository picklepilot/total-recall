<script setup lang="ts">
import type { EntryImportDraft } from '~~/shared/import/types'
import type { ImportDraftsResult } from '@/composables/useEntries'
import { fileImportAdapters, getFileImportAdapter } from '@/lib/import/registry'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const firebaseConfigured = useFirebaseUiReady()
const { signedIn } = useAuth()
const { ready, importDrafts } = useEntries()

const selectedAdapterId = ref(fileImportAdapters[0]?.id ?? '')
const parseError = ref('')
const drafts = ref<EntryImportDraft[]>([])
const fileLabel = ref('')
const dryRun = ref(false)
const importing = ref(false)
const progress = ref({ current: 0, total: 0 })
const lastResult = ref<ImportDraftsResult | null>(null)

const previewLimit = 20
const previewRows = computed(() => drafts.value.slice(0, previewLimit))
const previewShowsWidgets = computed(() => previewRows.value.some((d) => d.widgets?.length))

const selectedAdapter = computed(() => getFileImportAdapter(selectedAdapterId.value))

function formatDraftDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsText(file)
  })
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  parseError.value = ''
  drafts.value = []
  lastResult.value = null
  fileLabel.value = ''

  if (!file) return

  const maxBytes = 15 * 1024 * 1024
  if (file.size > maxBytes) {
    parseError.value = 'File is too large (max 15 MB).'
    return
  }

  const adapter = selectedAdapter.value
  if (!adapter) {
    parseError.value = 'No import source selected.'
    return
  }

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (adapter.fileExtensions.length && !adapter.fileExtensions.some((x) => ext === x.toLowerCase())) {
    parseError.value = `Expected a ${adapter.fileExtensions.join(' or ')} file.`
    return
  }

  fileLabel.value = file.name

  try {
    const text = await readFileAsText(file)
    drafts.value = await Promise.resolve(adapter.parseFile(text))
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : 'Could not parse file.'
  } finally {
    input.value = ''
  }
}

async function runImport() {
  if (!drafts.value.length || importing.value) return
  lastResult.value = null
  importing.value = true
  progress.value = { current: 0, total: drafts.value.length }
  try {
    const result = await importDrafts(drafts.value, {
      dryRun: dryRun.value,
      onProgress: (p) => {
        progress.value = p
      },
    })
    lastResult.value = result
  } catch (e) {
    lastResult.value = {
      imported: 0,
      skippedDuplicate: 0,
      failed: drafts.value.length,
      errors: [{ index: -1, message: e instanceof Error ? e.message : String(e) }],
      dryRun: dryRun.value,
    }
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="space-y-10 pb-24">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Import</h1>
      <p class="text-sm text-muted-foreground leading-relaxed">
        Backfill your log from an exported file. Each row becomes one entry with the original diary date.
        Duplicates from a previous import of the same source are skipped automatically.
        Use a dry run to see counts without writing anything.
      </p>
    </div>

    <Card v-if="!firebaseConfigured" class="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle class="text-base">Connect Firebase</CardTitle>
        <CardDescription> Import needs Firestore to save entries. </CardDescription>
      </CardHeader>
    </Card>

    <Card v-else-if="!signedIn" class="border-border/80 bg-muted/30">
      <CardHeader>
        <CardTitle class="text-base">Sign in</CardTitle>
        <CardDescription> Sign in with Google in the header to import. </CardDescription>
      </CardHeader>
    </Card>

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Source</CardTitle>
          <CardDescription>
            Choose where the file came from. More sources can be added over time.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="import-adapter">Format</Label>
            <select
              id="import-adapter"
              v-model="selectedAdapterId"
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :disabled="importing"
            >
              <option v-for="a in fileImportAdapters" :key="a.id" :value="a.id">
                {{ a.label }}
              </option>
            </select>
            <p v-if="selectedAdapter?.description" class="text-xs text-muted-foreground">
              {{ selectedAdapter.description }}
            </p>
            <p
              v-if="selectedAdapter?.widgetsGenerated?.length"
              class="text-xs text-muted-foreground"
            >
              Includes widgets when the file has matching columns:
              <span class="font-medium text-foreground">{{
                selectedAdapter.widgetsGenerated.join(', ')
              }}</span>
            </p>
          </div>

          <div class="space-y-2">
            <Label for="import-file">File</Label>
            <input
              id="import-file"
              type="file"
              class="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
              :accept="selectedAdapter?.fileExtensions.join(',') ?? '.csv'"
              :disabled="!ready || importing"
              @change="onFileChange"
            />
            <p v-if="fileLabel" class="text-xs text-muted-foreground">Loaded: {{ fileLabel }}</p>
          </div>

          <p v-if="parseError" class="text-sm text-destructive">{{ parseError }}</p>
          <p v-else-if="drafts.length" class="text-sm text-muted-foreground">
            {{ drafts.length }} row(s) ready to import.
          </p>
        </CardContent>
      </Card>

      <Card v-if="previewRows.length">
        <CardHeader>
          <CardTitle class="text-base">Preview (first {{ previewLimit }})</CardTitle>
        </CardHeader>
        <CardContent class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[110px]">Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead v-if="previewShowsWidgets" class="w-[140px]">Widgets</TableHead>
                <TableHead class="min-w-[140px]">Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, idx) in previewRows" :key="idx">
                <TableCell class="whitespace-nowrap text-muted-foreground">
                  {{ formatDraftDate(row.createdAt) }}
                </TableCell>
                <TableCell class="max-w-[320px]">
                  <p class="line-clamp-3 whitespace-pre-wrap text-sm">
                    {{ row.contentText }}
                  </p>
                </TableCell>
                <TableCell v-if="previewShowsWidgets" class="text-sm text-muted-foreground">
                  <template v-if="row.widgets?.length">
                    <span v-for="(w, wi) in row.widgets" :key="wi" class="block">
                      <template v-if="w.type === 'starRating'">{{ w.value }}★</template>
                      <template v-else>{{ w.type }}</template>
                    </span>
                  </template>
                  <span v-else>—</span>
                </TableCell>
                <TableCell>
                  <span v-for="t in row.tags.slice(0, 4)" :key="t" class="mr-1 inline-block">
                    <Badge variant="secondary" class="font-normal">{{ t }}</Badge>
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <label
          class="flex cursor-pointer items-center gap-2 text-sm text-foreground"
          :class="importing ? 'pointer-events-none opacity-60' : ''"
        >
          <input
            v-model="dryRun"
            type="checkbox"
            class="size-4 rounded border-input accent-primary"
            :disabled="importing"
          />
          Dry run (check duplicates only, no saves)
        </label>
        <div class="flex flex-wrap items-center gap-3">
          <Button :disabled="!drafts.length || !ready || importing" @click="runImport">
            {{
              importing
                ? dryRun
                  ? 'Dry run…'
                  : 'Importing…'
                : dryRun
                  ? 'Run dry run'
                  : 'Import all'
            }}
          </Button>
          <span v-if="importing" class="text-sm text-muted-foreground">
            {{ progress.current }} / {{ progress.total }}
          </span>
        </div>
      </div>

      <Card v-if="lastResult" class="border-border/80">
        <CardHeader>
          <CardTitle class="text-base">{{ lastResult.dryRun ? 'Dry run result' : 'Result' }}</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2 text-sm">
          <p>
            <template v-if="lastResult.dryRun">Would import:</template>
            <template v-else>Imported:</template>
            <span class="font-medium text-foreground">{{ lastResult.imported }}</span>
            ·
            <template v-if="lastResult.dryRun">Would skip (already imported):</template>
            <template v-else>Skipped (already imported):</template>
            <span class="font-medium text-foreground">{{ lastResult.skippedDuplicate }}</span>
            ·
            <template v-if="lastResult.dryRun">Would fail:</template>
            <template v-else>Failed:</template>
            <span class="font-medium text-foreground">{{ lastResult.failed }}</span>
          </p>
          <p v-if="lastResult.dryRun" class="text-muted-foreground">
            Uncheck dry run and choose Import all to write these entries.
          </p>
          <ul v-if="lastResult.errors.length" class="list-inside list-disc text-destructive">
            <li v-for="(err, i) in lastResult.errors.slice(0, 8)" :key="i">
              <template v-if="err.index >= 0">Row {{ err.index + 1 }}:</template>
              {{ err.message }}
            </li>
          </ul>
          <p v-if="!lastResult.dryRun && lastResult.imported > 0" class="text-muted-foreground">
            View them on the
            <NuxtLink to="/timeline" class="font-medium text-primary underline-offset-4 hover:underline">
              Timeline
            </NuxtLink>
            .
          </p>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
