import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

import { supabase } from './supabase';

async function getStudentStats() {
  const { data: all } = await (supabase.from('students').select as any)('status');
  if (!all) return { total: 0, cleared: 0, pending: 0, queried: 0 };
  return {
    total: all.length,
    cleared: all.filter((s: any) => s.status === 'cleared').length,
    pending: all.filter((s: any) => s.status === 'pending').length,
    queried: all.filter((s: any) => s.status === 'queried').length,
  };
}

async function getRejectionReasons() {
  const { data } = await (supabase.from('student_documents').select as any)(
    'queried_reason, document:documents(name)',
  );
  if (!data) return [];
  const counts: Record<string, number> = {};
  data.forEach((d: any) => {
    const reason = d.queried_reason || d.document?.name || 'Unknown';
    counts[reason] = (counts[reason] || 0) + 1;
  });
  const total = Object.values(counts).reduce((a: number, b: number) => a + b, 0);
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

describe('getStudentStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zeros when no data', async () => {
    (supabase.from('students').select as any).mockResolvedValue({ data: null });
    const stats = await getStudentStats();
    expect(stats).toEqual({ total: 0, cleared: 0, pending: 0, queried: 0 });
  });

  it('counts statuses correctly', async () => {
    (supabase.from('students').select as any).mockResolvedValue({
      data: [
        { status: 'cleared' },
        { status: 'pending' },
        { status: 'cleared' },
        { status: 'queried' },
        { status: 'pending' },
      ],
    });
    const stats = await getStudentStats();
    expect(stats).toEqual({ total: 5, cleared: 2, pending: 2, queried: 1 });
  });
});

describe('getRejectionReasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns top 5 rejection reasons with percentages', async () => {
    (supabase.from('student_documents').select as any).mockResolvedValue({
      data: [
        { queried_reason: 'Blurry passport', document: { name: 'Passport' } },
        { queried_reason: 'Blurry passport', document: { name: 'Passport' } },
        { queried_reason: 'Wrong format', document: { name: 'O-Level' } },
        { queried_reason: 'Illegible', document: { name: 'Birth Cert' } },
      ],
    });
    const reasons = await getRejectionReasons();
    expect(reasons).toHaveLength(3);
    expect(reasons[0]).toEqual({ reason: 'Blurry passport', count: 2, percent: 50 });
    expect(reasons[1].reason).toBe('Wrong format');
    expect(reasons[2].reason).toBe('Illegible');
  });

  it('falls back to document name when queried_reason is null', async () => {
    (supabase.from('student_documents').select as any).mockResolvedValue({
      data: [
        { queried_reason: null, document: { name: 'Passport' } },
      ],
    });
    const reasons = await getRejectionReasons();
    expect(reasons[0].reason).toBe('Passport');
  });

  it('returns empty array when no data', async () => {
    (supabase.from('student_documents').select as any).mockResolvedValue({ data: null });
    const reasons = await getRejectionReasons();
    expect(reasons).toEqual([]);
  });
});
