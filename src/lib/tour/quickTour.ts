import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";

const COMPLETED_KEY = "johncrow_quick_tour_completed";
const START_KEY = "johncrow_start_tour";

type StepDef = {
  title: string;
  text: string;
  selector?: string;
};

const STEP_DEFS: StepDef[] = [
  {
    selector: "#home-framing",
    title: "Start with the argument",
    text: "This project documents anti-Chinese racial terror and calls the Western system 'John Crow'—a regime aimed at expulsion. The site is built to let you move from narrative to evidence to pattern.",
  },
  {
    selector: "#qs-records",
    title: "Explore Records",
    text: "Records are the backbone: each case pairs narrative, metadata, and linked evidence. Start here when you want the story of a single incident.",
  },
  {
    selector: "#qs-news",
    title: "Open the primary sources",
    text: "News Clips are scanned articles with transcripts and citations. These artifacts are the evidentiary trail behind the narratives.",
  },
  {
    selector: "#qs-visualize",
    title: "See patterns across time and space",
    text: "Use Visualize to move from cases to systems: maps, timelines, and charts translate the dissertation’s figures into web form.",
  },
  {
    selector: "#qs-dataset",
    title: "Work with the dataset",
    text: "The dataset is the structured backbone used for analysis. Researchers can download, filter, and verify counts and categories.",
  },
  {
    selector: "#qs-ask",
    title: "Ask the Archive",
    text: "Ask questions and trace evidence across records.",
  },
  {
    selector: "#nav-explore",
    title: "Explore by collection",
    text: "Browse the archive by collection: Lynching Records, News Clips, or the Dataset.",
  },
  {
    selector: "#nav-ask",
    title: "Ask the Archive",
    text: "Query the archive conversationally to surface connections, then verify them in the linked primary sources.",
  },
  {
    selector: "#nav-visualize",
    title: "Visualize the data",
    text: "Maps, timelines, and charts translate the dataset into spatial and chronological patterns.",
  },
  {
    selector: "#nav-sources",
    title: "Primary Sources",
    text: "Access the documentary base: newspaper scans, transcripts, citation-ready references, and further readings for secondary scholarship.",
  },
];

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function clearStartFlag() {
  const storage = getLocalStorage();
  storage?.removeItem(START_KEY);
}

function completeQuickTour(tour: Shepherd.Tour) {
  const storage = getLocalStorage();
  storage?.setItem(COMPLETED_KEY, "true");
  clearStartFlag();
  tour.complete();
}

function buttonsForStep(tour: Shepherd.Tour, isFirst: boolean) {
  const buttons: Array<{ text: string; action: () => void; classes?: string }> = [
    {
      text: "Exit",
      action: () => tour.cancel(),
      classes: "shepherd-button-secondary",
    },
  ];

  if (!isFirst) {
    buttons.push({
      text: "Back",
      action: () => tour.back(),
      classes: "shepherd-button-secondary",
    });
  }

  buttons.push({
    text: "Next",
    action: () => tour.next(),
  });

  return buttons;
}

function finalStepButtons(tour: Shepherd.Tour) {
  return [
    {
      text: "End Tour",
      action: () => completeQuickTour(tour),
    },
  ];
}

function buildTour(): Shepherd.Tour {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    keyboardNavigation: true,
    exitOnEsc: true,
    defaultStepOptions: {
      cancelIcon: { enabled: true },
      classes: "shadow-xl rounded-lg johncrow-quick-tour",
      scrollTo: { behavior: "smooth", block: "center" },
      canClickTarget: false,
    },
  });

  STEP_DEFS.forEach((step, index) => {
    const target = step.selector ? document.querySelector(step.selector) : null;
    if (step.selector && !target) return;
    if (target instanceof HTMLElement && target.offsetParent === null) return;
    tour.addStep({
      id: `quick-tour-step-${index + 1}`,
      title: step.title,
      text: step.text,
      attachTo: step.selector
        ? {
            element: step.selector,
            on: "bottom",
          }
        : undefined,
      buttons: buttonsForStep(tour, index === 0),
    });
  });

  tour.addStep({
    id: "quick-tour-final",
    title: "Tour complete",
    text: "You’ve seen the site’s main entry points. When you’re ready, you can explore a case record and open the linked primary sources for evidence.",
    buttons: finalStepButtons(tour),
  });

  tour.on("cancel", () => {
    clearStartFlag();
  });

  tour.on("complete", () => {
    const storage = getLocalStorage();
    storage?.setItem(COMPLETED_KEY, "true");
    clearStartFlag();
  });

  return tour;
}

export function shouldAutoStartQuickTour(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("tour") === "1") return true;

  const storage = getLocalStorage();
  return storage?.getItem(START_KEY) === "true";
}

export function clearQuickTourStartFlag(): void {
  clearStartFlag();
}

export function startQuickTour(): void {
  clearStartFlag();
  const tour = buildTour();
  if (tour.steps.length === 0) return;
  tour.start();
}
