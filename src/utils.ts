import fs from "fs";
import { languagesDict } from "./types";

export async function removeFileIfExists(filePath: string) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error(`Falha ao remover arquivo: ${filePath}`, error);
  }
}

export function getValidLanguage(language: any) {
  if (typeof language !== "string" || !(language in languagesDict))
    return undefined;

  return language;
}
