import { supabase, isSupabaseConfigured } from '../db/supabase';

export const REPUTATION_THRESHOLD = 0.3;
const VALIDATION_BOOST = 0.1;
const CONTRADICTION_PENALTY = 0.3;

export async function checkReputation(userId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 1.0;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('reputation_score')
      .eq('user_id', userId)
      .single();

    if (error || !data) return 1.0;
    return data.reputation_score;
  } catch {
    return 1.0;
  }
}

export async function applyValidation(
  reportId: string,
  validatorId: string,
  verdict: 'safe' | 'unsafe'
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('author_id, validation_count, status')
      .eq('report_id', reportId)
      .single();

    if (reportError || !report) throw new Error('Report not found');
    if (report.status === 'Shadowbanned') return;

    const authorId = report.author_id;

    if (verdict === 'unsafe') {
      await supabase
        .from('reports')
        .update({ validation_count: report.validation_count + 1 })
        .eq('report_id', reportId);

      if (authorId) {
        await adjustReputation(authorId, VALIDATION_BOOST);
      }
    } else {
      if (authorId) {
        await adjustReputation(authorId, -CONTRADICTION_PENALTY);
      }

      if (report.validation_count <= 0) {
        await supabase
          .from('reports')
          .update({ status: 'Resolved' })
          .eq('report_id', reportId);
      }
    }

    await supabase.rpc('increment_validated', { uid: validatorId }).maybeSingle();
  } catch (err) {
    console.error('applyValidation error:', err);
  }
}

async function adjustReputation(userId: string, delta: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data: user } = await supabase
      .from('users')
      .select('reputation_score')
      .eq('user_id', userId)
      .single();

    if (!user) return;

    const newScore = Math.max(0, Math.min(1, user.reputation_score + delta));

    await supabase
      .from('users')
      .update({ reputation_score: newScore })
      .eq('user_id', userId);
  } catch (err) {
    console.error('adjustReputation error:', err);
  }
}
