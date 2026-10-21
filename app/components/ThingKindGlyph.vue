<script setup lang="ts">
import {
  BookOpen,
  Box,
  Car,
  Clapperboard,
  MapPin,
  UserRound,
  Wrench,
} from "lucide-vue-next";

const props = defineProps<{
  kind: string;
  iconClass?: string;
}>();

const icon = computed(() => {
  switch (props.kind) {
    case "book":
      return BookOpen;
    case "movie":
      return Clapperboard;
    case "person":
      return UserRound;
    case "place":
      return MapPin;
    case "tool":
      return Wrench;
    case "vehicle":
      return Car;
    default:
      return Box;
  }
});
</script>

<template>
  <component :is="icon" :class="iconClass" aria-hidden="true" />
</template>
