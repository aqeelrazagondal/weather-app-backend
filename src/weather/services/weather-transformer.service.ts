import { Injectable } from '@nestjs/common';
import {
  ForecastData,
  WeatherData,
  WeatherForecastData,
  WindData,
} from '../../shared/types/weather.types';

type DailyGroup = {
  speeds: number[];
  directions: string[];
};

@Injectable()
export class WeatherTransformerService {
  private readonly DIRECTIONS = [
    'N',
    'NE',
    'E',
    'SE',
    'S',
    'SW',
    'W',
    'NW',
  ] as const;
  private readonly DEFAULT_DIRECTION = 'N/A';

  getWindDirection(degrees: number): string {
    if (!Number.isFinite(degrees)) return this.DEFAULT_DIRECTION;
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.round(normalized / 45) % 8;
    return this.DIRECTIONS[index];
  }

  transformWindData(speed: number, degrees: number): WindData {
    const validSpeed = Number.isFinite(speed) ? speed : 0;
    const validDegrees = Number.isFinite(degrees) ? degrees : 0;

    return {
      speed: validSpeed,
      degrees: validDegrees,
      direction: this.getWindDirection(validDegrees),
    };
  }

  transformWeatherData(data: {
    temp: number;
    speed: number;
    deg: number;
  }): WeatherData {
    const windData = this.transformWindData(data.speed, data.deg);
    return {
      temperature: Number.isFinite(data.temp) ? data.temp : 0,
      windSpeed: windData.speed,
      windDirection: windData.direction,
    };
  }

  calculateDailyAverages(data: WeatherForecastData[]): ForecastData['daily'] {
    if (!Array.isArray(data)) return [];

    const dailyMap = data.reduce(
      (acc, item) => {
        const date = new Date(item.timestamp * 1000)
          .toISOString()
          .split('T')[0];
        if (!acc[date]) {
          acc[date] = { speeds: [], directions: [] };
        }
        acc[date].speeds.push(item.windSpeed);
        acc[date].directions.push(item.windDirection);
        return acc;
      },
      {} as Record<string, DailyGroup>,
    );

    return Object.entries(dailyMap).map(([date, group]) => ({
      date,
      avgWindSpeed: this.calculateAverage(group.speeds),
      predominantDirection: this.getMostFrequent(group.directions),
    }));
  }

  private calculateAverage(numbers: number[]): number {
    if (!numbers.length) return 0;
    const sum = numbers.reduce(
      (acc, val) => acc + (Number.isFinite(val) ? val : 0),
      0,
    );
    return Number((sum / numbers.length).toFixed(1));
  }

  private getMostFrequent(arr: string[]): string {
    if (!arr.length) return this.DEFAULT_DIRECTION;
    const counts = arr.reduce(
      (acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  }
}
