import { createServer } from 'node:http'

// The CI browser suite needs the real server-rendered catalog shell, with no
// production credentials or network dependency. Client operations have their
// own scoped Playwright fixtures. This server only supplies an empty catalog.
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end(JSON.stringify({ message: 'The catalog fixture is read-only.' }))
    return
  }
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  if (path === '/health') {
    response.end(JSON.stringify({ fixture: 'empty-readonly-catalog' }))
  } else if (path.startsWith('/rest/v1/')) {
    response.setHeader('Content-Range', '*/0')
    response.end('[]')
  } else {
    response.writeHead(404)
    response.end(JSON.stringify({ message: 'Unsupported fixture route.' }))
  }
})

server.listen(54321, '127.0.0.1', () => console.log('Read-only catalog fixture on 127.0.0.1:54321'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
