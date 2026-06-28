// Shared categorical color tokens — single source of truth so the same
// category/file-type always reads as the same color across Documents,
// the similarity Graph, and the Admin dashboard (previously these three
// each had their own slightly different hex maps).

export const CATEGORY_HEX: Record<string, string> = {
  mechanics: "#7A1F2B",    // Burgundy
  electrics: "#A67C52",    // Bronze
  simulation: "#4A6FA5",   // Slate Blue
  software: "#3E7C59",     // Forest Green
  other: "#6E6E6E",        // Neutral Grey
};

export const CATEGORY_CLASS: Record<string, string> = {
  mechanics: "bg-[#C2783A]/15 text-[#E0A876] border-[#C2783A]/40",
  electrics: "bg-[#D4B23C]/15 text-[#E5C878] border-[#D4B23C]/40",
  simulation: "bg-[#8C8FE0]/15 text-[#B3B5EC] border-[#8C8FE0]/40",
  software: "bg-[#5FAE7C]/15 text-[#8FCBA6] border-[#5FAE7C]/40",
  other: "bg-surface2 text-textdim border-line",
};

export const FILE_TYPE_HEX: Record<string, string> = {
  PDF: "#C2783A",
  DOCX: "#8C8FE0",
  DOC: "#8C8FE0",
  XLSX: "#5FAE7C",
  XLS: "#5FAE7C",
  TXT: "#8D9097",
  PNG: "#4FA8D8",
  JPG: "#4FA8D8",
  JPEG: "#4FA8D8",
  URL: "#D4B23C",
  FILE: "#8D9097",
};

export function fileTypeColor(ext: string) {
  return FILE_TYPE_HEX[ext.toUpperCase()] ?? FILE_TYPE_HEX.FILE;
}

export function categoryClass(cat: string) {
  return CATEGORY_CLASS[cat] ?? CATEGORY_CLASS.other;
}

export function categoryHex(cat: string) {
  return CATEGORY_HEX[cat] ?? CATEGORY_HEX.other;
}
