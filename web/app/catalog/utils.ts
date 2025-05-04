import {
  ConditionResponse,
  PrintingResponse,
  LanguageResponse,
} from "./schemas";

/**
 * Formats a SKU's variant details with interpunct delimiters
 * @param condition The condition object with a name property
 * @param printing The printing object with a name property
 * @param language The language object with a name property
 * @returns Formatted string with interpunct delimiters
 */
export function formatSKU(
  condition: ConditionResponse | { name: string },
  printing: PrintingResponse | { name: string },
  language: LanguageResponse | { name: string },
): string {
  return `${condition.name} · ${printing.name} · ${language.name}`;
}
