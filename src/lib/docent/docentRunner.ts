import { parse as parseYaml } from 'yaml';

export interface DocentStepAction {
  type: 'openArticle';
  articleId: string;
}

export interface DocentStep {
  id: number;
  route: string;
  anchor?: string;
  title: string;
  text: string;
  action?: DocentStepAction;
}

export interface DocentManifest {
  id: string;
  title: string;
  subtitle?: string;
  desktopOnly?: boolean;
  start?: {
    route: string;
    anchor?: string;
  };
  steps: DocentStep[];
}

const DOCENT_ID_KEY = 'docent_id';
const DOCENT_STEP_KEY = 'docent_step';
const DOCENT_DESKTOP_WIDTH = 768;

const manifestModules = import.meta.glob('../../docents/*.yaml', {
  eager: false,
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const manifestCache = new Map<string, DocentManifest>();

export const isDesktopViewport = (): boolean => {
  return typeof window !== 'undefined' && window.innerWidth >= DOCENT_DESKTOP_WIDTH;
};

export const isReducedMotion = (): boolean => {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const getActiveDocentId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = (params.get('docentId') || '').trim();
  const fromSession = sessionStorage.getItem(DOCENT_ID_KEY);
  if (params.get('docent') === '1') {
    if (fromQuery) return fromQuery;
    if (fromSession) return fromSession;
    return 'ahyo';
  }
  return fromSession;
};

export const getCurrentStepIndex = (): number => {
  if (typeof window === 'undefined') return 0;
  const value = Number(sessionStorage.getItem(DOCENT_STEP_KEY) || '0');
  return Number.isFinite(value) && value >= 0 ? value : 0;
};

export const setCurrentStepIndex = (index: number): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DOCENT_STEP_KEY, String(Math.max(0, index)));
};

export const clearDocentSession = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DOCENT_ID_KEY);
  sessionStorage.removeItem(DOCENT_STEP_KEY);
};

export const startDocentSession = (docentId: string, stepIndex = 0): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DOCENT_ID_KEY, docentId);
  setCurrentStepIndex(stepIndex);
};

export const exitDocentMode = (): void => {
  clearDocentSession();
  if (typeof window !== 'undefined') {
    window.location.assign('/tour');
  }
};

const getManifestPathForId = (docentId: string): string | null => {
  const suffix = `/docents/${docentId}.yaml`;
  return Object.keys(manifestModules).find((path) => path.endsWith(suffix)) || null;
};

export const loadManifest = async (docentId: string): Promise<DocentManifest | null> => {
  if (manifestCache.has(docentId)) {
    return manifestCache.get(docentId)!;
  }
  const modulePath = getManifestPathForId(docentId);
  if (!modulePath) return null;

  const raw = await manifestModules[modulePath]();
  const parsed = parseYaml(raw) as DocentManifest;
  if (!parsed || !Array.isArray(parsed.steps)) return null;
  manifestCache.set(docentId, parsed);
  return parsed;
};

const ensureDocentParam = (url: URL): URL => {
  url.searchParams.set('docent', '1');
  return url;
};

const normalizeStepIndex = (manifest: DocentManifest, index: number): number => {
  const max = Math.max(0, manifest.steps.length - 1);
  return Math.min(Math.max(0, index), max);
};

const getStepTargetUrl = (step: DocentStep): URL => {
  const url = new URL(step.route, window.location.origin);
  ensureDocentParam(url);
  if (step.action?.type === 'openArticle' && step.action.articleId) {
    url.searchParams.set('openArticle', step.action.articleId);
  }
  if (step.anchor) {
    url.hash = `#${step.anchor}`;
  }
  return url;
};

export const scrollToAnchorIfPresent = (anchor?: string): void => {
  if (!anchor || typeof document === 'undefined') return;
  const target = document.getElementById(anchor);
  if (!target) return;
  target.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: isReducedMotion() ? 'auto' : 'smooth',
  });
};

const dispatchOpenArticle = (articleId?: string): void => {
  if (!articleId || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('johncrow:docent-open-article', { detail: { articleId } }));
};

export const getDocentState = async (): Promise<{
  manifest: DocentManifest;
  step: DocentStep;
  index: number;
  total: number;
} | null> => {
  const docentId = getActiveDocentId();
  if (!docentId) return null;
  const manifest = await loadManifest(docentId);
  if (!manifest) return null;

  const index = normalizeStepIndex(manifest, getCurrentStepIndex());
  const step = manifest.steps[index];
  return { manifest, step, index, total: manifest.steps.length };
};

export const applyCurrentStepOnPage = async (): Promise<void> => {
  const state = await getDocentState();
  if (!state) return;
  scrollToAnchorIfPresent(state.step.anchor);
  if (state.step.action?.type === 'openArticle') {
    dispatchOpenArticle(state.step.action.articleId);
  }
};

export const goToStep = async (requestedIndex: number): Promise<void> => {
  const state = await getDocentState();
  if (!state || typeof window === 'undefined') return;
  const index = normalizeStepIndex(state.manifest, requestedIndex);
  const step = state.manifest.steps[index];
  setCurrentStepIndex(index);

  const targetUrl = getStepTargetUrl(step);
  const currentUrl = new URL(window.location.href);
  const samePage = currentUrl.pathname === targetUrl.pathname
    && currentUrl.search === targetUrl.search
    && currentUrl.hash === targetUrl.hash;

  if (samePage) {
    scrollToAnchorIfPresent(step.anchor);
    if (step.action?.type === 'openArticle') {
      dispatchOpenArticle(step.action.articleId);
    }
    return;
  }

  window.location.assign(targetUrl.pathname + targetUrl.search + targetUrl.hash);
};

export const goNextStep = async (): Promise<void> => {
  const state = await getDocentState();
  if (!state) return;
  await goToStep(Math.min(state.total - 1, state.index + 1));
};

export const goPreviousStep = async (): Promise<void> => {
  const state = await getDocentState();
  if (!state) return;
  await goToStep(Math.max(0, state.index - 1));
};
