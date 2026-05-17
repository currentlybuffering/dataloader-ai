import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import DataLoaderAI from 'dataloader-ai'

const userDB: Record<string, { id: string; name: string; email: string }> = {
  '1': { id: '1', name: 'Alice', email: 'alice@example.com' },
  '2': { id: '2', name: 'Bob', email: 'bob@example.com' },
  '3': { id: '3', name: 'Carol', email: 'carol@example.com' },
}

async function batchLoadUsers(ids: readonly string[]) {
  console.log(`[batch] loading ${ids.length} users: ${ids.join(', ')}`)
  await new Promise(r => setTimeout(r, 20))
  return ids.map(id => userDB[id] ?? new Error(`User ${id} not found`))
}

const typeDefs = `#graphql
type User {
  id: ID!
  name: String!
  email: String!
}

type Post {
  id: ID!
  title: String!
  author: User!
}

type Query {
  posts: [Post!]!
  metrics: String!
}
`

const posts = [
  { id: '101', title: 'GraphQL Performance Tips', authorId: '1' },
  { id: '102', title: 'Why DataLoader Matters', authorId: '2' },
  { id: '103', title: 'Serverless at Scale', authorId: '1' },
  { id: '104', title: 'Understanding N+1', authorId: '3' },
]

function createContext() {
  const userLoader = new DataLoaderAI(batchLoadUsers, {
    name: 'user',
    optimizer: {
      targetLatencyMs: 30,
      minBatchSize: 1,
      maxBatchSize: 100,
      onBatchSizeChange: (oldSize, newSize, reason) => {
        console.log(`[dataloader-ai] user loader: ${oldSize} → ${newSize} (${reason})`)
      },
    },
    agent: {
      apiKey: process.env.DL_API_KEY ?? 'dev-key-local',
      flushIntervalMs: 3000,
    },
  })

  return { userLoader }
}

type Context = ReturnType<typeof createContext>

const resolvers = {
  Query: {
    posts: () => posts,
    metrics: (_: unknown, __: unknown, ctx: Context) => {
      return JSON.stringify(ctx.userLoader.getMetrics(), null, 2)
    },
  },
  Post: {
    author: (post: { authorId: string }, _: unknown, ctx: Context) =>
      ctx.userLoader.load(post.authorId),
  },
}

const server = new ApolloServer<Context>({ typeDefs, resolvers })

const { url } = await startStandaloneServer(server, {
  context: async () => createContext(),
  listen: { port: 4000 },
})

console.log(`Apollo Server ready at ${url}`)
console.log(`Try: { posts { title author { name } } }`)
