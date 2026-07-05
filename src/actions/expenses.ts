'use server'

import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { expenses, users } from '@/db/schema'
import { requireAuth, requireAdmin } from '@/lib/session'
import { expenseSchema } from '@/lib/validation'
import { run } from '@/lib/result'
import type { Expense, ExpenseFilters } from '@/lib/types'

export async function listExpenses(filters: ExpenseFilters = {}) {
  return run<Expense[]>(async () => {
    await requireAuth()
    const conds = []
    if (filters.from) conds.push(gte(expenses.spent_on, filters.from))
    if (filters.to) conds.push(lte(expenses.spent_on, filters.to))
    if (filters.category) conds.push(eq(expenses.category, filters.category))
    return db
      .select({
        id: expenses.id,
        category: expenses.category,
        description: expenses.description,
        amount: expenses.amount,
        spent_on: expenses.spent_on,
        created_by: expenses.created_by,
        created_at: expenses.created_at,
        created_by_name: users.name
      })
      .from(expenses)
      .innerJoin(users, eq(users.id, expenses.created_by))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(expenses.spent_on), desc(expenses.id))
      .limit(1000)
  })
}

export async function createExpense(input: unknown) {
  return run<Expense>(async () => {
    const user = await requireAuth()
    const data = expenseSchema.parse(input)
    const [row] = await db
      .insert(expenses)
      .values({
        category: data.category,
        description: data.description ?? null,
        amount: data.amount,
        spent_on: data.spent_on,
        created_by: user.id
      })
      .returning()
    return row
  })
}

export async function deleteExpense(id: number) {
  return run<boolean>(async () => {
    await requireAdmin()
    await db.delete(expenses).where(eq(expenses.id, id))
    return true
  })
}
