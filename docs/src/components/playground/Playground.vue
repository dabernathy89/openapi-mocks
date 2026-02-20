<script setup lang="ts">
import SpecEditor from './SpecEditor.vue';
import CodeEditor from './CodeEditor.vue';
import HandlerAccordion from './HandlerAccordion.vue';
import { usePlayground } from './usePlayground';

const { specText, codeText, routes, evalStatus, evalError } = usePlayground();
</script>

<template>
  <div class="playground">
    <div class="left-column">
      <div class="top-pane">
        <SpecEditor v-model="specText" />
      </div>
      <div class="bottom-pane">
        <CodeEditor v-model="codeText" />
      </div>
    </div>
    <div class="right-column">
      <HandlerAccordion :routes="routes" :eval-status="evalStatus" :eval-error="evalError" />
    </div>
  </div>
</template>

<style scoped>
.playground {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: calc(100vh - 3.5rem);
  gap: 0;
}

.left-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-left: 1rem;
}

.top-pane {
  min-height: 0;
  overflow: hidden;
  resize: vertical;
  height: 50%;
}

.bottom-pane {
  min-height: 0;
  overflow: hidden;
  flex: 1;
}

.right-column {
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}
</style>
