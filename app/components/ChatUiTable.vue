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
  <div class="my-5 overflow-hidden rounded-xl border border-border/70 bg-muted/20 shadow-sm">
    <Table class="min-w-full table-fixed sm:table-auto">
      <TableCaption v-if="block.title" class="caption-top border-b border-border/60 bg-muted/30 px-4 py-3 text-left text-sm font-medium text-foreground">
        {{ block.title }}
      </TableCaption>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead
            v-for="col in block.columns"
            :key="col.key"
            class="whitespace-normal text-xs uppercase tracking-wide text-muted-foreground"
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
            class="whitespace-normal text-[15px] text-foreground"
          >
            {{ formatCell(row[col.key] ?? null) }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
