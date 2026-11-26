export const pageHead = (name: string, description: string) => () => ({
  meta: [
    { title: `${name} — NEXTMILE` },
    { name: "description", content: description },
    { property: "og:title", content: `${name} — NEXTMILE` },
    { property: "og:description", content: description },
  ],
});
