# Weather integration

Run with `npm run dev`. Restart Vite after changing `.env.local` or proxy config.

- Provider: KMA short-term forecast service v2, getUltraSrtNcst.
- Browser calls `/api/weather`; Vite development proxy adds `KMA_SERVICE_KEY` on the server. Never prefix this secret with VITE_. Both raw and URL-encoded keys are accepted by the current configuration.
- Weather display follows the selected legal dong's representative point. With all dong selected, it uses campus P2 (127.053828125, 37.0325125). These are 5 km grid observations; nearby dong may share the same weather grid. Future CFD requests must independently capture weather at the campus reference, not implicitly use the selected display district.
- Queries KST hourly observations, allowing publication delay until :45 and falling back up to two additional hours when NO_DATA is returned. Refresh every 10 minutes or manually.
- Shows observation time, wind direction/speed, temperature, humidity, loading and errors. Errors do not fall back to mock readings.
- Leak events, event timestamps and dispersion polygons remain mock data and do not use weather values for dispersion calculation.
- IMPORTANT: Vite proxy works only with the development server. A production deployment needs a backend/serverless `/api/weather` endpoint with the same contract and server-side credential, parameter validation, caching/rate limiting and timeouts. `vite preview` and static hosting alone do not provide this endpoint.
