# Weather API Service

A modern, scalable weather service built with NestJS, featuring real-time weather data, location search, and favorites management.

## Features

- 🌡️ Real-time weather data via OpenWeather API
- 🔍 Location search with autocomplete
- ⭐ Favorite locations management
- 📊 Weather forecasts with wind data analysis
- 🚀 Rate limiting and caching
- 📝 Swagger API documentation

## Architecture Overview

### Core Modules

1. **Weather Module**
    - Current weather data
    - 5-day forecast
    - Wind data analysis
    - Response caching

2. **Location Search Module**
    - City search with autocomplete
    - Geocoding support
    - Results caching
    - Rate limiting

3. **Locations Module**
    - Favorite locations management
    - PostgreSQL persistence
    - Weather data integration

### Technical Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis
- **API Documentation**: Swagger/OpenAPI
- **Weather Data**: OpenWeather API
- **Testing**: Jest
- **Type Safety**: TypeScript

### System Architecture
┌─────────────────┐ ┌──────────────┐ ┌─────────────┐ │ API Gateway │────▶│ Rate │────▶│ Redis │ │ (NestJS) │ │ Limiter │ │ Cache │ └─────────────────┘ └──────────────┘ └─────────────┘ │ ▲ ▼ │ ┌─────────────────┐ ┌──────────────┐ ┌─────────────┐ │ Controllers │────▶│ Services │────▶│ OpenWeather │ │ & Routes │ │ │ │ API │ └─────────────────┘ └──────────────┘ └─────────────┘ │ │ ▼ ▼ ┌─────────────────┐ ┌──────────────┐ │ TypeORM │────▶│ PostgreSQL │ │ Entities │ │ Database │ └─────────────────┘ └──────────────┘

## Setup Instructions

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis
- OpenWeather API key

### Installation

1. Clone the repository:

2. Install dependencies:
3. Environment setup:
4. Configure environment variables:


    # Server
    PORT=3000 NODE_ENV=development
    # Database
    DB_HOST=localhost DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=your_password DB_NAME=weather_db
    # Redis
    REDIS_HOST=localhost REDIS_PORT=6379
    # OpenWeather API
    OPENWEATHER_API_KEY=your_api_key OPENWEATHER_API_URL=[https://api.openweathermap.org/data/2.5](https://api.openweathermap.org/data/2.5)
5. Database setup:
### Running the Application
Development mode:
Production mode:
``` 
### API Documentation

Access Swagger documentation at:
```
[http://localhost:3000/api](http://localhost:3000/api)
## Rate Limiting

- Default: 30 requests per minute per IP
- OpenWeather API: 2000 requests per hour

## Caching Strategy

- Weather data: 30 minutes
- Location search: 1 hour
- Forecast data: 3 hours

## API Endpoints

### Weather
- `GET /v1/weather/current` - Current weather
- `GET /v1/weather/forecast` - Weather forecast

### Locations
- `GET /v1/locations` - List favorite locations
- `POST /v1/locations` - Add favorite location
- `DELETE /v1/locations/:id` - Remove location

### Search
- `GET /v1/location-search` - Search locations

## Error Handling

- Standard HTTP status codes
- Detailed error messages
- Rate limit notifications
- Validation error responses

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
