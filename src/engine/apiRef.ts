import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

let current: ExcalidrawImperativeAPI | null = null;

export const setEditorApi = (api: ExcalidrawImperativeAPI | null) => {
  current = api;
};
export const getEditorApi = () => current;
