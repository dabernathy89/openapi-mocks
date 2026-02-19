<script setup lang="ts">
import type { HandlerInfo } from './types';
import HandlerRow from './HandlerRow.vue';

defineProps<{ routes: HandlerInfo[] }>();
</script>

<template>
  <div class="handler-accordion">
    <h3>Live Handlers</h3>
    <HandlerRow v-for="route in routes" :key="route.method + route.path" :route="route" />
    <p v-if="routes.length === 0">No handlers returned.</p>
  </div>
</template>
