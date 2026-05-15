import "server-only"
import DodoPayments from "dodopayments"
import { env } from "@/lib/env"

export function getDodo(): DodoPayments {
  return new DodoPayments({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    environment: env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT,
  })
}

export type CheckoutInput = {
  userId: string
  email: string
  name?: string
  existingCustomerId: string | null
}

export async function createCheckoutSession(input: CheckoutInput): Promise<{
  checkoutUrl: string
  customerId: string
}> {
  const dodo = getDodo()

  let customerId = input.existingCustomerId
  if (!customerId) {
    const customer = await dodo.customers.create({
      email: input.email,
      name: input.name ?? input.email,
    })
    // SDK returns Customer with `customer_id` (not `id`).
    customerId = customer.customer_id
  }

  const productId = env.DODO_PRO_PRODUCT_ID
  if (!productId) {
    throw new Error("DODO_PRO_PRODUCT_ID is not configured")
  }

  const session = await dodo.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { customer_id: customerId },
    return_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?status=success`,
    metadata: { user_id: input.userId },
  })

  if (!session.checkout_url) {
    throw new Error("Dodo Payments did not return a checkout URL")
  }

  return { checkoutUrl: session.checkout_url, customerId }
}

export async function createPortalUrl(customerId: string): Promise<string> {
  const dodo = getDodo()
  // SDK exposes the customer portal under `customers.customerPortal.create`
  // and returns `{ link: string }` (not `{ url: string }`).
  const portal = await dodo.customers.customerPortal.create(customerId, {
    return_url: `${env.NEXT_PUBLIC_APP_URL}/account/billing`,
  })
  return portal.link
}
