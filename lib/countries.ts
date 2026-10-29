// Countries for the Flags emoji pack and for suggestions while typing (lib/country-suggest.ts): all 54 African countries first, then
// the places our members write about most. [ISO 3166 two-letter code, three-letter code, name, other names people type].
export type Country = { code: string; code3: string; name: string; aka: string[] };

const ROWS: [string, string, string, string[]?][] = [
  // Africa
  ["NG", "NGA", "Nigeria", ["Naija", "9ja"]], ["GH", "GHA", "Ghana"], ["KE", "KEN", "Kenya"], ["ZA", "ZAF", "South Africa", ["SA", "Mzansi"]], ["EG", "EGY", "Egypt"],
  ["DZ", "DZA", "Algeria"], ["AO", "AGO", "Angola"], ["BJ", "BEN", "Benin"], ["BW", "BWA", "Botswana"], ["BF", "BFA", "Burkina Faso"], ["BI", "BDI", "Burundi"],
  ["CV", "CPV", "Cape Verde", ["Cabo Verde"]], ["CM", "CMR", "Cameroon"], ["CF", "CAF", "Central African Republic"], ["TD", "TCD", "Chad"], ["KM", "COM", "Comoros"],
  ["CG", "COG", "Congo", ["Republic of the Congo", "Congo-Brazzaville"]], ["CD", "COD", "DR Congo", ["Democratic Republic of the Congo", "DRC", "Congo-Kinshasa"]],
  ["CI", "CIV", "Côte d'Ivoire", ["Ivory Coast", "Cote d'Ivoire"]], ["DJ", "DJI", "Djibouti"], ["GQ", "GNQ", "Equatorial Guinea"], ["ER", "ERI", "Eritrea"],
  ["SZ", "SWZ", "Eswatini", ["Swaziland"]], ["ET", "ETH", "Ethiopia"], ["GA", "GAB", "Gabon"], ["GM", "GMB", "Gambia", ["The Gambia"]], ["GN", "GIN", "Guinea"],
  ["GW", "GNB", "Guinea-Bissau"], ["LS", "LSO", "Lesotho"], ["LR", "LBR", "Liberia"], ["LY", "LBY", "Libya"], ["MG", "MDG", "Madagascar"], ["MW", "MWI", "Malawi"],
  ["ML", "MLI", "Mali"], ["MR", "MRT", "Mauritania"], ["MU", "MUS", "Mauritius"], ["MA", "MAR", "Morocco"], ["MZ", "MOZ", "Mozambique"], ["NA", "NAM", "Namibia"],
  ["NE", "NER", "Niger"], ["RW", "RWA", "Rwanda"], ["ST", "STP", "São Tomé and Príncipe", ["Sao Tome and Principe"]], ["SN", "SEN", "Senegal"], ["SC", "SYC", "Seychelles"],
  ["SL", "SLE", "Sierra Leone"], ["SO", "SOM", "Somalia"], ["SS", "SSD", "South Sudan"], ["SD", "SDN", "Sudan"], ["TZ", "TZA", "Tanzania"], ["TG", "TGO", "Togo"],
  ["TN", "TUN", "Tunisia"], ["UG", "UGA", "Uganda"], ["ZM", "ZMB", "Zambia"], ["ZW", "ZWE", "Zimbabwe"],
  // The rest of the world
  ["GB", "GBR", "United Kingdom", ["UK", "Britain", "England"]], ["US", "USA", "United States", ["USA", "America"]], ["CA", "CAN", "Canada"], ["IE", "IRL", "Ireland"],
  ["FR", "FRA", "France"], ["DE", "DEU", "Germany"], ["NL", "NLD", "Netherlands", ["Holland"]], ["BE", "BEL", "Belgium"], ["ES", "ESP", "Spain"], ["PT", "PRT", "Portugal"],
  ["IT", "ITA", "Italy"], ["CH", "CHE", "Switzerland"], ["SE", "SWE", "Sweden"], ["NO", "NOR", "Norway"], ["DK", "DNK", "Denmark"], ["FI", "FIN", "Finland"],
  ["PL", "POL", "Poland"], ["TR", "TUR", "Turkey", ["Türkiye"]], ["RU", "RUS", "Russia"], ["UA", "UKR", "Ukraine"], ["AE", "ARE", "United Arab Emirates", ["UAE", "Dubai"]],
  ["SA", "SAU", "Saudi Arabia"], ["QA", "QAT", "Qatar"], ["IL", "ISR", "Israel"], ["IN", "IND", "India"], ["PK", "PAK", "Pakistan"], ["CN", "CHN", "China"],
  ["JP", "JPN", "Japan"], ["KR", "KOR", "South Korea", ["Korea"]], ["SG", "SGP", "Singapore"], ["MY", "MYS", "Malaysia"], ["ID", "IDN", "Indonesia"],
  ["PH", "PHL", "Philippines"], ["AU", "AUS", "Australia"], ["NZ", "NZL", "New Zealand"], ["BR", "BRA", "Brazil"], ["MX", "MEX", "Mexico"], ["AR", "ARG", "Argentina"],
  ["CO", "COL", "Colombia"], ["JM", "JAM", "Jamaica"], ["TT", "TTO", "Trinidad and Tobago"], ["BB", "BRB", "Barbados"], ["HT", "HTI", "Haiti"], ["CU", "CUB", "Cuba"],
];

export const COUNTRIES: Country[] = ROWS.map(([code, code3, name, aka]) => ({ code, code3, name, aka: aka ?? [] }));

// A flag is two "regional indicator" letters; Noto Color Emoji draws them on every device (Windows shows only the letters otherwise).
export const flagOf = (code: string) => String.fromCodePoint(...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
export const flagCode = (code: string) => `:x-flag-${code.toLowerCase()}:`;

// The country outlines among our drawings (lib/africa-drawings.ts), as emoji codes.
export const COUNTRY_MAPS: Record<string, string> = { NG: ":x-nigeria:", GH: ":x-ghana:", KE: ":x-kenya:", ZA: ":x-south-africa:", EG: ":x-egypt:" };
