export interface WeatherForecastPoint {
  temperature: number;
  windSpeed: number;
  windGust?: number;
  windDirectionDeg: number;
  windDirection: string; // e.g., N, NE, E...
  timestamp: number; // unix seconds
}

export interface WeatherDailySummary {
  date: string; // YYYY-MM-DD in target timezone (UTC if not available)
  avgWindSpeed: number;
  predominantDirection: string;
  maxWindGust?: number;
}

export interface WindForecastResult {
  units: 'standard' | 'metric' | 'imperial';
  granularity: 'hourly' | 'daily';
  hourly?: WeatherForecastPoint[];
  daily?: WeatherDailySummary[];
}
