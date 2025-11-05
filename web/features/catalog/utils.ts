// Condition types for type safety
export const CONDITION_TYPES = {
  NEAR_MINT: "Near Mint",
  LIGHTLY_PLAYED: "Lightly Played",
  MODERATELY_PLAYED: "Moderately Played",
  HEAVILY_PLAYED: "Heavily Played",
  DAMAGED: "Damaged",
} as const;

export type ConditionType =
  (typeof CONDITION_TYPES)[keyof typeof CONDITION_TYPES];

export type ConditionFilter = ConditionType | null;

// Utility function to check if a condition name is valid
export function isValidCondition(
  conditionName: string,
): conditionName is ConditionType {
  return Object.values(CONDITION_TYPES).includes(
    conditionName as ConditionType,
  );
}

// Utility function to get condition rank for sorting
export function getConditionRank(condition: ConditionType | string): number {
  switch (condition.toLowerCase()) {
    case "near mint":
      return 5;
    case "lightly played":
      return 4;
    case "moderately played":
      return 3;
    case "heavily played":
      return 2;
    case "damaged":
      return 1;
    default:
      return 0;
  }
}

// Utility function to get condition color for UI
export function getConditionColor(condition: string): string {
  switch (condition.toLowerCase()) {
    case "near mint":
      return "bg-green-500";
    case "lightly played":
      return "bg-yellow-500";
    case "moderately played":
      return "bg-orange-500";
    case "heavily played":
      return "bg-red-500";
    case "damaged":
      return "bg-red-800";
    default:
      return "bg-gray-500";
  }
}

// Utility function to get condition display name
export function getConditionDisplayName(condition: string): string {
  switch (condition.toLowerCase()) {
    case "moderately played":
      return "Mod. Played";
    default:
      return condition;
  }
}

// Utility function to get condition color for charts (RGB format)
export function getConditionChartColor(condition: string): string {
  switch (condition.toLowerCase()) {
    case "near mint":
      return "rgb(34 197 94)"; // green-500
    case "lightly played":
      return "rgb(234 179 8)"; // yellow-500
    case "moderately played":
      return "rgb(249 115 22)"; // orange-500
    case "heavily played":
      return "rgb(239 68 68)"; // red-500
    case "damaged":
      return "rgb(153 27 27)"; // red-800
    default:
      return "rgb(107 114 128)"; // gray-500
  }
}
