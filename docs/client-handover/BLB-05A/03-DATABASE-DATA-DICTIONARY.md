# Database Data Dictionary

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Status:** Static Mongoose-schema reference; not a production database export  
**Prepared:** 2026-11-26  
**Evidence:** Model source files on `fix/api-product-data-access`

## Scope and limitations

This document describes fields and constraints visible in the Mongoose models. It does not confirm that production collections, indexes, data, or migrations match the code. Mongoose timestamps are enabled on the models noted below. Fields marked optional may be absent in older documents. Do not run index creation, migrations, cleanup, or schema changes against production without a reviewed migration plan and backup.

## Collections

### `products` — Product

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `name` | String | Required | Display name; trimmed. |
| `slug` | String | Required, unique | URL slug; trimmed, lowercase. |
| `description` | String | Required | Product description; trimmed. |
| `price` | Number | Required | Must be greater than zero. |
| `category` | String | Required | Product category. |
| `images` | String[] | `[]` | Image URLs/identifiers as stored by application. |
| `stock` | Number | 0 | Minimum 0; internal inventory quantity. |
| `availability` | String | `AVAILABLE` | Enum: `AVAILABLE`, `OUT_OF_STOCK`, `DISABLED`. |
| `preparationTime` | Number | Required | Minimum 0. |
| `active` | Boolean | true | Product active flag. |
| `cost` | Number | Optional | Minimum 0; optional cost basis for profitability. |
| `reorderLevel` | Number | Optional | Minimum 0; inventory threshold. |
| `leadTimeDays` | Number | Optional | Minimum 0; replenishment lead time. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Created/updated times. |

Schema indexes: `active`, `category`; `slug` is unique. Public product API projection intentionally excludes internal inventory/cost fields; see API route inventory.

### `orders` — Order

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `orderNumber` | String | Required, unique | Customer-facing order reference. |
| `userId` | ObjectId → User | Optional | Linked customer account. |
| `customCakeRequestId` | ObjectId → CustomCakeRequest | Optional, unique+sparse | Links converted custom-cake request; production index preflight is explicitly documented in schema. |
| `idempotencyKey` | String | Optional, unique+sparse | Idempotent creation key. |
| `idempotencyHash` | String | Optional, select:false | Internal idempotency hash. |
| `inventoryStatus` | Enum | Optional | `RESERVED`, `COMMITTED`, `RELEASED`. |
| `reservationExpiresAt` | Date | Optional | Inventory reservation expiry; indexed. |
| `reconciliationStatus` | Enum | `NONE` | `NONE` or `REVIEW_REQUIRED`. |
| `reconciliationReason` | String | Optional | Reconciliation explanation. |
| `customer` | Object | Optional | Embedded name, email (lowercase), phone. |
| `customerName` | String | Required | Customer name. |
| `phone` | String | Required | Contact phone; indexed. |
| `fulfillmentType` | Enum | Required | `DELIVERY` or `PICKUP`. |
| `address` | Object | Optional | `addressLine`, `city`, `pincode`. |
| `scheduledDate`, `scheduledTime` | String | Required | Requested fulfilment date/time. |
| `requestedSlot`, `confirmedSlot` | Date | Optional | Requested and confirmed slot timestamps. |
| `proposedSlot` | Object | Optional | Proposed time, note, admin, timestamp, status, expiry. |
| `rescheduleProposals` | Object[] | `[]` | Proposal history including proposal ID, slots, reason, admin, status, customer response and notification retry metadata. |
| `slotHistory` | Object[] | Optional | Previous/next slot, reason, actor, timestamp. |
| `reschedulePreviousStatus` | Enum | Optional | Prior order status before reschedule flow. |
| `paymentMethod` | Enum | Required | `COD`, `ONLINE`, `PAY_AT_STORE`. |
| `paymentStatus` | Enum | `PENDING` | `PENDING`, `PAID`, `FAILED`. |
| `razorpayOrderId`, `razorpayPaymentId` | String | Optional | Provider identifiers. |
| `razorpayOrderIds`, `razorpayPaymentIds` | String[] | `[]` | Provider identifier history. |
| `paidAt` | Date | Optional | Payment timestamp. |
| `paidBy` | ObjectId → Admin | Optional | Admin who marked payment paid. |
| `orderStatus` | Enum | `PLACED` | `PLACED`, `PAYMENT_CONFIRMED`, `CONFIRMED`, `PREPARING`, `READY`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `COLLECTED`, `CANCELLED`, `RESCHEDULE_PROPOSED`. |
| `items` | Object[] | Required, at least one | Item fields below. |
| `subtotal` | Number | Required, min 0 | Items subtotal. |
| `deliveryFee` | Number | 0, min 0 | Delivery fee. |
| `totalAmount` | Number | Required, min 0 | Order total. |
| `razorpaySettlementId` | String | Optional | Settlement reference. |
| `razorpayFee`, `taxAmount` | Number | Optional, min 0 | Financial reconciliation fields. |
| `readyAt`, `dispatchedAt`, `deliveredAt` | Date | Optional | Fulfilment lifecycle timestamps. |
| `acquisitionSource` | String | Optional, max 100 | Attribution source. |
| `isArchived` | Boolean | false | Soft-archive flag; indexed. |
| `archivedAt` | Date | Optional | Archive timestamp. |
| `archivedBy` | ObjectId → Admin | Optional | Admin who archived. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Created/updated times. |

Order item fields: `productId` (optional Product reference), `productName` (required), `variantId` (required), `quantity` (required, min 1), `unitPrice`, `itemTotal`, `totalPrice` (required, min 0), and optional `costSnapshot` (min 0). `productId` may be absent for custom cake orders.

Schema indexes include `userId`, `customCakeRequestId` (unique+sparse), `idempotencyKey` (unique+sparse), `reservationExpiresAt`, `razorpayOrderIds`, `isArchived`, and compound/single indexes on `createdAt`, `phone`, `paymentStatus`, and `orderStatus`.

### `users` — User

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `name` | String | Required | Customer name; trimmed. |
| `email` | String | Optional, unique+sparse | Lowercase, trimmed. |
| `phone` | String | Optional | Trimmed. |
| `passwordHash` | String | Optional, select:false | Password hash; never expose. |
| `googleId` | String | Optional, unique+sparse | Google identity subject. |
| `emailVerified` | Boolean | false | Email verification state. |
| `active` | Boolean | true | Account active flag. |
| `tokenVersion` | Number | 0, select:false | Session invalidation/version field. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Created/updated times. |

### `admins` — Admin

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `username` | String | Required, unique | Admin username; trimmed. |
| `password` | String | Required, select:false | Admin password hash/credential field; never expose. |
| `role` | Enum | `ADMIN` | Currently only `ADMIN`. |
| `tokenVersion` | Number | 0 | Session invalidation/version field. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Created/updated times. |

### `customcakerequests` — CustomCakeRequest

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `referenceNumber` | String | Required, unique | Request reference. |
| `name`, `phone` | String | Required | Requester details. |
| `userId` | ObjectId → User | null, indexed | Optional account link for authenticated customer submissions; null/absent for guest and legacy requests. Linked requests are owned by account ID, not phone-number matching. |
| `flavour`, `weight`, `theme` | String | Required | Cake requirements. |
| `messageOnCake`, `instructions`, `referenceImageUrl` | String | Empty string | Optional customer details/reference. |
| `status` | Enum | `PENDING` | `PENDING`, `CONTACTED`, `CONFIRMED`, `CLOSED`. |
| `proposedPrice` | Number | null, min 0 | Admin quote. |
| `proposedDeliveryDate`, `proposedDeliveryTime` | String | null | Proposed fulfilment. |
| `adminNotes` | String | null, max 1000 | Internal notes. |
| `customerConfirmed` | Enum | `PENDING` | `PENDING`, `CONFIRMED`, `DECLINED`. |
| `customerConfirmedAt`, `adminContactedAt` | Date | null | Workflow timestamps. |
| `convertedOrderId` | ObjectId → Order | null | Converted order link. |
| `convertedAt` | Date | null | Conversion timestamp. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Created/updated times. |

### `settings` — Settings

Singleton model (the application helper returns an existing record or creates defaults).

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `onlineOrdersEnabled` | Boolean | true | Online ordering toggle. |
| `deliveryEnabled` | Boolean | true | Delivery toggle. |
| `pickupEnabled` | Boolean | true | Pickup toggle. |
| `closedMessage` | String | Default customer-facing closure message | Trimmed. |
| `reopenAt` | Date | null | Optional reopen timestamp. |
| `codMaxAmount` | Number | null, min 0 | Optional COD maximum. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Created/updated times. |

### `inventorymovements` — InventoryMovement

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `productId` | ObjectId → Product | Required, indexed | Affected product. |
| `quantityChange` | Number | Required | Quantity delta. |
| `previousStock`, `newStock` | Number | Required, min 0 | Before/after stock values. |
| `reason` | Enum | Required | `ORDER_RESERVATION`, `ORDER_RESTORE`, `ORDER_COMMIT`, `MANUAL_ADJUSTMENT`, `RESTOCK`, `EXPIRY_RELEASE`. |
| `adjustmentReason` | String | Optional, max 200 | Human-readable manual adjustment reason. |
| `relatedOrderId` | ObjectId → Order | Optional, indexed | Related order. |
| `relatedUserId` | ObjectId → User | Optional, indexed | Related user. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Movement timestamps. |

Compound index: `productId + createdAt descending`.

### `whatsappconsents` — WhatsAppConsent

| Field | Type | Required / default | Purpose / constraints |
|---|---|---|---|
| `phone` | String | Required, unique, indexed | Consent subject identifier. |
| `status` | Enum | `GRANTED` | Legacy transactional status: `GRANTED`, `DENIED`, `WITHDRAWN`. |
| `source`, `consentText` | String | Optional | Transactional consent provenance/text. |
| `consentTimestamp`, `optOutTimestamp` | Date | Optional | Transactional consent/withdrawal times. |
| `withdrawalReason` | String | Optional | Transactional withdrawal reason. |
| `withdrawalHistory` | Object[] | `[]` | Reason, withdrawnAt, source. |
| `marketingStatus` | Enum | `DENIED` | Independent marketing status; explicit opt-in required. |
| `marketingSource`, `marketingConsentText` | String | Optional | Marketing provenance/text. |
| `marketingConsentTimestamp`, `marketingOptOutTimestamp` | Date | Optional | Marketing consent/withdrawal times. |
| `marketingWithdrawalReason` | String | Optional | Marketing withdrawal reason. |
| `marketingWithdrawalHistory` | Object[] | `[]` | Marketing withdrawal history. |
| `consentHistory` | Object[] | `[]` | Category, action, reason, source, occurredAt. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps | Record timestamps. |

Consent categories: `TRANSACTIONAL`, `MARKETING`. History actions: `GRANT`, `WITHDRAW`, `DENY`. Legacy transactional consent does not imply marketing consent.

## Data handling and migration controls

- Treat customer names, email addresses, phone numbers, delivery addresses, order contents, admin notes, and consent history as personal/confidential business data.
- Never export or publish password fields, password hashes, JWTs, OTPs, payment secrets, webhook secrets, or internal credentials.
- Use least-privilege access and approved retention/deletion rules. Those policies are not established by this schema document.
- Before production schema/index changes, inspect actual deployed indexes and data, check duplicates/null compatibility, prepare a reversible migration, and obtain owner approval.
- The Order model explicitly warns that the unique+sparse `customCakeRequestId` index requires a production preflight; do not assume it is safely deployed.
- This inventory does not include every model in the repository; it covers the core commerce, identity, settings, inventory, and WhatsApp-consent models inspected for handover.

## Source files

- `backend/src/models/Product.ts`
- `backend/src/models/Order.ts`
- `backend/src/models/User.ts`
- `backend/src/models/Admin.ts`
- `backend/src/models/CustomCakeRequest.ts`
- `backend/src/models/Settings.ts`
- `backend/src/models/InventoryMovement.ts`
- `backend/src/models/WhatsAppConsent.ts`
