import { ref, computed, watch, onMounted } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as jsYaml from 'js-yaml';
import type { HandlerInfo } from './types';
import { SAMPLE_SPEC } from './sample-spec';
import { DEFAULT_CODE } from './default-code';

type EvalStatus = 'idle' | 'pending' | 'ok' | 'error';

export function usePlayground() {
  const specText: Ref<string> = ref(SAMPLE_SPEC);
  const codeText: Ref<string> = ref(DEFAULT_CODE);
  const evalStatus: Ref<EvalStatus> = ref('idle');
  const evalError: Ref<string | null> = ref(null);

  // Internal state: active MSW HttpHandler array (typed loosely since we import dynamically)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeHandlers: Ref<any[]> = ref([]);

  // MSW worker instance (set after dynamic import)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any = null;

  const routes: ComputedRef<HandlerInfo[]> = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return activeHandlers.value.map((h: any) => ({
      method: (h?.info?.method ?? '').toUpperCase(),
      path: h?.info?.path ?? '',
    }));
  });

  // Debounce helpers
  let specTimer: ReturnType<typeof setTimeout> | null = null;
  let codeTimer: ReturnType<typeof setTimeout> | null = null;

  async function runEval() {
    evalStatus.value = 'pending';
    evalError.value = null;

    // 1. Parse spec YAML
    let specObject: unknown;
    try {
      specObject = jsYaml.load(specText.value);
    } catch (err) {
      evalStatus.value = 'error';
      evalError.value = err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err);
      activeHandlers.value = [];
      return;
    }

    // 2. Import browser bundle dynamically
    let createMockClient: unknown;
    try {
      const mod = await import('/playground/openapi-mocks.browser.js' as string);
      createMockClient = mod.createMockClient ?? mod.default?.createMockClient ?? mod.default;
    } catch (err) {
      evalStatus.value = 'error';
      evalError.value = `Failed to load openapi-mocks browser bundle: ${err instanceof Error ? err.message : String(err)}`;
      activeHandlers.value = [];
      return;
    }

    // 3. Evaluate user code with AsyncFunction
    let handlers: unknown[];
    try {
      // eslint-disable-next-line no-new-func
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
        ...args: string[]
      ) => (...args: unknown[]) => Promise<unknown>;
      const fn = new AsyncFunction('createMockClient', 'spec', codeText.value);
      handlers = (await fn(createMockClient, specObject)) as unknown[];
      if (!Array.isArray(handlers)) {
        throw new TypeError('User code must return an array of HttpHandlers');
      }
    } catch (err) {
      evalStatus.value = 'error';
      evalError.value = err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err);
      activeHandlers.value = [];
      return;
    }

    // 4. Update MSW worker
    if (worker) {
      try {
        worker.resetHandlers(...handlers);
      } catch (_) {
        // If resetHandlers fails, continue — handlers are still tracked locally
      }
    }

    activeHandlers.value = handlers;
    evalStatus.value = 'ok';
  }

  watch(specText, () => {
    if (specTimer) clearTimeout(specTimer);
    specTimer = setTimeout(() => runEval(), 800);
  });

  watch(codeText, () => {
    if (codeTimer) clearTimeout(codeTimer);
    codeTimer = setTimeout(() => runEval(), 500);
  });

  onMounted(async () => {
    try {
      const { setupWorker } = await import('msw/browser');
      worker = setupWorker();
      await worker.start({ onUnhandledRequest: 'bypass' });
    } catch (err) {
      console.warn('[usePlayground] MSW service worker setup failed:', err);
    }
    // Initial eval
    await runEval();
  });

  return {
    specText,
    codeText,
    routes,
    evalStatus,
    evalError,
  };
}
