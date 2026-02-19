<script setup lang="ts">
import { ref } from 'vue';
import type { HandlerInfo } from './types';
import HandlerRow from './HandlerRow.vue';

defineProps<{
  routes: HandlerInfo[];
  evalStatus?: 'idle' | 'pending' | 'ok' | 'error';
  evalError?: string | null;
}>();

const expandedKey = ref<string | null>(null);

function toggle(key: string) {
  expandedKey.value = expandedKey.value === key ? null : key;
}

function rowKey(route: HandlerInfo) {
  return route.method + ':' + route.path;
}
</script>

<template>
  <div class="handler-accordion">
    <h3 class="panel-label">Live Handlers</h3>

    <div v-if="evalStatus === 'pending'" class="loading">
      <span class="spinner" aria-label="Loading" /> Evaluating…
    </div>
    <div v-else-if="evalStatus === 'error' && evalError" class="eval-error">
      <strong>Error:</strong> <pre>{{ evalError }}</pre>
    </div>
    <template v-else>
      <p v-if="routes.length === 0 && evalStatus === 'ok'" class="empty">No handlers returned.</p>
      <HandlerRow
        v-for="route in routes"
        :key="rowKey(route)"
        :route="route"
        :expanded="expandedKey === rowKey(route)"
        @toggle="toggle(rowKey(route))"
      />
    </template>
  </div>
</template>

<style scoped>
.handler-accordion {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  font-family: var(--sl-font-mono, monospace);
}

.panel-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sl-color-gray-3, #888);
  margin: 0 0 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--sl-color-gray-6, #333);
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--sl-color-gray-3, #888);
  font-size: 0.875rem;
}

.spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.eval-error {
  padding: 1rem;
  color: var(--sl-color-red, #f87171);
  font-size: 0.8125rem;
}

.eval-error pre {
  margin: 0.25rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty {
  padding: 1rem;
  color: var(--sl-color-gray-3, #888);
  font-size: 0.875rem;
  margin: 0;
}
</style>
