import type { Region } from "./types";

export const ALL_REGIONS: Region[] = [
  { id: "hong-kong", label: "Hong Kong", shortLabel: "HK", timezone: "Asia/Hong_Kong" },
  { id: "taiwan", label: "Taiwan", shortLabel: "TW", timezone: "Asia/Taipei" },
  { id: "singapore", label: "Singapore", shortLabel: "SG", timezone: "Asia/Singapore" },
  { id: "japan", label: "Japan", shortLabel: "JP", timezone: "Asia/Tokyo" },
  { id: "united-states", label: "United States", shortLabel: "US", timezone: "America/Los_Angeles" },
  { id: "canada", label: "Canada", shortLabel: "CA", timezone: "America/Toronto" },
  { id: "united-kingdom", label: "United Kingdom", shortLabel: "UK", timezone: "Europe/London" },
  { id: "germany", label: "Germany", shortLabel: "DE", timezone: "Europe/Berlin" },
  { id: "netherlands", label: "Netherlands", shortLabel: "NL", timezone: "Europe/Amsterdam" },
  { id: "italy", label: "Italy", shortLabel: "IT", timezone: "Europe/Rome" },
  { id: "spain", label: "Spain", shortLabel: "ES", timezone: "Europe/Madrid" },
  { id: "turkey", label: "Turkey", shortLabel: "TR", timezone: "Europe/Istanbul" },
  { id: "australia", label: "Australia", shortLabel: "AU", timezone: "Australia/Sydney" },
  { id: "argentina", label: "Argentina", shortLabel: "AR", timezone: "America/Argentina/Buenos_Aires" },
  { id: "brazil", label: "Brazil", shortLabel: "BR", timezone: "America/Sao_Paulo" },
  { id: "chile", label: "Chile", shortLabel: "CL", timezone: "America/Santiago" },
  { id: "korea", label: "Korea", shortLabel: "KR", timezone: "Asia/Seoul" },
  { id: "india", label: "India", shortLabel: "IN", timezone: "Asia/Kolkata" },
  { id: "israel", label: "Israel", shortLabel: "IL", timezone: "Asia/Jerusalem" },
  { id: "thailand", label: "Thailand", shortLabel: "TH", timezone: "Asia/Bangkok" },
  { id: "vietnam", label: "Vietnam", shortLabel: "VN", timezone: "Asia/Ho_Chi_Minh" },
  { id: "malaysia", label: "Malaysia", shortLabel: "MY", timezone: "Asia/Kuala_Lumpur" },
  { id: "south-africa", label: "Johannesburg", shortLabel: "ZA", timezone: "Africa/Johannesburg" },
];

export function getEnabledRegions() {
  const configured = process.env.TTFT_REGION_IDS?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!configured?.length) {
    return ALL_REGIONS;
  }

  const byId = new Map(ALL_REGIONS.map((region) => [region.id, region]));
  return configured.map((id) => byId.get(id)).filter((region): region is Region => Boolean(region));
}
