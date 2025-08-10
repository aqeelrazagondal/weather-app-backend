import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable, from, of } from 'rxjs';
import { catchError, debounceTime, map } from 'rxjs/operators';
import axios from 'axios';
import crypto from 'crypto';
import type { LocationSearchResult } from '../types/location-search.types';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';

interface SearchResultWithScore extends LocationSearchResult {
  score: number;
  // Optional enrichment fields
  id?: string;
  displayName?: string;
  countryName?: string;
  timezone?: string;
  population?: number;
  bbox?: number[];
  importance?: number;
}

@Injectable()
export class LocationSearchService {
  private readonly apiKey: string;
  private readonly geoApiUrl = 'https://api.openweathermap.org/geo/1.0/direct';
  private readonly MINIMUM_QUERY_LENGTH = 2;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly regionNames = new Intl.DisplayNames(['en'], {
    type: 'region',
  });
  private readonly OWM_LIMIT_PER_HOUR = 2000;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.apiKey = this.configService.getOrThrow('OPENWEATHER_API_KEY');
  }

  searchLocationsWithAutocomplete(
    query: string,
    limit = 5,
  ): Observable<LocationSearchResult[]> {
    if (query.length < this.MINIMUM_QUERY_LENGTH) {
      return of([]);
    }

    return from(this.getCachedOrFetchLocations(query, limit)).pipe(
      debounceTime(300),
      map((locations) => this.processSearchResults(locations, query)),
      catchError(() => {
        throw new HttpException(
          'Failed to fetch location data',
          HttpStatus.BAD_REQUEST,
        );
      }),
    );
  }

  private async getCachedOrFetchLocations(
    query: string,
    limit: number,
  ): Promise<LocationSearchResult[]> {
    const cacheKey = `location_search_${query.toLowerCase()}`;
    const cached =
      await this.cacheManager.get<LocationSearchResult[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const results = await this.fetchLocations(query, limit);
    await this.cacheManager.set(cacheKey, results, this.CACHE_TTL);

    return results;
  }

  private async fetchLocations(
    query: string,
    limit: number,
  ): Promise<LocationSearchResult[]> {
    try {
      // Throttle before outbound request
      await this.rateLimiter.consume(
        'owm:requests',
        this.OWM_LIMIT_PER_HOUR,
        3600,
      );

      const { data } = await axios.get<
        Array<{
          name: string;
          local_names?: Record<string, string>;
          lat: number;
          lon: number;
          country: string;
          state?: string;
          population?: number;
          bbox?: number[];
          importance?: number;
          timezone?: string;
        }>
      >(this.geoApiUrl, {
        params: {
          q: query,
          limit,
          appid: this.apiKey,
        },
      });

      return this.transformLocations(data);
    } catch {
      // Preserve your existing error mapping
      throw new HttpException(
        'Failed to fetch location data',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private transformLocations(
    data: Array<{
      name: string;
      local_names?: Record<string, string>;
      lat: number;
      lon: number;
      country: string;
      state?: string;
      population?: number;
      bbox?: number[];
      importance?: number;
      timezone?: string;
    }>,
  ): LocationSearchResult[] {
    return data.map((location) => {
      const displayName = this.buildDisplayName(
        location.name,
        location.state,
        location.country,
      );
      const id = this.buildStableId(
        location.name,
        location.country,
        location.lat,
        location.lon,
      );
      const countryName = this.toCountryName(location.country);

      return {
        name: location.name,
        country: location.country,
        state: location.state,
        lat: location.lat,
        lon: location.lon,
        displayName,
        id,
        countryName,
        // The following are optional and depend on upstream support (not provided by OpenWeather):
        timezone: location.timezone, // likely undefined
        population: location.population, // likely undefined
        bbox: location.bbox, // likely undefined
        importance: location.importance, // likely undefined
      } as unknown as LocationSearchResult; // cast to keep compatibility with extended DTO at runtime
    });
  }

  private processSearchResults(
    locations: LocationSearchResult[],
    query: string,
  ): LocationSearchResult[] {
    const normalizedQuery = query.toLowerCase();

    const withScores: SearchResultWithScore[] = locations.map((location) => ({
      ...location,
      score: this.calculateRelevanceScore(location, normalizedQuery),
    }));

    withScores.sort((a, b) => b.score - a.score);

    // strip score before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return withScores.map(({ score, ...rest }) => rest as LocationSearchResult);
  }

  private calculateRelevanceScore(
    location: LocationSearchResult,
    query: string,
  ): number {
    const name = location.name.toLowerCase();
    const SCORE = {
      EXACT_MATCH: 100,
      STARTS_WITH: 75,
      CONTAINS: 50,
      STATE_MATCH: 25,
    };

    let total = 0;

    if (name === query) {
      total += SCORE.EXACT_MATCH;
    } else if (name.startsWith(query)) {
      total += SCORE.STARTS_WITH;
    } else if (name.includes(query)) {
      total += SCORE.CONTAINS;
    }

    if (location.state?.toLowerCase().includes(query)) {
      total += SCORE.STATE_MATCH;
    }

    return total;
  }

  private buildStableId(
    name: string,
    country: string,
    lat: number,
    lon: number,
  ): string {
    const h = crypto.createHash('sha1');
    h.update(`${name}|${country}|${lat}|${lon}`);
    return h.digest('hex');
  }

  private toCountryName(countryCode: string): string | undefined {
    try {
      return this.regionNames.of(countryCode);
    } catch {
      return undefined;
    }
  }

  private buildDisplayName(
    name: string,
    state: string | undefined,
    country: string,
  ): string {
    const parts = [name];
    if (state) parts.push(state);
    parts.push(country);
    return parts.join(', ');
  }
}
