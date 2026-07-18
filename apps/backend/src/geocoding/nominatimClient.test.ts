import { describe, expect, it, vi } from 'vitest';
import { createNominatimClient } from './nominatimClient';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('createNominatimClient.search', () => {
  it('sends a required User-Agent header and the expected query params', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = createNominatimClient({ userAgent: 'AstroCalc/1.0 (test@example.com)', fetchImpl });

    await client.search('Şəki', 5);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.searchParams.get('q')).toBe('Şəki');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('limit')).toBe('5');
    expect((calledInit.headers as Record<string, string>)['User-Agent']).toBe(
      'AstroCalc/1.0 (test@example.com)',
    );
  });

  it('maps Nominatim entries to PlaceResult-shaped records', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        { place_id: 123, lat: '41.19', lon: '47.17', display_name: 'Shaki, Azerbaijan', name: 'Shaki' },
      ]),
    );
    const client = createNominatimClient({ userAgent: 'test', fetchImpl });

    const results = await client.search('Shaki', 5);

    expect(results).toEqual([
      { id: 'nominatim:123', name: 'Shaki', region: 'Shaki, Azerbaijan', lat: 41.19, lng: 47.17 },
    ]);
  });

  it('falls back to the first display_name segment when name is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([{ place_id: 1, lat: '1', lon: '2', display_name: 'Foo, Bar, Baz' }]),
    );
    const client = createNominatimClient({ userAgent: 'test', fetchImpl });

    const [result] = await client.search('foo', 1);

    expect(result?.name).toBe('Foo');
  });

  it('throws when the upstream response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 503));
    const client = createNominatimClient({ userAgent: 'test', fetchImpl });

    await expect(client.search('x', 1)).rejects.toThrow(/503/);
  });
});
