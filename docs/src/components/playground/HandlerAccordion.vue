<script setup lang="ts">
import type { HandlerInfo } from './types';
import HandlerRow from './HandlerRow.vue';

defineProps<{
  routes: HandlerInfo[];
  evalStatus?: 'idle' | 'pending' | 'ok' | 'error';
  evalError?: string | null;
}>();
</script>

<template>
  <div class="handler-accordion">
    <h3>Live Handlers</h3>
    <div v-if="evalStatus === 'pending'" class="loading">Loading…</div>
    <div v-else-if="evalStatus === 'error' && evalError" class="eval-error">
      <strong>Error:</strong> {{ evalError }}
    </div>
    <template v-else>
      <HandlerRow v-for="route in routes" :key="route.method + route.path" :route="route" />
      <p v-if="routes.length === 0 && evalStatus === 'ok'">No handlers returned.</p>
    </template>
  </div>
</template>
