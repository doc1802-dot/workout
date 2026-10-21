import { supabase } from './supabase'
export async function api(path, { body, headers, ...options } = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) throw error
  if (!session) throw new Error('로그인이 필요합니다.')
  const multipart = body instanceof FormData
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  })
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : data?.detail
          ? JSON.stringify(data.detail)
          : `요청에 실패했습니다. (${response.status})`,
    )
  return data
}
