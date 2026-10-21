<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { Calendar, X } from "lucide-vue-next";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui";
import { formatThingDate } from "~~/shared/thingDate";

const props = defineProps<{
  modelValue: string;
  label?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const open = ref(false);
const narrow = useMediaQuery("(max-width: 639px), (max-height: 500px)");
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

/** Phone, and short landscape viewports, get a bottom sheet. Wider screens get a popover. */
const sheet = computed(() => mounted.value && narrow.value);

const display = computed(() => formatThingDate(props.modelValue));
const longDisplay = computed(() => formatThingDate(props.modelValue, "long"));
const hasValue = computed(() => props.modelValue.trim().length > 0);
const fieldName = computed(() => props.label?.trim() || "Date");
const triggerLabel = computed(() =>
  display.value ? `${fieldName.value}: ${display.value}` : "Choose a date",
);

function setOpen(value: boolean) {
  open.value = value;
}

function onValue(value: string) {
  emit("update:modelValue", value);
  open.value = false;
}

function clear() {
  emit("update:modelValue", "");
  open.value = false;
}

function keepSheetFocus(event: Event) {
  event.preventDefault();
}
</script>

<template>
  <component
    :is="sheet ? DialogRoot : PopoverRoot"
    :open="open"
    @update:open="setOpen"
  >
    <div class="mt-1 flex items-center gap-1">
      <component :is="sheet ? DialogTrigger : PopoverTrigger" as-child>
        <button
          type="button"
          class="flex min-h-11 min-w-0 flex-1 touch-manipulation items-center gap-2 rounded-lg px-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring data-open:bg-foreground/[0.04] sm:min-h-9"
          :aria-label="triggerLabel"
        >
          <span
            class="min-w-0 flex-1 truncate"
            :class="display ? 'text-foreground' : 'text-muted-foreground'"
          >
            {{ display || "Choose a date" }}
          </span>
          <Calendar class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </component>
      <button
        v-if="hasValue"
        type="button"
        class="grid size-11 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground sm:size-8"
        :aria-label="`Clear ${fieldName}`"
        @click="clear"
      >
        <X class="size-3.5" />
      </button>
    </div>

    <PopoverPortal v-if="!sheet">
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="8"
        :collision-padding="12"
        class="z-50 w-[19.5rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-foreground/[0.08] bg-popover p-3 text-popover-foreground shadow-lg outline-none duration-150 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 motion-reduce:animate-none"
      >
        <ThingDateCalendar :model-value="modelValue" @update:model-value="onValue" />
      </PopoverContent>
    </PopoverPortal>

    <DialogPortal v-else>
      <DialogOverlay
        class="fixed inset-0 z-[60] bg-black/45 duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 motion-reduce:animate-none dark:bg-black/70"
      />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-[70] max-h-[min(85dvh,40rem)] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-foreground/10 bg-popover pt-4 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] text-popover-foreground shadow-2xl outline-none duration-300 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom motion-reduce:animate-none"
        @open-auto-focus="keepSheetFocus"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <div class="min-w-0 pt-1">
            <DialogTitle class="text-base font-semibold tracking-tight">
              {{ fieldName }}
            </DialogTitle>
            <p v-if="longDisplay" class="mt-0.5 text-sm text-muted-foreground">
              {{ longDisplay }}
            </p>
            <DialogDescription class="sr-only">
              Choose a month, year, and day.
            </DialogDescription>
          </div>
          <DialogClose
            class="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            aria-label="Close"
          >
            <X class="size-4" />
          </DialogClose>
        </div>
        <ThingDateCalendar
          sheet
          :model-value="modelValue"
          @update:model-value="onValue"
        />
      </DialogContent>
    </DialogPortal>
  </component>
</template>
