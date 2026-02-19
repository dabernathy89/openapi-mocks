<script setup lang="ts">
import { ref, watch } from 'vue';
import type { HandlerInfo, FetchResult } from './types';

const props = defineProps<{
  route: HandlerInfo;
  expanded: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const fetchResult = ref<FetchResult | null>(null);
const fetchError = ref<string | null>(null);
const fetching = ref(false);

function methodClass(method: string) {
  const m = method.toUpperCase();
  return `method-badge method-${m}`;
}

function statusClass(status: number): string {
  if (status >= 500) return 'status-5xx';
  if (status >= 400) return 'status-4xx';
  if (status >= 300) return 'status-3xx';
  return 'status-2xx';
}

function exampleUrl(path: string): string {
  // Substitute path params: param containing "id" (case-insensitive) → "1", others → "example"
  return path.replace(/:([^/]+)/g, (_match, param: string) => {
    return /id/i.test(param) ? '1' : 'example';
  });
}

async function doFetch() {
  fetchResult.value = null;
  fetchError.value = null;
  fetching.value = true;
  const url = 'http://playground.local' + exampleUrl(props.route.path);
  const start = performance.now();
  try {
    const response = await fetch(url, { method: props.route.method });
    const durationMs = Math.round(performance.now() - start);
    const contentType = response.headers.get('content-type');
    let body: unknown = null;
    if (response.status !== 204 && contentType && contentType.includes('application/json')) {
      body = await response.json();
    }
    fetchResult.value = {
      status: response.status,
      contentType,
      body,
      durationMs,
    };
  } catch (err) {
    fetchError.value = err instanceof Error ? err.message : String(err);
  } finally {
    fetching.value = false;
  }
}

// When row becomes expanded, fire a fresh fetch each time
watch(
  () => props.expanded,
  (expanded) => {
    if (expanded) {
      doFetch();
    }
  }
);
</script>

<template>
  <div class="handler-row">
    <button
      class="row-header"
      :aria-expanded="expanded"
      @click="emit('toggle')"
    >
      <span :class="methodClass(route.method)">{{ route.method.toUpperCase() }}</span>
      <span class="path">{{ route.path }}</span>
      <span class="chevron" :class="{ open: expanded }">▶</span>
    </button>

    <div v-if="expanded" class="row-body">
      <div v-if="fetching" class="fetch-loading">
        <span class="spinner" aria-label="Loading" /> Fetching…
      </div>
      <div v-else-if="fetchError" class="fetch-error">
        <strong>Network error:</strong> {{ fetchError }}
      </div>
      <div v-else-if="fetchResult" class="fetch-result">
        <div class="result-meta">
          <span class="status-code" :class="statusClass(fetchResult.status)">{{ fetchResult.status }}</span>
          <span v-if="fetchResult.contentType" class="content-type">{{ fetchResult.contentType }}</span>
          <span class="duration">{{ fetchResult.durationMs }}ms</span>
        </div>
        <div v-if="fetchResult.status === 204" class="no-content">204 No Content</div>
        <pre v-else-if="fetchResult.body !== null" class="response-body">{{ JSON.stringify(fetchResult.body, null, 2) }}</pre>
        <div v-else class="no-content">No body</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.handler-row {
  border-bottom: 1px solid var(--sl-color-gray-6, #333);
}

.row-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font-family: var(--sl-font-mono, monospace);
  font-size: 0.8125rem;
}

.row-header:hover {
  background: var(--sl-color-gray-7, #1e1e1e);
}

.method-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  min-width: 4rem;
  text-align: center;
  flex-shrink: 0;
}

.method-GET    { background: #166534; color: #86efac; }
.method-POST   { background: #1e3a5f; color: #93c5fd; }
.method-PUT    { background: #713f12; color: #fde68a; }
.method-PATCH  { background: #581c87; color: #d8b4fe; }
.method-DELETE { background: #7f1d1d; color: #fca5a5; }
.method-HEAD   { background: #164e63; color: #67e8f9; }
.method-OPTIONS{ background: #374151; color: #d1d5db; }

.path {
  flex: 1;
  color: var(--sl-color-white, #e5e7eb);
}

.chevron {
  font-size: 0.625rem;
  color: var(--sl-color-gray-3, #888);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(90deg);
}

.row-body {
  padding: 0.75rem 1rem;
  background: var(--sl-color-gray-7, #111);
  border-top: 1px solid var(--sl-color-gray-6, #333);
  font-family: var(--sl-font-mono, monospace);
  font-size: 0.8125rem;
}

.fetch-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--sl-color-gray-3, #888);
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

.fetch-error {
  color: var(--sl-color-red, #f87171);
}

.fetch-result {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.status-code {
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.status-2xx { background: #166534; color: #86efac; }
.status-3xx { background: #1e3a5f; color: #93c5fd; }
.status-4xx { background: #713f12; color: #fde68a; }
.status-5xx { background: #7f1d1d; color: #fca5a5; }

.content-type {
  color: var(--sl-color-gray-3, #888);
}

.duration {
  color: var(--sl-color-gray-3, #888);
  margin-left: auto;
}

.response-body {
  margin: 0;
  padding: 0.5rem;
  background: var(--sl-color-gray-6, #1a1a1a);
  border-radius: 4px;
  overflow: auto;
  max-height: 300px;
  white-space: pre;
  font-size: 0.75rem;
  color: var(--sl-color-white, #e5e7eb);
}

.no-content {
  color: var(--sl-color-gray-3, #888);
  font-style: italic;
}
</style>
