/**
 * Focused tests for provider header wiring in the API client.
 *
 * Verifies that getProviderHeaders() returns the correct headers based on
 * the settings store state: Notion headers when configured, mock fallback when not.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../store/settingsStore';
import { getProviderHeaders } from '../store/settingsStore';

beforeEach(() => {
  // Reset store to default state before each test
  useSettingsStore.setState({
    provider: 'mock',
    notionToken: '',
    projectDataSourceId: '',
    blockersDataSourceId: '',
  });
});

describe('getProviderHeaders — mock fallback', () => {
  it('returns mock headers when provider is mock', () => {
    const headers = getProviderHeaders();
    expect(headers['X-Provider']).toBe('mock');
    expect(headers['X-Project']).toBe('DEMO');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('falls back to mock when notion provider is set but token is missing', () => {
    useSettingsStore.setState({ provider: 'notion', notionToken: '', projectDataSourceId: 'ds-123' });
    const headers = getProviderHeaders();
    expect(headers['X-Provider']).toBe('mock');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('falls back to mock when notion provider is set but project id is missing', () => {
    useSettingsStore.setState({ provider: 'notion', notionToken: 'secret_abc', projectDataSourceId: '' });
    const headers = getProviderHeaders();
    expect(headers['X-Provider']).toBe('mock');
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('getProviderHeaders — notion provider', () => {
  it('returns Notion headers when fully configured', () => {
    useSettingsStore.setState({
      provider: 'notion',
      notionToken: 'secret_test_token',
      projectDataSourceId: 'tasks-ds-id',
      blockersDataSourceId: 'blockers-ds-id',
    });

    const headers = getProviderHeaders();
    expect(headers['X-Provider']).toBe('notion');
    expect(headers['X-Project']).toBe('tasks-ds-id');
    expect(headers['Authorization']).toBe('Bearer secret_test_token');
    expect(headers['X-Notion-Blockers-Source']).toBe('blockers-ds-id');
  });

  it('omits X-Notion-Blockers-Source when blockers source is empty', () => {
    useSettingsStore.setState({
      provider: 'notion',
      notionToken: 'secret_test_token',
      projectDataSourceId: 'tasks-ds-id',
      blockersDataSourceId: '',
    });

    const headers = getProviderHeaders();
    expect(headers['X-Provider']).toBe('notion');
    expect(headers['X-Notion-Blockers-Source']).toBeUndefined();
  });

  it('Bearer token is built from notionToken without double-prefixing', () => {
    useSettingsStore.setState({
      provider: 'notion',
      notionToken: 'secret_abc123',
      projectDataSourceId: 'proj-id',
      blockersDataSourceId: '',
    });

    const { Authorization } = getProviderHeaders();
    expect(Authorization).toBe('Bearer secret_abc123');
    expect(Authorization).not.toContain('Bearer Bearer');
  });
});

describe('isConfigured', () => {
  it('mock provider is always considered configured', () => {
    useSettingsStore.setState({ provider: 'mock' });
    expect(useSettingsStore.getState().isConfigured()).toBe(true);
  });

  it('notion provider is configured when token + project id are set', () => {
    useSettingsStore.setState({
      provider: 'notion',
      notionToken: 'secret_x',
      projectDataSourceId: 'ds-x',
    });
    expect(useSettingsStore.getState().isConfigured()).toBe(true);
  });

  it('notion provider is not configured when fields are empty', () => {
    useSettingsStore.setState({ provider: 'notion', notionToken: '', projectDataSourceId: '' });
    expect(useSettingsStore.getState().isConfigured()).toBe(false);
  });
});
