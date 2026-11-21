/** Keep backend refusal reasons visible; identify missing routes when no JSON reason exists. */
export function responseErrorMessage(error: any): string {
  const body = error.response?.data
  const reason = body && typeof body === 'object' ? body.error || body.message : ''
  if (typeof reason === 'string' && reason.trim())
    return reason
  const status = error.response?.status
  const request = `${String(error.config?.method || 'GET').toUpperCase()} ${String(error.config?.url || '')}`
  return status === 404 ? `接口不存在（404）：${request}` : `请求失败（${status}）：${request}`
}
