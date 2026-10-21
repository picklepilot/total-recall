<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-vue-next";
import { createYear, createYearRange } from "reka-ui/date";
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
} from "reka-ui";
import { cn } from "@/lib/utils";
import { parseThingDate } from "~~/shared/thingDate";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    /** Larger type and targets for the phone sheet. */
    sheet?: boolean;
  }>(),
  { sheet: false },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

const selected = computed(() => parseThingDate(props.modelValue) ?? undefined);
const placeholder = ref<DateValue>(selected.value ?? today(getLocalTimeZone()));

const months = computed(() => createYear({ dateObj: placeholder.value }));
const years = computed(() => {
  const year = placeholder.value.year;
  return createYearRange({
    start: new CalendarDate(Math.min(1900, year), 1, 1),
    end: new CalendarDate(Math.max(2100, year), 12, 31),
  });
});

const pickerClass = computed(() =>
  cn(
    "relative flex min-w-0 items-center justify-center gap-1 rounded-full hover:bg-foreground/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
    props.sheet ? "h-11" : "h-9",
  ),
);

const navClass = computed(() =>
  cn(
    "grid shrink-0 place-items-center rounded-full text-foreground/70 hover:bg-foreground/5 hover:text-foreground disabled:opacity-30",
    props.sheet ? "size-11" : "size-9",
  ),
);

const dayClass =
  "mx-auto grid size-[clamp(2.25rem,calc((100cqw-1rem)/7),2.75rem)] shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full text-sm tabular-nums transition-colors outline-none select-none hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:active:scale-100 data-selected:bg-foreground data-selected:text-background data-selected:hover:bg-foreground [&[data-today]:not([data-selected])]:font-semibold [&[data-today]:not([data-selected])]:ring-1 [&[data-today]:not([data-selected])]:ring-foreground/30 data-[outside-view]:font-normal data-[outside-view]:text-muted-foreground/45 data-disabled:pointer-events-none data-disabled:opacity-30";

function monthLabel(month: number) {
  return monthFormatter.format(new Date(2020, month - 1, 1));
}

function onMonth(event: Event) {
  const month = Number((event.target as HTMLSelectElement).value);
  if (!Number.isInteger(month) || month < 1) return;
  placeholder.value = placeholder.value.set({ month });
}

function onYear(event: Event) {
  const year = Number((event.target as HTMLSelectElement).value);
  if (!Number.isInteger(year)) return;
  placeholder.value = placeholder.value.set({ year });
}

function onSelect(value: DateValue | DateValue[] | null | undefined) {
  if (!value || Array.isArray(value)) return;
  emit("update:modelValue", value.toString());
}

function pickToday() {
  emit("update:modelValue", today(getLocalTimeZone()).toString());
}

function clear() {
  emit("update:modelValue", "");
}
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    :model-value="selected"
    v-model:placeholder="placeholder"
    locale="en-US"
    weekday-format="narrow"
    :fixed-weeks="true"
    :prevent-deselect="true"
    :initial-focus="!sheet"
    calendar-label="Choose a date"
    class="@container w-full"
    @update:model-value="onSelect"
  >
    <div class="flex items-center gap-1">
      <CalendarPrev :class="navClass">
        <ChevronLeft class="size-4" aria-hidden="true" />
      </CalendarPrev>
      <div class="flex min-w-0 flex-1 items-center justify-center gap-1">
        <label :class="cn(pickerClass, 'flex-1 px-2')">
          <span class="truncate text-sm font-medium">
            {{ monthLabel(placeholder.month) }}
          </span>
          <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <select
            class="absolute inset-0 cursor-pointer text-base opacity-0 outline-none"
            :value="placeholder.month"
            aria-label="Month"
            @change="onMonth"
          >
            <option v-for="month in months" :key="month.month" :value="month.month">
              {{ monthLabel(month.month) }}
            </option>
          </select>
        </label>
        <label :class="cn(pickerClass, 'shrink-0 px-2.5')">
          <span class="text-sm font-medium tabular-nums">{{ placeholder.year }}</span>
          <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <select
            class="absolute inset-0 cursor-pointer text-base opacity-0 outline-none"
            :value="placeholder.year"
            aria-label="Year"
            @change="onYear"
          >
            <option v-for="year in years" :key="year.year" :value="year.year">
              {{ year.year }}
            </option>
          </select>
        </label>
      </div>
      <CalendarNext :class="navClass">
        <ChevronRight class="size-4" aria-hidden="true" />
      </CalendarNext>
    </div>

    <CalendarGrid
      v-for="month in grid"
      :key="month.value.toString()"
      class="mt-3 w-full border-collapse"
    >
      <CalendarGridHead>
        <CalendarGridRow class="flex w-full">
          <CalendarHeadCell
            v-for="(day, dayIndex) in weekDays"
            :key="dayIndex"
            class="min-w-0 flex-1 pb-1 text-center text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {{ day }}
          </CalendarHeadCell>
        </CalendarGridRow>
      </CalendarGridHead>
      <CalendarGridBody>
        <CalendarGridRow
          v-for="(week, weekIndex) in month.rows"
          :key="week[0]?.toString() ?? weekIndex"
          class="mt-0.5 flex w-full"
        >
          <CalendarCell
            v-for="day in week"
            :key="day.toString()"
            :date="day"
            class="flex min-w-0 flex-1 items-center justify-center py-0.5"
          >
            <CalendarCellTrigger :day="day" :month="month.value" :class="dayClass" />
          </CalendarCell>
        </CalendarGridRow>
      </CalendarGridBody>
    </CalendarGrid>

    <div class="mt-2 flex items-center justify-between gap-2 border-t border-foreground/[0.06] pt-2 dark:border-white/10">
      <button
        type="button"
        :class="
          cn(
            'touch-manipulation rounded-full font-medium hover:bg-foreground/5',
            sheet ? 'h-11 px-3 text-base' : 'h-8 px-2.5 text-sm',
          )
        "
        @click="pickToday"
      >
        Today
      </button>
      <button
        v-if="modelValue.trim()"
        type="button"
        :class="
          cn(
            'touch-manipulation rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
            sheet ? 'h-11 px-3 text-base' : 'h-8 px-2.5 text-sm',
          )
        "
        @click="clear"
      >
        Clear
      </button>
    </div>
  </CalendarRoot>
</template>
