import { createContextProvider } from "@solid-primitives/context";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  on,
  type Setter,
} from "solid-js";
import { createStore } from "solid-js/store";

import type {
  Code,
  DefaultParams,
  Section,
} from "~/components/interactive-docs/code";

export type CodeExample<
  Params extends DefaultParams,
  Sections extends string,
> = {
  fileName: string;
  code: Code<Params, Sections>;
};

export type Tab = {
  fileName: string;
  sections: Record<string, Section>;
  code: string;
};

export type PayMethod = "card" | "virtualAccount";
export type Pg =
  | "nice"
  | "smatro"
  | "toss"
  | "kpn"
  | "inicis"
  | "ksnet"
  | "kcp"
  | "kakao"
  | "naver"
  | "tosspay"
  | "hyphen";

export type ConvertToPgParam<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Partial<Record<O, any>>,
  O extends Pg = Pg,
  KeyName extends string = "name",
  ValueName extends string = "payMethods",
> = {
  [K in keyof T]: {
    [P in KeyName]: K;
  } & {
    [M in ValueName]: T[K][ValueName][number];
  };
}[keyof T];

export type PgOptions = {
  [key in Pg]?: {
    payMethods: PayMethod[];
  };
};

const highlighterInstance = createHighlighterCore({
  themes: [import("shiki/themes/one-dark-pro.mjs")],
  langs: [
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/html.mjs"),
    import("shiki/langs/css.mjs"),
  ],
  engine: createOnigurumaEngine(import("shiki/wasm")),
});

type Params = DefaultParams & object;
export type InteractiveDocsInit = {
  pgOptions: PgOptions;
  languages: {
    frontend: [string, ...string[]];
    backend: [string, ...string[]];
    hybrid: string[];
  };
  params: DefaultParams & object;
};

const [InteractiveDocsProvider, useInteractiveDocs] = createContextProvider(
  (props: { initial?: InteractiveDocsInit }) => {
    const initial = createMemo<InteractiveDocsInit>(
      () =>
        props.initial ??
        ({
          pgOptions: {
            hyphen: { payMethods: ["card"] },
          },
          languages: {
            frontend: ["react"],
            backend: ["node"],
            hybrid: ["nextjs"],
          },
          params: {
            pg: {
              name: "hyphen",
              payMethods: "card",
            },
          },
        } satisfies InteractiveDocsInit),
    );
    const [params, setParams] = createStore<Params>(initial().params);
    const [preview, setPreview] = createSignal<Component | undefined>(
      undefined,
    );
    const pgName = createMemo(() => params.pg.name);
    const pgOptions = createMemo(() => initial().pgOptions);
    createEffect(() => {
      const pg = Object.keys(pgOptions())[0] as Pg | undefined;
      if (!pg) return;
      const pgOption = pgOptions()[pg];
      if (!pgOption) return;
      setParams("pg", {
        name: pg,
        payMethods: pgOption.payMethods[0],
      });
    });
    const languages = createMemo(() => initial().languages);
    const [selectedLanguage, setSelectedLanguage] = createSignal<
      [frontend: string, backend: string] | string
    >([initial().languages.frontend[0], initial().languages.backend[0]]);
    createEffect(() => {
      setSelectedLanguage([languages().frontend[0], languages().backend[0]]);
    });
    const [codeExamples, setCodeExamples] = createSignal<{
      frontend: Record<string, CodeExample<Params, string>[]>;
      backend: Record<string, CodeExample<Params, string>[]>;
      hybrid?: Record<string, CodeExample<Params, string>[]>;
    }>({
      frontend: {},
      backend: {},
    });
    const [tabs, setTabs] = createSignal<Tab[]>([]);
    createEffect(() => {
      const resolveCode = (example: CodeExample<Params, string>): Tab => {
        const { code, sections } = example.code(params);
        return {
          fileName: example.fileName,
          code,
          sections: sections as Record<string, Section>,
        };
      };
      const _selectedLanguage = selectedLanguage();
      if (_selectedLanguage === null) return [];
      if (Array.isArray(_selectedLanguage)) {
        const [frontend, backend] = _selectedLanguage;
        return setTabs(
          [
            ...(codeExamples()["frontend"][frontend] ?? []),
            ...(codeExamples()["backend"][backend] ?? []),
          ].map(resolveCode),
        );
      }
      const hybrid = codeExamples()["hybrid"];
      return setTabs(
        hybrid ? (hybrid[_selectedLanguage] ?? []).map(resolveCode) : [],
      );
    });
    const [selectedTab, setSelectedTab] = createSignal<string | null>(
      tabs()[0]?.fileName ?? null,
    );
    const sections = createMemo<Record<string, { fileName: string } & Section>>(
      () => {
        const result = tabs().reduce(
          (acc, tab) => {
            for (const [
              section,
              { startLine, endLine },
            ] of Object.entries<Section>(tab.sections)) {
              if (section in acc) {
                console.error(
                  `Section "${section}" is defined in multiple files`,
                );
              }
              acc[section] = {
                fileName: tab.fileName,
                startLine,
                endLine,
              };
            }
            return acc;
          },
          {} as Record<string, { fileName: string } & Section>,
        );
        return result;
      },
    );
    const [currentSection, setCurrentSection] = createSignal<string | null>(
      null,
    );
    const highlightSection = createMemo<
      ({ fileName: string } & Section) | null
    >(() => {
      const section = currentSection();
      if (!section) return null;
      return sections()[section] ?? null;
    });

    // Section 변경 시 Tab 이동
    createEffect(() => {
      const section = highlightSection();
      if (!section) return;
      const tab = tabs().find((tab) => tab.fileName === section.fileName);
      if (tab) {
        setSelectedTab(tab.fileName);
      }
    });
    const [highlighter, setHighlighter] =
      createSignal<Awaited<ReturnType<typeof createHighlighterCore>>>();
    void highlighterInstance.then(setHighlighter);

    // PG사 변경 시 payMethods 초기화
    createEffect(
      on([pgName, pgOptions], ([pgName, pgOptions]) => {
        const pgOption = pgOptions[pgName];
        if (!pgOption) return;

        const payMethod = pgOption.payMethods.find(
          (method) => method === params.pg.payMethods,
        );
        if (payMethod === undefined && pgOption.payMethods[0]) {
          setParams("pg", "payMethods", pgOption.payMethods[0]);
        }
      }),
    );

    return {
      pgOptions,
      languages,
      selectedLanguage,
      setSelectedLanguage,
      params,
      setParams,
      setCodeExamples,
      sections,
      currentSection,
      setCurrentSection,
      tabs,
      selectedTab,
      setSelectedTab,
      highlighter,
      highlightSection,
      preview,
      setPreview,
    };
  },
  {
    pgOptions: () => ({
      inicis: {
        payMethods: ["card"],
      },
    }),
    languages: () => ({
      frontend: ["react", "html"],
      backend: ["node", "python"],
      hybrid: ["nextjs"],
    }),
    selectedLanguage: () => ["react", "node"],
    setSelectedLanguage: (_) => {},
    params: {
      pg: {
        name: "inicis",
        payMethods: "card",
      },
    },
    setParams: () => {},
    setCodeExamples: (_) => {},
    tabs: () => [],
    sections: () => ({}),
    currentSection: () => null,
    setCurrentSection: (_) => {},
    selectedTab: () => null,
    setSelectedTab: (_) => {},
    highlighter: () => undefined,
    highlightSection: () => null,
    preview: () => undefined,
    setPreview: ((_) => {}) as Setter<Component | undefined>,
  },
);

export { InteractiveDocsProvider, useInteractiveDocs };
