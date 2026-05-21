import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import { DataLoaderAI } from 'dataloader-ai'

type User = { id: string; name: string; email: string; tier: string }
type Product = { id: string; name: string; price: number; categoryId: string }
type Category = { id: string; name: string; slug: string }
type Review = { id: string; productId: string; userId: string; rating: number; body: string }
type Order = { id: string; userId: string; productId: string; quantity: number; total: number }

const userDB: Record<string, User> = Object.fromEntries(
  Array.from({ length: 50 }, (_, i) => [
    String(i + 1),
    { id: String(i + 1), name: `User ${i + 1}`, email: `user${i + 1}@example.com`, tier: i < 10 ? 'premium' : 'free' },
  ])
)

const categoryDB: Record<string, Category> = {
  c1: { id: 'c1', name: 'Electronics', slug: 'electronics' },
  c2: { id: 'c2', name: 'Books', slug: 'books' },
  c3: { id: 'c3', name: 'Clothing', slug: 'clothing' },
  c4: { id: 'c4', name: 'Home', slug: 'home' },
}

const productDB: Record<string, Product> = Object.fromEntries(
  Array.from({ length: 200 }, (_, i) => [
    String(i + 1),
    {
      id: String(i + 1),
      name: `Product ${i + 1}`,
      price: Math.round((10 + Math.random() * 490) * 100) / 100,
      categoryId: [`c1`, `c2`, `c3`, `c4`][i % 4],
    },
  ])
)

const reviewDB: Review[] = Array.from({ length: 500 }, (_, i) => ({
  id: String(i + 1),
  productId: String((i % 200) + 1),
  userId: String((i % 50) + 1),
  rating: 1 + Math.floor(Math.random() * 5),
  body: `Review ${i + 1}`,
}))

const orderDB: Order[] = Array.from({ length: 1000 }, (_, i) => ({
  id: String(i + 1),
  userId: String((i % 50) + 1),
  productId: String((i % 200) + 1),
  quantity: 1 + Math.floor(Math.random() * 5),
  total: Math.round((20 + Math.random() * 480) * 100) / 100,
}))

async function batchUsers(ids: readonly string[]) {
  await new Promise(r => setTimeout(r, 12 + Math.random() * 8))
  return ids.map(id => userDB[id] ?? new Error(`User ${id} not found`))
}

async function batchProducts(ids: readonly string[]) {
  await new Promise(r => setTimeout(r, 5 + Math.random() * 10))
  return ids.map(id => productDB[id] ?? new Error(`Product ${id} not found`))
}

async function batchCategories(ids: readonly string[]) {
  await new Promise(r => setTimeout(r, 3 + Math.random() * 4))
  return ids.map(id => categoryDB[id] ?? new Error(`Category ${id} not found`))
}

async function batchReviewsByProduct(productIds: readonly string[]) {
  await new Promise(r => setTimeout(r, 8 + Math.random() * 12))
  return productIds.map(pid => reviewDB.filter(r => r.productId === pid))
}

async function batchOrdersByUser(userIds: readonly string[]) {
  await new Promise(r => setTimeout(r, 15 + Math.random() * 20))
  return userIds.map(uid => orderDB.filter(o => o.userId === uid))
}

function createContext() {
  const userLoader = new DataLoaderAI(batchUsers, { name: 'user' })
  const productLoader = new DataLoaderAI(batchProducts, { name: 'product' })
  const categoryLoader = new DataLoaderAI(batchCategories, { name: 'category' })
  const reviewsLoader = new DataLoaderAI(batchReviewsByProduct, { name: 'reviews' })
  const ordersLoader = new DataLoaderAI(batchOrdersByUser, { name: 'orders' })

  return { userLoader, productLoader, categoryLoader, reviewsLoader, ordersLoader }
}

type Context = ReturnType<typeof createContext>

const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    tier: String!
    orders: [Order!]!
  }
  type Product {
    id: ID!
    name: String!
    price: Float!
    category: Category!
    reviews: [Review!]!
  }
  type Category {
    id: ID!
    name: String!
    slug: String!
  }
  type Review {
    id: ID!
    rating: Int!
    body: String!
    user: User!
  }
  type Order {
    id: ID!
    product: Product!
    quantity: Int!
    total: Float!
  }

  type Query {
    products(limit: Int): [Product!]!
    user(id: ID!): User
    topReviews(limit: Int): [Review!]!
  }
`

const resolvers = {
  Query: {
    products: (_: unknown, { limit = 10 }: { limit?: number }) =>
      Object.values(productDB).slice(0, limit),
    user: (_: unknown, { id }: { id: string }, ctx: Context) => ctx.userLoader.load(id),
    topReviews: (_: unknown, { limit = 5 }: { limit?: number }) => reviewDB.slice(0, limit),
  },
  Product: {
    category: (product: Product, _: unknown, ctx: Context) =>
      ctx.categoryLoader.load(product.categoryId),
    reviews: (product: Product, _: unknown, ctx: Context) =>
      ctx.reviewsLoader.load(product.id),
  },
  Review: {
    user: (review: Review, _: unknown, ctx: Context) =>
      ctx.userLoader.load(review.userId),
  },
  User: {
    orders: (user: User, _: unknown, ctx: Context) =>
      ctx.ordersLoader.load(user.id),
  },
  Order: {
    product: (order: Order, _: unknown, ctx: Context) =>
      ctx.productLoader.load(order.productId),
  },
}

const server = new ApolloServer<Context>({ typeDefs, resolvers })

const { url } = await startStandaloneServer(server, {
  context: async () => createContext(),
  listen: { port: 4000 },
})

console.log(`E-commerce GraphQL server ready at ${url}`)
console.log(`Try: { products(limit: 20) { name price category { name } reviews { rating user { name } } } }`)
console.log(`Local mode — metrics streaming in your terminal`)
