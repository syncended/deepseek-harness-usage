import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UsageRange, UsageSnapshot } from './types.js'

interface UsageSnapshotProvider {
  snapshot(range: UsageRange, timeZone: string): Promise<UsageSnapshot>
}

interface HttpLogger {
  warn(message: string, ...args: unknown[]): void
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = `${JSON.stringify(value)}\n`
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(body)
}

function validRange(value: string | null): UsageRange {
  if (value === null) return '30d'
  if (value === '30d' || value === '90d' || value === '365d' || value === 'all') return value
  throw Object.assign(new Error('range must be one of 30d, 90d, 365d, or all'), { status: 400 })
}

function validTimeZone(value: string | null): string {
  const timeZone = value?.trim() || 'UTC'
  if (timeZone.length > 100) throw Object.assign(new Error('timeZone is too long'), { status: 400 })
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
  } catch {
    throw Object.assign(new Error('timeZone is not recognized'), { status: 400 })
  }
  return timeZone
}

export function createUsageHttpHandler(
  service: UsageSnapshotProvider,
  prefix: string,
  logger: HttpLogger,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://dsh.local')
      const relative = url.pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '')
      if (relative !== '') return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Usage API route not found.' } })
      if ((request.method ?? 'GET') !== 'GET') {
        response.setHeader('allow', 'GET')
        return sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Allowed method: GET' } })
      }
      const range = validRange(url.searchParams.get('range'))
      const timeZone = validTimeZone(url.searchParams.get('timeZone'))
      return sendJson(response, 200, await service.snapshot(range, timeZone))
    } catch (error) {
      const maybeStatus = (error as { status?: unknown }).status
      const status = typeof maybeStatus === 'number' ? maybeStatus : 500
      const message = error instanceof Error ? error.message : String(error)
      if (status >= 500) logger.warn('usage: HTTP request failed: %s', message)
      return sendJson(response, status, {
        error: {
          code: status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
          message: status >= 500 ? 'Could not build usage analytics.' : message,
        },
      })
    }
  }
}
