import { OrderActionsService } from './order-actions.service';

const CLIENT = {
  id: 'client-1',
  name: 'Test Restaurant',
  deliveryEnabled: true,
  pickupEnabled: true,
  paymentInstructions: 'Pay at counter or bank transfer',
};
const CUSTOMER = { id: 'cust-1', name: 'Kasun', phoneNumber: '+94771234567' };

const KOTTU = {
  id: 'p1',
  name: 'Chicken Kottu',
  price: 850,
  available: true,
  active: true,
  options: [
    { name: 'Chicken', priceDelta: 0 },
    { name: 'Beef', priceDelta: 100 },
  ],
};
const JUICE = {
  id: 'p2',
  name: 'Lime Juice',
  price: 300,
  available: false, // sold out
  active: true,
  options: [],
};

/** Minimal stateful Prisma mock: orders + items live in memory per test. */
function makePrisma(products = [KOTTU, JUICE]) {
  const state: {
    order: Record<string, any> | null;
    items: Array<Record<string, any>>;
  } = { order: null, items: [] };

  const withItems = (order: Record<string, any> | null) =>
    order && {
      ...order,
      items: state.items.map((i) => ({
        ...i,
        product: products.find((p) => p.id === i.productId),
      })),
    };

  const prisma = {
    product: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where?.OR) {
          const ref = where.OR[0]?.id;
          return Promise.resolve(
            products.find(
              (p) =>
                p.id === ref || p.name.toLowerCase() === String(ref).toLowerCase(),
            ) ?? null,
          );
        }
        const contains = String(where?.name?.contains ?? '').toLowerCase();
        return Promise.resolve(
          products.find((p) => p.name.toLowerCase().includes(contains)) ?? null,
        );
      }),
      findMany: jest.fn().mockResolvedValue(products),
    },
    order: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (!state.order) return Promise.resolve(null);
        if (where?.status === 'draft' && state.order.status !== 'draft') {
          return Promise.resolve(null);
        }
        if (where?.status?.notIn?.includes(state.order.status)) {
          return Promise.resolve(null);
        }
        if (where?.status?.in && !where.status.in.includes(state.order.status)) {
          return Promise.resolve(null);
        }
        return Promise.resolve(withItems(state.order));
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        state.order = {
          id: 'order-1',
          type: 'pickup',
          total: 0,
          address: null,
          customerName: null,
          phone: null,
          notes: null,
          ...data,
        };
        return Promise.resolve(withItems(state.order));
      }),
      update: jest.fn().mockImplementation(({ data }) => {
        state.order = { ...state.order, ...data };
        return Promise.resolve(withItems(state.order));
      }),
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(() => Promise.resolve(withItems(state.order))),
    },
    orderItem: {
      create: jest.fn().mockImplementation(({ data }) => {
        const item = { id: `item-${state.items.length + 1}`, ...data };
        state.items.push(item);
        return Promise.resolve(item);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const item = state.items.find((i) => i.id === where.id);
        Object.assign(item, data);
        return Promise.resolve(item);
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        state.items = state.items.filter((i) => i.id !== where.id);
        return Promise.resolve({});
      }),
    },
  };
  return { prisma: prisma as never, state };
}

function ctxFor(client: Partial<typeof CLIENT> = {}) {
  return {
    client: { ...CLIENT, ...client },
    customer: CUSTOMER,
    conversationId: 'conv-1',
  };
}

describe('OrderActionsService', () => {
  it('add_items creates a draft with real prices and computes the total', async () => {
    const { prisma } = makePrisma();
    const service = new OrderActionsService(prisma);
    const result = await service.execute({
      ...ctxFor(),
      action: {
        type: 'add_items',
        items: [
          { product: 'Chicken Kottu', quantity: 2, options: ['Beef'] },
          { product: 'Lime Juice', quantity: 1 },
        ],
      },
    });

    // Beef delta (+100) on top of the 850 base, lime juice is unavailable.
    expect(result.summary).toContain('2× Chicken Kottu (Beef)');
    expect(result.summary).toContain('currently unavailable');
    expect(result.summary).toContain('1,900'); // 2 × (850 + 100)
    expect(result.orderId).toBe('order-1');
  });

  it('add_items reports unknown products and unknown options', async () => {
    const { prisma } = makePrisma();
    const service = new OrderActionsService(prisma);
    const result = await service.execute({
      ...ctxFor(),
      action: {
        type: 'add_items',
        items: [
          { product: 'Spaceship Burger', quantity: 1 },
          { product: 'Chicken Kottu', quantity: 1, options: ['Gold flakes'] },
        ],
      },
    });

    expect(result.summary).toContain('"Spaceship Burger" is not on the menu');
    expect(result.summary).toContain('no option(s): Gold flakes');
    // The kottu itself was still added at the real base price.
    expect(result.summary).toContain('850');
  });

  it('remove_items reduces quantity and recomputes the total', async () => {
    const { prisma } = makePrisma();
    const service = new OrderActionsService(prisma);
    await service.execute({
      ...ctxFor(),
      action: {
        type: 'add_items',
        items: [{ product: 'Chicken Kottu', quantity: 3 }],
      },
    });
    const result = await service.execute({
      ...ctxFor(),
      action: {
        type: 'remove_items',
        items: [{ product: 'Chicken Kottu', quantity: 1 }],
      },
    });

    expect(result.summary).toContain('Removed: 1× Chicken Kottu');
    expect(result.summary).toContain('1,700'); // 2 × 850
  });

  it('set_order_details captures delivery details and moves to pending', async () => {
    const { prisma, state } = makePrisma();
    const service = new OrderActionsService(prisma);
    await service.execute({
      ...ctxFor(),
      action: { type: 'add_items', items: [{ product: 'Chicken Kottu', quantity: 1 }] },
    });
    const result = await service.execute({
      ...ctxFor(),
      action: {
        type: 'set_order_details',
        orderType: 'delivery',
        address: '45 Galle Road, Colombo 3',
      },
    });

    expect(state.order?.status).toBe('pending');
    expect(state.order?.type).toBe('delivery');
    expect(state.order?.address).toBe('45 Galle Road, Colombo 3');
    expect(result.summary).toContain('pending');
  });

  it('set_order_details refuses delivery when the business has it disabled', async () => {
    const { prisma, state } = makePrisma();
    const service = new OrderActionsService(prisma);
    await service.execute({
      ...ctxFor({ deliveryEnabled: false }),
      action: { type: 'add_items', items: [{ product: 'Chicken Kottu', quantity: 1 }] },
    });
    const result = await service.execute({
      ...ctxFor({ deliveryEnabled: false }),
      action: { type: 'set_order_details', orderType: 'delivery' },
    });

    expect(result.summary).toContain('delivery is not available');
    expect(state.order?.type).toBe('pickup');
  });

  it('confirm_order confirms with a real total and staff notification', async () => {
    const { prisma } = makePrisma();
    const service = new OrderActionsService(prisma);
    const ctx = ctxFor();
    await service.execute({
      ...ctx,
      action: { type: 'add_items', items: [{ product: 'Chicken Kottu', quantity: 2 }] },
    });
    await service.execute({
      ...ctx,
      action: {
        type: 'set_order_details',
        orderType: 'delivery',
        address: '45 Galle Road',
      },
    });
    const result = await service.execute({
      ...ctx,
      action: { type: 'confirm_order' },
    });

    expect(result.summary).toContain('CONFIRMED');
    expect(result.summary).toContain('1,700');
    expect(result.staffNotification).toContain('45 Galle Road');
    expect(result.staffNotification).toContain('1,700');
    expect(result.staffNotification).toContain('+94771234567');
  });

  it('confirm_order refuses a delivery order without an address', async () => {
    const { prisma, state } = makePrisma();
    const service = new OrderActionsService(prisma);
    const ctx = ctxFor();
    await service.execute({
      ...ctx,
      action: { type: 'add_items', items: [{ product: 'Chicken Kottu', quantity: 1 }] },
    });
    // Force the draft to delivery type without an address.
    state.order = { ...state.order, type: 'delivery', address: null };

    const result = await service.execute({
      ...ctx,
      action: { type: 'confirm_order' },
    });

    expect(result.summary).toContain('NOT confirmed');
    expect(result.summary).toContain('address');
    expect(state.order?.status).toBe('draft');
  });

  it('confirm_order refuses when there are no items', async () => {
    const { prisma } = makePrisma();
    const service = new OrderActionsService(prisma);
    const result = await service.execute({
      ...ctxFor(),
      action: { type: 'confirm_order' },
    });
    expect(result.summary).toContain('NOT placed');
  });

  it('check_order_status reports the real status', async () => {
    const { prisma, state } = makePrisma();
    const service = new OrderActionsService(prisma);
    state.order = {
      id: 'order-9',
      status: 'preparing',
      type: 'pickup',
      total: 850,
      address: null,
    };
    state.items.push({
      id: 'item-1',
      orderId: 'order-9',
      productId: 'p1',
      quantity: 1,
      unitPrice: 850,
      selectedOptions: [],
    });

    const result = await service.execute({
      ...ctxFor(),
      action: { type: 'check_order_status' },
    });
    expect(result.summary).toContain('preparing');
    expect(result.summary).toContain('Chicken Kottu');
  });

  it('cancel_order cancels an active order and notifies staff', async () => {
    const { prisma, state } = makePrisma();
    const service = new OrderActionsService(prisma);
    const ctx = ctxFor();
    await service.execute({
      ...ctx,
      action: { type: 'add_items', items: [{ product: 'Chicken Kottu', quantity: 1 }] },
    });
    const result = await service.execute({
      ...ctx,
      action: { type: 'cancel_order' },
    });

    expect(state.order?.status).toBe('cancelled');
    expect(result.summary).toContain('CANCELLED');
    expect(result.staffNotification).toContain('cancelled');
  });

  it('cancel_order does nothing for orders already being prepared', async () => {
    const { prisma, state } = makePrisma();
    const service = new OrderActionsService(prisma);
    state.order = { id: 'order-9', status: 'preparing', type: 'pickup', total: 0 };

    const result = await service.execute({
      ...ctxFor(),
      action: { type: 'cancel_order' },
    });

    expect(state.order?.status).toBe('preparing');
    expect(result.summary).toContain('Nothing was cancelled');
  });

  it('copies unitPrice at order time so later price changes keep history', async () => {
    const { prisma, state } = makePrisma();
    const service = new OrderActionsService(prisma);
    await service.execute({
      ...ctxFor(),
      action: { type: 'add_items', items: [{ product: 'Chicken Kottu', quantity: 1 }] },
    });

    const created = (prisma as any).orderItem.create.mock.calls[0][0].data;
    expect(created.unitPrice).toBe(850); // copied, not referenced
    expect(state.items[0].unitPrice).toBe(850);
  });
});
