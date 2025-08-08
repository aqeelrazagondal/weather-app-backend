export interface LocationSearchResult {
  name: string;
  country: string;
  state?: string;
  lat: number;
  lon: number;
}

export interface OpenWeatherGeoResponse {
  name: string;
  country: string;
  state?: string;
  lat: number;
  lon: number;
  local_names?: Record<string, string>;
}