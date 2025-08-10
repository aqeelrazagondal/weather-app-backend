export interface WindData {
  speed: number;
  direction: string;
  degrees: number;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  timestamp?: number;
}

export interface WeatherForecastData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  timestamp: number;
}

export interface ForecastData {
  hourly: WeatherForecastData[];
  daily: {
    date: string;
    avgWindSpeed: number;
    predominantDirection: string;
  }[];
}

export interface OpenWeatherResponse {
  main: {
    temp: number;
  };
  wind: {
    speed: number;
    deg: number;
  };
  dt: number;
}

export interface OpenWeatherErrorResponse {
  message: string;
  cod: number;
}

export interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
    };
    wind: {
      speed: number;
      deg: number;
    };
  }>;
}

export interface WeatherApiResponse {
  data: OpenWeatherResponse | OpenWeatherForecastResponse;
  status: number;
}
