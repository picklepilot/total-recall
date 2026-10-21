<script setup lang="ts">
import { Plus, X } from "lucide-vue-next";
import type { ThingField, ThingFieldType } from "~~/shared/thingKinds";
import { THING_FIELD_TYPES } from "~~/shared/thingKinds";

const props = defineProps<{
  fields: ThingField[];
}>();

const emit = defineEmits<{
  "update:fields": [fields: ThingField[]];
  edit: [];
}>();

const typeLabels: Record<ThingFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  url: "Link",
};

function commit(next: ThingField[]) {
  emit("update:fields", next);
  emit("edit");
}

function patch(id: string, partial: Partial<ThingField>) {
  commit(props.fields.map((field) => (field.id === id ? { ...field, ...partial } : field)));
}

function remove(id: string) {
  commit(props.fields.filter((field) => field.id !== id));
}

function addField() {
  const id = crypto.randomUUID();
  emit("update:fields", [
    ...props.fields,
    { id, label: "", type: "text", value: "" },
  ]);
  nextTick(() => document.getElementById(`thing-field-${id}`)?.focus());
}

function inputType(type: ThingFieldType) {
  if (type === "number") return "number";
  if (type === "date") return "date";
  if (type === "url") return "url";
  return "text";
}
</script>

<template>
  <div>
    <div
      v-if="fields.length"
      class="divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card/70 dark:divide-white/[0.06] dark:border-white/10 dark:bg-white/[0.04]"
    >
      <div v-for="field in fields" :key="field.id" class="px-3.5 py-3 sm:px-4">
        <div class="flex items-center gap-2">
          <input
            :id="`thing-field-${field.id}`"
            :value="field.label"
            placeholder="Label"
            class="min-w-0 flex-1 bg-transparent text-xs font-medium tracking-wide text-muted-foreground uppercase outline-none placeholder:normal-case placeholder:tracking-normal"
            @input="patch(field.id, { label: ($event.target as HTMLInputElement).value })"
          />
          <select
            :value="field.type"
            class="h-7 rounded-full bg-transparent px-1 text-xs text-muted-foreground outline-none"
            :aria-label="`Type for ${field.label || 'field'}`"
            @change="patch(field.id, { type: ($event.target as HTMLSelectElement).value as ThingFieldType })"
          >
            <option v-for="type in THING_FIELD_TYPES" :key="type" :value="type">
              {{ typeLabels[type] }}
            </option>
          </select>
          <button
            type="button"
            class="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            :aria-label="`Remove ${field.label || 'field'}`"
            @click="remove(field.id)"
          >
            <X class="size-3.5" />
          </button>
        </div>
        <input
          :value="field.value"
          :type="inputType(field.type)"
          :placeholder="field.label ? field.label : 'Value'"
          class="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          @input="patch(field.id, { value: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </div>
    <button
      type="button"
      class="mt-3 inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      @click="addField"
    >
      <Plus class="size-4" aria-hidden="true" />
      Add field
    </button>
  </div>
</template>
