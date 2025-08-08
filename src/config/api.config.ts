export const apiConfig = {
  openWeather: {
    apiKey: process.env.OPENWEATHER_API_KEY ?? '',
    apiUrl:
      process.env.OPENWEATHER_API_URL ??
      'https://api.openweathermap.org/data/2.5',
  },
};
