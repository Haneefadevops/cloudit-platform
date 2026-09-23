/**
 * Chat phase polling acceptance tests: lifecycle, gating and the
 * never-throws interval loop (all offline, synthetic, deterministic).
 */
import { commandUpdate, flush, makeHarness, REPLY_TEXT, CHAT_ID } from './helpers';

describe('TelegramPollingService - lifecycle and gating', () => {
  it('makes no network calls when the commands kill switch is off (inert)', async () => {
    const { service, botApi, timers } = makeHarness({ commandsEnabled: false });

    service.onModuleInit();
    expect(timers.isScheduled()).toBe(true);
    timers.fire();
    await flush();

    expect(botApi.getUpdatesMock).not.toHaveBeenCalled();
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();
    await expect(service.cycle()).resolves.toEqual({ status: 'INERT' });
    expect(botApi.getUpdatesMock).not.toHaveBeenCalled();
  });

  it('makes no network calls when the bot token is absent (inert)', async () => {
    const { service, botApi } = makeHarness({ botToken: undefined });

    await expect(service.cycle()).resolves.toEqual({ status: 'INERT' });
    expect(botApi.getUpdatesMock).not.toHaveBeenCalled();
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();
  });

  it('checks the gate at the start of every cycle, not just the first', async () => {
    const { service, botApi, timers } = makeHarness({ commandsEnabled: false });
    service.onModuleInit();

    for (let i = 0; i < 3; i += 1) {
      timers.fire();
      await flush();
    }

    expect(botApi.getUpdatesMock).not.toHaveBeenCalled();
    botApi.queueUpdates([commandUpdate(10)]);
    timers.fire();
    await flush();
    // Still gated: the queued update must never be fetched or sent.
    expect(botApi.getUpdatesMock).not.toHaveBeenCalled();
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();
  });

  it('starts the interval at the configured intervalMs on module init', () => {
    const { service, timers } = makeHarness({ intervalMs: 5_000 });

    service.onModuleInit();

    expect(timers.isScheduled()).toBe(true);
    expect(timers.scheduledMs()).toBe(5_000);
  });

  it('does not schedule a second interval on repeated module init', () => {
    const { service, timers } = makeHarness();

    service.onModuleInit();
    service.onModuleInit();

    expect(timers.isScheduled()).toBe(true);
  });

  it('runs a full cycle from the interval loop: update in, pipeline, reply out', async () => {
    const { service, botApi, timers, commandHandler } = makeHarness();
    service.onModuleInit();
    botApi.queueUpdates([commandUpdate(41)]);

    timers.fire();
    await flush();

    expect(botApi.getUpdatesMock).toHaveBeenCalledWith(0);
    expect(commandHandler.execute).toHaveBeenCalledTimes(1);
    expect(botApi.sendMessageMock).toHaveBeenCalledWith(CHAT_ID, REPLY_TEXT);
    expect(service.getOffset()).toBe(42);
  });

  it('never overlaps cycles: an in-flight cycle suppresses concurrent ticks', async () => {
    const { service, botApi } = makeHarness();
    const gate = botApi.holdNextGetUpdates();

    const first = service.cycle();
    await flush();
    await expect(service.cycle()).resolves.toEqual({
      status: 'SUPPRESSED',
      reason: 'CYCLE_IN_FLIGHT',
    });

    gate.resolve([]);
    await first;
  });

  it('onModuleDestroy clears the interval and awaits the in-flight cycle', async () => {
    const { service, botApi, timers } = makeHarness();
    service.onModuleInit();
    const gate = botApi.holdNextGetUpdates();
    botApi.queueUpdates([commandUpdate(77)]);

    timers.fire();
    await flush();
    expect(botApi.getUpdatesMock).toHaveBeenCalledTimes(1);

    const destroyPending = service.onModuleDestroy();
    await flush();
    // The held cycle is still in flight; destroy must wait for it.
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();

    gate.resolve([commandUpdate(77)]);
    await destroyPending;

    expect(timers.clearedHandles).toEqual(['timer-handle-1']);
    expect(timers.isScheduled()).toBe(false);
    expect(botApi.sendMessageMock).toHaveBeenCalledWith(CHAT_ID, REPLY_TEXT);
    expect(service.getOffset()).toBe(78);
    expect(() => timers.fire()).toThrow('no interval scheduled');
  });

  it('destroy without an in-flight cycle resolves immediately', async () => {
    const { service, timers } = makeHarness();
    service.onModuleInit();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(timers.clearedHandles).toEqual(['timer-handle-1']);
  });
});
