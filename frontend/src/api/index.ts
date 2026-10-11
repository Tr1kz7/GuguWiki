import { HttpApi } from './http'
import { MockApi } from './mock'
import type { GuguApi } from './types'

export const api: GuguApi = import.meta.env.VITE_API_MODE === 'http' ? new HttpApi() : new MockApi()
export type { GuguApi } from './types'
