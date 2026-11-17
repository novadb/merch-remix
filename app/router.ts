import { compression } from 'remix/middleware/compression'
import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import controller from './actions/controller.tsx'
import pageController from './actions/page/controller.tsx'
import searchController from './actions/search/controller.tsx'
import { assets } from './assets.ts'
import { oneUrl } from './middleware/one-url.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    logger(),
    compression(),
    staticFiles('./public', { index: false, cacheControl: 'public, max-age=3600' }),
    oneUrl(),
    formData(),
    render({ assets, onError: (error) => console.error(error) }),
  ],
})

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, controller)
router.map(routes.page, pageController)
router.map(routes.search, searchController)
