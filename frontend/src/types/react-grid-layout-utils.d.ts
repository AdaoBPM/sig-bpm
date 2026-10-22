// A função da grade que move um bloco e empurra os que ele encobre (react-grid-layout/build/utils, sem os tipos no
// @types/react-grid-layout). Ela muda as posições no próprio leiaute.
declare module "react-grid-layout/build/utils" {
  import type { Layout } from "react-grid-layout";
  export function moveElement(
    layout: Layout[],
    l: Layout,
    x: number | undefined,
    y: number | undefined,
    isUserAction: boolean,
    preventCollision: boolean,
    compactType: "vertical" | "horizontal" | null,
    cols: number,
    allowOverlap?: boolean,
  ): Layout[];
}
