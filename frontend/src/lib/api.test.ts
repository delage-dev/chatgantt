/**
 * Tests for the API client.
 *
 * Single-tenant mode: the backend holds all credentials server-side.
 * The browser must NOT send any provider/auth headers — requests are plain
 * JSON with only Content-Type. These tests verify that contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Capture what headers the api client sends on a GET and a POST
describe('api client — no credential headers in requests', () => {
  let captured: Headers[] = [];

  beforeEach(() => {
    captured = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        captured.push(new Headers(init?.headers as HeadersInit | undefined));
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
        );
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchTasks sends no X-Provider header', async () => {
    const { fetchTasks } = await import('../utils/api');
    await fetchTasks();
    expect(captured.length).toBeGreaterThan(0);
    for (const h of captured) {
      expect(h.get('X-Provider')).toBeNull();
    }
  });

  it('fetchTasks sends no Authorization header', async () => {
    const { fetchTasks } = await import('../utils/api');
    await fetchTasks();
    for (const h of captured) {
      expect(h.get('Authorization')).toBeNull();
    }
  });

  it('fetchTasks sends no X-Project header', async () => {
    const { fetchTasks } = await import('../utils/api');
    await fetchTasks();
    for (const h of captured) {
      expect(h.get('X-Project')).toBeNull();
    }
  });

  it('fetchTasks sends Content-Type: application/json', async () => {
    const { fetchTasks } = await import('../utils/api');
    await fetchTasks();
    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0].get('Content-Type')).toBe('application/json');
  });

  it('sendChatMessage sends no credential headers', async () => {
    // stub for POST which returns a ChatResponse shape
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        captured.push(new Headers(init?.headers as HeadersInit | undefined));
        return Promise.resolve(
          new Response(
            JSON.stringify({ message: { role: 'assistant', content: 'ok' }, tool_executions: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      })
    );

    const { sendChatMessage } = await import('../utils/api');
    await sendChatMessage({
      messages: [{ role: 'user', content: 'hello' }],
      project_context: { project_key: 'DEMO', tasks: [] },
    });

    expect(captured.length).toBeGreaterThan(0);
    for (const h of captured) {
      expect(h.get('X-Provider')).toBeNull();
      expect(h.get('Authorization')).toBeNull();
      expect(h.get('X-Project')).toBeNull();
    }
  });
});
