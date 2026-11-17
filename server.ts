import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { assets } from './app/assets.ts'
import { router } from './app/router.ts'

const port = Number(process.env.PORT ?? 3000)

const server = http.createServer(
  createRequestListener(router.fetch, {
    // TLS ends at the ingress: its X-Forwarded-Proto and -Host make `request.url` the public https URL, which the
    // canonical links name. Turn it off where the site is reached directly, without a proxy: a client could forge them.
    trustProxy: true,
    onError(error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    },
  }),
)

server.listen(port, () => console.log(`Listening on http://localhost:${port}`))

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => assets.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
