<script setup lang="ts">
import type { ChatUiTableBlock } from '~~/shared/types/chat-ui'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

defineProps<{
  block: ChatUiTableBlock
}>()

function formatCell(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return '—'
  return String(v)
}
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.025] dark:border-white/[0.06] dark:bg-white/[0.04]">
    <Table class="min-w-full table-fixed sm:table-auto">
      <TableCaption v-if="block.title" class="caption-top border-b border-foreground/[0.06] px-4 py-3 text-left text-sm font-medium text-foreground dark:border-white/[0.06]">
        {{ block.title }}
      </TableCaption>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead
            v-for="col in block.columns"
            :key="col.key"
            class="whitespace-normal text-xs font-medium text-muted-foreground"
          >
            {{ col.label }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, ri) in block.rows" :key="ri">
          <TableCell
            v-for="col in block.columns"
            :key="col.key"
            class="whitespace-normal text-sm leading-relaxed text-foreground"
          >
            {{ formatCell(row[col.key] ?? null) }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
