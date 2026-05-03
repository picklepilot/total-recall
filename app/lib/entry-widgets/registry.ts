import type { Component } from 'vue'
import type { EntryWidget } from '@/types/entry'
import StarRatingWidgetView from '@/components/entry-widgets/StarRatingWidgetView.vue'

/**
 * Map widget `type` → read-only view. To add a kind: extend `EntryWidget`, create a component,
 * and register it here.
 */
export const entryWidgetViews: Record<EntryWidget['type'], Component> = {
  starRating: StarRatingWidgetView,
}
