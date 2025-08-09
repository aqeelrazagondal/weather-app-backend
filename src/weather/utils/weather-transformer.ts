import {
  WeatherDailySummary,
  WeatherForecastPoint,
} from '../types/forecast.types';

export class WeatherTransformer {
  // 16-point compass
  getWindDirection(deg: number): string {
    if (deg == null || Number.isNaN(deg)) return 'N';
    const dirs = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const idx = Math.round(deg / 22.5) % 16;
    return dirs[idx];
  }

  calculateDailyAverages(
    points: WeatherForecastPoint[],
  ): WeatherDailySummary[] {
    // Group by date (UTC)
    const groups = new Map<string, WeatherForecastPoint[]>();
    for (const p of points) {
      const date = new Date(p.timestamp * 1000).toISOString().slice(0, 10);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(p);
    }

    const summaries: WeatherDailySummary[] = [];
    for (const [date, arr] of groups.entries()) {
      if (arr.length === 0) continue;
      const avgWindSpeed =
        arr.reduce((sum, x) => sum + x.windSpeed, 0) / arr.length;

      // Determine predominant direction by mode
      const freq = new Map<string, number>();
      let predominantDirection = 'N';
      let maxCount = 0;
      let maxGust: number | undefined = undefined;

      for (const x of arr) {
        const count = (freq.get(x.windDirection) ?? 0) + 1;
        freq.set(x.windDirection, count);
        if (count > maxCount) {
          maxCount = count;
          predominantDirection = x.windDirection;
        }
        if (x.windGust != null) {
          maxGust = Math.max(maxGust ?? x.windGust, x.windGust);
        }
      }

      summaries.push({
        date,
        avgWindSpeed: Number(avgWindSpeed.toFixed(2)),
        predominantDirection,
        maxWindGust: maxGust != null ? Number(maxGust.toFixed(2)) : undefined,
      });
    }

    // Sort by date asc
    summaries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return summaries;
  }
}
