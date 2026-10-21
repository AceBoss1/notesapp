// Places for the Talks section's globe (lib/site-kits.ts): a member types where they spoke and, when it's one of these, the talk gets its
// dot on the globe without anyone typing coordinates. Anywhere else can still be given as latitude and longitude. Pure.
export const PLACES: Record<string, [number, number]> = {
  // Nigeria
  "Lagos, Nigeria": [6.52, 3.38], "Abuja, Nigeria": [9.08, 7.4], "Ibadan, Nigeria": [7.38, 3.94], "Port Harcourt, Nigeria": [4.82, 7.03],
  "Kano, Nigeria": [12.0, 8.52], "Enugu, Nigeria": [6.44, 7.5], "Benin City, Nigeria": [6.34, 5.63], "Kaduna, Nigeria": [10.52, 7.44],
  "Ile-Ife, Nigeria": [7.48, 4.56], "Nsukka, Nigeria": [6.86, 7.4], "Zaria, Nigeria": [11.08, 7.71], "Calabar, Nigeria": [4.95, 8.32],
  "Jos, Nigeria": [9.9, 8.86], "Ilorin, Nigeria": [8.5, 4.55], "Owerri, Nigeria": [5.48, 7.03], "Uyo, Nigeria": [5.04, 7.92],
  "Abeokuta, Nigeria": [7.15, 3.35], "Akure, Nigeria": [7.25, 5.2], "Warri, Nigeria": [5.52, 5.75], "Maiduguri, Nigeria": [11.83, 13.15],
  "Sokoto, Nigeria": [13.06, 5.24], "Asaba, Nigeria": [6.2, 6.73], "Awka, Nigeria": [6.21, 7.07], "Osogbo, Nigeria": [7.77, 4.56],
  // Africa
  "Accra, Ghana": [5.6, -0.19], "Kumasi, Ghana": [6.69, -1.62], "Nairobi, Kenya": [-1.29, 36.82], "Kigali, Rwanda": [-1.95, 30.06],
  "Addis Ababa, Ethiopia": [9.03, 38.74], "Cairo, Egypt": [30.04, 31.24], "Johannesburg, South Africa": [-26.2, 28.05],
  "Cape Town, South Africa": [-33.92, 18.42], "Pretoria, South Africa": [-25.75, 28.19], "Durban, South Africa": [-29.86, 31.02],
  "Dakar, Senegal": [14.72, -17.47], "Abidjan, Côte d'Ivoire": [5.36, -4.01], "Kampala, Uganda": [0.35, 32.58],
  "Dar es Salaam, Tanzania": [-6.79, 39.21], "Lusaka, Zambia": [-15.39, 28.32], "Harare, Zimbabwe": [-17.83, 31.05],
  "Casablanca, Morocco": [33.57, -7.59], "Rabat, Morocco": [34.02, -6.83], "Tunis, Tunisia": [36.81, 10.18], "Algiers, Algeria": [36.75, 3.06],
  "Lomé, Togo": [6.13, 1.22], "Cotonou, Benin": [6.37, 2.39], "Douala, Cameroon": [4.05, 9.7], "Yaoundé, Cameroon": [3.87, 11.52],
  "Kinshasa, DR Congo": [-4.44, 15.27], "Luanda, Angola": [-8.84, 13.23], "Freetown, Sierra Leone": [8.48, -13.23], "Monrovia, Liberia": [6.31, -10.8],
  "Banjul, The Gambia": [13.45, -16.58], "Gaborone, Botswana": [-24.65, 25.91], "Windhoek, Namibia": [-22.56, 17.08], "Maputo, Mozambique": [-25.97, 32.57],
  // Europe
  "London, United Kingdom": [51.51, -0.13], "Oxford, United Kingdom": [51.75, -1.26], "Cambridge, United Kingdom": [52.21, 0.12],
  "Manchester, United Kingdom": [53.48, -2.24], "Edinburgh, United Kingdom": [55.95, -3.19], "Birmingham, United Kingdom": [52.49, -1.89],
  "Glasgow, United Kingdom": [55.86, -4.25], "Dublin, Ireland": [53.35, -6.26], "Paris, France": [48.86, 2.35], "Lyon, France": [45.76, 4.84],
  "Berlin, Germany": [52.52, 13.4], "Munich, Germany": [48.14, 11.58], "Heidelberg, Germany": [49.4, 8.69], "Hamburg, Germany": [53.55, 9.99],
  "Amsterdam, Netherlands": [52.37, 4.9], "Leiden, Netherlands": [52.16, 4.49], "Brussels, Belgium": [50.85, 4.35], "Geneva, Switzerland": [46.2, 6.14],
  "Zurich, Switzerland": [47.38, 8.54], "Lausanne, Switzerland": [46.52, 6.63], "Vienna, Austria": [48.21, 16.37], "Rome, Italy": [41.9, 12.5],
  "Milan, Italy": [45.46, 9.19], "Madrid, Spain": [40.42, -3.7], "Barcelona, Spain": [41.39, 2.17], "Lisbon, Portugal": [38.72, -9.14],
  "Copenhagen, Denmark": [55.68, 12.57], "Stockholm, Sweden": [59.33, 18.07], "Oslo, Norway": [59.91, 10.75], "Helsinki, Finland": [60.17, 24.94],
  "Warsaw, Poland": [52.23, 21.01], "Prague, Czechia": [50.08, 14.44], "Budapest, Hungary": [47.5, 19.04], "Athens, Greece": [37.98, 23.73],
  "Istanbul, Türkiye": [41.01, 28.98], "Moscow, Russia": [55.76, 37.62],
  // The Americas
  "New York, United States": [40.71, -74.01], "Boston, United States": [42.36, -71.06], "Cambridge, United States": [42.37, -71.11],
  "Washington, United States": [38.91, -77.04], "Philadelphia, United States": [39.95, -75.17], "Baltimore, United States": [39.29, -76.61],
  "Chicago, United States": [41.88, -87.63], "Atlanta, United States": [33.75, -84.39], "Houston, United States": [29.76, -95.37],
  "Austin, United States": [30.27, -97.74], "Dallas, United States": [32.78, -96.8], "Miami, United States": [25.76, -80.19],
  "San Francisco, United States": [37.77, -122.42], "Stanford, United States": [37.43, -122.17], "Los Angeles, United States": [34.05, -118.24],
  "San Diego, United States": [32.72, -117.16], "Seattle, United States": [47.61, -122.33], "Denver, United States": [39.74, -104.99],
  "New Haven, United States": [41.31, -72.92], "Princeton, United States": [40.36, -74.66], "Ann Arbor, United States": [42.28, -83.74],
  "Pittsburgh, United States": [40.44, -79.99], "Minneapolis, United States": [44.98, -93.27], "Toronto, Canada": [43.65, -79.38],
  "Montreal, Canada": [45.5, -73.57], "Vancouver, Canada": [49.28, -123.12], "Ottawa, Canada": [45.42, -75.7], "Mexico City, Mexico": [19.43, -99.13],
  "São Paulo, Brazil": [-23.55, -46.63], "Rio de Janeiro, Brazil": [-22.91, -43.17], "Buenos Aires, Argentina": [-34.6, -58.38],
  "Santiago, Chile": [-33.45, -70.67], "Bogotá, Colombia": [4.71, -74.07], "Lima, Peru": [-12.05, -77.04], "Kingston, Jamaica": [18.0, -76.79],
  // Asia, the Middle East and Oceania
  "Dubai, United Arab Emirates": [25.2, 55.27], "Abu Dhabi, United Arab Emirates": [24.45, 54.38], "Doha, Qatar": [25.29, 51.53],
  "Riyadh, Saudi Arabia": [24.71, 46.68], "Jeddah, Saudi Arabia": [21.49, 39.19], "Tel Aviv, Israel": [32.09, 34.78], "Amman, Jordan": [31.95, 35.93],
  "Beirut, Lebanon": [33.89, 35.5], "Tehran, Iran": [35.69, 51.39], "Karachi, Pakistan": [24.86, 67.0], "Lahore, Pakistan": [31.55, 74.34],
  "New Delhi, India": [28.61, 77.21], "Mumbai, India": [19.08, 72.88], "Bengaluru, India": [12.97, 77.59], "Chennai, India": [13.08, 80.27],
  "Hyderabad, India": [17.39, 78.49], "Kolkata, India": [22.57, 88.36], "Dhaka, Bangladesh": [23.81, 90.41], "Colombo, Sri Lanka": [6.93, 79.86],
  "Singapore": [1.35, 103.82], "Kuala Lumpur, Malaysia": [3.14, 101.69], "Bangkok, Thailand": [13.76, 100.5], "Jakarta, Indonesia": [-6.21, 106.85],
  "Manila, Philippines": [14.6, 120.98], "Hanoi, Vietnam": [21.03, 105.85], "Ho Chi Minh City, Vietnam": [10.82, 106.63],
  "Hong Kong": [22.32, 114.17], "Beijing, China": [39.9, 116.41], "Shanghai, China": [31.23, 121.47], "Shenzhen, China": [22.54, 114.06],
  "Taipei, Taiwan": [25.03, 121.57], "Seoul, South Korea": [37.57, 126.98], "Tokyo, Japan": [35.68, 139.69], "Kyoto, Japan": [35.01, 135.77],
  "Osaka, Japan": [34.69, 135.5], "Sydney, Australia": [-33.87, 151.21], "Melbourne, Australia": [-37.81, 144.96], "Brisbane, Australia": [-27.47, 153.03],
  "Perth, Australia": [-31.95, 115.86], "Canberra, Australia": [-35.28, 149.13], "Auckland, New Zealand": [-36.85, 174.76], "Wellington, New Zealand": [-41.29, 174.78],
};
export const PLACE_NAMES = Object.keys(PLACES);
const key = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const BY_KEY = new Map<string, [number, number]>();
for (const [name, c] of Object.entries(PLACES)) {
  BY_KEY.set(key(name), c);
  const city = key(name.split(",")[0]);
  if (!BY_KEY.has(city)) BY_KEY.set(city, c); // "Lagos" alone works; the first of two Cambridges is the UK one
}
// The coordinates of a place by its name ("Lagos, Nigeria", "lagos", "Sao Paulo"), or null.
export function placeCoords(name: string): [number, number] | null {
  return BY_KEY.get(key(name)) ?? null;
}
