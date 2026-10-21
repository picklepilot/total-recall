<script setup lang="ts">
import { Loader2, Trash2 } from "lucide-vue-next";
import { onClickOutside, useEventListener } from "@vueuse/core";

const ACTION_WIDTH = 80;
const LOCK_DISTANCE = 8;
const FLICK_PX_PER_MS = 0.55;

const props = withDefaults(
  defineProps<{
    open: boolean;
    deleteLabel: string;
    busy?: boolean;
  }>(),
  { busy: false },
);

const emit = defineEmits<{
  "update:open": [open: boolean];
  delete: [];
}>();

const root = ref<HTMLElement | null>(null);
const offset = ref(0);
const dragging = ref(false);
/** Closed rows have no transform, so the action can't bleed a composited pixel. */
const settledClosed = ref(true);
/** True while the action is moving or open, so the resting clip stays off. */
const revealing = ref(false);

let tracking = false;
let activePointer = -1;
let axis: "x" | "y" | null = null;
let startX = 0;
let startY = 0;
let startOffset = 0;
let lastX = 0;
let lastTime = 0;
let velocity = 0;
let swallowClick = false;
let swallowTimer: ReturnType<typeof setTimeout> | undefined;
let restTimer: ReturnType<typeof setTimeout> | undefined;

const rowStyle = computed(() => {
  if (settledClosed.value) return undefined;
  return { transform: `translate3d(${offset.value}px, 0, 0)` };
});

const clipClosed = computed(() => !props.open && !revealing.value);

const iconStyle = computed(() => {
  const progress = Math.min(1, Math.max(0, -offset.value / ACTION_WIDTH));
  return {
    transform: `scale(${0.6 + progress * 0.4})`,
    opacity: String(0.35 + progress * 0.65),
  };
});

watch(
  () => props.open,
  (isOpen) => {
    if (tracking) return;
    if (isOpen) {
      settledClosed.value = false;
      revealing.value = true;
      offset.value = -ACTION_WIDTH;
      return;
    }
    offset.value = 0;
    if (motionReduced()) restClosed();
    else scheduleRest();
  },
);

onClickOutside(root, () => {
  if (!props.open || props.busy || tracking) return;
  emit("update:open", false);
});

useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key !== "Escape" || !props.open || props.busy || tracking) return;
  emit("update:open", false);
});

onScopeDispose(() => {
  clearTimeout(swallowTimer);
  clearTimeout(restTimer);
});

function motionReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function restClosed() {
  clearTimeout(restTimer);
  if (dragging.value || props.open || offset.value !== 0) return;
  revealing.value = false;
  settledClosed.value = true;
}

function scheduleRest() {
  clearTimeout(restTimer);
  restTimer = setTimeout(restClosed, 400);
}

function onTrackTransitionEnd(event: TransitionEvent) {
  if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
  restClosed();
}

function resist(distance: number) {
  const limit = 40;
  return (distance * limit) / (distance + limit);
}

function rubber(value: number) {
  if (value > 0) return resist(value);
  if (value < -ACTION_WIDTH) return -ACTION_WIDTH - resist(-value - ACTION_WIDTH);
  return value;
}

function settledOpen(x: number, vx: number) {
  if (vx <= -FLICK_PX_PER_MS) return true;
  if (vx >= FLICK_PX_PER_MS) return false;
  return x <= -ACTION_WIDTH * 0.5;
}

function readTranslateX(el: HTMLElement) {
  const value = getComputedStyle(el).transform;
  if (!value || value === "none") return 0;
  const x = new DOMMatrixReadOnly(value).m41;
  if (Math.abs(x) < 0.5) return 0;
  if (Math.abs(x + ACTION_WIDTH) < 0.5) return -ACTION_WIDTH;
  return x;
}

function armSwallow() {
  swallowClick = true;
  clearTimeout(swallowTimer);
  swallowTimer = setTimeout(() => {
    swallowClick = false;
  }, 400);
}

function takeSwallow() {
  if (!swallowClick) return false;
  swallowClick = false;
  clearTimeout(swallowTimer);
  return true;
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || props.busy || tracking) return;
  const el = event.currentTarget as HTMLElement;
  swallowClick = false;
  tracking = true;
  activePointer = event.pointerId;
  axis = null;
  startX = event.clientX;
  startY = event.clientY;
  if (settledClosed.value) {
    startOffset = 0;
  } else {
    startOffset = readTranslateX(el);
    offset.value = startOffset;
    dragging.value = true;
    clearTimeout(restTimer);
  }
  lastX = event.clientX;
  lastTime = event.timeStamp;
  velocity = 0;
}

function onPointerMove(event: PointerEvent) {
  if (!tracking || event.pointerId !== activePointer) return;
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  const dt = event.timeStamp - lastTime;
  if (dt >= 12) {
    velocity = (event.clientX - lastX) / dt;
    lastX = event.clientX;
    lastTime = event.timeStamp;
  }

  if (!axis) {
    if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return;
    axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (axis === "y") {
      dragging.value = false;
      offset.value = props.open ? -ACTION_WIDTH : 0;
      if (!props.open) scheduleRest();
      return;
    }
    settledClosed.value = false;
    revealing.value = true;
    dragging.value = true;
    const el = event.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* The pointer can already be gone if the browser took the gesture. */
    }
  }

  if (axis !== "x") return;
  event.preventDefault();
  offset.value = rubber(startOffset + dx);
}

function endGesture(event: PointerEvent, commit: boolean) {
  if (!tracking || event.pointerId !== activePointer) return;
  const horizontal = axis === "x";
  const verticalTravel = Math.abs(event.clientY - startY);
  tracking = false;
  activePointer = -1;
  axis = null;

  const el = event.currentTarget as HTMLElement | null;
  try {
    if (el?.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
  } catch {
    /* Capture may already have been released. */
  }

  if (horizontal || verticalTravel > LOCK_DISTANCE) armSwallow();

  if (!commit || !horizontal) {
    dragging.value = false;
    offset.value = props.open ? -ACTION_WIDTH : 0;
    if (!props.open) {
      if (motionReduced() || settledClosed.value) restClosed();
      else scheduleRest();
    }
    return;
  }

  const vx = event.timeStamp - lastTime > 70 ? 0 : velocity;
  const open = settledOpen(offset.value, vx);
  settledClosed.value = false;
  revealing.value = true;
  offset.value = open ? -ACTION_WIDTH : 0;
  dragging.value = false;
  if (!open) {
    if (motionReduced()) restClosed();
    else scheduleRest();
  }
  if (open !== props.open) emit("update:open", open);
}

function onPointerUp(event: PointerEvent) {
  endGesture(event, true);
}

function onPointerCancel(event: PointerEvent) {
  endGesture(event, false);
}

function onTrackClick(event: MouseEvent) {
  if (!takeSwallow()) return;
  event.preventDefault();
  event.stopPropagation();
}

function onFaceClick(event: MouseEvent) {
  if (!props.open || event.detail === 0) return;
  event.preventDefault();
  event.stopPropagation();
  if (!props.busy) emit("update:open", false);
}

function onDeleteClick() {
  if (props.busy) return;
  emit("delete");
}
</script>

<template>
  <li
    ref="root"
    class="relative touch-pan-y border-b border-foreground/[0.06] last:border-b-0 dark:border-white/[0.06]"
    :class="{ 'select-none': dragging }"
    :data-state="open ? 'open' : 'closed'"
  >
    <div class="overflow-clip" :class="{ 'swipe-closed-clip': clipClosed }">
      <div
        class="swipe-track flex w-full"
        :class="{ 'is-dragging': dragging }"
        :style="rowStyle"
        @transitionend="onTrackTransitionEnd"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @click.capture="onTrackClick"
        @dragstart.prevent
      >
        <div class="w-full min-w-full shrink-0" @click.capture="onFaceClick">
          <slot />
        </div>
        <button
          type="button"
          class="flex shrink-0 touch-manipulation items-center justify-center bg-destructive text-white transition-opacity active:opacity-80 disabled:opacity-70"
          :style="{ width: `${ACTION_WIDTH}px` }"
          :aria-label="deleteLabel"
          :aria-busy="busy || undefined"
          :disabled="busy"
          :inert="!open"
          @click="onDeleteClick"
        >
          <Loader2 v-if="busy" class="size-5 animate-spin" aria-hidden="true" />
          <Trash2
            v-else
            class="size-5"
            :class="dragging ? 'transition-none' : 'transition duration-300 ease-out motion-reduce:transition-none'"
            :style="iconStyle"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.swipe-closed-clip {
  clip-path: inset(0 2px 0 0);
}

.swipe-track {
  transition: transform 320ms cubic-bezier(0.2, 0.85, 0.3, 1);
}

.swipe-track.is-dragging {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .swipe-track {
    transition: none;
  }
}
</style>
