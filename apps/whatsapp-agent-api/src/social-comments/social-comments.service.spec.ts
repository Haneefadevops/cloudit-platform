import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SocialCommentsService } from './social-comments.service';

const CLIENT = {
  id: 'client-1',
  name: 'Acme Travels',
  systemPrompt: null,
  businessProfile: {},
  language: 'en',
  aiModel: null,
  facebookPageAccessToken: 'page-token',
};

function setup() {
  const prisma = {
    client: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(CLIENT),
    },
    socialComment: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'comment-1', channel: 'facebook', externalId: 'comment-ext', client: CLIENT,
      }),
      update: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    },
  };
  const ai = {
    generateCommentReply: jest.fn().mockResolvedValue('Thanks for your interest! Message us for details.'),
  };
  return { prisma, ai, service: new SocialCommentsService(prisma as never, ai as never) };
}

const PAGE_PAYLOAD = {
  object: 'page',
  entry: [{
    id: 'page-1',
    changes: [{ field: 'feed', value: {
      item: 'comment', verb: 'add', comment_id: 'fb-comment-1', post_id: 'post-1',
      from: { id: 'person-1', name: 'Ada' }, message: 'Interested',
    } }],
  }],
};

const INSTAGRAM_PAYLOAD = {
  object: 'instagram',
  entry: [{
    id: 'ig-1',
    changes: [{ field: 'comments', value: {
      id: 'ig-comment-1', text: 'Tell me more', media: { id: 'media-1' },
      from: { id: 'person-2', username: 'maya' },
    } }],
  }],
};

describe('SocialCommentsService', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  it('stores a Facebook Page comment for the matching client', async () => {
    const { prisma, service } = setup();
    prisma.client.findFirst.mockResolvedValue(CLIENT);

    await service.ingest(PAGE_PAYLOAD);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { facebookPageId: 'page-1' } });
    expect(prisma.socialComment.create).toHaveBeenCalledWith({
      data: {
        clientId: 'client-1', channel: 'facebook', externalId: 'fb-comment-1', postId: 'post-1',
        authorName: 'Ada', authorId: 'person-1', text: 'Interested',
      },
    });
  });

  it('stores an Instagram comment for the matching client', async () => {
    const { prisma, service } = setup();
    prisma.client.findFirst.mockResolvedValue(CLIENT);

    await service.ingest(INSTAGRAM_PAYLOAD);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { instagramAccountId: 'ig-1' } });
    expect(prisma.socialComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'instagram', externalId: 'ig-comment-1', postId: 'media-1' }),
    });
  });

  it('ignores page-owned comments and non-comment feed events', async () => {
    const { prisma, service } = setup();
    prisma.client.findFirst.mockResolvedValue(CLIENT);

    await service.ingest({
      ...PAGE_PAYLOAD,
      entry: [{ id: 'page-1', changes: [
        { field: 'feed', value: { ...PAGE_PAYLOAD.entry[0].changes[0].value, from: { id: 'page-1' } } },
        { field: 'feed', value: { item: 'post', verb: 'add' } },
      ] }],
    });

    expect(prisma.socialComment.create).not.toHaveBeenCalled();
  });

  it('ignores duplicate delivery without touching the stored comment', async () => {
    const { prisma, ai, service } = setup();
    prisma.client.findFirst.mockResolvedValue(CLIENT);
    prisma.socialComment.findUnique.mockResolvedValue({ id: 'comment-1' });

    await service.ingest(PAGE_PAYLOAD);

    expect(prisma.socialComment.create).not.toHaveBeenCalled();
    expect(ai.generateCommentReply).not.toHaveBeenCalled();
  });

  it('ignores unknown page IDs', async () => {
    const { prisma, service } = setup();
    prisma.client.findFirst.mockResolvedValue(null);

    await service.ingest(PAGE_PAYLOAD);

    expect(prisma.socialComment.create).not.toHaveBeenCalled();
  });

  it('stores an AI draft for a genuinely new comment', async () => {
    const { prisma, ai, service } = setup();
    prisma.client.findFirst.mockResolvedValue(CLIENT);

    await service.ingest(PAGE_PAYLOAD);

    expect(ai.generateCommentReply).toHaveBeenCalledWith(expect.objectContaining({
      commentText: 'Interested',
      authorName: 'Ada',
    }));
    expect(prisma.socialComment.update).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
      data: { aiDraft: 'Thanks for your interest! Message us for details.' },
    });
  });

  it('leaves the comment without a draft when drafting fails', async () => {
    const { prisma, ai, service } = setup();
    prisma.client.findFirst.mockResolvedValue(CLIENT);
    ai.generateCommentReply.mockResolvedValue(null);

    await service.ingest(PAGE_PAYLOAD);

    expect(prisma.socialComment.create).toHaveBeenCalled();
    expect(prisma.socialComment.update).not.toHaveBeenCalled();
  });

  it('marks a comment replied after a successful Graph API post', async () => {
    const { prisma, service } = setup();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await service.reply('client-1', 'comment-1', 'Thanks for asking!');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v18.0/comment-ext/comments',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ message: 'Thanks for asking!' }) }),
    );
    expect(prisma.socialComment.update).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
      data: expect.objectContaining({ status: 'replied', replyText: 'Thanks for asking!', repliedAt: expect.any(Date) }),
    });
  });

  it('leaves a comment pending when the Graph API rejects the reply', async () => {
    const { prisma, service } = setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 400, json: jest.fn().mockResolvedValue({ error: { message: 'Invalid token' } }),
    });

    await expect(service.reply('client-1', 'comment-1', 'Thanks')).rejects.toThrow(
      new BadRequestException('Invalid token'),
    );
    expect(prisma.socialComment.update).not.toHaveBeenCalled();
  });

  it('dismisses and hides comments only within the requested client', async () => {
    const { prisma, service } = setup();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await service.dismiss('client-1', 'comment-1');
    await service.hide('client-1', 'comment-1');

    expect(prisma.socialComment.findFirst).toHaveBeenCalledWith({
      where: { id: 'comment-1', clientId: 'client-1' },
      include: { client: true },
    });
    expect(prisma.socialComment.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'comment-1' }, data: { status: 'dismissed' },
    });
    expect(prisma.socialComment.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'comment-1' }, data: { status: 'hidden' },
    });
  });

  it('rejects a moderation action for another client', async () => {
    const { prisma, service } = setup();
    prisma.socialComment.findFirst.mockResolvedValue(null);

    await expect(service.dismiss('client-2', 'comment-1')).rejects.toThrow(NotFoundException);
    expect(prisma.socialComment.update).not.toHaveBeenCalled();
  });
});
