import { cache } from "@solidjs/router";
import { format } from "date-fns";
import { match, P } from "ts-pattern";

import type { ReleaseNoteEntry } from "~/content/config";
import type { YamlNavMenuToplevelItem } from "~/type";

export interface ReleaseNote {
  slug: string;
  entry: ReleaseNoteEntry;
}

const getReleaseNoteLabel = (slug: string) =>
  match(slug)
    .when(
      (v) => v.startsWith("api-sdk"),
      () => "원 페이먼트 인프라",
    )
    .when(
      (v) => v.startsWith("console"),
      () => "관리자콘솔",
    )
    .when(
      (v) => v.startsWith("platform"),
      () => "파트너 정산 자동화",
    )
    .run();

export const getReleaseNoteTitle = (releasedAt: Date, slug: string) =>
  `${format(releasedAt, "yyyy-MM-dd")} ${getReleaseNoteLabel(slug)} 업데이트`;

export const getReleaseNoteDescription = (releasedAt: Date, slug: string) =>
  `${format(releasedAt, "yyyy-MM-dd")} ${getReleaseNoteLabel(slug)} 업데이트 소식을 안내드립니다.`;

export const makeReleaseNoteFrontmatter = (
  releaseAt: Date,
  fullSlug: string,
) => {
  const slug = fullSlug.replace(/release-notes\/\(note\)\//, "");
  return {
    title: getReleaseNoteTitle(releaseAt, slug),
    description: getReleaseNoteDescription(releaseAt, slug),
  };
};

export const getReleaseNoteNavs = async () => {
  "use server";

  const { releaseNotes } = await import("#content");

  const apiSdkNotes: ReleaseNote[] = [];
  const consoleNotes: ReleaseNote[] = [];
  const platformNotes: ReleaseNote[] = [];
  for (const [slug, { frontmatter: entry }] of Object.entries(releaseNotes)) {
    if (slug.startsWith("api-sdk")) apiSdkNotes.push({ slug, entry });
    else if (slug.startsWith("console")) consoleNotes.push({ slug, entry });
    else if (slug.startsWith("platform")) platformNotes.push({ slug, entry });
  }
  for (const notes of [apiSdkNotes, consoleNotes, platformNotes]) {
    notes.sort((a, b) => (a.slug > b.slug ? -1 : 1));
  }

  const groupedNotesBeforeYear = new Date().getFullYear();
  const toNavMenuItems = (notes: ReleaseNote[]) => {
    return notes.reduce(
      (acc, note) => {
        const { items, noteMap } = acc;
        match(new Date(note.entry.releasedAt).getFullYear())
          .with(P.number.gte(groupedNotesBeforeYear), () => {
            items.push(`/${note.slug}`);
          })
          .with(P.number, (year) => {
            const [prefix] = note.slug.split("/");
            const path = `${prefix}/${year}`;
            if (!noteMap.has(path)) {
              noteMap.set(path, {
                title: `${year}년 업데이트`,
                items: [`/${note.slug}`],
              });
            } else {
              noteMap.get(path)!.items.push(`/${note.slug}`);
            }
          })
          .exhaustive();
        return acc;
      },
      {
        items: [] as string[],
        noteMap: new Map<string, { title: string; items: string[] }>(),
      },
    );
  };

  return [
    {
      label: getReleaseNoteLabel("console"),
      items: consoleNotes.map((note) => `/${note.slug}`),
    },
    {
      label: getReleaseNoteLabel("api-sdk"),
      items: apiSdkNotes.map((note) => `/${note.slug}`),
    },
    {
      label: getReleaseNoteLabel("platform"),
      items: platformNotes.map((note) => `/${note.slug}`),
    },
  ];
};

export const getReleaseNotes = cache(async () => {
  "use server";

  const { releaseNotes } = await import("#content");

  const apiSdkNotes: ReleaseNote[] = [];
  const consoleNotes: ReleaseNote[] = [];
  const platformNotes: ReleaseNote[] = [];
  for (const [slug, { frontmatter: entry }] of Object.entries(releaseNotes)) {
    if (slug.startsWith("api-sdk")) apiSdkNotes.push({ slug, entry });
    else if (slug.startsWith("console")) consoleNotes.push({ slug, entry });
    else if (slug.startsWith("platform")) platformNotes.push({ slug, entry });
  }
  for (const notes of [apiSdkNotes, consoleNotes, platformNotes]) {
    notes.sort((a, b) => (a.slug > b.slug ? -1 : 1));
  }
  return { apiSdkNotes, consoleNotes, platformNotes };
}, "release-notes");
