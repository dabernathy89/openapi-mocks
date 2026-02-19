<script setup lang="ts">
import SpecEditor from './SpecEditor.vue';
import CodeEditor from './CodeEditor.vue';
import HandlerAccordion from './HandlerAccordion.vue';
import { usePlayground } from './usePlayground';

const { specText, codeText, routes, evalStatus, evalError } = usePlayground();
</script>

<template>
  <div class="playground">
    <SpecEditor v-model="specText" />
    <CodeEditor v-model="codeText" />
    <HandlerAccordion :routes="routes" :eval-status="evalStatus" :eval-error="evalError" />
  </div>
</template>
